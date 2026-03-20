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
