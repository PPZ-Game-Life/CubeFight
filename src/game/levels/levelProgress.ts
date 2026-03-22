import type { CubeData } from '../model/types'
import type { GameStoreSnapshot } from '../state/gameStore'
import type { LevelEntry, LevelObjective } from './levelCatalog'

export type ObjectiveProgress = {
  objective: LevelObjective
  current: number
  target: number | null
  complete: boolean
}

export type LevelEvaluation = {
  completed: boolean
  failed: boolean
  stepsRemaining: number | null
  objectives: ObjectiveProgress[]
}

function countCubes(cubes: CubeData[], color: LevelObjective['targetColor'], level: number | undefined) {
  return cubes.filter((cube) => (!color || cube.color === color) && (level === undefined || cube.level === level)).length
}

function getObjectiveProgress(snapshot: GameStoreSnapshot, objective: LevelObjective): ObjectiveProgress {
  if (objective.type === 'merge') {
    const current = countCubes(snapshot.cubes, objective.targetColor, objective.targetLevel)
    return {
      objective,
      current,
      target: 1,
      complete: current > 0
    }
  }

  if (objective.type === 'devour') {
    const key = `${objective.targetColor}:${objective.targetLevel}`
    const current = snapshot.actionStats.devourCounts[key] ?? 0
    const target = objective.targetCount ?? 1
    return {
      objective,
      current,
      target,
      complete: current >= target
    }
  }

  if (objective.type === 'score') {
    const target = objective.targetCount ?? 0
    return {
      objective,
      current: snapshot.score,
      target,
      complete: target < 0 ? false : snapshot.score >= target
    }
  }

  const remainingRed = snapshot.cubes.filter((cube) => cube.color === 'red').length
  return {
    objective,
    current: remainingRed === 0 ? 1 : 0,
    target: 1,
    complete: remainingRed === 0
  }
}

export function evaluateLevel(snapshot: GameStoreSnapshot, level: LevelEntry): LevelEvaluation {
  const objectives = level.objectives.map((objective) => getObjectiveProgress(snapshot, objective))
  const completed = objectives.every((objective) => objective.complete)
  const stepsRemaining = level.limits?.steps !== undefined ? Math.max(0, level.limits.steps - snapshot.actionStats.actionsUsed) : null
  const failed = !completed && stepsRemaining !== null && stepsRemaining === 0

  return {
    completed,
    failed,
    stepsRemaining,
    objectives
  }
}

export function formatObjectiveText(progress: ObjectiveProgress): string {
  const { objective } = progress

  if (objective.type === 'merge') {
    return `Merge Lv.${objective.targetLevel} ${objective.targetColor}`
  }

  if (objective.type === 'devour') {
    const countText = objective.targetCount && objective.targetCount > 1 ? ` x${objective.targetCount}` : ''
    return `Devour Lv.${objective.targetLevel} ${objective.targetColor}${countText}`
  }

  if (objective.type === 'score') {
    return objective.targetCount === -1 ? 'Score endlessly' : `Reach ${objective.targetCount} score`
  }

  return 'Clear all red cubes'
}
