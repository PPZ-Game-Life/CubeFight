import React, { createContext, useContext, useRef, useSyncExternalStore } from 'react'

import { CUBE_GAP, CUBE_SIZE, getValidatedPlayableDemoConfig } from '../config/config'
import type {
  ComboTextKey,
  CubeData,
  GameOverlay,
  GameRunState,
  MatchResult,
  MergeAnimationState,
  PlayableDemoConfig,
  PlayableDemoUiConfig,
  ResumeTargetState,
  SliceState,
  StatusHintKey
} from '../model/types'
import {
  advanceComboState,
  deriveStatusHintKey,
  evaluatePostAction,
  resetComboState,
  shouldExpireCombo,
  type ComboState
} from './gameFlow'
import {
  getComboScore,
  getValidTargets,
  getVisibleBombTargets,
  getVisibleValidTargets,
  resolveBoardAction,
  resolveBomb
} from './demoRules'
import { getActualTopDownLayerIndex, getScreenColumnMapping, isCubeVisible } from './selectors'

type TimeoutHandle = ReturnType<typeof setTimeout>

type CameraState = {
  yaw: number
  pitch: number
}

type ControlState = {
  xSelection: number
  ySelection: number
}

type VisualState = {
  selected: boolean
  highlighted: boolean
  dimmed: boolean
}

type ActionStats = {
  actionsUsed: number
  bombsUsed: number
  mergeCounts: Record<string, number>
  devourCounts: Record<string, number>
}

type TimerApi = {
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
}

type GameStoreData = ComboState & {
  cubes: CubeData[]
  selectedCubeId: string | null
  bombCount: number
  score: number
  coins: number
  runState: GameRunState
  resumeTargetState: ResumeTargetState
  overlay: GameOverlay
  matchResult: MatchResult
  statusHintKey: StatusHintKey | null
  mergeAnimation: MergeAnimationState | null
  slice: SliceState
  controls: ControlState
  camera: CameraState
  actionStats: ActionStats
}

export type GameStoreSnapshot = {
  gridSize: number
  cubes: CubeData[]
  visibleCubes: CubeData[]
  selectedCubeId: string | null
  score: number
  coins: number
  comboCount: number
  comboText: ComboTextKey | null
  gameOver: boolean
  mergeAnimation: MergeAnimationState | null
  slice: SliceState
  controls: ControlState
  camera: CameraState
  runState: GameRunState
  resumeTargetState: ResumeTargetState
  bombCount: number
  overlay: GameOverlay
  statusHintKey: StatusHintKey | null
  matchResult: MatchResult
  actionStats: ActionStats
  ui: PlayableDemoUiConfig
  validTargetIds: string[]
  bombTargetIds: string[]
  getCubeVisualState: (cubeId: string) => VisualState
  showLayerFromTop: (index: number) => void
  showScreenColumn: (index: number) => void
  resetSliceView: () => void
  updateCameraAngles: (yaw: number, pitch: number) => void
  selectCube: (cubeId: string) => void
  commitBoardAction: (targetId: string) => void
  pauseGame: () => void
  resumeGame: () => void
  restartDemo: () => void
  activateBomb: () => void
  cancelTargeting: () => void
  getStatusHintKey: () => StatusHintKey | null
  clickCube: (cubeId: string) => void
  clearSelection: () => void
}

export type GameStore = {
  getState: () => GameStoreSnapshot
  subscribe: (listener: () => void) => () => void
}

export type CreateGameStoreOptions = {
  config?: PlayableDemoConfig
  now?: () => number
  timers?: TimerApi
}

const MERGE_DURATION_MS = 240
export const GameStoreContext = createContext<GameStore | null>(null)

function cloneCube(cube: CubeData): CubeData {
  return { ...cube }
}

function cloneConfig(config: PlayableDemoConfig): PlayableDemoConfig {
  return {
    board: {
      gridSize: config.board.gridSize,
      cubes: config.board.cubes.map(cloneCube)
    },
    inventory: {
      bombCount: config.inventory.bombCount
    },
    combo: {
      timeoutMs: config.combo.timeoutMs,
      multiplierTable: [...config.combo.multiplierTable]
    },
    scoring: {
      mergeBase: { ...config.scoring.mergeBase },
      devourRedBase: { ...config.scoring.devourRedBase },
      devourYellowBase: { ...config.scoring.devourYellowBase }
    },
    winLoss: {
      ...config.winLoss
    },
    ui: {
      ...config.ui
    }
  }
}

