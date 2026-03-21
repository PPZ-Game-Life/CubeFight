import { describe, expect, it } from 'vitest'

import type { PlayableDemoConfig } from '../model/types'
import {
  buildDuplicateIdConfig,
  buildEmptyMultiplierConfig,
  buildNoMoveBoardWithRed,
  buildOutOfBoundsConfig,
  buildOverlappingCellConfig,
  buildPlayableDemoConfig,
  buildTopLayerSlice
} from '../config/playableDemo'
import {
  PlayableDemoConfigError,
  assertPlayableDemoConfig,
  validatePlayableDemoConfig
} from '../config/playableDemoValidation'
import type { CubeData, SliceState } from '../model/types'
import {
  getComboScore,
  getMatchResult,
  getValidTargets,
  getVisibleBombTargets,
  getVisibleValidTargets,
  isAdjacent,
  resolveBoardAction,
  resolveBomb
} from './demoRules'

const noMoveBoardWithRedFixture = buildNoMoveBoardWithRed()
const topLayerSliceFixture = buildTopLayerSlice()

function getErrorMessages(config: unknown) {
  return validatePlayableDemoConfig(config).map((error) => error.message)
}

describe('playable demo config validation', () => {
  it('builds a playable demo config that can be cloned repeatedly without mutation', () => {
    const firstConfig = buildPlayableDemoConfig()
    const secondConfig = buildPlayableDemoConfig()

    firstConfig.board.cubes[0].level = 99
    firstConfig.combo.multiplierTable[0] = 999
    firstConfig.scoring.mergeBase[2] = 999
    firstConfig.inventory.bombCount = 0

    expect(secondConfig.board.cubes[0].level).not.toBe(99)
    expect(secondConfig.combo.multiplierTable[0]).not.toBe(999)
    expect(secondConfig.scoring.mergeBase[2]).not.toBe(999)
    expect(secondConfig.inventory.bombCount).not.toBe(0)
    expect(secondConfig.winLoss.victory).toBe('clear_all_red')
    expect(secondConfig.ui.sliceLayout).toBe('current-implementation')
    expect(validatePlayableDemoConfig(secondConfig)).toEqual([])
  })

  it('rejects duplicate cube ids', () => {
    expect(getErrorMessages(buildDuplicateIdConfig())).toContainEqual(expect.stringMatching(/duplicate cube id/i))
  })

  it('rejects overlapping cells', () => {
    expect(getErrorMessages(buildOverlappingCellConfig())).toContainEqual(expect.stringMatching(/overlapping cell/i))
  })

  it('rejects out-of-bounds coordinates', () => {
    expect(getErrorMessages(buildOutOfBoundsConfig())).toContainEqual(expect.stringMatching(/out-of-bounds/i))
  })

  it('rejects an empty multiplier table', () => {
    expect(getErrorMessages(buildEmptyMultiplierConfig())).toContainEqual(expect.stringMatching(/multiplier table/i))
  })

  it('rejects missing score coverage for authored cube levels', () => {
    const config = buildPlayableDemoConfig()
    const devourRedBase = config.scoring.devourRedBase as Partial<Record<number, number>>

    delete devourRedBase[1]

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/missing score coverage.*red.*level 1/i))
  })

  it('rejects missing merge score coverage for authored merge-result levels', () => {
    const config = buildPlayableDemoConfig()
    const mergeBase = config.scoring.mergeBase as Partial<Record<number, number>>

    delete mergeBase[2]

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/missing merge score coverage.*level 2/i))
  })

  it('rejects missing merge score coverage for chained reachable merge-result levels', () => {
    const config = buildPlayableDemoConfig()
    const mergeBase = config.scoring.mergeBase as Partial<Record<number, number>>

    delete mergeBase[3]

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/missing merge score coverage.*level 3/i))
  })

  it('rejects a config with missing mergeBase', () => {
    const config = buildPlayableDemoConfig() as PlayableDemoConfig

    delete (config as { scoring: { mergeBase?: unknown } }).scoring.mergeBase

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/mergeBase/i))
  })

  it('rejects a config with missing inventory.bombCount', () => {
    const config = buildPlayableDemoConfig() as PlayableDemoConfig

    delete (config as { inventory: { bombCount?: unknown } }).inventory.bombCount

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/inventory\.bombCount/i))
  })

  it('rejects a config with missing combo.timeoutMs', () => {
    const config = buildPlayableDemoConfig() as PlayableDemoConfig

    delete (config as { combo: { timeoutMs?: unknown } }).combo.timeoutMs

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/combo\.timeoutMs/i))
  })

  it('rejects a config with incomplete win-loss and ui contracts', () => {
    const config = buildPlayableDemoConfig() as PlayableDemoConfig

    delete (config as { winLoss: { requireNoMovesForGameOver?: unknown } }).winLoss.requireNoMovesForGameOver
    delete (config as { winLoss: { requireNoBombsForGameOver?: unknown } }).winLoss.requireNoBombsForGameOver
    delete (config as { ui: { showCombo?: unknown } }).ui.showCombo
    delete (config as { ui: { showPause?: unknown } }).ui.showPause

    const errors = getErrorMessages(config)

    expect(errors).toContainEqual(expect.stringMatching(/requireNoMovesForGameOver/i))
    expect(errors).toContainEqual(expect.stringMatching(/requireNoBombsForGameOver/i))
    expect(errors).toContainEqual(expect.stringMatching(/ui\.showCombo/i))
    expect(errors).toContainEqual(expect.stringMatching(/ui\.showPause/i))
  })

  it('rejects a config with a non-positive board.gridSize', () => {
    const config = buildPlayableDemoConfig()

    config.board.gridSize = 0

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/board\.gridSize.*positive integer/i))
  })

  it('rejects a config with an unsupported non-3 board.gridSize', () => {
    const config = buildPlayableDemoConfig()

    config.board.gridSize = 4

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/board\.gridSize.*to be 3/i))
  })

  it('rejects a config with an invalid inventory.bombCount number', () => {
    const config = buildPlayableDemoConfig()

    config.inventory.bombCount = Number.NaN

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/inventory\.bombCount.*non-negative integer/i))
  })

  it('rejects a config with a non-positive combo timeout', () => {
    const config = buildPlayableDemoConfig()

    config.combo.timeoutMs = -1

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/combo\.timeoutMs.*positive finite number/i))
  })

  it('rejects a config with invalid combo multipliers', () => {
    const config = buildPlayableDemoConfig()

    config.combo.multiplierTable[1] = 0

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/combo multiplier.*index 1.*positive finite number/i))
  })

  it('rejects a config with invalid scoring table values', () => {
    const config = buildPlayableDemoConfig()

    config.scoring.mergeBase[2] = Number.POSITIVE_INFINITY
    config.scoring.devourRedBase[1] = -10
    config.scoring.devourYellowBase[1] = Number.NaN

    const errors = getErrorMessages(config)

    expect(errors).toContainEqual(expect.stringMatching(/scoring\.mergeBase.*level 2.*finite non-negative number/i))
    expect(errors).toContainEqual(expect.stringMatching(/scoring\.devourRedBase.*level 1.*finite non-negative number/i))
    expect(errors).toContainEqual(expect.stringMatching(/scoring\.devourYellowBase.*level 1.*finite non-negative number/i))
  })

  it('rejects a config with an invalid cube level', () => {
    const config = buildPlayableDemoConfig()

    config.board.cubes[0].level = 0

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/cube ".*" level must be a positive integer/i))
  })

  it('assertPlayableDemoConfig throws PlayableDemoConfigError for invalid config', () => {
    expect(() => assertPlayableDemoConfig(buildDuplicateIdConfig())).toThrow(PlayableDemoConfigError)
  })

  it('rejects malformed cube objects explicitly', () => {
    const config = buildPlayableDemoConfig() as unknown as {
      board: { cubes: unknown[] }
    }

    config.board.cubes[0] = { id: 'broken-cube', level: 1, x: 0, y: 0, z: 0 }

    expect(getErrorMessages(config)).toContainEqual(expect.stringMatching(/invalid cube.*index 0/i))
  })
})

