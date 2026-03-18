import React, { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../game/state/gameStore'
import type { CubeData } from '../../game/model/types'
import { CUBE_COLORS, CUBE_GAP, CUBE_SIZE, GRID_SIZE } from '../../game/config/config'

function toWorldPosition(x: number, y: number, z: number): [number, number, number] {
  const spacing = CUBE_SIZE + CUBE_GAP
  const offset = ((GRID_SIZE - 1) * spacing) / 2
  return [x * spacing - offset, y * spacing - offset, z * spacing - offset]
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

const faceConfigs = [
  { key: 'front', position: [0, 0, CUBE_SIZE * 0.52], normal: new THREE.Vector3(0, 0, 1) },
  { key: 'back', position: [0, 0, -CUBE_SIZE * 0.52], normal: new THREE.Vector3(0, 0, -1) },
  { key: 'right', position: [CUBE_SIZE * 0.52, 0, 0], normal: new THREE.Vector3(1, 0, 0) },
  { key: 'left', position: [-CUBE_SIZE * 0.52, 0, 0], normal: new THREE.Vector3(-1, 0, 0) },
  { key: 'top', position: [0, CUBE_SIZE * 0.52, 0], normal: new THREE.Vector3(0, 1, 0) },
  { key: 'bottom', position: [0, -CUBE_SIZE * 0.52, 0], normal: new THREE.Vector3(0, -1, 0) }
] as const

function createLabelTexture(level: number, dimmed: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create label canvas context')

  ctx.clearRect(0, 0, 128, 128)

  ctx.font = 'bold 72px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.strokeText(String(level), 64, 68)
  ctx.fillStyle = dimmed ? '#d1d5db' : '#ffffff'
  ctx.fillText(String(level), 64, 68)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function CubeMeshInner({ cube }: { cube: CubeData }) {
  const { clickCube, getCubeVisualState, mergeAnimation } = useGameStore()
  const groupRef = useRef<THREE.Group>(null)
  const labelRefs = useRef<Array<THREE.Mesh | null>>([])
  const position = useMemo(() => toWorldPosition(cube.x, cube.y, cube.z), [cube.x, cube.y, cube.z])
  const visual = getCubeVisualState(cube.id)
  const emissive = useMemo(() => (
    visual.selected || cube.level > 1
      ? new THREE.Color(visual.highlighted ? '#22c55e' : CUBE_COLORS[cube.color])
      : new THREE.Color('#000000')
  ), [cube.color, cube.level, visual.highlighted, visual.selected])
  const opacity = visual.dimmed ? 0.3 : 1
  const scale = visual.selected ? 1.08 : visual.highlighted ? 1.04 : 1
  const isMergeSource = mergeAnimation?.sourceId === cube.id
  const isMergeTarget = mergeAnimation?.targetId === cube.id
  const labelTexture = useMemo(() => createLabelTexture(cube.level, visual.dimmed), [cube.level, visual.dimmed])
  const labelMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false
  }), [labelTexture])

  React.useEffect(() => {
    return () => {
      labelTexture.dispose()
      labelMaterial.dispose()
    }
  }, [labelTexture, labelMaterial])

  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group) return

    if (!mergeAnimation || (!isMergeSource && !isMergeTarget)) {
      group.position.set(position[0], position[1], position[2])
      group.scale.setScalar(scale)
    } else {
      const progress = Math.min(1, (Date.now() - mergeAnimation.startTime) / mergeAnimation.duration)
      const eased = easeOutCubic(progress)

      if (isMergeSource) {
        const targetPosition = toWorldPosition(
          mergeAnimation.targetPosition.x,
          mergeAnimation.targetPosition.y,
          mergeAnimation.targetPosition.z
        )
        group.position.set(
          THREE.MathUtils.lerp(position[0], targetPosition[0], eased),
          THREE.MathUtils.lerp(position[1], targetPosition[1], eased),
          THREE.MathUtils.lerp(position[2], targetPosition[2], eased)
        )
        const mergeScale = THREE.MathUtils.lerp(scale, 0.82, eased)
        group.scale.setScalar(mergeScale)
      } else if (isMergeTarget) {
        const pulse = progress < 0.35
          ? THREE.MathUtils.lerp(0.94, 1.16, progress / 0.35)
          : THREE.MathUtils.lerp(1.16, 1, (progress - 0.35) / 0.65)
        group.position.set(position[0], position[1], position[2])
        group.scale.setScalar(scale * pulse)
      }
    }

    const cameraPosition = new THREE.Vector3()
    camera.getWorldPosition(cameraPosition)
    const meshWorldQuaternion = group.getWorldQuaternion(new THREE.Quaternion())
    const inverseMeshWorldQuaternion = meshWorldQuaternion.clone().invert()
    const localCameraPosition = cameraPosition.clone()
    group.worldToLocal(localCameraPosition)
    const cameraForward = new THREE.Vector3()
    camera.getWorldDirection(cameraForward)
    const localCameraForward = cameraForward.applyQuaternion(inverseMeshWorldQuaternion).normalize()
    const localCameraUp = camera.up.clone().applyQuaternion(inverseMeshWorldQuaternion).normalize()

    faceConfigs.forEach((config, index) => {
      const plane = labelRefs.current[index]
      if (!plane) return

      const planePosition = new THREE.Vector3(...config.position)
      const normal = config.normal.clone()
      const toCamera = localCameraPosition.clone().sub(planePosition).normalize()
      const facing = normal.dot(toCamera)

      plane.visible = facing > 0.08 && !isMergeSource
      if (!plane.visible) return

      let planeUp = localCameraUp.clone().sub(normal.clone().multiplyScalar(localCameraUp.dot(normal)))
      if (planeUp.lengthSq() < 1e-4) {
        planeUp = localCameraForward.clone().sub(normal.clone().multiplyScalar(localCameraForward.dot(normal)))
      }
      if (planeUp.lengthSq() < 1e-4) {
        planeUp = new THREE.Vector3(0, 1, 0).sub(normal.clone().multiplyScalar(normal.y))
      }
      planeUp.normalize()
      const planeRight = new THREE.Vector3().crossVectors(planeUp, normal).normalize()
      const correctedUp = new THREE.Vector3().crossVectors(normal, planeRight).normalize()
      const rotationMatrix = new THREE.Matrix4().makeBasis(planeRight, correctedUp, normal)
      plane.quaternion.setFromRotationMatrix(rotationMatrix)
    })
  })

  const emissiveIntensity = isMergeTarget && mergeAnimation
    ? 0.62
    : visual.selected ? 0.45 : visual.highlighted ? 0.3 : cube.level > 1 ? 0.18 : 0

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh onClick={(event) => {
        event.stopPropagation()
        clickCube(cube.id)
      }}>
        <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
        <meshStandardMaterial
          color={CUBE_COLORS[cube.color]}
          metalness={0.3}
          roughness={0.4}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={isMergeSource ? Math.max(0.12, opacity * 0.55) : opacity}
        />
      </mesh>
      {faceConfigs.map((config, index) => (
        <mesh
          key={config.key}
          ref={(node) => {
            labelRefs.current[index] = node
          }}
          position={config.position}
          material={labelMaterial}
        >
          <planeGeometry args={[0.68, 0.68]} />
        </mesh>
      ))}
    </group>
  )
}

export const CubeMesh = memo(CubeMeshInner)
