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
} = {}) {
  const locale = options.locale ?? 'en'
  const store = options.store ?? createGameStore({ config: options.config })

  vi.stubGlobal('navigator', { language: locale })

  return {
    store,
    ...render(
      <LocaleProvider>
        <GameStoreContext.Provider value={store}>
          <HUD />
        </GameStoreContext.Provider>
      </LocaleProvider>
    )
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HUD', () => {
  it('renders localized score, combo, bomb, and status surfaces', () => {
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
    expect(screen.getByText('Combo')).toBeInTheDocument()
    expect(screen.getByText('Bombs')).toBeInTheDocument()
    expect(screen.getByText('Hint')).toBeInTheDocument()
    expect(screen.getByText('Resolving move...')).toBeInTheDocument()
  })

  it('shows a pause overlay and wires resume and restart actions', () => {
    const store = createGameStore({
      config: buildConfig([
        cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
        cube({ id: 'blue-b', color: 'blue', x: 1, y: 0, z: 0 }),
        cube({ id: 'red-a', color: 'red', x: 2, y: 0, z: 0 })
      ])
    })

    renderWithGameProviders({ store })

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))

    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument()
    expect(store.getState().overlay).toBe('pause')

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(store.getState().overlay).toBe('none')

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))

    expect(store.getState().overlay).toBe('none')
    expect(store.getState().runState).toBe('idle')
    expect(store.getState().score).toBe(0)
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

  it('disables the bomb action when inventory is empty and hides optional combo or pause controls from config', () => {
    const config = buildConfig([
      cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', x: 0, y: 1, z: 0 })
    ], 0)
    config.ui.showCombo = false
    config.ui.showPause = false

    const store = createGameStore({ config })

    renderWithGameProviders({ store })

    expect(screen.getByRole('button', { name: 'Bombs' })).toBeDisabled()
    expect(screen.queryByText('Combo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })

  it('renders zh-CN locale labels, hints, and overlay actions', () => {
    const store = createGameStore({
      config: buildConfig([
        cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
        cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 }),
        cube({ id: 'yellow-a', color: 'yellow', x: 0, y: 1, z: 0 })
      ])
    })

    renderWithGameProviders({ store, locale: 'zh-CN' })

    expect(screen.getByText('积分')).toBeInTheDocument()
    expect(screen.getByText('炸弹')).toBeInTheDocument()
    expect(screen.getByText('提示')).toBeInTheDocument()
    expect(screen.getByText('选择一个蓝色方块开始行动。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '暂停' }))

    expect(screen.getByRole('dialog', { name: '已暂停' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新开始' })).toBeInTheDocument()
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

    expect(screen.getByText('x2 不错！')).toBeInTheDocument()
    expect(screen.queryByText('Nice!')).not.toBeInTheDocument()
  })

  it('uses wrapping row layouts so HUD can reflow on narrow screens', () => {
    renderWithGameProviders()

    const overlay = document.getElementById('ui-overlay')
    const topRow = overlay?.children.item(0)
    const bottomRow = overlay?.children.item(1)

    expect(topRow).toHaveStyle({ flexWrap: 'wrap' })
    expect(bottomRow).toHaveStyle({ flexWrap: 'wrap' })
  })
})
