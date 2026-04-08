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

type RecentScoringAction = {
  sourceId: string
  sourceColor: CubeData['color']
  kind: 'merge_blue' | 'merge_yellow' | 'devour_red' | 'devour_yellow' | 'devour_golden'
  position: Pick<CubeData, 'x' | 'y' | 'z'>
}

type EndlessStage = 'early' | 'mid' | 'late' | 'endgame'

type EndlessStageConfig = {
  scoreMaxInclusive: number
  highestBlueMaxInclusive: number
  colorWeights: {
    blue: number
    red: number
    yellow: number
  }
  goldChance: number
  blueLevelRolls: number[]
  yellowLevelMin: number
  yellowLevelMax: number
  redLevelBand: {
    minOffset: number
    maxOffset: number
  }
}

type EndlessTuning = {
  minBlueCount: number
  stageConfigs: Record<EndlessStage, EndlessStageConfig>
}

type DominanceContext = {
  sourceId: string
  state: 'active' | 'observe'
}

type EndlessDiagnostics = {
  stage: EndlessStage
  dominantBlueId: string | null
  dominantBlueState: 'active' | 'observe' | 'none'
  yellowFamilyPityCount: number
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
  endlessDiagnostics: EndlessDiagnostics | null
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
  random?: () => number
}

const MERGE_DURATION_MS = 240
export const GameStoreContext = createContext<GameStore | null>(null)

