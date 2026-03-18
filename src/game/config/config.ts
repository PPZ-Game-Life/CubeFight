import type { CubeColor, CubeData } from '../model/types'

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

export const INITIAL_CUBES: CubeData[] = [
  { id: 'c000', color: 'blue', level: 1, x: 0, y: 0, z: 0 },
  { id: 'c001', color: 'blue', level: 1, x: 1, y: 0, z: 0 },
  { id: 'c002', color: 'yellow', level: 1, x: 2, y: 0, z: 0 },
  { id: 'c003', color: 'blue', level: 1, x: 0, y: 0, z: 1 },
  { id: 'c004', color: 'red', level: 1, x: 1, y: 0, z: 1 },
  { id: 'c005', color: 'yellow', level: 1, x: 2, y: 0, z: 1 },
  { id: 'c006', color: 'yellow', level: 1, x: 0, y: 0, z: 2 },
  { id: 'c007', color: 'blue', level: 1, x: 1, y: 0, z: 2 },
  { id: 'c008', color: 'red', level: 1, x: 2, y: 0, z: 2 },
  { id: 'c009', color: 'blue', level: 2, x: 0, y: 1, z: 0 },
  { id: 'c010', color: 'yellow', level: 1, x: 1, y: 1, z: 0 },
  { id: 'c011', color: 'blue', level: 1, x: 2, y: 1, z: 0 },
  { id: 'c012', color: 'red', level: 1, x: 0, y: 1, z: 1 },
  { id: 'c013', color: 'yellow', level: 1, x: 1, y: 1, z: 1 },
  { id: 'c014', color: 'yellow', level: 2, x: 2, y: 1, z: 1 },
  { id: 'c015', color: 'blue', level: 1, x: 0, y: 1, z: 2 },
  { id: 'c016', color: 'red', level: 1, x: 1, y: 1, z: 2 },
  { id: 'c017', color: 'blue', level: 1, x: 2, y: 1, z: 2 },
  { id: 'c018', color: 'yellow', level: 1, x: 0, y: 2, z: 0 },
  { id: 'c019', color: 'blue', level: 1, x: 1, y: 2, z: 0 },
  { id: 'c020', color: 'red', level: 1, x: 2, y: 2, z: 0 },
  { id: 'c021', color: 'red', level: 1, x: 0, y: 2, z: 1 },
  { id: 'c022', color: 'blue', level: 1, x: 1, y: 2, z: 1 },
  { id: 'c023', color: 'yellow', level: 1, x: 2, y: 2, z: 1 },
  { id: 'c024', color: 'blue', level: 1, x: 0, y: 2, z: 2 },
  { id: 'c025', color: 'blue', level: 1, x: 1, y: 2, z: 2 },
  { id: 'c026', color: 'red', level: 1, x: 2, y: 2, z: 2 }
]
