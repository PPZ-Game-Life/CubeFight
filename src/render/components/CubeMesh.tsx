import React, { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { audioManager } from '../../audio/audioManager'
import { readStoredDebugOptions } from '../../app/debugOptions'
import { useGameStore } from '../../game/state/gameStore'
import type { CubeData } from '../../game/model/types'
import { CUBE_COLORS, CUBE_GAP, CUBE_SIZE } from '../../game/config/config'

function toWorldPosition(x: number, y: number, z: number, gridSize: number): [number, number, number] {
  const spacing = CUBE_SIZE + CUBE_GAP
  const offset = ((gridSize - 1) * spacing) / 2
  return [x * spacing - offset, y * spacing - offset, z * spacing - offset]
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function createShellGeometry(reducedQuality: boolean) {
  return new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, reducedQuality ? 3 : 6, reducedQuality ? 0.14 : 0.17)
}

function createRimMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uIntensity: { value: 1 }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0), 3.4);
        float alpha = fresnel * 0.7 * uIntensity;
        gl_FragColor = vec4(uColor * (0.45 + fresnel * 0.9), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending
  })
}

function factionVisuals(cube: CubeData) {
  if (cube.variant === 'golden') {
    return {
      shellTint: '#fff0b0',
      coreAccent: '#ffd54a',
      shellTransmission: 0.7,
      shellRoughness: 0.16,
      shellOpacity: 0.98
    }
  }

  const color = cube.color
  if (color === 'blue') {
    return {
      shellTint: '#d7f2ff',
      coreAccent: '#9ce8ff',
      shellTransmission: 0.72,
      shellRoughness: 0.22,
      shellOpacity: 0.94
    }
  }

  if (color === 'red') {
    return {
      shellTint: '#ffd9d2',
      coreAccent: '#ff8b7f',
      shellTransmission: 0.6,
      shellRoughness: 0.28,
      shellOpacity: 0.96
    }
  }

  return {
    shellTint: '#fff1bf',
    coreAccent: '#ffe08d',
    shellTransmission: 0.66,
    shellRoughness: 0.2,
    shellOpacity: 0.95
  }
}

const faceConfigs = [
  { key: 'front', position: [0, 0, CUBE_SIZE * 0.52], normal: new THREE.Vector3(0, 0, 1) },
  { key: 'back', position: [0, 0, -CUBE_SIZE * 0.52], normal: new THREE.Vector3(0, 0, -1) },
  { key: 'right', position: [CUBE_SIZE * 0.52, 0, 0], normal: new THREE.Vector3(1, 0, 0) },
  { key: 'left', position: [-CUBE_SIZE * 0.52, 0, 0], normal: new THREE.Vector3(-1, 0, 0) },
  { key: 'top', position: [0, CUBE_SIZE * 0.52, 0], normal: new THREE.Vector3(0, 1, 0) },
  { key: 'bottom', position: [0, -CUBE_SIZE * 0.52, 0], normal: new THREE.Vector3(0, -1, 0) }
] as const

const scratchCameraPosition = new THREE.Vector3()
const scratchMeshWorldQuaternion = new THREE.Quaternion()
const scratchInverseQuaternion = new THREE.Quaternion()
const scratchLocalCameraPosition = new THREE.Vector3()
const scratchCameraForward = new THREE.Vector3()
const scratchLocalCameraForward = new THREE.Vector3()
const scratchLocalCameraUp = new THREE.Vector3()
const scratchPlanePosition = new THREE.Vector3()
const scratchNormal = new THREE.Vector3()
const scratchToCamera = new THREE.Vector3()
const scratchPlaneUp = new THREE.Vector3()
const scratchPlaneRight = new THREE.Vector3()
const scratchCorrectedUp = new THREE.Vector3()
const scratchNormalProjection = new THREE.Vector3()
const scratchRotationMatrix = new THREE.Matrix4()
const scratchWorldPosition = new THREE.Vector3()

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

function isSelectableCube(cube: CubeData) {
  return cube.color === 'blue' || cube.color === 'yellow'
}

