import type { CubeData, PlayableDemoConfig, SliceState } from '../model/types'

export interface MergeBoardAction {
  type: 'merge'
  sourceId: string
  targetId: string
}

export interface DevourBoardAction {
  type: 'devour'
  sourceId: string
  targetId: string
}

export type DemoBoardAction = MergeBoardAction | DevourBoardAction

export type DemoBoardActionFailureReason = 'missing_source' | 'missing_target' | 'unsupported_source' | 'invalid_target'

export interface InvalidBoardActionResult {
  kind: 'invalid'
  reason: DemoBoardActionFailureReason
  cubes: CubeData[]
  baseScore: 0
}

export interface MergeBoardActionResult {
  kind: 'merge'
  cubes: CubeData[]
  baseScore: number
  sourceId: string
  targetId: string
  nextLevel: number
}

export interface DevourBoardActionResult {
  kind: 'devour_red' | 'devour_yellow'
  cubes: CubeData[]
  baseScore: number
  sourceId: string
  targetId: string
  consumedLevel: number
}

export type ResolveBoardActionResult =
  | InvalidBoardActionResult
  | MergeBoardActionResult
  | DevourBoardActionResult

export interface InvalidBombResult {
  kind: 'invalid'
  reason: 'missing_target'
  cubes: CubeData[]
}

export interface BombResult {
  kind: 'bomb'
  cubes: CubeData[]
  targetId: string
}

export type ResolveBombResult = InvalidBombResult | BombResult

export type MatchResult =
  | { kind: 'victory' }
  | { kind: 'game_over' }
  | { kind: 'in_progress' }

function cloneCube(cube: CubeData): CubeData {
  return { ...cube }
}

function cloneCubes(cubes: CubeData[]): CubeData[] {
  return cubes.map(cloneCube)
}

function findCube(cubes: CubeData[], cubeId: string): CubeData | undefined {
  return cubes.find((cube) => cube.id === cubeId)
}

function isVisibleInSlice(cube: CubeData, slice: SliceState): boolean {
  if (!slice.axis || slice.index < 0) {
    return true
  }

  return cube[slice.axis] === slice.index
}

function canResolveAction(source: CubeData, target: CubeData, action: DemoBoardAction): boolean {
  if (source.color !== 'blue') {
    return false
  }

  if (action.type === 'merge') {
    return target.color === 'blue' && source.level === target.level
  }

  return (target.color === 'red' || target.color === 'yellow') && source.level >= target.level
}

function canTargetFromBlue(source: CubeData, target: CubeData): boolean {
  if (source.color !== 'blue') {
    return false
  }

  return (target.color === 'blue' && source.level === target.level)
    || ((target.color === 'red' || target.color === 'yellow') && source.level >= target.level)
}

function hasLegalBlueMove(cubes: CubeData[]): boolean {
  return cubes.some((cube) => cube.color === 'blue' && getValidTargets(cubes, cube.id).length > 0)
}

export function isAdjacent(a: CubeData, b: CubeData): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  const dz = Math.abs(a.z - b.z)

  return (dx === 1 && dy === 0 && dz === 0) || (dx === 0 && dy === 1 && dz === 0) || (dx === 0 && dy === 0 && dz === 1)
}

export function getValidTargets(cubes: CubeData[], sourceId: string): string[] {
  const source = findCube(cubes, sourceId)

  if (!source) {
    return []
  }

  return cubes
    .filter((target) => target.id !== source.id && isAdjacent(source, target) && canTargetFromBlue(source, target))
    .map((target) => target.id)
}

export function getVisibleValidTargets(cubes: CubeData[], sourceId: string, slice: SliceState): string[] {
  return getValidTargets(cubes, sourceId).filter((targetId) => {
    const target = findCube(cubes, targetId)
    return target ? isVisibleInSlice(target, slice) : false
  })
}

export function getVisibleBombTargets(cubes: CubeData[], slice: SliceState): string[] {
  return cubes
    .filter((cube) => (cube.color === 'red' || cube.color === 'yellow') && isVisibleInSlice(cube, slice))
    .map((cube) => cube.id)
}

export function resolveBoardAction(
  cubes: CubeData[],
  action: DemoBoardAction,
  config: Pick<PlayableDemoConfig, 'scoring'>
): ResolveBoardActionResult {
  const source = findCube(cubes, action.sourceId)
  if (!source) {
    return { kind: 'invalid', reason: 'missing_source', cubes: cloneCubes(cubes), baseScore: 0 }
  }

  const target = findCube(cubes, action.targetId)
  if (!target) {
    return { kind: 'invalid', reason: 'missing_target', cubes: cloneCubes(cubes), baseScore: 0 }
  }

  if (source.color !== 'blue') {
    return { kind: 'invalid', reason: 'unsupported_source', cubes: cloneCubes(cubes), baseScore: 0 }
  }

  if (!isAdjacent(source, target) || !canResolveAction(source, target, action)) {
    return { kind: 'invalid', reason: 'invalid_target', cubes: cloneCubes(cubes), baseScore: 0 }
  }

  if (action.type === 'merge') {
    const nextLevel = source.level + 1
    const mergedCubes = cubes
      .filter((cube) => cube.id !== target.id)
      .map((cube) => (cube.id === source.id ? { ...cube, x: target.x, y: target.y, z: target.z, level: nextLevel } : cloneCube(cube)))

    return {
      kind: 'merge',
      cubes: mergedCubes,
      baseScore: config.scoring.mergeBase[nextLevel] ?? 0,
      sourceId: source.id,
      targetId: target.id,
      nextLevel
    }
  }

  const devouredCubes = cubes
    .filter((cube) => cube.id !== target.id)
    .map((cube) => (cube.id === source.id ? { ...cube, x: target.x, y: target.y, z: target.z } : cloneCube(cube)))

  return {
    kind: target.color === 'red' ? 'devour_red' : 'devour_yellow',
    cubes: devouredCubes,
    baseScore: target.color === 'red'
      ? (config.scoring.devourRedBase[target.level] ?? 0)
      : (config.scoring.devourYellowBase[target.level] ?? 0),
    sourceId: source.id,
    targetId: target.id,
    consumedLevel: target.level
  }
}

export function resolveBomb(cubes: CubeData[], targetId: string): ResolveBombResult {
  if (!findCube(cubes, targetId)) {
    return { kind: 'invalid', reason: 'missing_target', cubes: cloneCubes(cubes) }
  }

  return {
    kind: 'bomb',
    cubes: cubes.filter((cube) => cube.id !== targetId).map(cloneCube),
    targetId
  }
}

export function getMatchResult(cubes: CubeData[], bombCount: number): MatchResult {
  const hasRed = cubes.some((cube) => cube.color === 'red')

  if (!hasRed) {
    return { kind: 'victory' }
  }

  if (bombCount === 0 && !hasLegalBlueMove(cubes)) {
    return { kind: 'game_over' }
  }

  return { kind: 'in_progress' }
}

export function getComboScore(baseScore: number, comboCount: number, table: number[]): number {
  if (table.length === 0) {
    return baseScore
  }

  const multiplierIndex = Math.max(0, Math.min(comboCount, table.length) - 1)
  return baseScore * table[multiplierIndex]
}
