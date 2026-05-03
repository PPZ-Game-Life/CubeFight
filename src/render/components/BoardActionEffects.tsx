import React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import { useGameStore } from '../../game/state/gameStore'
import { CUBE_GAP, CUBE_SIZE } from '../../game/config/config'

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function toWorldPosition(x: number, y: number, z: number, gridSize: number): [number, number, number] {
  const spacing = CUBE_SIZE + CUBE_GAP
  const offset = ((gridSize - 1) * spacing) / 2
  return [x * spacing - offset, y * spacing - offset, z * spacing - offset]
}

export function BoardActionEffects() {
  const { gridSize, mergeAnimation } = useGameStore()
  const impactRef = React.useRef<THREE.Mesh>(null)
  const ghostRef = React.useRef<THREE.Mesh>(null)
  const ghostMaterialRef = React.useRef<THREE.MeshBasicMaterial>(null)
  const impactMaterialRef = React.useRef<THREE.MeshBasicMaterial>(null)
  const impactGeometry = React.useMemo(() => new THREE.RingGeometry(0.38, 0.58, 40), [])
  const ghostGeometry = React.useMemo(() => new RoundedBoxGeometry(CUBE_SIZE * 0.92, CUBE_SIZE * 0.92, CUBE_SIZE * 0.92, 5, 0.15), [])

  useFrame(() => {
    const animation = mergeAnimation
    const impact = impactRef.current
    const ghost = ghostRef.current
    const impactMaterial = impactMaterialRef.current
    const ghostMaterial = ghostMaterialRef.current

    if (!animation || !impact || !impactMaterial) {
      if (impact) {
        impact.visible = false
      }
      if (ghost) {
        ghost.visible = false
      }
      return
    }

    const progress = Math.min(1, (Date.now() - animation.startTime) / animation.duration)
    const eased = easeOutCubic(progress)
    const targetPosition = toWorldPosition(animation.targetPosition.x, animation.targetPosition.y, animation.targetPosition.z, gridSize)
    const impactScale = animation.kind === 'devour'
      ? 0.78 + eased * 1.05
      : 0.7 + eased * 1.35

    impact.visible = true
    impact.position.set(targetPosition[0], targetPosition[1], targetPosition[2])
    impact.rotation.set(-Math.PI / 2, 0, 0)
    impact.scale.setScalar(impactScale)
    impactMaterial.opacity = Math.max(0, animation.kind === 'devour' ? 0.44 - eased * 0.44 : 0.52 - eased * 0.52)

    if (!ghost || !ghostMaterial || animation.kind !== 'devour') {
      if (ghost) {
        ghost.visible = false
      }
      return
    }

    ghost.visible = true
    ghost.position.set(targetPosition[0], targetPosition[1], targetPosition[2])
    ghost.scale.setScalar(1.02 - eased * 0.44)
    ghostMaterial.opacity = Math.max(0, 0.72 - eased * 0.72)
  })

  React.useEffect(() => () => {
    impactGeometry.dispose()
    ghostGeometry.dispose()
  }, [ghostGeometry, impactGeometry])

  const targetColor = mergeAnimation?.targetColor === 'blue'
    ? '#d7f2ff'
    : mergeAnimation?.targetColor === 'red'
      ? '#ffd9d2'
      : '#fff1bf'

  return (
    <group>
      <mesh ref={impactRef} raycast={() => null} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={impactGeometry} />
        <meshBasicMaterial ref={impactMaterialRef} color="#f8fdff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      <mesh ref={ghostRef} raycast={() => null} visible={false}>
        <primitive attach="geometry" object={ghostGeometry} />
        <meshBasicMaterial ref={ghostMaterialRef} color={targetColor} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
