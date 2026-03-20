export type CubeColor = 'blue' | 'red' | 'yellow'

export type SliceAxis = 'x' | 'y' | 'z'

export type PlayableDemoVictoryCondition = 'clear_all_red'

export type PlayableDemoSliceLayout = 'current-implementation'

export interface CubeData {
  id: string
  color: CubeColor
  level: number
  x: number
  y: number
  z: number
}

export type Locale = 'zh-CN' | 'en'

export interface SliceState {
  axis: SliceAxis | null
  index: number
}

export interface PlayableDemoBoardConfig {
  gridSize: number
  cubes: CubeData[]
}

export interface PlayableDemoInventoryConfig {
  bombCount: number
}

export interface PlayableDemoComboConfig {
  timeoutMs: number
  multiplierTable: number[]
}

export interface PlayableDemoScoringConfig {
  mergeBase: Record<number, number>
  devourRedBase: Record<number, number>
  devourYellowBase: Record<number, number>
}

export interface PlayableDemoWinLossConfig {
  victory: PlayableDemoVictoryCondition
  requireNoMovesForGameOver: true
  requireNoBombsForGameOver: true
}

export interface PlayableDemoUiConfig {
  showCombo: boolean
  showPause: boolean
  sliceLayout: PlayableDemoSliceLayout
}

export interface PlayableDemoConfig {
  board: PlayableDemoBoardConfig
  inventory: PlayableDemoInventoryConfig
  combo: PlayableDemoComboConfig
  scoring: PlayableDemoScoringConfig
  winLoss: PlayableDemoWinLossConfig
  ui: PlayableDemoUiConfig
}

export interface MergeAnimationState {
  sourceId: string
  targetId: string
  targetPosition: { x: number; y: number; z: number }
  nextLevel: number
  startTime: number
  duration: number
  sourceColor: CubeColor
}
