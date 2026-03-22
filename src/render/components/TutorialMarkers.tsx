import React from 'react'
import { Html } from '@react-three/drei'

import { toWorldPosition, useGameStore } from '../../game/state/gameStore'

export function TutorialMarkers({ cubeIds }: { cubeIds: string[] }) {
  const { cubes, gridSize } = useGameStore()
  const targets = cubes.filter((cube) => cubeIds.includes(cube.id))

  return (
    <group>
      {targets.map((cube) => {
        const position = toWorldPosition(cube.x, cube.y, cube.z, gridSize)
        return (
          <Html key={cube.id} center position={[position[0], position[1] + 0.9, position[2]]} transform>
            <div className="tutorial-hand-marker">
              <div className="tutorial-hand-marker__ripple" />
              <div className="tutorial-hand-marker__icon">☞</div>
            </div>
          </Html>
        )
      })}
    </group>
  )
}