const ENDLESS_TUNING: Record<3 | 4 | 5, EndlessTuning> = {
  3: {
    minBlueCount: 2,
    stageConfigs: {
      early: {
        scoreMaxInclusive: 2000,
        highestBlueMaxInclusive: 2,
        colorWeights: { blue: 40, red: 20, yellow: 40 },
        goldChance: 0,
        blueLevelRolls: [1, 1, 1, 2, 2],
        yellowLevelMin: 1,
        yellowLevelMax: 2,
        redLevelBand: { minOffset: -2, maxOffset: -1 }
      },
      mid: {
        scoreMaxInclusive: 8000,
        highestBlueMaxInclusive: 4,
        colorWeights: { blue: 28, red: 42, yellow: 30 },
        goldChance: 0.08,
        blueLevelRolls: [1, 1, 2, 2, 3],
        yellowLevelMin: 1,
        yellowLevelMax: 3,
        redLevelBand: { minOffset: -1, maxOffset: 0 }
      },
      late: {
        scoreMaxInclusive: 20000,
        highestBlueMaxInclusive: 6,
        colorWeights: { blue: 20, red: 56, yellow: 24 },
        goldChance: 0.14,
        blueLevelRolls: [1, 2, 2, 2, 3],
        yellowLevelMin: 2,
        yellowLevelMax: 4,
        redLevelBand: { minOffset: -1, maxOffset: 1 }
      },
      endgame: {
        scoreMaxInclusive: Number.POSITIVE_INFINITY,
        highestBlueMaxInclusive: Number.POSITIVE_INFINITY,
        colorWeights: { blue: 16, red: 64, yellow: 20 },
        goldChance: 0.2,
        blueLevelRolls: [1, 2, 2, 3],
        yellowLevelMin: 2,
        yellowLevelMax: 5,
        redLevelBand: { minOffset: 0, maxOffset: 1 }
      }
    }
  },
  4: {
    minBlueCount: 3,
    stageConfigs: {
      early: {
        scoreMaxInclusive: 5000,
        highestBlueMaxInclusive: 2,
        colorWeights: { blue: 36, red: 28, yellow: 36 },
        goldChance: 0,
        blueLevelRolls: [1, 1, 1, 2, 2],
        yellowLevelMin: 1,
        yellowLevelMax: 2,
        redLevelBand: { minOffset: -2, maxOffset: -1 }
      },
      mid: {
        scoreMaxInclusive: 20000,
        highestBlueMaxInclusive: 4,
        colorWeights: { blue: 26, red: 40, yellow: 34 },
        goldChance: 0.1,
        blueLevelRolls: [1, 1, 2, 2, 3],
        yellowLevelMin: 1,
        yellowLevelMax: 3,
        redLevelBand: { minOffset: -1, maxOffset: 0 }
      },
      late: {
        scoreMaxInclusive: 60000,
        highestBlueMaxInclusive: 6,
        colorWeights: { blue: 20, red: 50, yellow: 30 },
        goldChance: 0.16,
        blueLevelRolls: [1, 2, 2, 2, 3],
        yellowLevelMin: 2,
        yellowLevelMax: 4,
        redLevelBand: { minOffset: -1, maxOffset: 1 }
      },
      endgame: {
        scoreMaxInclusive: Number.POSITIVE_INFINITY,
        highestBlueMaxInclusive: Number.POSITIVE_INFINITY,
        colorWeights: { blue: 16, red: 58, yellow: 26 },
        goldChance: 0.24,
        blueLevelRolls: [1, 2, 2, 3],
        yellowLevelMin: 2,
        yellowLevelMax: 5,
        redLevelBand: { minOffset: 0, maxOffset: 1 }
      }
    }
  },
  5: {
    minBlueCount: 3,
    stageConfigs: {
      early: {
        scoreMaxInclusive: 10000,
        highestBlueMaxInclusive: 2,
        colorWeights: { blue: 38, red: 24, yellow: 38 },
        goldChance: 0,
        blueLevelRolls: [1, 1, 1, 2, 2],
        yellowLevelMin: 1,
        yellowLevelMax: 2,
        redLevelBand: { minOffset: -2, maxOffset: -1 }
      },
      mid: {
        scoreMaxInclusive: 40000,
        highestBlueMaxInclusive: 4,
        colorWeights: { blue: 28, red: 36, yellow: 36 },
        goldChance: 0.12,
        blueLevelRolls: [1, 1, 2, 2, 3],
        yellowLevelMin: 1,
        yellowLevelMax: 3,
        redLevelBand: { minOffset: -1, maxOffset: 0 }
      },
      late: {
        scoreMaxInclusive: 120000,
        highestBlueMaxInclusive: 6,
        colorWeights: { blue: 20, red: 46, yellow: 34 },
        goldChance: 0.22,
        blueLevelRolls: [1, 2, 2, 2, 3],
        yellowLevelMin: 2,
        yellowLevelMax: 4,
        redLevelBand: { minOffset: -1, maxOffset: 1 }
      },
      endgame: {
        scoreMaxInclusive: Number.POSITIVE_INFINITY,
        highestBlueMaxInclusive: Number.POSITIVE_INFINITY,
        colorWeights: { blue: 16, red: 56, yellow: 28 },
        goldChance: 0.3,
        blueLevelRolls: [1, 2, 2, 3],
        yellowLevelMin: 2,
        yellowLevelMax: 5,
        redLevelBand: { minOffset: 0, maxOffset: 2 }
      }
    }
  }
}

function getBoardCapacity(gridSize: number) {
  return gridSize * gridSize * gridSize
}

function getEmptyCells(cubes: CubeData[], gridSize: number) {
  const occupied = new Set(cubes.map((cube) => `${cube.x}:${cube.y}:${cube.z}`))
  const cells: Array<Pick<CubeData, 'x' | 'y' | 'z'>> = []

  for (let x = 0; x < gridSize; x += 1) {
    for (let y = 0; y < gridSize; y += 1) {
      for (let z = 0; z < gridSize; z += 1) {
        const key = `${x}:${y}:${z}`
        if (!occupied.has(key)) {
          cells.push({ x, y, z })
        }
      }
    }
  }

  return cells
}

function getHighestBlueLevel(cubes: CubeData[]) {
  return cubes.reduce((highest, cube) => (cube.color === 'blue' ? Math.max(highest, cube.level) : highest), 0)
}

function hasValidMerge(cubes: CubeData[]) {
  return cubes.some((cube) => (cube.color === 'blue' || cube.color === 'yellow') && getValidTargets(cubes, cube.id).some((targetId) => {
    const target = cubes.find((item) => item.id === targetId)
    return Boolean(target && target.color === cube.color && target.level === cube.level)
  }))
}

