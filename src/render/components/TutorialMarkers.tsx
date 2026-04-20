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
  const groupRef = React.useRef<THREE.Group>(null)
  const lineRef = React.useRef<THREE.LineSegments>(null)
  const ringRef = React.useRef<THREE.Mesh>(null)
  const haloRef = React.useRef<THREE.Mesh>(null)
  const glowRef = React.useRef<THREE.Mesh>(null)
  const geometry = React.useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(MARKER_BASE_SIZE, MARKER_BASE_SIZE, MARKER_BASE_SIZE)), [])

  useFrame((state) => {
    const group = groupRef.current
    const line = lineRef.current
    const ring = ringRef.current
    const halo = haloRef.current
    const glow = glowRef.current
    if (!group || !line || !ring || !halo || !glow) {
      return
    }

    const cycle = (state.clock.getElapsedTime() * 0.95 + phaseOffset) % 1
    const eased = easeOutCubic(cycle)
    const scale = 0.96 + eased * 0.32
    const material = line.material as THREE.LineBasicMaterial
    const ringMaterial = ring.material as THREE.MeshBasicMaterial
    const haloMaterial = halo.material as THREE.MeshBasicMaterial
    const glowMaterial = glow.material as THREE.MeshBasicMaterial
    const time = state.clock.getElapsedTime() + phaseOffset * 3

    group.position.set(position[0], position[1] + Math.sin(time * 2.8) * 0.04, position[2])
    line.scale.setScalar(scale)
    material.opacity = 0.92 - eased * 0.78

    ring.scale.setScalar(0.88 + eased * 0.52)
    ringMaterial.opacity = 0.62 - eased * 0.5

    halo.scale.setScalar(1.02 + eased * 0.16)
    haloMaterial.opacity = 0.26 + Math.sin(time * 4.5) * 0.08

    glow.scale.setScalar(0.72 + (1 - eased) * 0.1)
    glowMaterial.opacity = 0.18 + (1 - eased) * 0.12
  })

  return (
    <group ref={groupRef}>
      <mesh raycast={() => null} ref={haloRef} renderOrder={10}>
        <sphereGeometry args={[MARKER_BASE_SIZE * 0.34, 18, 18]} />
        <meshBasicMaterial color="#7dd3fc" depthWrite={false} transparent opacity={0.22} toneMapped={false} />
      </mesh>
      <lineSegments raycast={() => null} ref={lineRef} renderOrder={12} geometry={geometry}>
        <lineBasicMaterial color="#d9f2ff" depthWrite={false} transparent opacity={0.72} toneMapped={false} />
      </lineSegments>
      <mesh raycast={() => null} ref={ringRef} renderOrder={13} rotation={[-Math.PI / 2, 0, 0]} position={[0, -MARKER_BASE_SIZE * 0.58, 0]}>
        <torusGeometry args={[MARKER_BASE_SIZE * 0.42, MARKER_BASE_SIZE * 0.042, 14, 56]} />
        <meshBasicMaterial color="#f8fdff" depthWrite={false} transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh raycast={() => null} ref={glowRef} renderOrder={11}>
        <octahedronGeometry args={[MARKER_BASE_SIZE * 0.14, 0]} />
        <meshBasicMaterial color="#ffffff" depthWrite={false} transparent opacity={0.24} toneMapped={false} />
      </mesh>
    </group>
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
