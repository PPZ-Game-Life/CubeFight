import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn()
}))

vi.mock('../../game/state/gameStore', () => ({
  toWorldPosition: (x: number, y: number, z: number) => [x, y, z],
  useGameStore: () => ({
    gridSize: 3,
    cubes: [
      { id: 'blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 0 },
      { id: 'blue-b', color: 'blue', level: 1, x: 1, y: 0, z: 0 }
    ]
  })
}))

import { TutorialMarkers } from './TutorialMarkers'

describe('TutorialMarkers', () => {
  it('renders layered focus helpers for tutorial cubes', () => {
    const { container } = render(<TutorialMarkers cubeIds={['blue-a']} />)

    expect(container.querySelectorAll('linesegments').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('torusgeometry').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('spheregeometry').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('octahedrongeometry').length).toBeGreaterThanOrEqual(1)
  })
})