function hasValidDevour(cubes: CubeData[]) {
  return cubes.some((cube) => cube.color === 'blue' && getValidTargets(cubes, cube.id).some((targetId) => {
    const target = cubes.find((item) => item.id === targetId)
    return Boolean(target && (target.color === 'red' || target.color === 'yellow') && cube.level >= target.level)
  }))
}

function checkEndlessGameOver(cubes: CubeData[], gridSize: number, bombCount: number) {
  return cubes.length === getBoardCapacity(gridSize)
    && !hasValidMerge(cubes)
    && !hasValidDevour(cubes)
    && bombCount === 0
}

function cloneCube(cube: CubeData): CubeData {
  return { ...cube }
}

function isBlueCube(cube: CubeData) {
  return cube.color === 'blue'
}

function getBlueCubes(cubes: CubeData[]) {
  return cubes.filter(isBlueCube)
}

function getDistance(a: Pick<CubeData, 'x' | 'y' | 'z'>, b: Pick<CubeData, 'x' | 'y' | 'z'>) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)
}

function getEndlessTuning(gridSize: number) {
  return ENDLESS_TUNING[gridSize as 3 | 4 | 5] ?? ENDLESS_TUNING[3]
}

function clampLevel(level: number) {
  return Math.max(1, Math.min(9, Math.floor(level)))
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
    },
    endless: config.endless
      ? { ...config.endless }
      : undefined
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

function pushRecentScoringAction(history: RecentScoringAction[], action: RecentScoringAction) {
  history.push(action)
  if (history.length > 6) {
    history.splice(0, history.length - 6)
  }
}

