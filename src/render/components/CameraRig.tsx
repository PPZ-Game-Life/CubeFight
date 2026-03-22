import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../game/state/gameStore'

const MIN_POLAR_ANGLE = THREE.MathUtils.degToRad(65)
const MAX_POLAR_ANGLE = THREE.MathUtils.degToRad(115)
function getCameraDistance(gridSize: number) {
  return Math.max(8, gridSize * 2.4)
}

export function CameraRig() {
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()
  const { camera: cameraState, gridSize, updateCameraAngles } = useGameStore()
  const distance = React.useMemo(() => getCameraDistance(gridSize), [gridSize])

  useEffect(() => {
    camera.up.set(0, 1, 0)
  }, [camera])

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, distance]} fov={60} near={0.1} far={1000} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        target={[0, 0, 0]}
        minPolarAngle={MIN_POLAR_ANGLE}
        maxPolarAngle={MAX_POLAR_ANGLE}
        dampingFactor={0.12}
        onChange={() => {
          const controls = controlsRef.current
          if (!controls) return
          updateCameraAngles(controls.getAzimuthalAngle(), controls.getPolarAngle())
        }}
      />
    </>
  )
}
