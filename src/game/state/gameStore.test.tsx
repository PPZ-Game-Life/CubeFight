import { describe, expect, it, vi } from 'vitest'

import { buildNoMoveBoardWithRed, buildPlayableDemoConfig } from '../config/playableDemo'
import type { CubeData, PlayableDemoConfig } from '../model/types'
import { createGameStore } from './gameStore'

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

function createStoreConfig(cubes: CubeData[], bombCount = 1): PlayableDemoConfig {
  const config = buildPlayableDemoConfig()
  config.board.cubes = cubes.map((item) => ({ ...item }))
  config.inventory.bombCount = bombCount
  return config
}

function createTestStore() {
  return createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'blue-b', color: 'blue', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', level: 1, x: 0, y: 1, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', level: 1, x: 0, y: 0, z: 1 })
    ])
  })
}

function createHiddenMoveStore() {
  const store = createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'blue-hidden', color: 'blue', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-visible', color: 'red', level: 2, x: 0, y: 1, z: 0 })
    ])
  })

  store.getState().showLayerFromTop(1)
  store.getState().selectCube('blue-a')

  return store
}

function createVictoryReadyStore() {
  const store = createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-last', color: 'red', level: 1, x: 1, y: 0, z: 0 })
    ])
  })

  store.getState().selectCube('blue-a')

  return store
}

function createSliceAwareStore() {
  return createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 2, z: 0 }),
      cube({ id: 'red-top', color: 'red', level: 1, x: 1, y: 2, z: 0 }),
      cube({ id: 'yellow-mid', color: 'yellow', level: 1, x: 1, y: 1, z: 0 })
    ])
  })
}

function createResolvingStore() {
  vi.useFakeTimers()

  const store = createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'blue-b', color: 'blue', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-after', color: 'red', level: 1, x: 2, y: 0, z: 0 })
    ])
  })

  store.getState().selectCube('blue-a')
  store.getState().commitBoardAction('blue-b')

  return store
}

function createNoMoveStore() {
  return createGameStore({
    config: createStoreConfig(buildNoMoveBoardWithRed(), 0)
  })
}

describe('gameStore selection states', () => {
  it('moves from idle to selected when selecting a blue cube', () => {
    const store = createTestStore()

    store.getState().selectCube('blue-a')

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().validTargetIds).toEqual(['blue-b', 'red-a', 'yellow-a'])
    expect(store.getState().statusHintKey).toBe('choose_target')
  })

  it('switches selection to another blue cube', () => {
    const store = createTestStore()

    store.getState().selectCube('blue-a')
    store.getState().selectCube('blue-b')

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-b')
    expect(store.getState().validTargetIds).toEqual(['blue-a'])
  })

  it('returns to idle when clicking the selected blue cube again', () => {
    const store = createTestStore()

    store.getState().selectCube('blue-a')
    store.getState().selectCube('blue-a')

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().selectedCubeId).toBeNull()
    expect(store.getState().validTargetIds).toEqual([])
    expect(store.getState().statusHintKey).toBe('select_blue_cube')
  })
})

describe('gameStore test helpers', () => {
  it('createTestStore starts as an in-progress idle demo state', () => {
    const store = createTestStore()

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().resumeTargetState).toBeNull()
    expect(store.getState().bombCount).toBe(1)
    expect(store.getState().overlay).toBe('none')
    expect(store.getState().matchResult).toEqual({ kind: 'in_progress' })
    expect(store.getState().bombTargetIds).toEqual(['red-a', 'yellow-a'])
    expect(store.getState().statusHintKey).toBe('select_blue_cube')
  })

  it('createHiddenMoveStore hides off-slice targets without clearing the source selection', () => {
    const store = createHiddenMoveStore()

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().validTargetIds).toEqual([])
    expect(store.getState().bombTargetIds).toEqual(['red-visible'])
  })

  it('createVictoryReadyStore reaches victory after one committed board action', () => {
    const store = createVictoryReadyStore()

    store.getState().commitBoardAction('red-last')

    expect(store.getState().runState).toBe('victory')
    expect(store.getState().overlay).toBe('victory')
    expect(store.getState().matchResult).toEqual({ kind: 'victory' })
    expect(store.getState().statusHintKey).toBe('victory')
  })

  it('createSliceAwareStore keeps slice selectors deterministic', () => {
    const store = createSliceAwareStore()

    store.getState().showLayerFromTop(0)

    expect(store.getState().visibleCubes.map((item: CubeData) => item.id)).toEqual(['blue-a', 'red-top'])
    expect(store.getState().bombTargetIds).toEqual(['red-top'])

    store.getState().resetSliceView()

    expect(store.getState().visibleCubes.map((item: CubeData) => item.id)).toEqual(['blue-a', 'red-top', 'yellow-mid'])
  })

  it('createResolvingStore exposes the transient resolving state during merge resolution', () => {
    const store = createResolvingStore()

    expect(store.getState().runState).toBe('resolving')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().statusHintKey).toBe('resolving')
    expect(store.getState().matchResult).toEqual({ kind: 'in_progress' })

    vi.useRealTimers()
  })

  it('createNoMoveStore enters game over when no moves and no bombs remain', () => {
    const store = createNoMoveStore()

    expect(store.getState().runState).toBe('game_over')
    expect(store.getState().overlay).toBe('game_over')
    expect(store.getState().matchResult).toEqual({ kind: 'game_over' })
    expect(store.getState().statusHintKey).toBe('game_over')
  })
})
