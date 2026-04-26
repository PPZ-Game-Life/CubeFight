import type { CubeData } from '../game/model/types'

export type EndlessGridSize = 2 | 3 | 4 | 5

export type PlayerProgress = {
  tutorialCompleted: boolean
  endlessUnlocked: boolean
  bestScore: number
  preferredGridSize: EndlessGridSize
  playerId: string
  weeklyBestScore: number
  weeklyBestMergeLevel: number
  leaderboardWeekKey: string
}

export type LeaderboardEntry = {
  rank: number
  playerId: string
  score: number
  maxMergeLevel: number
  isCurrentPlayer: boolean
}

type WeeklyLeaderboardState = {
  weekKey: string
  playerEntry: Omit<LeaderboardEntry, 'rank' | 'isCurrentPlayer'> | null
}

const PROGRESS_STORAGE_KEY = 'cubefight.progress'
const LEADERBOARD_STORAGE_KEY = 'cubefight.leaderboard.weekly'

export const GRID_UNLOCK_THRESHOLDS: Record<EndlessGridSize, number> = {
  2: 0,
  3: 0,
  4: 20000,
  5: 100000
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampGridSize(value: unknown): EndlessGridSize {
  if (value === 2 || value === 3 || value === 4 || value === 5) {
    return value
  }

  return 3
}

function randomPlayerId() {
  return `P-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export function getCurrentWeekKey(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

function getDefaultProgress(): PlayerProgress {
  const currentWeekKey = getCurrentWeekKey()

  return {
    tutorialCompleted: false,
    endlessUnlocked: false,
    bestScore: 0,
    preferredGridSize: 3,
    playerId: randomPlayerId(),
    weeklyBestScore: 0,
    weeklyBestMergeLevel: 0,
    leaderboardWeekKey: currentWeekKey
  }
}

export function getUnlockedGridSizes(bestScore: number): EndlessGridSize[] {
  return ([3, 4, 5] as EndlessGridSize[]).filter((size) => bestScore >= GRID_UNLOCK_THRESHOLDS[size])
}

export function getHighestUnlockedGridSize(bestScore: number): EndlessGridSize {
  const unlockedGridSizes = getUnlockedGridSizes(bestScore)
  return unlockedGridSizes[unlockedGridSizes.length - 1] ?? 3
}

export function normalizeProgress(progress: Partial<PlayerProgress> | null | undefined): PlayerProgress {
  const fallback = getDefaultProgress()
  const normalizedBestScore = typeof progress?.bestScore === 'number' && Number.isFinite(progress.bestScore)
    ? Math.max(0, Math.floor(progress.bestScore))
    : 0
  const tutorialCompleted = progress?.tutorialCompleted === true
  const endlessUnlocked = progress?.endlessUnlocked === true || tutorialCompleted
  const leaderboardWeekKey = typeof progress?.leaderboardWeekKey === 'string' && progress.leaderboardWeekKey.length > 0
    ? progress.leaderboardWeekKey
    : fallback.leaderboardWeekKey
  const currentWeekKey = getCurrentWeekKey()
  const preferredGridSize = clampGridSize(progress?.preferredGridSize)
  const highestUnlockedGridSize = getHighestUnlockedGridSize(normalizedBestScore)

  return {
    tutorialCompleted,
    endlessUnlocked,
    bestScore: normalizedBestScore,
    preferredGridSize: preferredGridSize <= highestUnlockedGridSize ? preferredGridSize : highestUnlockedGridSize,
    playerId: typeof progress?.playerId === 'string' && progress.playerId.length > 0 ? progress.playerId : fallback.playerId,
    weeklyBestScore: leaderboardWeekKey === currentWeekKey && typeof progress?.weeklyBestScore === 'number'
      ? Math.max(0, Math.floor(progress.weeklyBestScore))
      : 0,
    weeklyBestMergeLevel: leaderboardWeekKey === currentWeekKey && typeof progress?.weeklyBestMergeLevel === 'number'
      ? Math.max(0, Math.floor(progress.weeklyBestMergeLevel))
      : 0,
    leaderboardWeekKey: currentWeekKey
  }
}

export function readStoredProgress(): PlayerProgress {
  if (typeof window === 'undefined') {
    return getDefaultProgress()
  }

  const rawValue = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
  if (!rawValue) {
    return getDefaultProgress()
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PlayerProgress>
    return normalizeProgress(parsed)
  } catch {
    return getDefaultProgress()
  }
}

export function writeStoredProgress(progress: PlayerProgress) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

export function updateProgressFromEndlessRun(progress: PlayerProgress, score: number, maxMergeLevel: number): PlayerProgress {
  const normalizedScore = Math.max(0, Math.floor(score))
  const normalizedMergeLevel = Math.max(0, Math.floor(maxMergeLevel))
  const nextBestScore = Math.max(progress.bestScore, normalizedScore)
  const nextProgress = normalizeProgress({
    ...progress,
    bestScore: nextBestScore,
    weeklyBestScore: Math.max(progress.weeklyBestScore, normalizedScore),
    weeklyBestMergeLevel: normalizedScore >= progress.weeklyBestScore
      ? normalizedMergeLevel
      : progress.weeklyBestMergeLevel,
    endlessUnlocked: progress.endlessUnlocked || progress.tutorialCompleted
  })

  return nextProgress
}

function readWeeklyLeaderboardState(): WeeklyLeaderboardState {
  const currentWeekKey = getCurrentWeekKey()

  if (typeof window === 'undefined') {
    return {
      weekKey: currentWeekKey,
      playerEntry: null
    }
  }

  const rawValue = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY)
  if (!rawValue) {
    return {
      weekKey: currentWeekKey,
      playerEntry: null
    }
  }

  try {
    const parsed = JSON.parse(rawValue) as WeeklyLeaderboardState
    if (!isRecord(parsed) || parsed.weekKey !== currentWeekKey) {
      return {
        weekKey: currentWeekKey,
        playerEntry: null
      }
    }

    return {
      weekKey: currentWeekKey,
      playerEntry: parsed.playerEntry && typeof parsed.playerEntry.playerId === 'string'
        ? parsed.playerEntry
        : null
    }
  } catch {
    return {
      weekKey: currentWeekKey,
      playerEntry: null
    }
  }
}

function writeWeeklyLeaderboardState(state: WeeklyLeaderboardState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(state))
}

export function submitWeeklyLeaderboardScore(progress: PlayerProgress, score: number, maxMergeLevel: number) {
  const weeklyState = readWeeklyLeaderboardState()
  const normalizedScore = Math.max(0, Math.floor(score))
  const normalizedMergeLevel = Math.max(0, Math.floor(maxMergeLevel))
  const currentPlayerEntry = weeklyState.playerEntry?.playerId === progress.playerId ? weeklyState.playerEntry : null

  if (currentPlayerEntry && currentPlayerEntry.score >= normalizedScore) {
    return
  }

  writeWeeklyLeaderboardState({
    weekKey: weeklyState.weekKey,
    playerEntry: {
      playerId: progress.playerId,
      score: normalizedScore,
      maxMergeLevel: normalizedMergeLevel
    }
  })
}

export function getWeeklyLeaderboard(progress: PlayerProgress): { entries: LeaderboardEntry[]; playerEntry: LeaderboardEntry | null } {
  const weeklyState = readWeeklyLeaderboardState()
  const rawEntries: Array<Omit<LeaderboardEntry, 'rank' | 'isCurrentPlayer'>> = []

  if (weeklyState.playerEntry) {
    rawEntries.push(weeklyState.playerEntry)
  }

  rawEntries.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    if (right.maxMergeLevel !== left.maxMergeLevel) {
      return right.maxMergeLevel - left.maxMergeLevel
    }

    return left.playerId.localeCompare(right.playerId)
  })

  const entries = rawEntries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isCurrentPlayer: entry.playerId === progress.playerId
  }))

  return {
    entries,
    playerEntry: entries.find((entry) => entry.playerId === progress.playerId) ?? null
  }
}

export function getHighestMergeLevel(cubes: CubeData[]) {
  return cubes.reduce((highest, cube) => Math.max(highest, cube.level), 0)
}
