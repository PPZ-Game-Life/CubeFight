import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../game/state/gameStore'

const MIN_POLAR_ANGLE = THREE.MathUtils.degToRad(65)
const MAX_POLAR_ANGLE = THREE.MathUtils.degToRad(115)
function getResponsiveCameraDistance(gridSize: number, aspectRatio: number) {
  const baseDistance = Math.max(8, gridSize * 2.4)

  if (aspectRatio >= 1) {
    return baseDistance
  }

  const portraitCompensation = (1 - aspectRatio) * (gridSize * 1.6)
  return baseDistance + portraitCompensation
}

export function CameraRig() {
  const controlsRef = useRef<any>(null)
  const { camera, size } = useThree()
  const { gridSize, updateCameraAngles } = useGameStore()
  const aspectRatio = React.useMemo(() => size.width / Math.max(size.height, 1), [size.height, size.width])
  const defaultDistance = React.useMemo(() => getResponsiveCameraDistance(gridSize, aspectRatio), [aspectRatio, gridSize])
  const minDistance = React.useMemo(() => defaultDistance * 0.72, [defaultDistance])
  const maxDistance = React.useMemo(() => defaultDistance * 1.95, [defaultDistance])

  useEffect(() => {
    camera.up.set(0, 1, 0)
  }, [camera])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) {
      return
    }

    const currentOffset = camera.position.clone().sub(controls.target)
    const nextOffset = currentOffset.lengthSq() > 0 ? currentOffset : new THREE.Vector3(0, 0, 1)
    nextOffset.setLength(defaultDistance)

    camera.position.copy(controls.target).add(nextOffset)
    controls.minDistance = minDistance
    controls.maxDistance = maxDistance
    controls.update()
  }, [camera, defaultDistance, maxDistance, minDistance])

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, defaultDistance]} fov={60} near={0.1} far={1000} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        target={[0, 0, 0]}
        minDistance={minDistance}
        maxDistance={maxDistance}
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
