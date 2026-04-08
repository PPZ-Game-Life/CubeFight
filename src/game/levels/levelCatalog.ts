import rawLevels from '../../../config/json/levels.json'

import type { CubeColor, CubeData, PlayableDemoConfig } from '../model/types'
import { buildPlayableDemoConfig } from '../config/playableDemo'
import { COIN_VALUES, SCORE_VALUES } from '../config/config'

export type LevelSpawnMode = 'static' | 'dynamic'
export type LevelObjectiveType = 'merge' | 'devour' | 'score' | 'clear_all_red'

export type LevelObjective = {
  type: LevelObjectiveType
  targetColor?: CubeColor
  targetLevel?: number
  targetCount?: number
}

export type LevelLimits = {
  steps?: number
  time?: number
} | null

export type LevelDynamicParams = {
  spawnIntervalSteps: number
  redWeight: number
  yellowWeight: number
} | null

export type LevelReward = {
  coins: number
}

export type GeneratedHintStep = {
  action: 'split_merge' | 'split_devour'
  [key: string]: unknown
}

export type LevelEntry = {
  id: number
  name: string
  gridSize: number
  spawnMode: LevelSpawnMode
  objectives: LevelObjective[]
  limits: LevelLimits
  initialMap: Array<Omit<CubeData, 'id'>>
  dynamicParams: LevelDynamicParams
  reward: LevelReward
  generatedHintPath?: GeneratedHintStep[]
}

