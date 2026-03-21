import type { CubeColor, CubeData, PlayableDemoConfig } from '../model/types'
import { buildPlayableDemoConfig } from './playableDemo'
import { assertPlayableDemoConfig } from './playableDemoValidation'

export const GRID_SIZE = 3
export const CUBE_SIZE = 1
export const CUBE_GAP = 0.2
export const MAX_LEVEL = 9
export const COMBO_TIMEOUT = 3000

export const SCORE_VALUES = [10, 30, 80, 200, 500, 1200, 3000, 8000, 25000]
export const COIN_VALUES = [1, 3, 8, 20, 50, 120, 300, 800, 2500]

export const CUBE_COLORS: Record<CubeColor, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#fbbf24'
}

export function getValidatedPlayableDemoConfig(config: unknown = buildPlayableDemoConfig()): PlayableDemoConfig {
  assertPlayableDemoConfig(config)
  return config
}

export function getInitialCubes(config: unknown = buildPlayableDemoConfig()): CubeData[] {
  return getValidatedPlayableDemoConfig(config).board.cubes.map((cube) => ({ ...cube }))
}

export { buildPlayableDemoConfig }