function isSelectableCube(cube: CubeData): boolean {
  return cube.color === 'blue' || cube.color === 'yellow'
}

function createInitialData(config: PlayableDemoConfig): GameStoreData {
  return {
    cubes: config.board.cubes.map(cloneCube),
    selectedCubeId: null,
    bombCount: config.inventory.bombCount,
    score: 0,
    coins: 0,
    ...resetComboState(),
    runState: 'idle',
    resumeTargetState: null,
    overlay: 'none',
    matchResult: { kind: 'in_progress' },
    statusHintKey: 'select_blue_cube',
    mergeAnimation: null,
    slice: { axis: null, index: -1 },
    controls: { xSelection: -1, ySelection: -1 },
    camera: { yaw: 0, pitch: Math.PI / 2 },
    actionStats: {
      actionsUsed: 0,
      bombsUsed: 0,
      mergeCounts: {},
      devourCounts: {}
    }
  }
}

function incrementActionCount(table: Record<string, number>, key: string) {
  table[key] = (table[key] ?? 0) + 1
}

export function createGameStore(options: CreateGameStoreOptions = {}): GameStore {
  const config = cloneConfig(getValidatedPlayableDemoConfig(options.config))
  const now = options.now ?? (() => Date.now())
  const timers = options.timers ?? {
    setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout),
    clearTimeout: (handle) => globalThis.clearTimeout(handle)
  }
  const listeners = new Set<() => void>()
  let data = createInitialData(config)
  let comboTimer: TimeoutHandle | null = null
  let pausedComboRemainingMs: number | null = null
  let resolutionTimer: TimeoutHandle | null = null
  let cachedSnapshot: GameStoreSnapshot | null = null

  const getDerived = (selectedCubeId = data.selectedCubeId) => {
    const visibleCubes = data.cubes.filter((cube) => isCubeVisible(cube, data.slice))
    const validTargetIds = selectedCubeId ? getVisibleValidTargets(data.cubes, selectedCubeId, data.slice) : []
    const bombTargetIds = getVisibleBombTargets(data.cubes, data.slice)
    return { visibleCubes, validTargetIds, bombTargetIds }
  }

  const hasHiddenLegalMoves = () => {
    if (data.selectedCubeId) {
      const selectedTargets = getValidTargets(data.cubes, data.selectedCubeId)
      const visibleSelectedTargets = getVisibleValidTargets(data.cubes, data.selectedCubeId, data.slice)
      return selectedTargets.length > 0 && visibleSelectedTargets.length === 0
    }

    const visibleSelectableIds = data.cubes.filter((cube) => isSelectableCube(cube) && isCubeVisible(cube, data.slice)).map((cube) => cube.id)
    const hasAnyLegalMove = data.cubes.some((cube) => isSelectableCube(cube) && getValidTargets(data.cubes, cube.id).length > 0)
    const hasVisibleLegalMove = visibleSelectableIds.some((cubeId) => getVisibleValidTargets(data.cubes, cubeId, data.slice).length > 0)
    return hasAnyLegalMove && !hasVisibleLegalMove
  }

  const applyStatusHint = (overrideRunState = data.runState) => {
    const { validTargetIds, bombTargetIds } = getDerived()
    data.statusHintKey = deriveStatusHintKey({
      runState: overrideRunState,
      overlay: data.overlay,
      bombCount: data.bombCount,
      selectedCubeId: data.selectedCubeId,
      validTargetIds,
      bombTargetIds,
      matchResult: data.matchResult,
      hasHiddenLegalMoves: hasHiddenLegalMoves()
    })
  }

  const clearComboState = () => {
    clearComboTimer()
    data.comboCount = 0
    data.comboText = null
    data.lastActionAt = null
    data.comboExpiresAt = null
  }

  const syncInteractiveFlow = () => {
    const { validTargetIds } = getDerived()
    const nextFlow = evaluatePostAction({
      cubes: data.cubes,
      bombCount: data.bombCount,
      selectedCubeId: data.selectedCubeId,
      validTargetIds,
      runState: data.runState,
      victoryCondition: config.winLoss.victory
    })

    data.matchResult = nextFlow.matchResult
    data.runState = nextFlow.runState
    data.overlay = nextFlow.overlay
    data.resumeTargetState = nextFlow.resumeTargetState

    if (data.matchResult.kind === 'victory' || data.matchResult.kind === 'game_over') {
      clearComboState()
    }

    applyStatusHint()
  }

  const clearComboTimer = () => {
    if (!comboTimer) {
      return
    }

    timers.clearTimeout(comboTimer)
    comboTimer = null
  }

  const scheduleComboExpiry = () => {
    clearComboTimer()

    if (data.comboExpiresAt === null) {
      return
    }

    const delay = Math.max(0, data.comboExpiresAt - now())
    comboTimer = timers.setTimeout(() => {
      if (!shouldExpireCombo(data, now())) {
        scheduleComboExpiry()
        return
      }

      data.comboCount = 0
      data.comboText = null
      data.lastActionAt = null
      data.comboExpiresAt = null
      comboTimer = null
      emit()
    }, delay)
  }

  const clearResolutionTimer = () => {
    if (!resolutionTimer) {
      return
    }

    timers.clearTimeout(resolutionTimer)
    resolutionTimer = null
  }

  const emit = () => {
    cachedSnapshot = null
    listeners.forEach((listener) => listener())
  }

  const applyComboProgress = () => {
    const nextCombo = advanceComboState(data, now(), config.combo.timeoutMs)
    data.comboCount = nextCombo.comboCount
    data.comboText = nextCombo.comboText
    data.lastActionAt = nextCombo.lastActionAt
    data.comboExpiresAt = nextCombo.comboExpiresAt
    scheduleComboExpiry()
    return nextCombo.comboCount
  }

  const finalizeMerge = (resolvedCubes: CubeData[], awardedScore: number) => {
    data.cubes = resolvedCubes.map(cloneCube)
    data.selectedCubeId = null
    data.mergeAnimation = null
    data.score += awardedScore
    syncInteractiveFlow()
    resolutionTimer = null
    emit()
  }

  const commitBombTarget = (targetId: string) => {
    if (!getDerived().bombTargetIds.includes(targetId)) {
      applyStatusHint('targeting_bomb')
      emit()
      return
    }

    const result = resolveBomb(data.cubes, targetId)
    if (result.kind === 'invalid') {
      applyStatusHint('targeting_bomb')
      emit()
      return
    }

    data.cubes = result.cubes.map(cloneCube)
    data.bombCount = Math.max(0, data.bombCount - 1)
    data.actionStats.actionsUsed += 1
    data.actionStats.bombsUsed += 1
    data.selectedCubeId = null
    data.mergeAnimation = null
    syncInteractiveFlow()
    emit()
  }

  const selectCube = (cubeId: string) => {
    if (data.runState === 'paused' || data.runState === 'resolving' || data.runState === 'victory' || data.runState === 'game_over') {
      return
    }

    const cube = data.cubes.find((item) => item.id === cubeId)
    if (!cube || !isSelectableCube(cube) || !isCubeVisible(cube, data.slice)) {
      return
    }

    if (data.selectedCubeId === cubeId) {
      data.selectedCubeId = null
      syncInteractiveFlow()
      emit()
      return
    }

    data.selectedCubeId = cubeId
    data.runState = 'selected'
    data.overlay = 'none'
    data.resumeTargetState = null
    syncInteractiveFlow()
    emit()
  }

  const commitBoardAction = (targetId: string) => {
    if (data.runState !== 'selected' || !data.selectedCubeId) {
      return
    }

    if (!getDerived(data.selectedCubeId).validTargetIds.includes(targetId)) {
      data.statusHintKey = 'chooseValidTarget'
      emit()
      return
    }

    const selectedCube = data.cubes.find((item) => item.id === data.selectedCubeId)
    const target = data.cubes.find((item) => item.id === targetId)
    if (!selectedCube || !target) {
      return
    }

    const result = resolveBoardAction(
      data.cubes,
      {
        type: target.color === selectedCube.color ? 'merge' : 'devour',
        sourceId: data.selectedCubeId,
        targetId
      },
      config
    )

    if (result.kind === 'invalid') {
      data.statusHintKey = 'chooseValidTarget'
      emit()
      return
    }

    const comboCount = applyComboProgress()
    const awardedScore = getComboScore(result.baseScore, comboCount, config.combo.multiplierTable)
    data.actionStats.actionsUsed += 1

    if (result.kind === 'merge') {
      incrementActionCount(data.actionStats.mergeCounts, `${selectedCube.color}:${result.nextLevel}`)
      clearResolutionTimer()
      data.runState = 'resolving'
      data.overlay = 'none'
      data.mergeAnimation = {
        sourceId: result.sourceId,
        targetId: result.targetId,
        targetPosition: {
          x: target.x,
          y: target.y,
          z: target.z
        },
        nextLevel: result.nextLevel,
        startTime: now(),
        duration: MERGE_DURATION_MS,
        sourceColor: 'blue'
      }
      data.statusHintKey = 'resolving'
      resolutionTimer = timers.setTimeout(() => finalizeMerge(result.cubes, awardedScore), MERGE_DURATION_MS)
      emit()
      return
    }

    data.cubes = result.cubes.map(cloneCube)
    data.score += awardedScore
    incrementActionCount(data.actionStats.devourCounts, `${target.color}:${result.consumedLevel}`)
    if (result.kind === 'devour_yellow') {
      data.coins += result.consumedLevel
    }
    data.selectedCubeId = null
    data.mergeAnimation = null
    syncInteractiveFlow()
    emit()
  }

  const pauseGame = () => {
    if (data.runState === 'paused' || data.runState === 'resolving' || data.runState === 'victory' || data.runState === 'game_over') {
      return
    }

    pausedComboRemainingMs = data.comboExpiresAt === null ? null : Math.max(0, data.comboExpiresAt - now())
    clearComboTimer()

    data.resumeTargetState = data.runState === 'targeting_bomb' ? 'targeting_bomb' : data.selectedCubeId ? 'selected' : 'idle'
    data.runState = 'paused'
    data.overlay = 'pause'
    applyStatusHint('paused')
    emit()
  }

  const resumeGame = () => {
    if (data.runState !== 'paused') {
      return
    }

    if (pausedComboRemainingMs !== null && data.comboCount > 0) {
      data.lastActionAt = now() - (config.combo.timeoutMs - pausedComboRemainingMs)
      data.comboExpiresAt = now() + pausedComboRemainingMs
      scheduleComboExpiry()
    }
    pausedComboRemainingMs = null

    data.runState = data.resumeTargetState ?? 'idle'
    data.overlay = 'none'
    data.resumeTargetState = null
    applyStatusHint()
    emit()
  }

  const activateBomb = () => {
    if (data.runState === 'paused' || data.runState === 'resolving' || data.runState === 'victory' || data.runState === 'game_over') {
      return
    }

    if (data.bombCount <= 0) {
      data.statusHintKey = 'noBombs'
      emit()
      return
    }

    data.selectedCubeId = null
    data.runState = 'targeting_bomb'
    data.overlay = 'none'
    data.resumeTargetState = null
    applyStatusHint('targeting_bomb')
    emit()
  }

  const cancelTargeting = () => {
    if (data.runState === 'paused' || data.runState === 'resolving' || data.runState === 'victory' || data.runState === 'game_over') {
      return
    }

    data.selectedCubeId = null
    data.runState = 'idle'
    data.overlay = 'none'
    data.resumeTargetState = null
    syncInteractiveFlow()
    emit()
  }

  const restartDemo = () => {
    clearComboTimer()
    clearResolutionTimer()
    pausedComboRemainingMs = null
    data = createInitialData(config)
    syncInteractiveFlow()
    emit()
  }

  const syncSliceInteractionState = () => {
    if (!data.selectedCubeId) {
      if (data.runState === 'paused' && data.resumeTargetState === 'selected') {
        data.resumeTargetState = 'idle'
      }
      return
    }

    const selectedCube = data.cubes.find((cube) => cube.id === data.selectedCubeId)
    if (selectedCube && isCubeVisible(selectedCube, data.slice)) {
      return
    }

    data.selectedCubeId = null

    if (data.runState === 'selected') {
      data.runState = 'idle'
    }

    if (data.runState === 'paused' && data.resumeTargetState === 'selected') {
      data.resumeTargetState = 'idle'
    }
  }

  const showLayerFromTop = (index: number) => {
    data.controls = { ...data.controls, ySelection: index }
    data.slice = { axis: 'y', index: getActualTopDownLayerIndex(index, config.board.gridSize) }
    syncSliceInteractionState()
    applyStatusHint()
    emit()
  }

  const showScreenColumn = (index: number) => {
    const mapping = getScreenColumnMapping(data.camera.yaw, config.board.gridSize)
    data.controls = { ...data.controls, xSelection: index }
    data.slice = { axis: mapping.axis, index: mapping.order[index] }
    syncSliceInteractionState()
    applyStatusHint()
    emit()
  }

  const resetSliceView = () => {
    data.slice = { axis: null, index: -1 }
    data.controls = { xSelection: -1, ySelection: -1 }
    syncSliceInteractionState()
    applyStatusHint()
    emit()
  }

  const updateCameraAngles = (yaw: number, pitch: number) => {
    data.camera = { ...data.camera, yaw, pitch }
    emit()
  }

  const getStatusHintKey = () => getSnapshot().statusHintKey

  const clickCube = (cubeId: string) => {
    const cube = data.cubes.find((item) => item.id === cubeId)
    if (!cube) {
      return
    }

    if (data.runState === 'targeting_bomb') {
      commitBombTarget(cubeId)
      return
    }

    if (data.runState === 'selected' && data.selectedCubeId) {
      if (cubeId === data.selectedCubeId) {
        selectCube(cubeId)
        return
      }

      const visibleTargetIds = getDerived(data.selectedCubeId).validTargetIds
      if (visibleTargetIds.includes(cubeId)) {
        commitBoardAction(cubeId)
        return
      }
    }

    if (isSelectableCube(cube)) {
      selectCube(cubeId)
      return
    }

    commitBoardAction(cubeId)
  }

  const clearSelection = () => {
    cancelTargeting()
  }

  const getCubeVisualState = (cubeId: string): VisualState => {
    const { validTargetIds, bombTargetIds } = getDerived()
    const cube = data.cubes.find((item) => item.id === cubeId)
    if (!cube) {
      return { selected: false, highlighted: false, dimmed: false }
    }

    if (data.runState === 'targeting_bomb') {
      const highlighted = bombTargetIds.includes(cubeId)
      return { selected: false, highlighted, dimmed: !highlighted && (cube.color === 'red' || cube.color === 'yellow' || cube.color === 'blue') }
    }

    if (!data.selectedCubeId) {
      return { selected: false, highlighted: false, dimmed: false }
    }

    if (data.selectedCubeId === cubeId) {
      return { selected: true, highlighted: false, dimmed: false }
    }

    const highlighted = validTargetIds.includes(cubeId)
    return { selected: false, highlighted, dimmed: !highlighted }
  }

  const getSnapshot = (): GameStoreSnapshot => {
    if (cachedSnapshot) {
      return cachedSnapshot
    }

    const derived = getDerived()
    cachedSnapshot = {
      gridSize: config.board.gridSize,
      cubes: data.cubes,
      visibleCubes: derived.visibleCubes,
      selectedCubeId: data.selectedCubeId,
      score: data.score,
      coins: data.coins,
      comboCount: data.comboCount,
      comboText: data.comboText,
      gameOver: data.matchResult.kind === 'game_over',
      mergeAnimation: data.mergeAnimation,
      slice: data.slice,
      controls: data.controls,
      camera: data.camera,
      runState: data.runState,
      resumeTargetState: data.resumeTargetState,
      bombCount: data.bombCount,
      overlay: data.overlay,
      statusHintKey: data.statusHintKey,
      matchResult: data.matchResult,
      actionStats: data.actionStats,
      ui: config.ui,
      validTargetIds: derived.validTargetIds,
      bombTargetIds: derived.bombTargetIds,
      getCubeVisualState,
      showLayerFromTop,
      showScreenColumn,
      resetSliceView,
      updateCameraAngles,
      selectCube,
      commitBoardAction,
      pauseGame,
      resumeGame,
      restartDemo,
      activateBomb,
      cancelTargeting,
      getStatusHintKey,
      clickCube,
      clearSelection
    }

    return cachedSnapshot
  }

  syncInteractiveFlow()

  return {
    getState: getSnapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

export function GameStoreProvider({ children, config, storeKey = 'default' }: { children: React.ReactNode; config?: PlayableDemoConfig; storeKey?: string | number }) {
  const storeRef = useRef<GameStore | null>(null)
  const storeKeyRef = useRef<string | number | null>(null)

  if (!storeRef.current || storeKeyRef.current !== storeKey) {
    storeRef.current = createGameStore({ config })
    storeKeyRef.current = storeKey
  }

  return <GameStoreContext.Provider value={storeRef.current}>{children}</GameStoreContext.Provider>
}

export function useGameStore() {
  const store = useContext(GameStoreContext)
  if (!store) {
    throw new Error('useGameStore must be used within GameStoreProvider')
  }

  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export function toWorldPosition(x: number, y: number, z: number, gridSize = 3): [number, number, number] {
  const spacing = CUBE_SIZE + CUBE_GAP
  const offset = ((gridSize - 1) * spacing) / 2
  return [x * spacing - offset, y * spacing - offset, z * spacing - offset]
}
