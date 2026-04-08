import { describe, expect, it } from 'vitest'

import { getValidTargets } from '../state/demoRules'
import { buildPlayableEndlessConfig } from './endlessConfig'

describe('endlessConfig', () => {
  it('builds full starter boards for every endless grid size', () => {
    for (const gridSize of [2, 3, 4, 5] as const) {
      const config = buildPlayableEndlessConfig(gridSize)

      expect(config.board.gridSize).toBe(gridSize)
      expect(config.board.cubes).toHaveLength(gridSize * gridSize * gridSize)
    }
  })

  it('keeps an immediate legal move on a full 2x2x2 starter board', () => {
    const config = buildPlayableEndlessConfig(2)
    const source = config.board.cubes.find((cube) => cube.id === 'endless_2_seed_0')

    expect(source).toBeDefined()
    expect(getValidTargets(config.board.cubes, source?.id ?? '')).toContain('endless_2_seed_1')
  })
})
