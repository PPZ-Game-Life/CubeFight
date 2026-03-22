import { describe, expect, it } from 'vitest'

import { buildPlayableConfigFromLevel, getLevelById, levelCatalog, parseLevelCatalog } from './levelCatalog'

describe('levelCatalog', () => {
  it('loads the authored tutorial ramp and endless mode', () => {
    expect(levelCatalog.levels.map((level) => level.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      999
    ])
  })

  it('keeps level 1 extremely sparse for scripted onboarding', () => {
    expect(getLevelById(1).initialMap).toHaveLength(2)
    expect(getLevelById(2).initialMap.length).toBeGreaterThanOrEqual(4)
  })

  it('keeps mid-campaign levels on expanded boards from level 6 onward', () => {
    expect(getLevelById(6).gridSize).toBe(4)
    expect(getLevelById(8).gridSize).toBe(4)
    expect(getLevelById(10).gridSize).toBe(5)
  })

  it('preserves authored 5x5x5 layouts for later levels', () => {
    const level = getLevelById(15)

    expect(level.gridSize).toBe(5)
    expect(level.initialMap.some((cube) => cube.x === 4 || cube.y === 4 || cube.z === 4)).toBe(true)
  })

  it('maps larger schema levels into playable runtime configs', () => {
    const config = buildPlayableConfigFromLevel(25)

    expect(config.board.gridSize).toBe(5)
    expect(config.board.cubes.some((cube) => cube.x === 4 || cube.y === 4 || cube.z === 4)).toBe(true)
  })

  it('maps a schema level into the current playable runtime config', () => {
    const config = buildPlayableConfigFromLevel(1)

    expect(config.board.gridSize).toBe(3)
    expect(config.board.cubes).toEqual([
      { id: 'lvl01_000', color: 'blue', level: 1, x: 0, y: 0, z: 1 },
      { id: 'lvl01_001', color: 'blue', level: 1, x: 1, y: 0, z: 1 }
    ])
    expect(config.inventory.bombCount).toBe(0)
  })

  it('normalizes clear_red objectives from legacy authored data', () => {
    const parsed = parseLevelCatalog({
      levels: [{
        id: 77,
        name: 'legacy_clear_red',
        gridSize: 3,
        spawnMode: 'static',
        objectives: [{ type: 'clear_red' }],
        limits: null,
        initialMap: [{ x: 0, y: 0, z: 0, color: 'red', level: 1 }],
        dynamicParams: null,
        reward: { coins: 0 }
      }]
    })

    expect(parsed.levels[0].objectives[0].type).toBe('clear_all_red')
  })
})