export function createGameStore(options: CreateGameStoreOptions = {}): GameStore {
  const config = cloneConfig(getValidatedPlayableDemoConfig(options.config))
  const now = options.now ?? (() => Date.now())
  const timers = options.timers ?? {
    setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout),
    clearTimeout: (handle) => globalThis.clearTimeout(handle)
  }
  const random = options.random ?? (() => Math.random())
  const listeners = new Set<() => void>()
  let data = createInitialData(config)
  let comboTimer: TimeoutHandle | null = null
  let pausedComboRemainingMs: number | null = null
  let resolutionTimer: TimeoutHandle | null = null
  let refillTimer: TimeoutHandle | null = null
  let cachedSnapshot: GameStoreSnapshot | null = null
  let endlessSpawnSerial = 0
  let recentScoringActions: RecentScoringAction[] = []
  let refillsSinceYellowFamily = 0
  let lastDominantSourceId: string | null = null
  let dominanceObserveSpawnsRemaining = 0

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

  const isEndlessMode = () => config.endless?.enabled === true

  const clearRefillTimer = () => {
    if (!refillTimer) {
      return
    }

    timers.clearTimeout(refillTimer)
    refillTimer = null
  }

  const getEndlessStage = (): EndlessStage => {
    const tuning = getEndlessTuning(config.board.gridSize)
    const highestBlueLevel = getHighestBlueLevel(data.cubes)
    const score = data.score

    if (score > tuning.stageConfigs.late.scoreMaxInclusive || highestBlueLevel > tuning.stageConfigs.late.highestBlueMaxInclusive) {
      return 'endgame'
    }

    if (score > tuning.stageConfigs.mid.scoreMaxInclusive || highestBlueLevel > tuning.stageConfigs.mid.highestBlueMaxInclusive) {
      return 'late'
    }

    if (score > tuning.stageConfigs.early.scoreMaxInclusive || highestBlueLevel > tuning.stageConfigs.early.highestBlueMaxInclusive) {
      return 'mid'
    }

    return 'early'
  }

  const getDominanceContext = (): DominanceContext | null => {
    const recentBlueActions = recentScoringActions.filter((action) => action.sourceColor === 'blue')
    const blueActionCounts = new Map<string, { total: number; devours: number }>()
    const highestBlueLevel = getHighestBlueLevel(data.cubes)

    for (const action of recentBlueActions) {
      const next = blueActionCounts.get(action.sourceId) ?? { total: 0, devours: 0 }
      next.total += 1
      if (action.kind === 'devour_red' || action.kind === 'devour_yellow' || action.kind === 'devour_golden') {
        next.devours += 1
      }
      blueActionCounts.set(action.sourceId, next)
    }

    const dominantEntry = [...blueActionCounts.entries()].find(([sourceId, counts]) => {
      const cube = data.cubes.find((item) => item.id === sourceId && item.color === 'blue')
      if (!cube) {
        return false
      }

      return counts.total >= 4 && counts.devours >= 2 && cube.level >= Math.max(1, highestBlueLevel - 1)
    })

    if (dominantEntry) {
      lastDominantSourceId = dominantEntry[0]
      dominanceObserveSpawnsRemaining = 0
      return {
        sourceId: dominantEntry[0],
        state: 'active'
      }
    }

    if (lastDominantSourceId) {
      const dominantCubeStillExists = data.cubes.some((cube) => cube.id === lastDominantSourceId && cube.color === 'blue')
      if (dominantCubeStillExists && dominanceObserveSpawnsRemaining === 0) {
        dominanceObserveSpawnsRemaining = 2
      }

      if (dominantCubeStillExists && dominanceObserveSpawnsRemaining > 0) {
        return {
          sourceId: lastDominantSourceId,
          state: 'observe'
        }
      }
    }

    lastDominantSourceId = null
    return null
  }

  const getEndlessDiagnostics = (): EndlessDiagnostics | null => {
    if (!isEndlessMode()) {
      return null
    }

    const dominanceContext = getDominanceContext()

    return {
      stage: getEndlessStage(),
      dominantBlueId: dominanceContext?.sourceId ?? null,
      dominantBlueState: dominanceContext?.state ?? 'none',
      yellowFamilyPityCount: refillsSinceYellowFamily
    }
  }

  const getMainOperationCells = () => {
    return recentScoringActions.slice(-4).map((action) => action.position)
  }

  const getKeyPathCells = () => {
    const cells = new Set<string>()

    for (const cube of data.cubes) {
      if (cube.color !== 'blue') {
        continue
      }

      for (const targetId of getValidTargets(data.cubes, cube.id)) {
        const target = data.cubes.find((item) => item.id === targetId)
        if (!target) {
          continue
        }

        const midpoints: Array<Pick<CubeData, 'x' | 'y' | 'z'>> = [cube, target]
        for (const cell of midpoints) {
          cells.add(`${cell.x}:${cell.y}:${cell.z}`)
        }
      }
    }

    return cells
  }

  const pickWeightedCell = (color: CubeData['color'], emptyCells: Array<Pick<CubeData, 'x' | 'y' | 'z'>>) => {
    const blueCubes = getBlueCubes(data.cubes)
    const mainOperationCells = getMainOperationCells()
    const keyPathCells = getKeyPathCells()
    const dominanceContext = getDominanceContext()
    const dominantCube = dominanceContext ? data.cubes.find((cube) => cube.id === dominanceContext.sourceId) ?? null : null
    const alternativeBlueCubes = blueCubes.filter((cube) => cube.id !== dominantCube?.id)
    const weightedCells = emptyCells.map((cell) => {
      let weight = 1
      const nearestBlueDistance = blueCubes.length > 0
        ? Math.min(...blueCubes.map((cube) => getDistance(cell, cube)))
        : config.board.gridSize
      const nearestAltBlueDistance = alternativeBlueCubes.length > 0
        ? Math.min(...alternativeBlueCubes.map((cube) => getDistance(cell, cube)))
        : config.board.gridSize
      const dominantDistance = dominantCube ? getDistance(cell, dominantCube) : config.board.gridSize
      const touchesMainOperationArea = mainOperationCells.some((actionCell) => getDistance(cell, actionCell) <= 1)
      const inKeyPath = keyPathCells.has(`${cell.x}:${cell.y}:${cell.z}`)

      if (color === 'blue') {
        weight += nearestAltBlueDistance <= 1 ? 3.8 : nearestBlueDistance <= 1 ? 2.4 : 0.8
        if (dominantCube) {
          weight += dominantDistance >= 2 ? 2.2 : 0.4
        }
      }

      if (color === 'yellow') {
        weight += dominantDistance >= 2 ? 3.2 : 0.6
        weight += nearestAltBlueDistance <= 1 ? 1.8 : 0
        weight += touchesMainOperationArea ? 0.4 : 1.6
      }

      if (color === 'red') {
        weight += inKeyPath ? 3 : 0.6
        weight += touchesMainOperationArea ? 2.2 : 0.4
        weight += dominantCube && dominantDistance <= 1 ? 3.4 : nearestBlueDistance <= 1 ? 1.8 : 0.4
      }

      if (dominanceContext?.state === 'observe') {
        weight *= 0.88
      }

      return {
        cell,
        weight: Math.max(0.1, weight)
      }
    })

    const totalWeight = weightedCells.reduce((sum, entry) => sum + entry.weight, 0)
    let roll = random() * totalWeight

    for (const entry of weightedCells) {
      if (roll < entry.weight) {
        return entry.cell
      }
      roll -= entry.weight
    }

    return weightedCells[weightedCells.length - 1]?.cell ?? emptyCells[0]
  }

  const pickEndlessSpawnBlueprint = () => {
    const tuning = getEndlessTuning(config.board.gridSize)
    const stage = getEndlessStage()
    const stageConfig = tuning.stageConfigs[stage]
    const highestBlueLevel = getHighestBlueLevel(data.cubes)
    const blueCount = getBlueCubes(data.cubes).length
    const dominanceContext = getDominanceContext()
    const weights = {
      blue: stageConfig.colorWeights.blue,
      red: stageConfig.colorWeights.red,
      yellow: stageConfig.colorWeights.yellow
    }

    if (blueCount < tuning.minBlueCount) {
      weights.blue = Math.max(weights.blue, Math.max(weights.red, weights.yellow) + 1)
    }

    if (refillsSinceYellowFamily >= 5) {
      const spawnsGolden = stageConfig.goldChance > 0 && random() < stageConfig.goldChance
      return {
        color: 'yellow' as const,
        variant: spawnsGolden ? 'golden' as const : undefined,
        level: clampLevel(stageConfig.yellowLevelMin + Math.floor(random() * (stageConfig.yellowLevelMax - stageConfig.yellowLevelMin + 1)))
      }
    }

    if (dominanceContext) {
      weights.red += dominanceContext.state === 'active' ? 18 : 8
      weights.yellow = Math.max(6, weights.yellow - (dominanceContext.state === 'active' ? 12 : 5))
    }

    const totalWeight = weights.blue + weights.red + weights.yellow
    let roll = random() * totalWeight
    let color: CubeData['color'] = 'red'

    if (roll < weights.blue) {
      color = 'blue'
    } else {
      roll -= weights.blue
      color = roll < weights.red ? 'red' : 'yellow'
    }

    if (color === 'blue') {
      return {
        color,
        variant: undefined,
        level: stageConfig.blueLevelRolls[Math.floor(random() * stageConfig.blueLevelRolls.length)] ?? 1
      }
    }

    if (color === 'yellow') {
      return {
        color,
        variant: stageConfig.goldChance > 0 && random() < stageConfig.goldChance ? 'golden' as const : undefined,
        level: clampLevel(stageConfig.yellowLevelMin + Math.floor(random() * (stageConfig.yellowLevelMax - stageConfig.yellowLevelMin + 1)))
      }
    }

    const redMin = clampLevel(highestBlueLevel + stageConfig.redLevelBand.minOffset)
    const redMax = clampLevel(Math.max(redMin, highestBlueLevel + stageConfig.redLevelBand.maxOffset))

    return {
      color,
      variant: undefined,
      level: clampLevel(redMin + Math.floor(random() * (redMax - redMin + 1)))
    }
  }

  const spawnEndlessRefillCube = () => {
    const emptyCells = getEmptyCells(data.cubes, config.board.gridSize)
    if (emptyCells.length === 0) {
      return false
    }

    const blueprint = pickEndlessSpawnBlueprint()
    const cell = pickWeightedCell(blueprint.color, emptyCells)

    data.cubes = [
      ...data.cubes,
      {
        id: `endless_spawn_${String(endlessSpawnSerial).padStart(4, '0')}`,
        color: blueprint.color,
        variant: blueprint.variant,
        level: blueprint.level,
        x: cell.x,
        y: cell.y,
        z: cell.z
      }
    ]
    endlessSpawnSerial += 1
    refillsSinceYellowFamily = blueprint.color === 'yellow' ? 0 : refillsSinceYellowFamily + 1
    if (!recentScoringActions.some((action) => action.sourceId === lastDominantSourceId)) {
      dominanceObserveSpawnsRemaining = Math.max(0, dominanceObserveSpawnsRemaining - 1)
    }
    return true
  }

  const scheduleEndlessRefillIfNeeded = () => {
    const endless = config.endless
    if (!isEndlessMode() || !endless) {
      syncInteractiveFlow()
      emit()
      return
    }

    clearRefillTimer()
    const hasEmptyCell = data.cubes.length < getBoardCapacity(config.board.gridSize)
    const shouldSpawnThisTurn = data.actionStats.actionsUsed % endless.spawnIntervalSteps === 0

    if (!hasEmptyCell || !shouldSpawnThisTurn) {
      syncInteractiveFlow()
      emit()
      return
    }

    data.runState = 'resolving'
    data.overlay = 'none'
    data.resumeTargetState = null
    data.statusHintKey = 'resolving'
    emit()

    refillTimer = timers.setTimeout(() => {
      refillTimer = null
      spawnEndlessRefillCube()
      syncInteractiveFlow()
      emit()
    }, endless.refillDelayMs)
  }

  const syncInteractiveFlow = () => {
    if (isEndlessMode()) {
      if (checkEndlessGameOver(data.cubes, config.board.gridSize, data.bombCount)) {
        data.matchResult = { kind: 'game_over' }
        data.runState = 'game_over'
        data.overlay = 'game_over'
        data.resumeTargetState = null
        clearComboState()
        applyStatusHint('game_over')
        return
      }

      const derived = getDerived()
      data.matchResult = { kind: 'in_progress' }
      data.runState = data.selectedCubeId ? 'selected' : 'idle'
      data.overlay = 'none'
      data.resumeTargetState = null
      data.statusHintKey = deriveStatusHintKey({
        runState: data.runState,
        overlay: data.overlay,
        bombCount: data.bombCount,
        selectedCubeId: data.selectedCubeId,
        validTargetIds: derived.validTargetIds,
        bombTargetIds: derived.bombTargetIds,
        matchResult: data.matchResult,
        hasHiddenLegalMoves: hasHiddenLegalMoves()
      })
      return
    }

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
    resolutionTimer = null
    scheduleEndlessRefillIfNeeded()
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
      pushRecentScoringAction(recentScoringActions, {
        sourceId: result.sourceId,
        sourceColor: selectedCube.color,
        kind: selectedCube.color === 'yellow' ? 'merge_yellow' : 'merge_blue',
        position: {
          x: target.x,
          y: target.y,
          z: target.z
        }
      })
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
    pushRecentScoringAction(recentScoringActions, {
      sourceId: result.sourceId,
      sourceColor: selectedCube.color,
      kind: target.color === 'red'
        ? 'devour_red'
        : target.variant === 'golden'
          ? 'devour_golden'
          : 'devour_yellow',
      position: {
        x: target.x,
        y: target.y,
        z: target.z
      }
    })
    if (result.kind === 'devour_yellow') {
      data.coins += result.consumedLevel
    }
    data.selectedCubeId = null
    data.mergeAnimation = null
    scheduleEndlessRefillIfNeeded()
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
    clearRefillTimer()
    pausedComboRemainingMs = null
    data = createInitialData(config)
    endlessSpawnSerial = 0
    recentScoringActions = []
    refillsSinceYellowFamily = 0
    lastDominantSourceId = null
    dominanceObserveSpawnsRemaining = 0
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
      endlessDiagnostics: getEndlessDiagnostics(),
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