function CubeMeshInner({ cube, gridSize = 3, interactive = true, allowedCubeIds, reducedQuality = false }: { cube: CubeData; gridSize?: number; interactive?: boolean; allowedCubeIds?: string[] | null; reducedQuality?: boolean }) {
  const { bombTargetIds, clickCube, getCubeVisualState, invalidClickFeedback, mergeAnimation, runState, selectedCubeId, validTargetIds } = useGameStore()
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const mergeWaveRef = useRef<THREE.Mesh>(null)
  const physicalMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const labelRefs = useRef<Array<THREE.Mesh | null>>([])
  const clickFeedbackAtRef = useRef(0)
  const labelFrameTickRef = useRef(0)
  const lastActivationAtRef = useRef(0)
  const lastMaterialDebugStateRef = useRef<'fallback' | 'glass' | null>(null)
  const position = useMemo(() => toWorldPosition(cube.x, cube.y, cube.z, gridSize), [cube.x, cube.y, cube.z, gridSize])
  const visual = getCubeVisualState(cube.id)
  const emissive = useMemo(() => (
    visual.selected || cube.level > 1
      ? new THREE.Color(visual.highlighted ? '#22c55e' : CUBE_COLORS[cube.color])
      : new THREE.Color('#000000')
  ), [cube.color, cube.level, visual.highlighted, visual.selected])
  const opacity = visual.dimmed ? 0.3 : 1
  const scale = visual.selected ? 1.12 : visual.highlighted ? 1.07 : 1
  const isMergeSource = mergeAnimation?.sourceId === cube.id
  const isMergeTarget = mergeAnimation?.targetId === cube.id
  const isInvalidFeedbackTarget = invalidClickFeedback?.cubeId === cube.id
  const faction = factionVisuals(cube)
  const activeFaceConfigs = faceConfigs
  const labelTexture = useMemo(() => createLabelTexture(cube.level, visual.dimmed), [cube.level, visual.dimmed])
  const shellGeometry = useMemo(() => createShellGeometry(reducedQuality), [reducedQuality])
  const labelMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false
  }), [labelTexture])
  const shellBaseColor = cube.variant === 'golden' ? '#f6c945' : CUBE_COLORS[cube.color]
  const shellColor = useMemo(() => new THREE.Color(shellBaseColor).lerp(new THREE.Color(faction.shellTint), visual.selected ? 0.36 : 0.18), [faction.shellTint, shellBaseColor, visual.selected])
  const rimMaterial = useMemo(() => createRimMaterial(new THREE.Color(faction.coreAccent)), [faction.coreAccent])

  React.useEffect(() => {
    return () => {
      labelTexture.dispose()
      labelMaterial.dispose()
      shellGeometry.dispose()
      rimMaterial.dispose()
    }
  }, [labelMaterial, labelTexture, rimMaterial, shellGeometry])

  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group) return
    const clickElapsedMs = Date.now() - clickFeedbackAtRef.current
    const clickFeedbackProgress = clickElapsedMs >= 0 && clickElapsedMs <= 220 ? 1 - (clickElapsedMs / 220) : 0
    const clickFeedbackScale = clickFeedbackProgress > 0 ? 1 + Math.sin(clickFeedbackProgress * Math.PI) * 0.06 : 1
    const invalidElapsedMs = invalidClickFeedback?.cubeId === cube.id ? Date.now() - invalidClickFeedback.startTime : Number.POSITIVE_INFINITY
    const invalidProgress = invalidElapsedMs >= 0 && invalidElapsedMs <= (invalidClickFeedback?.duration ?? 0)
      ? 1 - (invalidElapsedMs / (invalidClickFeedback?.duration ?? 1))
      : 0

    if (!mergeAnimation || (!isMergeSource && !isMergeTarget)) {
      group.position.set(position[0], position[1], position[2])
      const invalidShake = invalidProgress > 0 ? Math.sin(invalidProgress * Math.PI * 12) * 0.04 : 0
      const invalidPunch = invalidProgress > 0 ? 1 + Math.sin(invalidProgress * Math.PI) * 0.08 : 1
      group.position.x += invalidShake
      group.position.y += invalidProgress > 0 ? invalidProgress * 0.02 : 0
      group.scale.setScalar(scale * clickFeedbackScale * invalidPunch)
      group.rotation.set(0, 0, 0)
    } else {
      const progress = Math.min(1, (Date.now() - mergeAnimation.startTime) / mergeAnimation.duration)
      const eased = easeOutCubic(progress)
      const mergeBounce = Math.sin(progress * Math.PI)

      if (isMergeSource) {
        const sourcePosition = toWorldPosition(mergeAnimation.sourcePosition.x, mergeAnimation.sourcePosition.y, mergeAnimation.sourcePosition.z, gridSize)
        const targetPosition = toWorldPosition(mergeAnimation.targetPosition.x, mergeAnimation.targetPosition.y, mergeAnimation.targetPosition.z, gridSize)
        const lift = mergeAnimation.kind === 'devour' ? 0.04 : 0.08
        group.position.set(
          THREE.MathUtils.lerp(sourcePosition[0], targetPosition[0], eased),
          THREE.MathUtils.lerp(sourcePosition[1], targetPosition[1], eased) + mergeBounce * lift,
          THREE.MathUtils.lerp(sourcePosition[2], targetPosition[2], eased)
        )
        const mergeScale = mergeAnimation.kind === 'devour'
          ? THREE.MathUtils.lerp(scale * 1.02, 0.86, easeInOutCubic(progress))
          : THREE.MathUtils.lerp(scale * 1.01, 0.88, easeInOutCubic(progress))
        group.scale.setScalar(mergeScale * clickFeedbackScale)
        group.rotation.set(0, 0, 0)
      } else if (isMergeTarget) {
        const pulse = progress < 0.18
          ? THREE.MathUtils.lerp(0.96, 1.01, progress / 0.18)
          : progress < 0.48
            ? THREE.MathUtils.lerp(1.01, 1.12, (progress - 0.18) / 0.3)
            : THREE.MathUtils.lerp(1.12, 1, (progress - 0.48) / 0.52)
        group.position.set(position[0], position[1], position[2])
        group.scale.setScalar(scale * pulse * clickFeedbackScale)
        group.rotation.set(0, 0, 0)
      }
    }

    const now = Date.now() * 0.001
    rimMaterial.uniforms.uIntensity.value = (
      isMergeTarget && mergeAnimation
        ? 1.96
        : isMergeSource && mergeAnimation
          ? 1.52
          : visual.selected ? 1.44 : visual.highlighted ? 1.18 : 0.96
    ) + clickFeedbackProgress * 0.7

    const physicalMaterial = physicalMaterialRef.current
    if (physicalMaterial) {
      group.getWorldPosition(scratchWorldPosition)
      const cameraDistance = scratchWorldPosition.distanceTo(camera.position)
      const hardFallbackDistance = 4.8
      const restoreGlassDistance = 6.2
      const glassFactor = THREE.MathUtils.clamp((cameraDistance - hardFallbackDistance) / (restoreGlassDistance - hardFallbackDistance), 0, 1)
      const useFallback = cameraDistance <= hardFallbackDistance + 0.05

      physicalMaterial.transmission = useFallback ? 0 : shellTransmission * glassFactor
      physicalMaterial.thickness = useFallback ? 0 : shellThickness * (0.3 + glassFactor * 0.7)
      physicalMaterial.reflectivity = useFallback ? 0.08 : 0.12 + glassFactor * 0.58
      physicalMaterial.clearcoat = useFallback ? 0.08 : 0.18 + glassFactor * 0.82
      physicalMaterial.attenuationDistance = useFallback ? 0.01 : 0.35 + glassFactor * 1.05
      physicalMaterial.ior = useFallback ? 1.02 : cube.color === 'yellow' ? 1.22 : cube.color === 'red' ? 1.14 : 1.18
      physicalMaterial.opacity = isMergeSource
        ? mergeAnimation?.kind === 'devour' ? Math.max(0.86, opacity * shellOpacity) : Math.max(0.45, opacity * 0.72)
        : useFallback
          ? Math.max(0.98, opacity)
          : Math.max(0.9, opacity * shellOpacity)

      if (typeof window !== 'undefined' && readStoredDebugOptions().debugMode) {
        const nextDebugState: 'fallback' | 'glass' = useFallback ? 'fallback' : 'glass'
        if (lastMaterialDebugStateRef.current !== nextDebugState) {
          lastMaterialDebugStateRef.current = nextDebugState
          console.warn('[CubeMesh material safety]', {
            cubeId: cube.id,
            color: cube.color,
            level: cube.level,
            cameraDistance: Number(cameraDistance.toFixed(3)),
            mode: nextDebugState,
            transmission: Number(physicalMaterial.transmission.toFixed(3)),
            thickness: Number(physicalMaterial.thickness.toFixed(3)),
            opacity: Number(physicalMaterial.opacity.toFixed(3))
          })
        }
      }
    }

    const ring = ringRef.current
    if (ring) {
      const pulse = visual.selected
        ? 1 + Math.sin(now * 5.4 + cube.level) * 0.12
        : visual.highlighted
          ? 1 + Math.sin(now * 4.2 + cube.level) * 0.08
          : isInvalidFeedbackTarget
            ? 1 + invalidProgress * 0.28
            : 1 + clickFeedbackProgress * 0.18
      ring.scale.setScalar(pulse)
    }

    const mergeWave = mergeWaveRef.current
    if (mergeWave) {
      if (isMergeTarget && mergeAnimation && mergeAnimation.kind === 'merge') {
        const progress = Math.min(1, (Date.now() - mergeAnimation.startTime) / mergeAnimation.duration)
        const waveProgress = easeOutCubic(progress)
        const material = mergeWave.material as THREE.MeshBasicMaterial
        mergeWave.visible = true
        mergeWave.scale.setScalar(0.72 + waveProgress * 1.1)
        material.opacity = Math.max(0, 0.52 - waveProgress * 0.52)
      } else {
        mergeWave.visible = false
      }
    }

    labelFrameTickRef.current += 1
    const shouldUpdateLabels = !reducedQuality || labelFrameTickRef.current % 2 === 0
    if (shouldUpdateLabels) {
      camera.getWorldPosition(scratchCameraPosition)
      group.getWorldQuaternion(scratchMeshWorldQuaternion)
      scratchInverseQuaternion.copy(scratchMeshWorldQuaternion).invert()
      scratchLocalCameraPosition.copy(scratchCameraPosition)
      group.worldToLocal(scratchLocalCameraPosition)
      camera.getWorldDirection(scratchCameraForward)
      scratchLocalCameraForward.copy(scratchCameraForward).applyQuaternion(scratchInverseQuaternion).normalize()
      scratchLocalCameraUp.copy(camera.up).applyQuaternion(scratchInverseQuaternion).normalize()

      activeFaceConfigs.forEach((config, index) => {
        const plane = labelRefs.current[index]
        if (!plane) return

        scratchPlanePosition.set(config.position[0], config.position[1], config.position[2])
        scratchNormal.copy(config.normal)
        scratchToCamera.copy(scratchLocalCameraPosition).sub(scratchPlanePosition).normalize()
        const facing = scratchNormal.dot(scratchToCamera)

        plane.visible = facing > 0.08 && !isMergeSource
        if (!plane.visible) return

        scratchNormalProjection.copy(scratchNormal).multiplyScalar(scratchLocalCameraUp.dot(scratchNormal))
        scratchPlaneUp.copy(scratchLocalCameraUp).sub(scratchNormalProjection)
        if (scratchPlaneUp.lengthSq() < 1e-4) {
          scratchNormalProjection.copy(scratchNormal).multiplyScalar(scratchLocalCameraForward.dot(scratchNormal))
          scratchPlaneUp.copy(scratchLocalCameraForward).sub(scratchNormalProjection)
        }
        if (scratchPlaneUp.lengthSq() < 1e-4) {
          scratchNormalProjection.copy(scratchNormal).multiplyScalar(scratchNormal.y)
          scratchPlaneUp.set(0, 1, 0).sub(scratchNormalProjection)
        }
        scratchPlaneUp.normalize()
        scratchPlaneRight.crossVectors(scratchPlaneUp, scratchNormal).normalize()
        scratchCorrectedUp.crossVectors(scratchNormal, scratchPlaneRight).normalize()
        scratchRotationMatrix.makeBasis(scratchPlaneRight, scratchCorrectedUp, scratchNormal)
        plane.quaternion.setFromRotationMatrix(scratchRotationMatrix)
      })

      for (let index = activeFaceConfigs.length; index < labelRefs.current.length; index += 1) {
        const plane = labelRefs.current[index]
        if (plane) {
          plane.visible = false
        }
      }
    }
  })

  const clickFeedbackElapsedMs = Date.now() - clickFeedbackAtRef.current
  const clickFeedbackProgress = clickFeedbackElapsedMs >= 0 && clickFeedbackElapsedMs <= 220 ? 1 - (clickFeedbackElapsedMs / 220) : 0
  const invalidFeedbackElapsedMs = invalidClickFeedback?.cubeId === cube.id ? Date.now() - invalidClickFeedback.startTime : Number.POSITIVE_INFINITY
  const invalidFeedbackProgress = invalidFeedbackElapsedMs >= 0 && invalidFeedbackElapsedMs <= (invalidClickFeedback?.duration ?? 0)
    ? 1 - (invalidFeedbackElapsedMs / (invalidClickFeedback?.duration ?? 1))
    : 0
  const emissiveIntensity = (isMergeTarget && mergeAnimation
    ? 0.92
    : visual.selected ? 0.56 : visual.highlighted ? 0.38 : cube.level > 1 ? 0.2 : 0.04) + clickFeedbackProgress * 0.26
  const shellThickness = cube.level >= 6 ? 0.08 : cube.level >= 4 ? 0.11 : 0.15
  const shellRoughness = cube.level <= 3 ? Math.max(0.3, faction.shellRoughness + 0.08) : cube.level <= 6 ? faction.shellRoughness : Math.max(0.16, faction.shellRoughness - 0.02)
  const shellTransmission = cube.level <= 3 ? Math.max(0.48, faction.shellTransmission - 0.08) : cube.level <= 6 ? faction.shellTransmission : Math.min(0.82, faction.shellTransmission + 0.04)
  const shellOpacity = visual.selected ? 1 : visual.highlighted ? Math.min(1, faction.shellOpacity + 0.03) : faction.shellOpacity
  const showSelectionRing = visual.selected || visual.highlighted || clickFeedbackProgress > 0 || invalidFeedbackProgress > 0
  const showRimShell = !reducedQuality || visual.selected || visual.highlighted || clickFeedbackProgress > 0 || isMergeSource || isMergeTarget
  const ringColor = invalidFeedbackProgress > 0 ? '#ff8d8d' : clickFeedbackProgress > 0 ? '#ffffff' : visual.selected ? '#ffffff' : faction.coreAccent
  const ringOpacity = invalidFeedbackProgress > 0 ? 0.9 : clickFeedbackProgress > 0 ? 0.96 : visual.selected ? 0.94 : 0.56

  const activateCube = (event: { stopPropagation: () => void }) => {
    if (!interactive || (allowedCubeIds && !allowedCubeIds.includes(cube.id))) {
      return
    }

    const canSelect = isSelectableCube(cube)
    const hasSelectedCube = Boolean(selectedCubeId)
    const isValidBombTarget = runState === 'targeting_bomb' && bombTargetIds.includes(cube.id)
    const isValidBoardTarget = hasSelectedCube && (cube.id === selectedCubeId || validTargetIds.includes(cube.id) || canSelect)
    const isInvalidClick = runState === 'targeting_bomb'
      ? !isValidBombTarget
      : hasSelectedCube
        ? !isValidBoardTarget && !canSelect
        : !canSelect

    const now = Date.now()
    if (now - lastActivationAtRef.current < 80) {
      event.stopPropagation()
      return
    }

    lastActivationAtRef.current = now
    event.stopPropagation()
    clickFeedbackAtRef.current = now
    if (!isInvalidClick) {
      void audioManager.playSelect()
    }
    clickCube(cube.id)
  }

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
    >
      <mesh
        onPointerDown={(event) => {
          if (!interactive || (allowedCubeIds && !allowedCubeIds.includes(cube.id))) {
            return
          }

          event.stopPropagation()
        }}
        onPointerUp={activateCube}
        onClick={activateCube}
      >
        <primitive attach="geometry" object={shellGeometry} />
        {reducedQuality ? (
          <meshStandardMaterial
            color={shellColor}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity * 0.78}
            metalness={0.04}
            roughness={Math.min(0.72, shellRoughness + 0.18)}
            transparent
            depthWrite
            depthTest
            opacity={isMergeSource ? mergeAnimation?.kind === 'devour' ? Math.max(0.86, opacity * shellOpacity) : Math.max(0.4, opacity * 0.68) : Math.max(0.88, opacity * shellOpacity)}
          />
        ) : (
          <meshPhysicalMaterial
            ref={physicalMaterialRef}
            color={shellColor}
            metalness={0.02}
            roughness={shellRoughness}
            transmission={shellTransmission}
            ior={cube.color === 'yellow' ? 1.22 : cube.color === 'red' ? 1.14 : 1.18}
            thickness={shellThickness}
            reflectivity={0.7}
            clearcoat={1}
            clearcoatRoughness={visual.selected ? 0.06 : 0.12}
            attenuationDistance={1.4}
            attenuationColor={shellColor}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity + (cube.color === 'red' ? 0.12 : cube.color === 'yellow' ? 0.08 : 0.04)}
            transparent
            depthWrite
            depthTest
            opacity={isMergeSource ? mergeAnimation?.kind === 'devour' ? Math.max(0.88, opacity * shellOpacity) : Math.max(0.45, opacity * 0.72) : Math.max(0.9, opacity * shellOpacity)}
          />
        )}
      </mesh>
      {showRimShell ? (
        <mesh raycast={() => null} scale={1.012}>
          <primitive attach="geometry" object={shellGeometry} />
          <primitive attach="material" object={rimMaterial} />
        </mesh>
      ) : null}
      {showSelectionRing ? (
        <mesh ref={ringRef} raycast={() => null} position={[0, -CUBE_SIZE * 0.54, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.46, 0.028, 18, 48]} />
          <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
      <mesh ref={mergeWaveRef} raycast={() => null} position={[0, -CUBE_SIZE * 0.53, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.34, 0.5, 48]} />
        <meshBasicMaterial color="#f8fdff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {activeFaceConfigs.map((config, index) => (
        <mesh
          key={config.key}
          raycast={() => null}
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
