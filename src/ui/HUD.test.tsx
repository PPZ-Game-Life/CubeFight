import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { audioManager } from '../audio/audioManager'
import { buildNoMoveBoardWithRed, buildPlayableDemoConfig } from '../game/config/playableDemo'
import type { CubeData, Locale, PlayableDemoConfig } from '../game/model/types'
import { createGameStore, GameStoreContext, type GameStore } from '../game/state/gameStore'
import { LocaleProvider } from './LocaleProvider'
import { getFpsColor, HUD } from './HUD'

function cube(overrides: Partial<CubeData> & Pick<CubeData, 'id' | 'color'>): CubeData {
  return {
    id: overrides.id,
    color: overrides.color,
    level: overrides.level ?? 1,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    z: overrides.z ?? 0
  }
}

function buildConfig(cubes: CubeData[], bombCount = 1): PlayableDemoConfig {
  const config = buildPlayableDemoConfig()
  config.board.cubes = cubes.map((item) => ({ ...item }))
  config.inventory.bombCount = bombCount
  return config
}

function renderWithGameProviders(options: {
  locale?: Locale
  store?: GameStore
  config?: PlayableDemoConfig
  onBackToLobby?: () => void
  levelInfo?: React.ComponentProps<typeof HUD>['levelInfo']
  showEndlessDiagnostics?: boolean
  showFps?: boolean
} = {}) {
  const locale = options.locale ?? 'en'
  const store = options.store ?? createGameStore({ config: options.config })

  vi.stubGlobal('navigator', { language: locale })

  return {
    store,
    ...render(
        <LocaleProvider>
          <GameStoreContext.Provider value={store}>
            <HUD levelInfo={options.levelInfo} onBackToLobby={options.onBackToLobby ?? (() => undefined)} showEndlessDiagnostics={options.showEndlessDiagnostics} showFps={options.showFps} />
          </GameStoreContext.Provider>
        </LocaleProvider>
    )
  }
}

