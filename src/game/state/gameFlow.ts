import type { CubeData, GameOverlay, GameRunState, MatchResult, ResumeTargetState, StatusHintKey } from '../model/types'
import { getMatchResult } from './demoRules'

const COMBO_TEXT_BY_COUNT = ['', '', 'Nice!', 'Great!', 'Awesome!', 'Amazing!', 'Godlike!']

export interface ComboState {
  comboCount: number
  comboText: string | null
  lastActionAt: number | null
  comboExpiresAt: number | null
}

export interface FlowSnapshot {
  cubes: CubeData[]
  bombCount: number
  selectedCubeId: string | null
  validTargetIds: string[]
  runState: GameRunState
}

export interface PostActionEvaluation {
  matchResult: MatchResult
  runState: GameRunState
  overlay: GameOverlay
  resumeTargetState: ResumeTargetState
  statusHintKey: StatusHintKey
}

function getComboText(comboCount: number): string {
  return comboCount < COMBO_TEXT_BY_COUNT.length ? COMBO_TEXT_BY_COUNT[comboCount] : 'UNSTOPPABLE!'
}

export function deriveStatusHintKey(snapshot: {
  runState: GameRunState
  overlay: GameOverlay
  bombCount: number
  selectedCubeId: string | null
  validTargetIds: string[]
  bombTargetIds: string[]
  matchResult: MatchResult
  hasHiddenLegalMoves: boolean
}): StatusHintKey | null {
  if (snapshot.overlay !== 'none') {
    return null
  }

  if (snapshot.runState === 'resolving') {
    return 'resolving'
  }

  if (snapshot.runState === 'targeting_bomb') {
    return 'choose_bomb_target'
  }

  if (snapshot.selectedCubeId && snapshot.validTargetIds.length > 0) {
    return 'choose_target'
  }

  if (snapshot.bombCount > 0 && snapshot.bombTargetIds.length > 0 && snapshot.selectedCubeId && snapshot.validTargetIds.length === 0) {
    return 'use_bomb'
  }

  if (snapshot.hasHiddenLegalMoves) {
    return 'movesHiddenByView'
  }

  return 'select_blue_cube'
}

export function advanceComboState(snapshot: ComboState, now: number, timeoutMs: number): ComboState {
  const isExpired = snapshot.lastActionAt === null || now - snapshot.lastActionAt > timeoutMs
  const comboCount = isExpired ? 1 : snapshot.comboCount + 1

  return {
    comboCount,
    comboText: comboCount > 1 ? getComboText(comboCount) : null,
    lastActionAt: now,
    comboExpiresAt: now + timeoutMs
  }
}

export function resetComboState(): ComboState {
  return {
    comboCount: 0,
    comboText: null,
    lastActionAt: null,
    comboExpiresAt: null
  }
}

export function shouldExpireCombo(snapshot: ComboState, now: number): boolean {
  return snapshot.comboExpiresAt !== null && now >= snapshot.comboExpiresAt
}

export function evaluatePostAction(snapshot: FlowSnapshot): Omit<PostActionEvaluation, 'statusHintKey'> & { matchResult: MatchResult } {
  const matchResult = getMatchResult(snapshot.cubes, snapshot.bombCount)

  if (matchResult.kind === 'victory') {
    return {
      matchResult,
      runState: 'victory',
      overlay: 'victory',
      resumeTargetState: null
    }
  }

  if (matchResult.kind === 'game_over') {
    return {
      matchResult,
      runState: 'game_over',
      overlay: 'game_over',
      resumeTargetState: null
    }
  }

  const runState: GameRunState = snapshot.selectedCubeId ? 'selected' : 'idle'

  return {
    matchResult,
    runState,
    overlay: 'none',
    resumeTargetState: null
  }
}
