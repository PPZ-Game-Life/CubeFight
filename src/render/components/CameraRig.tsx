import { PerspectiveCamera, TrackballControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { useGameStore } from '../../game/state/gameStore'

function getResponsiveCameraDistance(gridSize: number, aspectRatio: number) {
  const baseDistance = Math.max(8, gridSize * 2.4)

  if (aspectRatio >= 1) {
    return baseDistance
  }

  const portraitCompensation = (1 - aspectRatio) * (gridSize * 1.6)
  return baseDistance + portraitCompensation
}

function wrapAngle(angle: number) {
  const tau = Math.PI * 2
  return ((angle % tau) + tau) % tau
}

export function CameraRig() {
  const controlsRef = useRef<any>(null)
  const { camera, size } = useThree()
  const { gridSize, updateCameraAngles } = useGameStore()
  const aspectRatio = useMemo(() => size.width / Math.max(size.height, 1), [size.height, size.width])
  const defaultDistance = useMemo(() => getResponsiveCameraDistance(gridSize, aspectRatio), [aspectRatio, gridSize])
  const minDistance = useMemo(() => defaultDistance * 0.72, [defaultDistance])
  const maxDistance = useMemo(() => defaultDistance * 1.95, [defaultDistance])

  const syncCameraAngles = React.useCallback(() => {
    const controls = controlsRef.current
    if (!controls) {
      return
    }

    const offset = camera.position.clone().sub(controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    updateCameraAngles(wrapAngle(spherical.theta), spherical.phi)
  }, [camera, updateCameraAngles])

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
    syncCameraAngles()
  }, [camera, defaultDistance, maxDistance, minDistance, syncCameraAngles])

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, defaultDistance]} fov={60} near={0.1} far={1000} />
      <TrackballControls
        ref={controlsRef}
        noPan
        noRotate={false}
        noZoom={false}
        target={[0, 0, 0]}
        minDistance={minDistance}
        maxDistance={maxDistance}
        rotateSpeed={4}
        zoomSpeed={1.1}
        staticMoving={false}
        dynamicDampingFactor={0.12}
        onChange={syncCameraAngles}
      />
    </>
  )
}
