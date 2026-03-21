import { describe, expect, it, vi } from 'vitest'

import { buildNoMoveBoardWithRed, buildPlayableDemoConfig } from '../config/playableDemo'
import { PlayableDemoConfigError } from '../config/playableDemoValidation'
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

  store.getState().showScreenColumn(0)
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

function createPauseReadyStore() {
  const store = createTestStore()
  store.getState().selectCube('blue-a')
  return store
}

function createHiddenMoveNoBombStore() {
  return createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'blue-hidden', color: 'blue', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-visible', color: 'red', level: 2, x: 0, y: 1, z: 0 })
    ], 0)
  })
}

function createSelectionAwareHiddenMoveStore() {
  const store = createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-selected', color: 'blue', level: 1, x: 0, y: 2, z: 0 }),
      cube({ id: 'blue-hidden-target', color: 'blue', level: 1, x: 0, y: 1, z: 0 }),
      cube({ id: 'blue-visible', color: 'blue', level: 1, x: 2, y: 2, z: 0 }),
      cube({ id: 'red-visible', color: 'red', level: 1, x: 2, y: 2, z: 1 })
    ], 0)
  })

  store.getState().showLayerFromTop(0)
  store.getState().selectCube('blue-selected')

  return store
}

function createBombReadyStore() {
  return createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', level: 1, x: 0, y: 1, z: 0 })
    ])
  })
}

function createNoBombStore() {
  return createGameStore({
    config: createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', level: 1, x: 0, y: 1, z: 0 })
    ], 0)
  })
}

function createInvalidTargetStore() {
  const config = createStoreConfig([
    cube({ id: 'blue-a', color: 'blue', level: 2, x: 0, y: 0, z: 0 }),
    cube({ id: 'blue-b', color: 'blue', level: 2, x: 1, y: 0, z: 0 }),
    cube({ id: 'red-strong', color: 'red', level: 3, x: 0, y: 1, z: 0 })
  ])
  config.scoring.devourRedBase[3] = 999

  const store = createGameStore({ config })

  store.getState().selectCube('blue-a')

  return store
}

function createRestartableStore() {
  const store = createBombReadyStore()
  store.getState().activateBomb()
  store.getState().clickCube('red-a')
  return store
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
    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'blue-b', 'red-a', 'yellow-a'])
    expect(store.getState().statusHintKey).toBe('select_blue_cube')
  })

  it('createHiddenMoveStore hides off-slice targets without clearing the source selection', () => {
    const store = createHiddenMoveStore()

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().validTargetIds).toEqual([])
    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'red-visible'])
  })

  it('createVictoryReadyStore reaches victory after one committed board action', () => {
    const store = createVictoryReadyStore()

    store.getState().commitBoardAction('red-last')

    expect(store.getState().runState).toBe('victory')
    expect(store.getState().overlay).toBe('victory')
    expect(store.getState().matchResult).toEqual({ kind: 'victory' })
    expect(store.getState().statusHintKey).toBeNull()
  })

  it('createSliceAwareStore keeps slice selectors deterministic', () => {
    const store = createSliceAwareStore()

    store.getState().showLayerFromTop(0)

    expect(store.getState().visibleCubes.map((item: CubeData) => item.id)).toEqual(['blue-a', 'red-top'])
    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'red-top'])

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
    expect(store.getState().statusHintKey).toBeNull()
  })
})