describe('playable demo fixtures', () => {
  it('provides stable fixtures for later rules tests', () => {
    expect(noMoveBoardWithRedFixture.some((cube) => cube.color === 'red')).toBe(true)
    expect(topLayerSliceFixture).toEqual({ axis: 'y', index: 2 })
  })
})

function cube(overrides: Partial<CubeData> & Pick<CubeData, 'id' | 'color'>): CubeData {
  return {
    id: overrides.id,
    color: overrides.color,
    level: overrides.level ?? 1,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    z: overrides.z ?? 0
  }
}

function cloneCubes(cubes: CubeData[]): CubeData[] {
  return cubes.map((item) => ({ ...item }))
}

describe('demo gameplay rules', () => {
  const visibleTopSlice: SliceState = { axis: 'y', index: 1 }

  it('treats only orthogonal neighbors as adjacent', () => {
    const origin = cube({ id: 'origin', color: 'blue', x: 0, y: 0, z: 0 })

    expect(isAdjacent(origin, cube({ id: 'x-neighbor', color: 'blue', x: 1, y: 0, z: 0 }))).toBe(true)
    expect(isAdjacent(origin, cube({ id: 'y-neighbor', color: 'blue', x: 0, y: 1, z: 0 }))).toBe(true)
    expect(isAdjacent(origin, cube({ id: 'z-neighbor', color: 'blue', x: 0, y: 0, z: 1 }))).toBe(true)
    expect(isAdjacent(origin, cube({ id: 'diagonal', color: 'blue', x: 1, y: 1, z: 0 }))).toBe(false)
    expect(isAdjacent(origin, cube({ id: 'same-cell', color: 'blue', x: 0, y: 0, z: 0 }))).toBe(false)
  })

  it('looks up only legal targets for a selected blue cube', () => {
    const cubes = [
      cube({ id: 'blue-source', color: 'blue', level: 2, x: 0, y: 0, z: 0 }),
      cube({ id: 'merge-blue', color: 'blue', level: 2, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-food', color: 'red', level: 1, x: 0, y: 1, z: 0 }),
      cube({ id: 'yellow-food', color: 'yellow', level: 2, x: 0, y: 0, z: 1 }),
      cube({ id: 'too-strong-red', color: 'red', level: 3, x: 1, y: 1, z: 0 }),
      cube({ id: 'diagonal-blue', color: 'blue', level: 2, x: 1, y: 1, z: 1 })
    ]

    expect(getValidTargets(cubes, 'blue-source')).toEqual(['merge-blue', 'red-food', 'yellow-food'])
  })

  it('filters visible legal targets by the active slice', () => {
    const cubes = [
      cube({ id: 'blue-source', color: 'blue', level: 2, x: 0, y: 1, z: 0 }),
      cube({ id: 'visible-target', color: 'red', level: 1, x: 1, y: 1, z: 0 }),
      cube({ id: 'hidden-target', color: 'yellow', level: 1, x: 0, y: 0, z: 0 })
    ]

    expect(getVisibleValidTargets(cubes, 'blue-source', visibleTopSlice)).toEqual(['visible-target'])
  })

  it('filters visible bomb targets by the active slice', () => {
    const cubes = [
      cube({ id: 'visible-a', color: 'red', x: 0, y: 1, z: 0 }),
      cube({ id: 'visible-b', color: 'yellow', x: 1, y: 1, z: 0 }),
      cube({ id: 'visible-blue', color: 'blue', x: 2, y: 1, z: 0 }),
      cube({ id: 'hidden', color: 'blue', x: 0, y: 0, z: 0 })
    ]

    expect(getVisibleBombTargets(cubes, visibleTopSlice)).toEqual(['visible-a', 'visible-b', 'visible-blue'])
  })

  it('merges same-level adjacent blue cubes into the second-click position', () => {
    const rulesConfig = buildPlayableDemoConfig()
    const cubes = [
      cube({ id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'blue-b', color: 'blue', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-keep', color: 'red', level: 1, x: 2, y: 0, z: 0 })
    ]

    const result = resolveBoardAction(cloneCubes(cubes), { type: 'merge', sourceId: 'blue-a', targetId: 'blue-b' }, rulesConfig)

    expect(result.kind).toBe('merge')
    expect(result.cubes).toEqual([
      cube({ id: 'blue-a', color: 'blue', level: 2, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-keep', color: 'red', level: 1, x: 2, y: 0, z: 0 })
    ])
    expect(result.baseScore).toBe(rulesConfig.scoring.mergeBase[2])
  })

  it('lets blue devour a legal red target', () => {
    const rulesConfig = buildPlayableDemoConfig()
    const cubes = [
      cube({ id: 'blue-source', color: 'blue', level: 2, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-target', color: 'red', level: 1, x: 1, y: 0, z: 0 })
    ]

    const result = resolveBoardAction(cloneCubes(cubes), { type: 'devour', sourceId: 'blue-source', targetId: 'red-target' }, rulesConfig)

    expect(result.kind).toBe('devour_red')
    expect(result.cubes).toEqual([
      cube({ id: 'blue-source', color: 'blue', level: 2, x: 1, y: 0, z: 0 })
    ])
    expect(result.baseScore).toBe(rulesConfig.scoring.devourRedBase[1])
  })

  it('lets blue devour a legal yellow target', () => {
    const rulesConfig = buildPlayableDemoConfig()
    const cubes = [
      cube({ id: 'blue-source', color: 'blue', level: 2, x: 0, y: 0, z: 0 }),
      cube({ id: 'yellow-target', color: 'yellow', level: 2, x: 0, y: 0, z: 1 })
    ]

    const result = resolveBoardAction(cloneCubes(cubes), { type: 'devour', sourceId: 'blue-source', targetId: 'yellow-target' }, rulesConfig)

    expect(result.kind).toBe('devour_yellow')
    expect(result.cubes).toEqual([
      cube({ id: 'blue-source', color: 'blue', level: 2, x: 0, y: 0, z: 1 })
    ])
    expect(result.baseScore).toBe(rulesConfig.scoring.devourYellowBase[2])
  })

  it('returns adjacent same-level yellow cubes as legal merge targets', () => {
    const cubes = [
      cube({ id: 'yellow-source', color: 'yellow', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'yellow-target', color: 'yellow', level: 1, x: 1, y: 0, z: 0 }),
      cube({ id: 'red-target', color: 'red', level: 1, x: 0, y: 1, z: 0 })
    ]

    expect(getValidTargets(cubes, 'yellow-source')).toEqual(['yellow-target'])
  })

  it('rejects an invalid non-adjacent target without mutating the board', () => {
    const rulesConfig = buildPlayableDemoConfig()
    const cubes = [
      cube({ id: 'blue-source', color: 'blue', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'far-blue', color: 'blue', level: 1, x: 2, y: 0, z: 0 })
    ]

    const result = resolveBoardAction(cloneCubes(cubes), { type: 'merge', sourceId: 'blue-source', targetId: 'far-blue' }, rulesConfig)

    expect(result.kind).toBe('invalid')
    if (result.kind !== 'invalid') {
      throw new Error(`Expected invalid result, received ${result.kind}`)
    }
    expect(result.reason).toBe('invalid_target')
    expect(result.cubes).toEqual(cubes)
  })

  it('lets yellow merge with a legal yellow target', () => {
    const rulesConfig = buildPlayableDemoConfig()
    const cubes = [
      cube({ id: 'yellow-source', color: 'yellow', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'yellow-target', color: 'yellow', level: 1, x: 1, y: 0, z: 0 })
    ]

    const result = resolveBoardAction(cloneCubes(cubes), { type: 'merge', sourceId: 'yellow-source', targetId: 'yellow-target' }, rulesConfig)

    expect(result.kind).toBe('merge')
    if (result.kind !== 'merge') {
      throw new Error(`Expected merge result, received ${result.kind}`)
    }
    expect(result.cubes).toEqual([
      cube({ id: 'yellow-source', color: 'yellow', level: 2, x: 1, y: 0, z: 0 })
    ])
    expect(result.baseScore).toBe(rulesConfig.scoring.mergeBase[2])
  })

  it('still rejects yellow devour attempts clearly', () => {
    const rulesConfig = buildPlayableDemoConfig()
    const cubes = [
      cube({ id: 'yellow-source', color: 'yellow', level: 1, x: 0, y: 0, z: 0 }),
      cube({ id: 'red-target', color: 'red', level: 1, x: 1, y: 0, z: 0 })
    ]

    const result = resolveBoardAction(cloneCubes(cubes), { type: 'devour', sourceId: 'yellow-source', targetId: 'red-target' }, rulesConfig)

    expect(result.kind).toBe('invalid')
    if (result.kind !== 'invalid') {
      throw new Error(`Expected invalid result, received ${result.kind}`)
    }
    expect(result.reason).toBe('invalid_target')
  })

  it('removes exactly one targeted cube when a bomb resolves', () => {
    const cubes = [
      cube({ id: 'bomb-target', color: 'red', x: 0, y: 0, z: 0 }),
      cube({ id: 'survivor-a', color: 'blue', x: 1, y: 0, z: 0 }),
      cube({ id: 'survivor-b', color: 'yellow', x: 0, y: 1, z: 0 })
    ]

    const result = resolveBomb(cloneCubes(cubes), 'bomb-target')

    expect(result.kind).toBe('bomb')
    expect(result.cubes).toEqual([
      cube({ id: 'survivor-a', color: 'blue', x: 1, y: 0, z: 0 }),
      cube({ id: 'survivor-b', color: 'yellow', x: 0, y: 1, z: 0 })
    ])
  })

  it('lets bombs target a visible blue cube and remove exactly that cube', () => {
    const cubes = [
      cube({ id: 'blue-target', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'red-survivor', color: 'red', x: 1, y: 0, z: 0 })
    ]

    const result = resolveBomb(cloneCubes(cubes), 'blue-target')

    expect(result.kind).toBe('bomb')
    if (result.kind !== 'bomb') {
      throw new Error(`Expected bomb result, received ${result.kind}`)
    }
    expect(result.cubes).toEqual([
      cube({ id: 'red-survivor', color: 'red', x: 1, y: 0, z: 0 })
    ])
  })

  it('returns victory when all red cubes are gone', () => {
    const cubes = [
      cube({ id: 'blue', color: 'blue', x: 0, y: 0, z: 0 }),
      cube({ id: 'yellow', color: 'yellow', x: 1, y: 0, z: 0 })
    ]

    expect(getMatchResult(cubes, 0)).toEqual({ kind: 'victory' })
  })

  it('returns game over when red remains, no legal blue move exists, and bombs are depleted', () => {
    expect(getMatchResult(noMoveBoardWithRedFixture, 0)).toEqual({ kind: 'game_over' })
  })

  it('keeps the match in progress when red remains but a bomb is still available', () => {
    expect(getMatchResult(noMoveBoardWithRedFixture, 1)).toEqual({ kind: 'in_progress' })
  })

  it('applies combo multipliers from the authored table and clamps at the last entry', () => {
    expect(getComboScore(10, 1, [1, 1.5, 2])).toBe(10)
    expect(getComboScore(10, 2, [1, 1.5, 2])).toBe(15)
    expect(getComboScore(10, 5, [1, 1.5, 2])).toBe(20)
  })
})