afterEach(() => {
  audioManager.setUserMuted(false)
  audioManager.setUserVolume(0.78)
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('HUD', () => {
  it('renders localized score pill, combo callout, and bomb surfaces', () => {
    const store = createGameStore({
      config: buildConfig([
        cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
        cube({ id: 'blue-b', color: 'blue', x: 1, y: 0, z: 0 }),
        cube({ id: 'red-a', color: 'red', x: 2, y: 0, z: 0 })
      ])
    })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('blue-b')

    renderWithGameProviders({ store })

    expect(screen.getByText('Score')).toBeInTheDocument()
    expect(screen.queryByText('Bombs')).not.toBeInTheDocument()
    expect(screen.getByTestId('hud-score-hero')).toBeInTheDocument()
    expect(screen.getByTestId('hud-combo-callout')).toBeInTheDocument()
  })

  it('does not render a pause entry in the revamped in-game hud', () => {
    const store = createGameStore({
      config: buildConfig([
        cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
        cube({ id: 'blue-b', color: 'blue', x: 1, y: 0, z: 0 }),
        cube({ id: 'red-a', color: 'red', x: 2, y: 0, z: 0 })
      ])
    })

    renderWithGameProviders({ store })

    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Paused' })).not.toBeInTheDocument()
  })

  it('renders victory and game-over overlays', () => {
    const victoryStore = createGameStore({
      config: buildConfig([
        cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
        cube({ id: 'red-last', color: 'red', x: 1, y: 0, z: 0 })
      ])
    })
    victoryStore.getState().selectCube('blue-a')
    victoryStore.getState().commitBoardAction('red-last')

    const { unmount } = renderWithGameProviders({ store: victoryStore })
    expect(screen.getByRole('dialog', { name: 'Victory' })).toBeInTheDocument()
    unmount()

    const gameOverStore = createGameStore({
      config: buildConfig(buildNoMoveBoardWithRed(), 0)
    })

    renderWithGameProviders({ store: gameOverStore })
    expect(screen.getByRole('dialog', { name: 'Game Over' })).toBeInTheDocument()
  })

  it('does not render the bomb control while props are disabled', () => {
    const config = buildConfig([
      cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', x: 0, y: 1, z: 0 })
    ], 0)
    config.ui.showCombo = false
    config.ui.showPause = false

    const store = createGameStore({ config })

    renderWithGameProviders({ store })

    expect(screen.queryByRole('button', { name: 'Bombs' })).not.toBeInTheDocument()
    expect(screen.queryByText('Combo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })

  it('renders zh-CN locale labels and end-state overlay actions', () => {
    const store = createGameStore({
      config: buildConfig([
        cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
        cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 }),
        cube({ id: 'yellow-a', color: 'yellow', x: 0, y: 1, z: 0 })
      ])
    })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('red-a')

    renderWithGameProviders({ store, locale: 'zh-CN' })

    expect(screen.getByText('积分')).toBeInTheDocument()
    expect(screen.queryByText('炸弹')).not.toBeInTheDocument()

    expect(screen.getByRole('dialog', { name: '胜利' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新开始' })).toBeInTheDocument()
  })

  it('renders the revamped stat bar and bomb dock landmarks', () => {
    renderWithGameProviders()

    expect(screen.getByTestId('hud-stat-bar')).toBeInTheDocument()
    expect(screen.getByTestId('hud-score-hero')).toBeInTheDocument()
    expect(screen.queryByTestId('hud-fps-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('hud-lobby-button')).toBeInTheDocument()
    expect(screen.getByTestId('hud-audio-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('hud-rules-button')).toBeInTheDocument()
    expect(screen.queryByTestId('hud-bomb-dock')).not.toBeInTheDocument()
    expect(screen.getByTestId('hud-bottom-row')).toBeInTheDocument()
    expect(screen.queryByLabelText('Hammer')).not.toBeInTheDocument()
  })

  it('renders localized fps label in the top-right diagnostics panel when enabled', () => {
    renderWithGameProviders({ locale: 'zh-CN', showFps: true })

    expect(screen.getByTestId('hud-fps-panel')).toHaveTextContent('帧率')
  })

  it('renders endless diagnostics when debug diagnostics are enabled', () => {
    const config = buildPlayableDemoConfig()
    config.board.gridSize = 3
    config.winLoss.victory = 'none'
    config.endless = {
      enabled: true,
      refillDelayMs: 1,
      spawnIntervalSteps: 1,
      redWeight: 20,
      yellowWeight: 20,
      blueWeight: 60
    }
    config.board.cubes = [
      cube({ id: 'blue-main', color: 'blue', level: 3, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-target', color: 'red', level: 1, x: 1, y: 0, z: 0 })
    ]

    const store = createGameStore({ config })
    store.getState().selectCube('blue-main')
    store.getState().commitBoardAction('red-target')

    renderWithGameProviders({ store, showEndlessDiagnostics: true })

    expect(screen.getByTestId('hud-endless-diagnostics-panel')).toHaveTextContent('Endless Debug')
    expect(screen.getByTestId('hud-endless-diagnostics-panel')).toHaveTextContent('Stage')
    expect(screen.getByTestId('hud-endless-diagnostics-panel')).toHaveTextContent('Yellow Pity')
  })

  it('maps fps values to traffic-light colors', () => {
    expect(getFpsColor(29)).toBe('#ff9b9b')
    expect(getFpsColor(30)).toBe('#ffe08a')
    expect(getFpsColor(54)).toBe('#ffe08a')
    expect(getFpsColor(55)).toBe('#b8f3c8')
  })

  it('routes the lobby button to the supplied callback', () => {
    const onBackToLobby = vi.fn()

    renderWithGameProviders({ onBackToLobby })

    fireEvent.click(screen.getByTestId('hud-lobby-button'))

    expect(onBackToLobby).toHaveBeenCalledTimes(1)
  })

  it('renders authored level goals and remaining steps when provided', () => {
    renderWithGameProviders({
      levelInfo: {
        levelLabel: 'Level 03',
        stepsRemaining: 4,
        objectives: [
          { text: 'Devour Lv.1 yellow', complete: false }
        ]
      }
    })

    const panel = screen.getByTestId('hud-level-panel')

    expect(panel).toHaveClass('hud__level-panel')
    expect(panel).toHaveTextContent('Level 03')
    expect(panel).not.toHaveTextContent('Steps: 4')
    expect(panel).toHaveTextContent('Devour Lv.1 yellow')
  })

  it('does not render an empty combo text bubble for x1 chains', () => {
    const store = createGameStore({
      config: buildConfig([
        cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
        cube({ id: 'blue-b', color: 'blue', x: 1, y: 0, z: 0 }),
        cube({ id: 'red-a', color: 'red', x: 2, y: 0, z: 0 })
      ])
    })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('blue-b')

    renderWithGameProviders({ store })

    const comboCallout = screen.getByTestId('hud-combo-callout')

    expect(comboCallout).toHaveTextContent('x1')
    expect(comboCallout.querySelector('.hud__combo-text')).toBeNull()
  })

  it('renders combo callout text in zh-CN without English fallback', () => {
    const store = createGameStore({
      config: buildConfig([
        cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
        cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 }),
        cube({ id: 'blue-b', color: 'blue', x: 0, y: 1, z: 0 }),
        cube({ id: 'yellow-a', color: 'yellow', x: 1, y: 1, z: 0 }),
        cube({ id: 'red-b', color: 'red', x: 2, y: 2, z: 2 })
      ])
    })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('red-a')
    store.getState().selectCube('blue-b')
    store.getState().commitBoardAction('yellow-a')

    renderWithGameProviders({ store, locale: 'zh-CN' })

    const comboCallout = screen.getByTestId('hud-combo-callout')

    expect(comboCallout).toHaveTextContent('x2')
    expect(comboCallout).toHaveTextContent('不错！')
    expect(screen.queryByText('Nice!')).not.toBeInTheDocument()
  })

  it('uses wrapping row layouts so HUD can reflow on narrow screens', () => {
    renderWithGameProviders()

    const overlay = document.getElementById('ui-overlay')
    const topRow = overlay?.querySelector('.hud__stat-bar')
    const bottomRow = overlay?.querySelector('.hud__bottom-row')

    expect(topRow).toHaveStyle({ justifyContent: 'center' })
    expect(bottomRow).toHaveStyle({ justifyContent: 'space-between' })
  })

  it('renders the lobby control as a compact bottom-corner icon button', () => {
    renderWithGameProviders()

    const lobbyButton = screen.getByTestId('hud-lobby-button')

    expect(lobbyButton).toHaveAccessibleName('Lobby')
    expect(lobbyButton).toHaveTextContent('⌂')
  })

  it('toggles global audio from the bottom-corner control', () => {
    renderWithGameProviders()

    const audioButton = screen.getByTestId('hud-audio-toggle')

    expect(audioButton).toHaveAccessibleName('Mute audio')
    expect(audioButton).toHaveTextContent('🔊')

    fireEvent.click(audioButton)

    expect(audioManager.isUserMuted()).toBe(true)
    expect(audioButton).toHaveAccessibleName('Unmute audio')
    expect(audioButton).toHaveTextContent('🔇')

    fireEvent.click(audioButton)

    expect(audioManager.isUserMuted()).toBe(false)
    expect(audioButton).toHaveAccessibleName('Mute audio')
  })

  it('opens game rules from the bottom-corner control', () => {
    renderWithGameProviders()

    const rulesButton = screen.getByTestId('hud-rules-button')

    expect(rulesButton).toHaveAccessibleName('Game Rules')

    fireEvent.click(rulesButton)

    expect(screen.getByTestId('hud-rules-dialog')).toHaveTextContent('Blue cubes')
    expect(screen.getByTestId('hud-rules-dialog')).toHaveTextContent('Endless')
  })

  it('shows a crisis vignette when the board occupancy gets high', () => {
    const denseBoard = Array.from({ length: 19 }, (_, index) => cube({
      id: `cube-${index}`,
      color: index % 3 === 0 ? 'red' : index % 3 === 1 ? 'blue' : 'yellow',
      x: index % 3,
      y: Math.floor(index / 3) % 3,
      z: Math.floor(index / 9)
    }))

    const store = createGameStore({ config: buildConfig(denseBoard, 1) })

    renderWithGameProviders({ store })

    expect(screen.getByTestId('hud-crisis-glow')).toBeInTheDocument()
  })
})