describe('gameStore public actions', () => {
  it('returns the same snapshot reference when state has not changed', () => {
    const store = createTestStore()

    const firstSnapshot = store.getState()
    const secondSnapshot = store.getState()

    expect(secondSnapshot).toBe(firstSnapshot)
  })

  it('pauseGame exposes a pause overlay and preserves the resume target state', () => {
    const store = createPauseReadyStore()

    store.getState().pauseGame()

    expect(store.getState().runState).toBe('paused')
    expect(store.getState().overlay).toBe('pause')
    expect(store.getState().resumeTargetState).toBe('selected')
    expect(store.getState().statusHintKey).toBeNull()
  })

  it('resumeGame restores the selected run state after pausing', () => {
    const store = createPauseReadyStore()

    store.getState().pauseGame()
    store.getState().resumeGame()

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().overlay).toBe('none')
    expect(store.getState().resumeTargetState).toBeNull()
    expect(store.getState().selectedCubeId).toBe('blue-a')
  })

  it('activateBomb clears selection and exposes bomb targets', () => {
    const store = createPauseReadyStore()

    store.getState().activateBomb()

    expect(store.getState().runState).toBe('targeting_bomb')
    expect(store.getState().selectedCubeId).toBeNull()
    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'blue-b', 'red-a', 'yellow-a'])
    expect(store.getState().statusHintKey).toBe('choose_bomb_target')
  })

  it('activateBomb only enters bomb targeting when bombs remain', () => {
    const store = createNoBombStore()

    store.getState().activateBomb()

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().overlay).toBe('none')
    expect(store.getState().bombCount).toBe(0)
    expect(store.getState().statusHintKey).toBe('noBombs')
  })

  it('keeps the current selection after an invalid board target click', () => {
    const store = createInvalidTargetStore()

    store.getState().clickCube('red-strong')

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().validTargetIds).toEqual(['blue-b'])
    expect(store.getState().statusHintKey).toBe('chooseValidTarget')
  })

  it('rejects hidden target ids during selected state', () => {
    const store = createHiddenMoveStore()

    store.getState().commitBoardAction('blue-hidden')

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().cubes.map((item: CubeData) => item.id)).toEqual(['blue-a', 'blue-hidden', 'red-visible'])
    expect(store.getState().score).toBe(0)
    expect(store.getState().statusHintKey).toBe('chooseValidTarget')
  })

  it('allows bombing a visible blue cube', () => {
    const store = createBombReadyStore()

    store.getState().activateBomb()
    store.getState().clickCube('blue-a')

    expect(store.getState().runState).toBe('game_over')
    expect(store.getState().selectedCubeId).toBeNull()
    expect(store.getState().bombCount).toBe(0)
    expect(store.getState().cubes.map((item: CubeData) => item.id)).toEqual(['red-a', 'yellow-a'])
    expect(store.getState().matchResult).toEqual({ kind: 'game_over' })
  })

  it('rejects hidden bomb target ids during bomb targeting', () => {
    const store = createSliceAwareStore()

    store.getState().showLayerFromTop(0)
    store.getState().activateBomb()
    store.getState().clickCube('yellow-mid')

    expect(store.getState().runState).toBe('targeting_bomb')
    expect(store.getState().bombCount).toBe(1)
    expect(store.getState().cubes.map((item: CubeData) => item.id)).toEqual(['blue-a', 'red-top', 'yellow-mid'])
    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'red-top'])
    expect(store.getState().statusHintKey).toBe('choose_bomb_target')
  })

  it('cancelTargeting returns bomb targeting back to idle', () => {
    const store = createBombReadyStore()

    store.getState().activateBomb()
    store.getState().cancelTargeting()

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().overlay).toBe('none')
    expect(store.getState().selectedCubeId).toBeNull()
    expect(store.getState().statusHintKey).toBe('select_blue_cube')
  })

  it('clears a selected cube when a slice change hides it', () => {
    const store = createHiddenMoveStore()

    store.getState().resetSliceView()
    store.getState().selectCube('blue-a')
    store.getState().showLayerFromTop(1)

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().selectedCubeId).toBeNull()
    expect(store.getState().bombTargetIds).toEqual(['red-visible'])
    expect(store.getState().statusHintKey).toBe('movesHiddenByView')
  })

  it('preserves selection when the selected cube stays visible across a slice change', () => {
    const store = createSliceAwareStore()

    store.getState().selectCube('blue-a')
    store.getState().showLayerFromTop(0)

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().validTargetIds).toEqual(['red-top'])
    expect(store.getState().statusHintKey).toBe('choose_target')
  })

  it('rejects selecting a hidden blue cube while a slice is active', () => {
    const store = createHiddenMoveStore()

    store.getState().selectCube('blue-hidden')

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().validTargetIds).toEqual([])

    store.getState().clickCube('blue-hidden')

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-a')
    expect(store.getState().validTargetIds).toEqual([])
  })

  it('recomputes bomb targets when the visible slice changes during bomb targeting', () => {
    const store = createSliceAwareStore()

    store.getState().activateBomb()
    store.getState().showLayerFromTop(0)

    expect(store.getState().runState).toBe('targeting_bomb')
    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'red-top'])

    store.getState().showLayerFromTop(1)

    expect(store.getState().runState).toBe('targeting_bomb')
    expect(store.getState().bombTargetIds).toEqual(['yellow-mid'])
    expect(store.getState().statusHintKey).toBe('choose_bomb_target')
  })

  it('restartDemo restores the authored starting state after mutations', () => {
    const store = createRestartableStore()

    store.getState().restartDemo()

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().bombCount).toBe(1)
    expect(store.getState().score).toBe(0)
    expect(store.getState().selectedCubeId).toBeNull()
    expect(store.getState().cubes.map((item: CubeData) => item.id)).toEqual(['blue-a', 'red-a', 'yellow-a'])
  })

  it('restartDemo restores the authored starting state from the pause overlay', () => {
    const store = createPauseReadyStore()

    store.getState().pauseGame()
    store.getState().restartDemo()

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().overlay).toBe('none')
    expect(store.getState().resumeTargetState).toBeNull()
    expect(store.getState().statusHintKey).toBe('select_blue_cube')
    expect(store.getState().selectedCubeId).toBeNull()
    expect(store.getState().bombCount).toBe(1)
  })

  it('restartDemo restores the authored starting state from the victory overlay', () => {
    const store = createVictoryReadyStore()

    store.getState().commitBoardAction('red-last')
    store.getState().restartDemo()

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().overlay).toBe('none')
    expect(store.getState().matchResult).toEqual({ kind: 'in_progress' })
    expect(store.getState().statusHintKey).toBe('select_blue_cube')
    expect(store.getState().cubes.map((item: CubeData) => item.id)).toEqual(['blue-a', 'red-last'])
  })

  it('restartDemo restores the authored starting state from the game over overlay', () => {
    const store = createNoMoveStore()

    store.getState().restartDemo()

    expect(store.getState().runState).toBe('game_over')
    expect(store.getState().overlay).toBe('game_over')
    expect(store.getState().matchResult).toEqual({ kind: 'game_over' })
    expect(store.getState().statusHintKey).toBeNull()
    expect(store.getState().cubes).toEqual(buildNoMoveBoardWithRed())
  })

  it('expires combo state after the configured timeout', () => {
    vi.useFakeTimers()

    const store = createGameStore({
      config: createStoreConfig([
        cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
        cube({ id: 'red-a', color: 'red', level: 1, x: 1, y: 0, z: 0 }),
        cube({ id: 'yellow-a', color: 'yellow', level: 1, x: 0, y: 1, z: 0 }),
        cube({ id: 'red-spare', color: 'red', level: 2, x: 2, y: 2, z: 2 })
      ])
    })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('red-a')

    expect(store.getState().comboCount).toBe(1)

    vi.advanceTimersByTime(buildPlayableDemoConfig().combo.timeoutMs)

    expect(store.getState().comboCount).toBe(0)
    expect(store.getState().comboText).toBeNull()

    vi.useRealTimers()
  })

  it('keeps merge scoring tied to the combo count captured at commit time', () => {
    vi.useFakeTimers()

    const config = createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'blue-b', color: 'blue', level: 1, x: 1, y: 0, z: 1 }),
      cube({ id: 'red-a', color: 'red', level: 1, x: 0, y: 0, z: 1 }),
      cube({ id: 'red-b', color: 'red', level: 1, x: 2, y: 2, z: 2 })
    ])
    config.combo.timeoutMs = 100
    config.combo.multiplierTable = [1, 2]

    const store = createGameStore({ config })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('red-a')
    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('blue-b')

    vi.advanceTimersByTime(100)
    expect(store.getState().comboCount).toBe(0)

    vi.advanceTimersByTime(140)

    expect(store.getState().score).toBe(70)

    vi.useRealTimers()
  })

  it('refreshes the combo timeout after each successful action', () => {
    vi.useFakeTimers()

    const config = createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', level: 1, x: 2, y: 0, z: 0 }),
      cube({ id: 'red-spare', color: 'red', level: 2, x: 2, y: 2, z: 2 })
    ])
    config.combo.timeoutMs = 100

    const store = createGameStore({ config })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('red-a')
    vi.advanceTimersByTime(80)

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('yellow-a')

    vi.advanceTimersByTime(99)

    expect(store.getState().comboCount).toBe(2)

    vi.advanceTimersByTime(1)

    expect(store.getState().comboCount).toBe(0)

    vi.useRealTimers()
  })

  it('freezes combo expiry while the game is paused', () => {
    vi.useFakeTimers()

    const config = createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-spare', color: 'red', level: 2, x: 2, y: 2, z: 2 })
    ])
    config.combo.timeoutMs = 100

    const store = createGameStore({ config })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('red-a')
    vi.advanceTimersByTime(60)

    store.getState().pauseGame()
    vi.advanceTimersByTime(1000)

    expect(store.getState().comboCount).toBe(1)

    store.getState().resumeGame()
    vi.advanceTimersByTime(39)

    expect(store.getState().comboCount).toBe(1)

    vi.advanceTimersByTime(1)

    expect(store.getState().comboCount).toBe(0)

    vi.useRealTimers()
  })

  it('keeps the combo timer active across bomb use without incrementing the combo', () => {
    vi.useFakeTimers()

    const config = createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', level: 1, x: 0, y: 1, z: 0 }),
      cube({ id: 'red-spare', color: 'red', level: 2, x: 2, y: 2, z: 2 })
    ], 2)
    config.combo.timeoutMs = 100

    const store = createGameStore({ config })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('red-a')
    vi.advanceTimersByTime(60)

    store.getState().activateBomb()
    store.getState().clickCube('yellow-a')

    expect(store.getState().comboCount).toBe(1)

    vi.advanceTimersByTime(39)
    expect(store.getState().comboCount).toBe(1)

    vi.advanceTimersByTime(1)
    expect(store.getState().comboCount).toBe(0)

    vi.useRealTimers()
  })

  it('resets combo state when an action ends in victory', () => {
    const store = createVictoryReadyStore()

    store.getState().commitBoardAction('red-last')

    expect(store.getState().runState).toBe('victory')
    expect(store.getState().comboCount).toBe(0)
    expect(store.getState().comboText).toBeNull()
  })

  it('resets combo state when an action ends in game over', () => {
    const store = createGameStore({
      config: createStoreConfig([
        cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
        cube({ id: 'yellow-a', color: 'yellow', level: 1, x: 1, y: 0, z: 0 }),
        cube({ id: 'red-strong', color: 'red', level: 2, x: 2, y: 2, z: 2 })
      ], 0)
    })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('yellow-a')

    expect(store.getState().runState).toBe('game_over')
    expect(store.getState().comboCount).toBe(0)
    expect(store.getState().comboText).toBeNull()
  })

  it('uses the configured base scores for red devours, yellow devours, and merges before multiplying by combo', () => {
    vi.useFakeTimers()

    const config = createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'yellow-a', color: 'yellow', level: 1, x: 2, y: 0, z: 0 }),
      cube({ id: 'blue-b', color: 'blue', level: 1, x: 2, y: 1, z: 0 }),
      cube({ id: 'red-spare', color: 'red', level: 2, x: 2, y: 2, z: 2 })
    ])
    config.combo.timeoutMs = 1000
    config.combo.multiplierTable = [1, 3, 4]
    config.scoring.devourRedBase[1] = 7
    config.scoring.devourYellowBase[1] = 11
    config.scoring.mergeBase[2] = 13

    const store = createGameStore({ config })

    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('red-a')
    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('yellow-a')
    store.getState().selectCube('blue-a')
    store.getState().commitBoardAction('blue-b')
    vi.advanceTimersByTime(240)

    expect(store.getState().score).toBe(92)

    vi.useRealTimers()
  })

  it('validates injected configs passed into createGameStore', () => {
    const config = createStoreConfig([
      cube({ id: 'duplicate', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'duplicate', color: 'red', x: 1, y: 0, z: 0 })
    ])

    expect(() => createGameStore({ config })).toThrow(PlayableDemoConfigError)
  })

  it('throws PlayableDemoConfigError for incomplete injected configs', () => {
    const config = createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 })
    ]) as PlayableDemoConfig

    delete (config as { inventory: { bombCount?: unknown } }).inventory.bombCount
    delete (config as { combo: { timeoutMs?: unknown } }).combo.timeoutMs

    expect(() => createGameStore({ config })).toThrow(PlayableDemoConfigError)
  })

  it('throws PlayableDemoConfigError for semantically invalid injected numeric configs', () => {
    const config = createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 })
    ])

    config.inventory.bombCount = -1
    config.combo.timeoutMs = Number.NaN

    expect(() => createGameStore({ config })).toThrow(PlayableDemoConfigError)
  })

  it('throws PlayableDemoConfigError for invalid injected cube levels', () => {
    const config = createStoreConfig([
      cube({ id: 'blue-a', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'red-a', color: 'red', x: 1, y: 0, z: 0 })
    ])

    config.board.cubes[0].level = Number.NaN

    expect(() => createGameStore({ config })).toThrow(PlayableDemoConfigError)
  })

  it('does not enter game over when a legal move exists off the visible slice', () => {
    const store = createHiddenMoveNoBombStore()

    store.getState().showScreenColumn(0)
    store.getState().selectCube('blue-a')

    expect(store.getState().validTargetIds).toEqual([])
    expect(store.getState().matchResult).toEqual({ kind: 'in_progress' })
    expect(store.getState().runState).toBe('selected')
  })

  it('surfaces movesHiddenByView when legal moves exist but none are visible', () => {
    const store = createHiddenMoveNoBombStore()

    store.getState().showScreenColumn(0)

    expect(store.getState().runState).toBe('idle')
    expect(store.getState().matchResult).toEqual({ kind: 'in_progress' })
    expect(store.getState().validTargetIds).toEqual([])
    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'red-visible'])
    expect(store.getState().statusHintKey).toBe('movesHiddenByView')
  })

  it('surfaces movesHiddenByView for the selected cube even when another visible cube has a visible move', () => {
    const store = createSelectionAwareHiddenMoveStore()

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().selectedCubeId).toBe('blue-selected')
    expect(store.getState().validTargetIds).toEqual([])
    expect(store.getState().statusHintKey).toBe('movesHiddenByView')
  })

  it('keeps pause requests ignored during resolving', () => {
    const store = createResolvingStore()

    store.getState().pauseGame()

    expect(store.getState().runState).toBe('resolving')
    expect(store.getState().overlay).toBe('none')
    expect(store.getState().statusHintKey).toBe('resolving')

    vi.useRealTimers()
  })

  it('restores visible targets after resuming from pause', () => {
    const store = createPauseReadyStore()

    store.getState().pauseGame()
    store.getState().resumeGame()

    expect(store.getState().runState).toBe('selected')
    expect(store.getState().validTargetIds).toEqual(['blue-b', 'red-a', 'yellow-a'])
    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'blue-b', 'red-a', 'yellow-a'])
    expect(store.getState().statusHintKey).toBe('choose_target')
  })

  it('limits bomb targets to visible cubes after slice filtering', () => {
    const store = createSliceAwareStore()

    store.getState().showLayerFromTop(0)
    store.getState().activateBomb()

    expect(store.getState().bombTargetIds).toEqual(['blue-a', 'red-top'])

    store.getState().showLayerFromTop(1)

    expect(store.getState().bombTargetIds).toEqual(['yellow-mid'])
  })
})
