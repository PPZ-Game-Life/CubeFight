import type { CubeData, PlayableDemoConfig } from '../model/types'

const SUPPORTED_PLAYABLE_DEMO_GRID_SIZES = [3, 4, 5] as const

export class PlayableDemoConfigError extends Error {
  readonly issues: string[]

  constructor(messageOrIssues: string | string[]) {
    const issues = Array.isArray(messageOrIssues) ? messageOrIssues : [messageOrIssues]
    super(issues.join('; '))
    this.name = 'PlayableDemoConfigError'
    this.issues = issues
    Object.setPrototypeOf(this, PlayableDemoConfigError.prototype)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCubeData(value: unknown): value is CubeData {
  if (!isRecord(value)) return false

  return typeof value.id === 'string'
    && (value.color === 'blue' || value.color === 'red' || value.color === 'yellow')
    && typeof value.level === 'number'
    && typeof value.x === 'number'
    && typeof value.y === 'number'
    && typeof value.z === 'number'
}

function collectCubeLevels(cubes: CubeData[], color: CubeData['color']): number[] {
  return [...new Set(cubes.filter((cube) => cube.color === color).map((cube) => cube.level))].sort((a, b) => a - b)
}

function collectMergeResultLevels(cubes: CubeData[]): number[] {
  const blueLevelCounts = new Map<number, number>()
  const levels = new Set<number>()

  for (const cube of cubes) {
    if (cube.color !== 'blue') continue
    blueLevelCounts.set(cube.level, (blueLevelCounts.get(cube.level) ?? 0) + 1)
  }

  const orderedLevels = [...blueLevelCounts.keys()].sort((a, b) => a - b)

  for (let index = 0; index < orderedLevels.length; index += 1) {
    const level = orderedLevels[index]
    const count = blueLevelCounts.get(level) ?? 0
    const pairs = Math.floor(count / 2)

    if (pairs <= 0) continue

    const nextLevel = level + 1
    levels.add(nextLevel)
    blueLevelCounts.set(nextLevel, (blueLevelCounts.get(nextLevel) ?? 0) + pairs)

    if (!orderedLevels.includes(nextLevel)) {
      orderedLevels.push(nextLevel)
      orderedLevels.sort((a, b) => a - b)
    }
  }

  return [...levels].sort((a, b) => a - b)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function hasScoreForLevel(table: unknown, level: number): boolean {
  return isRecord(table) && isNonNegativeFiniteNumber(table[level])
}

function validateScoreTableValues(
  table: unknown,
  tableName: string,
  errors: PlayableDemoConfigError[]
) {
  if (!isRecord(table)) {
    return
  }

  for (const [level, value] of Object.entries(table)) {
    if (!isNonNegativeFiniteNumber(value)) {
      errors.push(new PlayableDemoConfigError(
        `Playable demo config requires ${tableName} level ${level} to be a finite non-negative number.`
      ))
    }
  }
}

export function validatePlayableDemoConfig(config: unknown): PlayableDemoConfigError[] {
  const errors: PlayableDemoConfigError[] = []

  if (!isRecord(config)) {
    return [new PlayableDemoConfigError('Playable demo config must be an object.')]
  }

  const board = isRecord(config.board) ? config.board : null
  const inventory = isRecord(config.inventory) ? config.inventory : null
  const combo = isRecord(config.combo) ? config.combo : null
  const scoring = isRecord(config.scoring) ? config.scoring : null
  const winLoss = isRecord(config.winLoss) ? config.winLoss : null
  const ui = isRecord(config.ui) ? config.ui : null
  const endless = config.endless === undefined ? null : (isRecord(config.endless) ? config.endless : null)

  const gridSize = typeof board?.gridSize === 'number' ? board.gridSize : null
  const cubes: CubeData[] = []

  if (gridSize === null) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires board.gridSize.'))
  } else if (!isPositiveInteger(gridSize)) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires board.gridSize to be a positive integer.'))
  } else if (!SUPPORTED_PLAYABLE_DEMO_GRID_SIZES.includes(gridSize as (typeof SUPPORTED_PLAYABLE_DEMO_GRID_SIZES)[number])) {
    errors.push(new PlayableDemoConfigError(
      `Playable demo config requires board.gridSize to be one of ${SUPPORTED_PLAYABLE_DEMO_GRID_SIZES.join(', ')}.`
    ))
  }

  if (!Array.isArray(board?.cubes)) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires board.cubes.'))
  } else {
    for (const [index, cube] of board.cubes.entries()) {
      if (!isCubeData(cube)) {
        errors.push(new PlayableDemoConfigError(`Invalid cube at index ${index}.`))
        continue
      }

      if (!isPositiveInteger(cube.level)) {
        errors.push(new PlayableDemoConfigError(`Cube "${cube.id}" level must be a positive integer.`))
      }

      cubes.push(cube)
    }
  }

