import React from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { CUBE_GAP, CUBE_SIZE } from '../../game/config/config'
import { toWorldPosition, useGameStore } from '../../game/state/gameStore'

const MARKER_BASE_SIZE = CUBE_SIZE + CUBE_GAP * 0.72

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function TutorialPulseCube({ position, phaseOffset = 0 }: { position: [number, number, number]; phaseOffset?: number }) {
  const lineRef = React.useRef<THREE.LineSegments>(null)
  const geometry = React.useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(MARKER_BASE_SIZE, MARKER_BASE_SIZE, MARKER_BASE_SIZE)), [])

  useFrame((state) => {
    const line = lineRef.current
    if (!line) {
      return
    }

    const cycle = (state.clock.getElapsedTime() * 0.95 + phaseOffset) % 1
    const eased = easeOutCubic(cycle)
    const scale = 0.96 + eased * 0.28
    const material = line.material as THREE.LineBasicMaterial

    line.scale.setScalar(scale)
    material.opacity = 0.88 - eased * 0.78
  })

  return (
    <lineSegments position={position} raycast={() => null} ref={lineRef} renderOrder={12} geometry={geometry}>
      <lineBasicMaterial color="#d9f2ff" depthWrite={false} transparent opacity={0.72} toneMapped={false} />
    </lineSegments>
  )
}

export function TutorialMarkers({ cubeIds }: { cubeIds: string[] }) {
  const { cubes, gridSize } = useGameStore()
  const targets = cubes.filter((cube) => cubeIds.includes(cube.id))

  return (
    <group>
      {targets.map((cube) => {
        const position = toWorldPosition(cube.x, cube.y, cube.z, gridSize)
        return (
          <group key={cube.id}>
            <TutorialPulseCube position={position} />
            <TutorialPulseCube phaseOffset={0.24} position={position} />
          </group>
        )
      })}
    </group>
  )
}
