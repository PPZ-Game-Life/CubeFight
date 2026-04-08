import { buildPlayableConfigFromLevel } from './levelCatalog'
import type { CubeData, PlayableDemoConfig } from '../model/types'
import type { EndlessGridSize } from '../../app/endlessProgress'

const ENDLESS_LEVEL_ID = 999

type CubeSeed = Pick<CubeData, 'color' | 'level' | 'x' | 'y' | 'z'>

function createCube(id: string, color: CubeData['color'], level: number, x: number, y: number, z: number): CubeData {
  return { id, color, level, x, y, z }
}

function buildStarterBoard(gridSize: EndlessGridSize): CubeData[] {
  const cubes: CubeData[] = []
  const authoredSeeds: CubeSeed[] = [
    { color: 'blue', level: 1, x: 0, y: 0, z: 0 },
    { color: 'blue', level: 1, x: 1, y: 0, z: 0 },
    { color: 'yellow', level: 1, x: 0, y: 1, z: 0 },
    { color: 'yellow', level: 1, x: 1, y: 1, z: 0 },
    { color: 'blue', level: 2, x: 0, y: 0, z: 1 },
    { color: 'red', level: 2, x: 1, y: 0, z: 1 }
  ]
  const overrides = new Map(authoredSeeds.map((seed, index) => [`${seed.x}:${seed.y}:${seed.z}`, createCube(`endless_${gridSize}_seed_${index}`, seed.color, seed.level, seed.x, seed.y, seed.z)]))

  for (let x = 0; x < gridSize; x += 1) {
    for (let y = 0; y < gridSize; y += 1) {
      for (let z = 0; z < gridSize; z += 1) {
        const key = `${x}:${y}:${z}`
        const overrideCube = overrides.get(key)
        if (overrideCube) {
          cubes.push(overrideCube)
          continue
        }

        const parity = (x + y + z) % 3
        const color: CubeData['color'] = parity === 0 ? 'red' : parity === 1 ? 'yellow' : 'red'
        const level = ((x * 3) + (y * 2) + z) % 2 === 0 ? 1 : 2
        cubes.push(createCube(`endless_${gridSize}_${x}_${y}_${z}`, color, level, x, y, z))
      }
    }
  }

  return cubes
}

export function buildPlayableEndlessConfig(gridSize: EndlessGridSize): PlayableDemoConfig {
  const config = buildPlayableConfigFromLevel(ENDLESS_LEVEL_ID)

  return {
    ...config,
    board: {
      gridSize,
      cubes: buildStarterBoard(gridSize)
    },
    winLoss: {
      ...config.winLoss,
      victory: 'none'
    }
  }
}