  if (typeof inventory?.bombCount !== 'number') {
    errors.push(new PlayableDemoConfigError('Playable demo config requires inventory.bombCount.'))
  } else if (!isNonNegativeInteger(inventory.bombCount)) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires inventory.bombCount to be a non-negative integer.'))
  }

  if (typeof combo?.timeoutMs !== 'number') {
    errors.push(new PlayableDemoConfigError('Playable demo config requires combo.timeoutMs.'))
  } else if (!isPositiveFiniteNumber(combo.timeoutMs)) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires combo.timeoutMs to be a positive finite number.'))
  }

  if (!Array.isArray(combo?.multiplierTable) || combo.multiplierTable.length === 0) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires a non-empty combo multiplier table.'))
  } else {
    for (const [index, value] of combo.multiplierTable.entries()) {
      if (!isPositiveFiniteNumber(value)) {
        errors.push(new PlayableDemoConfigError(
          `Playable demo config requires combo multiplier at index ${index} to be a positive finite number.`
        ))
      }
    }
  }

  if (!scoring) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires scoring rules.'))
  }

  if (!isRecord(scoring?.mergeBase)) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires scoring.mergeBase.'))
  }

  if (!isRecord(scoring?.devourRedBase)) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires scoring.devourRedBase.'))
  }

  if (!isRecord(scoring?.devourYellowBase)) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires scoring.devourYellowBase.'))
  }

  validateScoreTableValues(scoring?.mergeBase, 'scoring.mergeBase', errors)
  validateScoreTableValues(scoring?.devourRedBase, 'scoring.devourRedBase', errors)
  validateScoreTableValues(scoring?.devourYellowBase, 'scoring.devourYellowBase', errors)

  if (winLoss?.victory !== 'clear_all_red' && winLoss?.victory !== 'none') {
    errors.push(new PlayableDemoConfigError('Playable demo config requires winLoss.victory to be clear_all_red or none.'))
  }

  if (winLoss?.requireNoMovesForGameOver !== true) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires winLoss.requireNoMovesForGameOver to be true.'))
  }

  if (winLoss?.requireNoBombsForGameOver !== true) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires winLoss.requireNoBombsForGameOver to be true.'))
  }

  if (typeof ui?.showCombo !== 'boolean') {
    errors.push(new PlayableDemoConfigError('Playable demo config requires ui.showCombo.'))
  }

  if (typeof ui?.showPause !== 'boolean') {
    errors.push(new PlayableDemoConfigError('Playable demo config requires ui.showPause.'))
  }

  if (ui?.sliceLayout !== 'current-implementation') {
    errors.push(new PlayableDemoConfigError('Playable demo config requires ui.sliceLayout to be current-implementation.'))
  }

  if (config.endless !== undefined) {
    if (!endless) {
      errors.push(new PlayableDemoConfigError('Playable demo config endless section must be an object when provided.'))
    } else {
      if (endless.enabled !== true) {
        errors.push(new PlayableDemoConfigError('Playable demo config endless.enabled must be true when endless config is provided.'))
      }
      if (!isPositiveFiniteNumber(endless.refillDelayMs)) {
        errors.push(new PlayableDemoConfigError('Playable demo config endless.refillDelayMs must be a positive finite number.'))
      }
      if (!isPositiveInteger(endless.spawnIntervalSteps)) {
        errors.push(new PlayableDemoConfigError('Playable demo config endless.spawnIntervalSteps must be a positive integer.'))
      }
      if (!isNonNegativeFiniteNumber(endless.redWeight) || !isNonNegativeFiniteNumber(endless.yellowWeight) || !isNonNegativeFiniteNumber(endless.blueWeight)) {
        errors.push(new PlayableDemoConfigError('Playable demo config endless weights must be finite non-negative numbers.'))
      }
      const weightSum = Number(endless.redWeight ?? 0) + Number(endless.yellowWeight ?? 0) + Number(endless.blueWeight ?? 0)
      if (!(weightSum > 0)) {
        errors.push(new PlayableDemoConfigError('Playable demo config endless weights must sum to a positive number.'))
      }
    }
  }

  if (gridSize !== null && SUPPORTED_PLAYABLE_DEMO_GRID_SIZES.includes(gridSize as (typeof SUPPORTED_PLAYABLE_DEMO_GRID_SIZES)[number])) {
    const seenIds = new Set<string>()
    const occupiedCells = new Set<string>()

    for (const cube of cubes) {
      if (seenIds.has(cube.id)) {
        errors.push(new PlayableDemoConfigError(`Found duplicate cube id "${cube.id}".`))
      }
      seenIds.add(cube.id)

      const coordinates = [
        ['x', cube.x],
        ['y', cube.y],
        ['z', cube.z]
      ] as const

      for (const [axis, value] of coordinates) {
        if (!Number.isInteger(value) || value < 0 || value >= gridSize) {
          errors.push(new PlayableDemoConfigError(
            `Cube "${cube.id}" has out-of-bounds ${axis} coordinate ${value} for grid size ${gridSize}.`
          ))
        }
      }

      const cellKey = `${cube.x}:${cube.y}:${cube.z}`
      if (occupiedCells.has(cellKey)) {
        errors.push(new PlayableDemoConfigError(`Found overlapping cell at ${cellKey}.`))
      }
      occupiedCells.add(cellKey)
    }

    const redLevels = collectCubeLevels(cubes, 'red')
    const yellowLevels = collectCubeLevels(cubes, 'yellow')
    const mergeLevels = collectMergeResultLevels(cubes)

    for (const level of redLevels) {
      if (!hasScoreForLevel(scoring?.devourRedBase, level)) {
        errors.push(new PlayableDemoConfigError(`Missing score coverage for authored red cube level ${level}.`))
      }
    }

    for (const level of yellowLevels) {
      if (!hasScoreForLevel(scoring?.devourYellowBase, level)) {
        errors.push(new PlayableDemoConfigError(`Missing score coverage for authored yellow cube level ${level}.`))
      }
    }

    for (const level of mergeLevels) {
      if (!hasScoreForLevel(scoring?.mergeBase, level)) {
        errors.push(new PlayableDemoConfigError(`Missing merge score coverage for authored merge-result level ${level}.`))
      }
    }
  }

  return errors
}

export function assertPlayableDemoConfig(config: unknown): asserts config is PlayableDemoConfig {
  const errors = validatePlayableDemoConfig(config)

  if (errors.length > 0) {
    throw new PlayableDemoConfigError(errors.map((error) => error.message))
  }
}
