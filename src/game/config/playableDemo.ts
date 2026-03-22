import type { CubeData, PlayableDemoConfig, SliceState } from '../model/types'

const PLAYABLE_DEMO_GRID_SIZE = 3

const PLAYABLE_DEMO_CUBES: CubeData[] = [
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

const PLAYABLE_DEMO_CONFIG_TEMPLATE: PlayableDemoConfig = {
  board: {
    gridSize: PLAYABLE_DEMO_GRID_SIZE,
    cubes: PLAYABLE_DEMO_CUBES
  },
  inventory: {
    bombCount: 0
  },
  combo: {
    timeoutMs: 3000,
    multiplierTable: [1, 1.5, 2, 3]
  },
  scoring: {
    mergeBase: {
      2: 30,
      3: 80,
      4: 200
    },
    devourRedBase: {
      1: 10,
      2: 30
    },
    devourYellowBase: {
      1: 10,
      2: 30
    }
  },
  winLoss: {
    victory: 'clear_all_red',
    requireNoMovesForGameOver: true,
    requireNoBombsForGameOver: true
  },
  ui: {
    showCombo: true,
    showPause: true,
    sliceLayout: 'current-implementation'
  }
}

function cloneCube(cube: CubeData): CubeData {
  return { ...cube }
}

function cloneCubeList(cubes: CubeData[]): CubeData[] {
  return cubes.map(cloneCube)
}

function cloneScoreTable(table: Record<number, number>): Record<number, number> {
  const clone: Record<number, number> = {}

  for (const [level, score] of Object.entries(table)) {
    clone[Number(level)] = score
  }

  return clone
}

export function buildPlayableDemoConfig(): PlayableDemoConfig {
  return {
    board: {
      gridSize: PLAYABLE_DEMO_CONFIG_TEMPLATE.board.gridSize,
      cubes: cloneCubeList(PLAYABLE_DEMO_CONFIG_TEMPLATE.board.cubes)
    },
    inventory: {
      bombCount: PLAYABLE_DEMO_CONFIG_TEMPLATE.inventory.bombCount
    },
    combo: {
      timeoutMs: PLAYABLE_DEMO_CONFIG_TEMPLATE.combo.timeoutMs,
      multiplierTable: [...PLAYABLE_DEMO_CONFIG_TEMPLATE.combo.multiplierTable]
    },
    scoring: {
      mergeBase: cloneScoreTable(PLAYABLE_DEMO_CONFIG_TEMPLATE.scoring.mergeBase),
      devourRedBase: cloneScoreTable(PLAYABLE_DEMO_CONFIG_TEMPLATE.scoring.devourRedBase),
      devourYellowBase: cloneScoreTable(PLAYABLE_DEMO_CONFIG_TEMPLATE.scoring.devourYellowBase)
    },
    winLoss: {
      ...PLAYABLE_DEMO_CONFIG_TEMPLATE.winLoss
    },
    ui: {
      ...PLAYABLE_DEMO_CONFIG_TEMPLATE.ui
    }
  }
}

export function buildDuplicateIdConfig(): PlayableDemoConfig {
  const config = buildPlayableDemoConfig()
  config.board.cubes[1] = { ...config.board.cubes[1], id: config.board.cubes[0].id }
  return config
}

export function buildOverlappingCellConfig(): PlayableDemoConfig {
  const config = buildPlayableDemoConfig()
  const [firstCube] = config.board.cubes
  config.board.cubes[1] = {
    ...config.board.cubes[1],
    x: firstCube.x,
    y: firstCube.y,
    z: firstCube.z
  }
  return config
}

export function buildOutOfBoundsConfig(): PlayableDemoConfig {
  const config = buildPlayableDemoConfig()
  config.board.cubes[0] = {
    ...config.board.cubes[0],
    x: config.board.gridSize
  }
  return config
}

export function buildEmptyMultiplierConfig(): PlayableDemoConfig {
  const config = buildPlayableDemoConfig()
  config.combo.multiplierTable = []
  return config
}

export function buildNoMoveBoardWithRed(): CubeData[] {
  const cubes: CubeData[] = [
    { id: 'locked-red', color: 'red', level: 1, x: 1, y: 1, z: 1 },
    { id: 'locked-yellow-a', color: 'yellow', level: 2, x: 0, y: 0, z: 0 },
    { id: 'locked-yellow-b', color: 'yellow', level: 2, x: 2, y: 2, z: 2 }
  ]

  return cubes.map(cloneCube)
}

export function buildTopLayerSlice(): SliceState {
  return { axis: 'y', index: PLAYABLE_DEMO_GRID_SIZE - 1 }
}