export type LevelCatalog = {
  levels: LevelEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCubeColor(value: unknown): value is CubeColor {
  return value === 'blue' || value === 'red' || value === 'yellow'
}

function normalizeObjectiveType(value: unknown): LevelObjectiveType | null {
  if (value === 'merge' || value === 'devour' || value === 'score' || value === 'clear_all_red') {
    return value
  }

  if (value === 'clear_red') {
    return 'clear_all_red'
  }

  return null
}

function parseObjective(value: unknown, levelId: number, index: number): LevelObjective {
  if (!isRecord(value)) {
    throw new Error(`Level ${levelId} objective ${index} must be an object.`)
  }

  const type = normalizeObjectiveType(value.type)
  if (!type) {
    throw new Error(`Level ${levelId} objective ${index} has unsupported type "${String(value.type)}".`)
  }

  if (value.targetColor !== undefined && !isCubeColor(value.targetColor)) {
    throw new Error(`Level ${levelId} objective ${index} has invalid targetColor.`)
  }

  const targetLevel = value.targetLevel
  const targetCount = value.targetCount

  if (targetLevel !== undefined && targetLevel !== null && (!Number.isInteger(targetLevel) || Number(targetLevel) < 1)) {
    throw new Error(`Level ${levelId} objective ${index} has invalid targetLevel.`)
  }

  if (targetCount !== undefined && targetCount !== null && (!Number.isInteger(targetCount) || Number(targetCount) === 0)) {
    throw new Error(`Level ${levelId} objective ${index} has invalid targetCount.`)
  }

  return {
    type,
    targetColor: value.targetColor,
    targetLevel: typeof targetLevel === 'number' ? targetLevel : undefined,
    targetCount: typeof targetCount === 'number' ? targetCount : undefined
  }
}

function parseInitialCube(value: unknown, levelId: number, index: number): Omit<CubeData, 'id'> {
  if (!isRecord(value)) {
    throw new Error(`Level ${levelId} initialMap entry ${index} must be an object.`)
  }

  if (!isCubeColor(value.color)) {
    throw new Error(`Level ${levelId} initialMap entry ${index} has invalid color.`)
  }

  const x = value.x
  const y = value.y
  const z = value.z
  const level = value.level
  const coordinates: unknown[] = [x, y, z]
  if (!coordinates.every((coordinate) => Number.isInteger(coordinate) && Number(coordinate) >= 0)) {
    throw new Error(`Level ${levelId} initialMap entry ${index} has invalid coordinates.`)
  }

  if (!Number.isInteger(level) || Number(level) < 1 || Number(level) > 9) {
    throw new Error(`Level ${levelId} initialMap entry ${index} has invalid level.`)
  }

  return {
    x: x as number,
    y: y as number,
    z: z as number,
    color: value.color,
    variant: value.variant === 'golden' ? 'golden' : undefined,
    level: level as number
  }
}

function parseLevel(value: unknown): LevelEntry {
  if (!isRecord(value)) {
    throw new Error('Level entry must be an object.')
  }

  const levelId = value.id
  if (!Number.isInteger(levelId) || Number(levelId) < 1) {
    throw new Error('Level id must be a positive integer.')
  }
  const parsedLevelId = Number(levelId)

  if (typeof value.name !== 'string' || value.name.length === 0) {
    throw new Error(`Level ${parsedLevelId} requires a non-empty name.`)
  }

  if (value.gridSize !== 3 && value.gridSize !== 4 && value.gridSize !== 5) {
    throw new Error(`Level ${parsedLevelId} gridSize must be 3, 4, or 5.`)
  }

  if (value.spawnMode !== 'static' && value.spawnMode !== 'dynamic') {
    throw new Error(`Level ${parsedLevelId} spawnMode must be static or dynamic.`)
  }

  if (!Array.isArray(value.objectives) || value.objectives.length === 0) {
    throw new Error(`Level ${parsedLevelId} requires at least one objective.`)
  }

  if (!Array.isArray(value.initialMap)) {
    throw new Error(`Level ${parsedLevelId} requires an initialMap array.`)
  }

  const objectives = value.objectives.map((objective, index) => parseObjective(objective, parsedLevelId, index))
  const initialMap = value.initialMap.map((cube, index) => parseInitialCube(cube, parsedLevelId, index))
  const occupied = new Set<string>()

  for (const cube of initialMap) {
    if (cube.x >= value.gridSize || cube.y >= value.gridSize || cube.z >= value.gridSize) {
      throw new Error(`Level ${parsedLevelId} has cube outside grid bounds.`)
    }

    const cellKey = `${cube.x}:${cube.y}:${cube.z}`
    if (occupied.has(cellKey)) {
      throw new Error(`Level ${parsedLevelId} has overlapping cube at ${cellKey}.`)
    }
    occupied.add(cellKey)
  }

  const rawLimits = isRecord(value.limits) ? value.limits : null
  const limits = value.limits === null || value.limits === undefined
    ? null
    : {
        steps: rawLimits && Number.isInteger(rawLimits.steps) ? rawLimits.steps as number : undefined,
        time: rawLimits && Number.isInteger(rawLimits.time) ? rawLimits.time as number : undefined
      }

  const rawDynamicParams = isRecord(value.dynamicParams) ? value.dynamicParams : null
  const dynamicParams = value.dynamicParams === null || value.dynamicParams === undefined
    ? null
    : {
        spawnIntervalSteps: Number(rawDynamicParams?.spawnIntervalSteps ?? 0),
        redWeight: Number(rawDynamicParams?.redWeight ?? 0),
        yellowWeight: Number(rawDynamicParams?.yellowWeight ?? 0)
      }

  const reward = isRecord(value.reward) ? value.reward : null
  if (!reward || !Number.isInteger(reward.coins) || Number(reward.coins) < 0) {
    throw new Error(`Level ${parsedLevelId} reward.coins must be a non-negative integer.`)
  }

  return {
    id: parsedLevelId,
    name: value.name,
    gridSize: value.gridSize,
    spawnMode: value.spawnMode,
    objectives,
    limits,
    initialMap,
    dynamicParams,
    reward: { coins: reward.coins as number },
    generatedHintPath: Array.isArray(value.generatedHintPath) ? value.generatedHintPath as GeneratedHintStep[] : undefined
  }
}

export function parseLevelCatalog(value: unknown): LevelCatalog {
  if (!isRecord(value) || !Array.isArray(value.levels)) {
    throw new Error('Level catalog requires a levels array.')
  }

  const levels = value.levels.map(parseLevel).sort((left, right) => left.id - right.id)
  const levelIds = new Set<number>()

  for (const level of levels) {
    if (levelIds.has(level.id)) {
      throw new Error(`Duplicate level id ${level.id}.`)
    }
    levelIds.add(level.id)
  }

  return { levels }
}

export const levelCatalog = parseLevelCatalog(rawLevels)

export function getLevelById(levelId: number): LevelEntry {
  const level = levelCatalog.levels.find((entry) => entry.id === levelId)
  if (!level) {
    throw new Error(`Level ${levelId} not found in catalog.`)
  }

  return level
}

export function buildPlayableConfigFromLevel(levelId: number): PlayableDemoConfig {
  const level = getLevelById(levelId)

  const baseConfig = buildPlayableDemoConfig()
  const usesClearAllRed = level.objectives.some((objective) => objective.type === 'clear_all_red')
  const mergeBase: Record<number, number> = {}
  const devourRedBase: Record<number, number> = {}
  const devourYellowBase: Record<number, number> = {}

  for (let authoredLevel = 1; authoredLevel <= 9; authoredLevel += 1) {
    mergeBase[authoredLevel] = SCORE_VALUES[Math.max(0, authoredLevel - 1)] ?? SCORE_VALUES[SCORE_VALUES.length - 1] ?? 0
    devourRedBase[authoredLevel] = SCORE_VALUES[Math.max(0, authoredLevel - 1)] ?? SCORE_VALUES[SCORE_VALUES.length - 1] ?? 0
    devourYellowBase[authoredLevel] = COIN_VALUES[Math.max(0, authoredLevel - 1)] ?? COIN_VALUES[COIN_VALUES.length - 1] ?? 0
  }

  return {
    ...baseConfig,
    board: {
      gridSize: level.id === 999 ? 3 : level.gridSize,
      cubes: level.initialMap.map((cube, index) => ({ ...cube, id: `lvl${level.id.toString().padStart(2, '0')}_${index.toString().padStart(3, '0')}` }))
    },
    inventory: {
      bombCount: 0
    },
    scoring: {
      mergeBase,
      devourRedBase,
      devourYellowBase
    },
    winLoss: {
      ...baseConfig.winLoss,
      victory: usesClearAllRed ? 'clear_all_red' : 'none'
    },
    endless: level.id === 999 && level.dynamicParams
      ? {
          enabled: true,
          refillDelayMs: 300,
          spawnIntervalSteps: Math.max(1, level.dynamicParams.spawnIntervalSteps),
          redWeight: Math.max(0, level.dynamicParams.redWeight),
          yellowWeight: Math.max(0, level.dynamicParams.yellowWeight),
          blueWeight: Math.max(0, 100 - level.dynamicParams.redWeight - level.dynamicParams.yellowWeight)
        }
      : undefined
  }
}
