import type { CubeData, PlayableDemoConfig } from '../model/types'

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

function isOrthogonallyAdjacent(a: CubeData, b: CubeData) {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  const dz = Math.abs(a.z - b.z)

  return (dx === 1 && dy === 0 && dz === 0)
    || (dx === 0 && dy === 1 && dz === 0)
    || (dx === 0 && dy === 0 && dz === 1)
}

function collectCubeLevels(cubes: CubeData[], color: CubeData['color']): number[] {
  return [...new Set(cubes.filter((cube) => cube.color === color).map((cube) => cube.level))].sort((a, b) => a - b)
}

function collectMergeResultLevels(cubes: CubeData[]): number[] {
  const levels = new Set<number>()

  for (let index = 0; index < cubes.length; index += 1) {
    const source = cubes[index]

    if (source.color !== 'blue') continue

    for (let nextIndex = index + 1; nextIndex < cubes.length; nextIndex += 1) {
      const target = cubes[nextIndex]

      if (target.color !== 'blue') continue
      if (source.level !== target.level) continue
      if (!isOrthogonallyAdjacent(source, target)) continue

      levels.add(source.level + 1)
    }
  }

  return [...levels].sort((a, b) => a - b)
}

function hasScoreForLevel(table: unknown, level: number): boolean {
  return isRecord(table) && typeof table[level] === 'number'
}

export function validatePlayableDemoConfig(config: unknown): PlayableDemoConfigError[] {
  const errors: PlayableDemoConfigError[] = []

  if (!isRecord(config)) {
    return [new PlayableDemoConfigError('Playable demo config must be an object.')]
  }

  const board = isRecord(config.board) ? config.board : null
  const combo = isRecord(config.combo) ? config.combo : null
  const scoring = isRecord(config.scoring) ? config.scoring : null
  const winLoss = isRecord(config.winLoss) ? config.winLoss : null
  const ui = isRecord(config.ui) ? config.ui : null

  const gridSize = typeof board?.gridSize === 'number' ? board.gridSize : null
  const cubes = Array.isArray(board?.cubes) ? board.cubes.filter(isCubeData) : []

  if (gridSize === null) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires board.gridSize.'))
  }

  if (!Array.isArray(board?.cubes)) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires board.cubes.'))
  }

  if (!Array.isArray(combo?.multiplierTable) || combo.multiplierTable.length === 0) {
    errors.push(new PlayableDemoConfigError('Playable demo config requires a non-empty combo multiplier table.'))
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

  if (winLoss?.victory !== 'clear_all_red') {
    errors.push(new PlayableDemoConfigError('Playable demo config requires winLoss.victory to be clear_all_red.'))
  }

  if (ui?.sliceLayout !== 'current-implementation') {
    errors.push(new PlayableDemoConfigError('Playable demo config requires ui.sliceLayout to be current-implementation.'))
  }

  if (gridSize !== null) {
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
