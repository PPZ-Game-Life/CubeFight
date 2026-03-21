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

function levelPhase(level: number) {
  return level <= 3 ? 'awakening' : level <= 6 ? 'forming' : level <= 8 ? 'critical' : 'mythic'
}

function createLevelGeometry(level: number) {
  if (level <= 2) return new THREE.SphereGeometry(0.18, 24, 24)
  if (level === 3) return new THREE.OctahedronGeometry(0.22, 0)
  if (level <= 5) return new THREE.IcosahedronGeometry(0.22, 0)
  if (level === 6) return new THREE.TorusKnotGeometry(0.14, 0.045, 80, 12)
  if (level <= 8) return new THREE.DodecahedronGeometry(0.24, 0)
  return new THREE.IcosahedronGeometry(0.28, 1)
}

function createSecondaryGeometry(level: number) {
  if (level < 4) return null
  return new THREE.OctahedronGeometry(0.18, level >= 7 ? 1 : 0)
}

function levelCoreScale(level: number) {
  if (level <= 3) return 0.72
  if (level <= 6) return 0.92
  if (level <= 8) return 1.02
  return 1.16
}

function createEnergyMaterial(primaryColor: THREE.Color, secondaryColor: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPrimary: { value: primaryColor },
      uSecondary: { value: secondaryColor }
    },
    vertexShader: `
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        float radial = length(vPosition.xy);
        float swirl = sin((vPosition.y * 16.0) + (vPosition.z * 10.0) - uTime * 2.4);
        float pulse = 0.55 + 0.45 * sin(uTime * 3.2 + radial * 18.0);
        float flow = smoothstep(-0.4, 0.9, swirl);
        float fresnel = pow(1.0 - abs(vNormal.z), 2.0);
        vec3 color = mix(uPrimary, uSecondary, flow);
        color += uSecondary * pulse * 0.35;
        float alpha = 0.72 + fresnel * 0.18;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  })
}

function factionVisuals(color: CubeData['color']) {
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

function CubeMeshInner({ cube, interactive = true }: { cube: CubeData; interactive?: boolean }) {
  const { clickCube, getCubeVisualState, mergeAnimation } = useGameStore()
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
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
  const phase = levelPhase(cube.level)
  const faction = factionVisuals(cube.color)
  const labelTexture = useMemo(() => createLabelTexture(cube.level, visual.dimmed), [cube.level, visual.dimmed])
  const coreGeometry = useMemo(() => createLevelGeometry(cube.level), [cube.level])
  const secondaryGeometry = useMemo(() => createSecondaryGeometry(cube.level), [cube.level])
  const labelMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false
  }), [labelTexture])
  const coreColor = useMemo(() => new THREE.Color(CUBE_COLORS[cube.color]).offsetHSL(0, 0.08, cube.color === 'yellow' ? 0.12 : 0.06), [cube.color])
  const shellColor = useMemo(() => new THREE.Color(CUBE_COLORS[cube.color]).lerp(new THREE.Color(faction.shellTint), visual.selected ? 0.36 : 0.18), [cube.color, faction.shellTint, visual.selected])
  const energyMaterial = useMemo(() => {
    if (cube.level < 7) return null
    return createEnergyMaterial(coreColor.clone(), new THREE.Color(faction.coreAccent))
  }, [coreColor, cube.level, faction.coreAccent])

  React.useEffect(() => {
    return () => {
      labelTexture.dispose()
      labelMaterial.dispose()
      coreGeometry.dispose()
      secondaryGeometry?.dispose()
      energyMaterial?.dispose()
    }
  }, [coreGeometry, energyMaterial, labelMaterial, labelTexture, secondaryGeometry])

  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group) return
    const core = coreRef.current

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

    if (core) {
      const now = Date.now() * 0.001
      const idleSpeed = 0.24 + cube.level * 0.035
      core.rotation.x = now * idleSpeed * 0.45
      core.rotation.y = now * idleSpeed
      core.rotation.z = Math.sin(now * 0.8 + cube.level) * 0.14
      const breathe = cube.color === 'red' ? 1 + Math.sin(now * 2.6 + cube.level) * 0.04 : 1 + Math.sin(now * 1.4 + cube.level) * 0.02
      core.scale.setScalar(levelCoreScale(cube.level) * breathe)
      if (energyMaterial) {
        energyMaterial.uniforms.uTime.value = now
      }

      const ring = ringRef.current
      if (ring) {
        const pulse = visual.selected
          ? 1 + Math.sin(now * 5.4 + cube.level) * 0.08
          : visual.highlighted
            ? 1 + Math.sin(now * 4.2 + cube.level) * 0.05
            : 1
        ring.scale.setScalar(pulse)
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
  const shellThickness = cube.level >= 6 ? 0.08 : cube.level >= 4 ? 0.11 : 0.15
  const shellRoughness = phase === 'awakening' ? Math.max(0.3, faction.shellRoughness + 0.08) : phase === 'forming' ? faction.shellRoughness : Math.max(0.16, faction.shellRoughness - 0.02)
  const shellTransmission = phase === 'awakening' ? Math.max(0.48, faction.shellTransmission - 0.08) : phase === 'forming' ? faction.shellTransmission : Math.min(0.82, faction.shellTransmission + 0.04)
  const coreEmissiveIntensity = phase === 'awakening' ? 0.45 : phase === 'forming' ? 0.85 : phase === 'critical' ? 1.2 : 1.55
  const edgeOpacity = visual.dimmed ? 0.24 : visual.selected ? 0.82 : 0.54
  const innerOpacity = visual.dimmed ? 0.58 : 1
  const shellOpacity = visual.selected ? 1 : visual.highlighted ? Math.min(1, faction.shellOpacity + 0.03) : faction.shellOpacity
  const selectedLift = visual.selected ? 0.04 : visual.highlighted ? 0.02 : 0
  const showSelectionRing = visual.selected || visual.highlighted
  const ringColor = visual.selected ? '#ffffff' : faction.coreAccent
  const ringOpacity = visual.selected ? 0.9 : 0.42

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
    >
      <group ref={coreRef} position={[0, selectedLift, 0]}>
        <mesh raycast={() => null}>
          <primitive attach="geometry" object={coreGeometry} />
          {energyMaterial ? (
            <primitive attach="material" object={energyMaterial} />
          ) : (
            <meshStandardMaterial
              color={coreColor}
              emissive={new THREE.Color(faction.coreAccent)}
              emissiveIntensity={coreEmissiveIntensity * (visual.highlighted ? 1.18 : 1)}
              metalness={cube.color === 'yellow' ? 0.26 : phase === 'awakening' ? 0.12 : 0.2}
              roughness={cube.color === 'red' ? 0.28 : phase === 'awakening' ? 0.38 : 0.22}
              transparent={innerOpacity < 1}
              depthWrite
              opacity={isMergeSource ? innerOpacity * 0.45 : innerOpacity}
            />
          )}
        </mesh>
        {secondaryGeometry ? (
          <mesh raycast={() => null} rotation={[Math.PI / 4, Math.PI / 4, 0]} scale={0.72}>
            <primitive attach="geometry" object={secondaryGeometry} />
            <meshStandardMaterial
              color={new THREE.Color('#f8fbff')}
              emissive={new THREE.Color(faction.coreAccent)}
              emissiveIntensity={coreEmissiveIntensity * 0.42}
              metalness={cube.color === 'yellow' ? 0.16 : 0.06}
              roughness={cube.color === 'blue' ? 0.14 : 0.22}
              transparent={visual.dimmed}
              depthWrite
              opacity={visual.dimmed ? 0.48 : 0.72}
            />
          </mesh>
        ) : null}
      </group>
      <mesh onClick={(event) => {
        if (!interactive) {
          return
        }
        event.stopPropagation()
        clickCube(cube.id)
      }}>
        <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
        <meshPhysicalMaterial
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
          opacity={isMergeSource ? Math.max(0.45, opacity * 0.72) : Math.max(0.9, opacity * shellOpacity)}
        />
      </mesh>
      <lineSegments raycast={() => null}>
        <edgesGeometry args={[new THREE.BoxGeometry(CUBE_SIZE * 0.98, CUBE_SIZE * 0.98, CUBE_SIZE * 0.98)]} />
        <lineBasicMaterial color={visual.selected ? '#ffffff' : new THREE.Color(faction.coreAccent)} transparent opacity={edgeOpacity} />
      </lineSegments>
      {showSelectionRing ? (
        <mesh ref={ringRef} raycast={() => null} position={[0, -CUBE_SIZE * 0.54, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.46, 0.028, 18, 48]} />
          <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
      {faceConfigs.map((config, index) => (
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
