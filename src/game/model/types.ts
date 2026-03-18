export type CubeColor = 'blue' | 'red' | 'yellow'

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
  axis: 'x' | 'y' | 'z' | null
  index: number
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
