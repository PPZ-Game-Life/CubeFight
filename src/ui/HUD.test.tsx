import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildNoMoveBoardWithRed, buildPlayableDemoConfig } from '../game/config/playableDemo'
import type { CubeData, Locale, PlayableDemoConfig } from '../game/model/types'
import { createGameStore, GameStoreContext, type GameStore } from '../game/state/gameStore'
import { LocaleProvider } from './LocaleProvider'
import { HUD } from './HUD'

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
} = {}) {
  const locale = options.locale ?? 'en'
  const store = options.store ?? createGameStore({ config: options.config })

  vi.stubGlobal('navigator', { language: locale })

  return {
    store,
    ...render(
        <LocaleProvider>
          <GameStoreContext.Provider value={store}>
            <HUD onBackToLobby={options.onBackToLobby ?? (() => undefined)} />
          </GameStoreContext.Provider>
        </LocaleProvider>
    )
  }
}

afterEach(() => {
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
    expect(screen.getByText('Bombs')).toBeInTheDocument()
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

  it('keeps the zero-bomb control visually disabled while surfacing the noBombs hint on click', () => {
    const config = buildConfig([
      cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', x: 0, y: 1, z: 0 })
    ], 0)
    config.ui.showCombo = false
    config.ui.showPause = false

    const store = createGameStore({ config })

    renderWithGameProviders({ store })

    const bombButton = screen.getByRole('button', { name: 'Bombs' })

    expect(bombButton).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(bombButton)

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
    expect(screen.getByText('炸弹')).toBeInTheDocument()

    expect(screen.getByRole('dialog', { name: '胜利' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新开始' })).toBeInTheDocument()
  })

  it('renders the revamped stat bar and bomb dock landmarks', () => {
    renderWithGameProviders()

    expect(screen.getByTestId('hud-stat-bar')).toBeInTheDocument()
    expect(screen.getByTestId('hud-score-hero')).toBeInTheDocument()
    expect(screen.getByTestId('hud-lobby-button')).toBeInTheDocument()
    expect(screen.getByTestId('hud-bomb-dock')).toBeInTheDocument()
    expect(screen.getByTestId('hud-bottom-row')).toBeInTheDocument()
    expect(screen.queryByLabelText('Hammer')).not.toBeInTheDocument()
  })

  it('routes the lobby button to the supplied callback', () => {
    const onBackToLobby = vi.fn()

    renderWithGameProviders({ onBackToLobby })

    fireEvent.click(screen.getByTestId('hud-lobby-button'))

    expect(onBackToLobby).toHaveBeenCalledTimes(1)
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
    expect(bottomRow).toHaveStyle({ justifyContent: 'flex-end' })
  })

  it('renders the lobby control as a compact top-corner icon button', () => {
    renderWithGameProviders()

    const lobbyButton = screen.getByTestId('hud-lobby-button')

    expect(lobbyButton).toHaveAccessibleName('Lobby')
    expect(lobbyButton).toHaveTextContent('⌂')
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
