import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CubeData, MergeAnimationState } from '../../game/model/types'

const clickCube = vi.fn()

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn()
}))

const getCubeVisualState = vi.fn(() => ({ selected: false, highlighted: false, dimmed: false }))

vi.mock('../../game/state/gameStore', () => ({
  useGameStore: () => ({
    clickCube,
    getCubeVisualState,
    mergeAnimation: null as MergeAnimationState | null
  })
}))

import { CubeMesh } from './CubeMesh'

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

describe('CubeMesh', () => {
  beforeEach(() => {
    clickCube.mockReset()
    getCubeVisualState.mockReset()
    getCubeVisualState.mockReturnValue({ selected: false, highlighted: false, dimmed: false })

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({
        clearRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        font: '',
        textAlign: 'center',
        textBaseline: 'middle',
        lineWidth: 0,
        strokeStyle: '',
        fillStyle: ''
      })
    })
  })

  it('routes clicks from label faces to the cube click handler', () => {
    const { container } = render(<CubeMesh cube={cube({ id: 'blue-a', color: 'blue' })} />)
    const meshes = container.querySelectorAll('mesh')
    const labelFace = meshes.item(1)

    expect(labelFace).not.toBeNull()

    fireEvent.click(labelFace)

    expect(clickCube).toHaveBeenCalledWith('blue-a')
    expect(clickCube).toHaveBeenCalledTimes(1)
  })

  it('does not double dispatch when clicking the cube body mesh', () => {
    const { container } = render(<CubeMesh cube={cube({ id: 'blue-a', color: 'blue' })} />)
    const cubeBody = container.querySelectorAll('mesh').item(1)

    expect(cubeBody).not.toBeNull()

    fireEvent.click(cubeBody as Element)

    expect(clickCube).toHaveBeenCalledWith('blue-a')
    expect(clickCube).toHaveBeenCalledTimes(1)
  })

  it('renders shell, inner core, and edge outline layers', () => {
    const { container } = render(<CubeMesh cube={cube({ id: 'yellow-a', color: 'yellow', level: 6 })} />)

    expect(container.querySelectorAll('mesh').length).toBeGreaterThanOrEqual(9)
    expect(container.querySelector('linesegments')).toBeNull()
  })

  it('renders a ground ring when the cube is selected', () => {
    getCubeVisualState.mockReturnValue({ selected: true, highlighted: false, dimmed: false })

    const { container } = render(<CubeMesh cube={cube({ id: 'blue-a', color: 'blue', level: 3 })} />)

    expect(container.querySelectorAll('torusgeometry').length).toBeGreaterThanOrEqual(1)
  })

})
