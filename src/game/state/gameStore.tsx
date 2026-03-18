import React, { createContext, useContext, useMemo, useState } from 'react'
import {
  COIN_VALUES,
  COMBO_TIMEOUT,
  GRID_SIZE,
  INITIAL_CUBES,
  MAX_LEVEL,
  SCORE_VALUES
} from '../config/config'
import type { CubeData, MergeAnimationState, SliceState } from '../model/types'
import { getActualTopDownLayerIndex, getScreenColumnMapping, isCubeVisible } from './selectors'

type CameraState = {
  yaw: number
  pitch: number
  resetVersion: number
}

type ControlState = {
  xSelection: number
  ySelection: number
}

type VisualState = {
  selected: boolean
  highlighted: boolean
  dimmed: boolean
}

type GameStoreValue = {
  cubes: CubeData[]
  visibleCubes: CubeData[]
  selectedCubeId: string | null
  score: number
  coins: number
  comboCount: number
  comboText: string | null
  gameOver: boolean
  mergeAnimation: MergeAnimationState | null
  slice: SliceState
  controls: ControlState
  camera: CameraState
  getCubeVisualState: (cubeId: string) => VisualState
  clickCube: (cubeId: string) => void
  clearSelection: () => void
  showLayerFromTop: (index: number) => void
  showScreenColumn: (index: number) => void
  resetSliceView: () => void
  resetView: () => void
  updateCameraAngles: (yaw: number, pitch: number) => void
}

const GameStoreContext = createContext<GameStoreValue | null>(null)

function cloneInitialCubes(): CubeData[] {
  return INITIAL_CUBES.map((cube) => ({ ...cube }))
}

function isAdjacent(a: CubeData, b: CubeData) {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  const dz = Math.abs(a.z - b.z)
  return (dx === 1 && dy === 0 && dz === 0) || (dx === 0 && dy === 1 && dz === 0) || (dx === 0 && dy === 0 && dz === 1)
}

function canPerformAction(source: CubeData, target: CubeData) {
  if (source.color === 'blue') {
    if (target.color === 'blue' && source.level === target.level) return true
    if ((target.color === 'red' || target.color === 'yellow') && source.level >= target.level) return true
  }
  if (source.color === 'yellow' && target.color === 'yellow' && source.level === target.level) return true
  return false
}

function computeNextCombo(previousCombo: number, lastActionTime: number) {
  const now = Date.now()
  if (now - lastActionTime > COMBO_TIMEOUT) {
    return { combo: 1, time: now }
  }
  return { combo: previousCombo + 1, time: now }
}

function getComboText(combo: number) {
  const comboTexts = ['', '', 'Nice!', 'Great!', 'Awesome!', 'Amazing!', 'Godlike!']
  return combo < comboTexts.length ? comboTexts[combo] : 'UNSTOPPABLE!'
}

function getMaxBlueLevel(cubes: CubeData[]) {
  return cubes.reduce((max, cube) => (cube.color === 'blue' ? Math.max(max, cube.level) : max), 1)
}

function hasValidMoves(cubes: CubeData[]) {
  for (const cube of cubes) {
    if (cube.color !== 'blue') continue
    for (const neighbor of cubes) {
      if (neighbor.id === cube.id) continue
      if (isAdjacent(cube, neighbor) && canPerformAction(cube, neighbor)) {
        return true
      }
    }
  }
  return false
}

function spawnRedCube(cubes: CubeData[]): CubeData[] {
  const occupied = new Set(cubes.map((cube) => `${cube.x}-${cube.y}-${cube.z}`))
  const emptyPositions: Array<{ x: number; y: number; z: number }> = []

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const key = `${x}-${y}-${z}`
        if (!occupied.has(key)) {
          emptyPositions.push({ x, y, z })
        }
      }
    }
  }

  if (emptyPositions.length === 0) return cubes

  const pos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)]
  const maxBlueLevel = getMaxBlueLevel(cubes)
  const maxLevel = Math.max(1, maxBlueLevel - 1)
  const level = Math.floor(Math.random() * maxLevel) + 1

  return [...cubes, {
    id: `red-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    color: 'red',
    level,
    x: pos.x,
    y: pos.y,
    z: pos.z
  }]
}

function evaluateEndlessBoard(cubes: CubeData[]) {
  const isFull = cubes.length >= GRID_SIZE * GRID_SIZE * GRID_SIZE
  return isFull && !hasValidMoves(cubes)
}

export function GameStoreProvider({ children }: { children: React.ReactNode }) {
  const [cubes, setCubes] = useState<CubeData[]>(() => cloneInitialCubes())
  const [selectedCubeId, setSelectedCubeId] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [coins, setCoins] = useState(0)
  const [comboCount, setComboCount] = useState(0)
  const [comboText, setComboText] = useState<string | null>(null)
  const [lastActionTime, setLastActionTime] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [mergeAnimation, setMergeAnimation] = useState<MergeAnimationState | null>(null)
  const [slice, setSlice] = useState<SliceState>({ axis: null, index: -1 })
  const [controls, setControls] = useState<ControlState>({ xSelection: -1, ySelection: -1 })
  const [camera, setCamera] = useState<CameraState>({ yaw: 0, pitch: Math.PI / 2, resetVersion: 0 })

  React.useEffect(() => {
    if (comboCount <= 0) return
    const timer = window.setTimeout(() => {
      setComboCount(0)
      setComboText(null)
    }, COMBO_TIMEOUT)
    return () => window.clearTimeout(timer)
  }, [comboCount, lastActionTime])

  const visibleCubes = useMemo(() => cubes.filter((cube) => isCubeVisible(cube, slice)), [cubes, slice])

  const getCubeVisualState = (cubeId: string): VisualState => {
    const cube = cubes.find((item) => item.id === cubeId)
    const selected = cubes.find((item) => item.id === selectedCubeId)
    if (!cube) return { selected: false, highlighted: false, dimmed: false }
    if (!selected) return { selected: false, highlighted: false, dimmed: false }
    if (cube.id === selected.id) return { selected: true, highlighted: false, dimmed: false }
    const highlighted = isAdjacent(selected, cube) && canPerformAction(selected, cube)
    return { selected: false, highlighted, dimmed: !highlighted }
  }

  const finalizeMerge = (animation: MergeAnimationState, comboMultiplier: number) => {
    setCubes((prev) => {
      const merged = prev
        .filter((cube) => cube.id !== animation.targetId)
        .map((cube) => (
          cube.id === animation.sourceId
            ? {
                ...cube,
                x: animation.targetPosition.x,
                y: animation.targetPosition.y,
                z: animation.targetPosition.z,
                level: animation.nextLevel
              }
            : cube
        ))
      const nextCubes = spawnRedCube(merged)
      setGameOver(evaluateEndlessBoard(nextCubes))
      return nextCubes
    })
    setScore((prev) => prev + (SCORE_VALUES[animation.nextLevel - 1] ?? 10) * comboMultiplier)
    setSelectedCubeId(null)
    setMergeAnimation(null)
  }

  React.useEffect(() => {
    if (!mergeAnimation) return
    const timer = window.setTimeout(() => {
      finalizeMerge(mergeAnimation, comboCount || 1)
    }, mergeAnimation.duration)
    return () => window.clearTimeout(timer)
  }, [mergeAnimation])

  const resolveAction = (source: CubeData, target: CubeData) => {
    if (!isAdjacent(source, target) || !canPerformAction(source, target)) {
      setSelectedCubeId(null)
      return
    }

    const nextCombo = computeNextCombo(comboCount, lastActionTime)
    setComboCount(nextCombo.combo)
    setLastActionTime(nextCombo.time)
    setComboText(nextCombo.combo > 1 ? getComboText(nextCombo.combo) : null)

    if ((source.color === 'blue' && target.color === 'blue' && source.level === target.level) ||
      (source.color === 'yellow' && target.color === 'yellow' && source.level === target.level)) {
      const nextLevel = Math.min(source.level + 1, MAX_LEVEL)
      setMergeAnimation({
        sourceId: source.id,
        targetId: target.id,
        targetPosition: { x: target.x, y: target.y, z: target.z },
        nextLevel,
        startTime: Date.now(),
        duration: 240,
        sourceColor: source.color
      })
      return
    }

    if (source.color === 'blue' && (target.color === 'red' || target.color === 'yellow') && source.level >= target.level) {
      setCubes((prev) => {
        const devoured = prev
        .filter((cube) => cube.id !== target.id)
        .map((cube) => (cube.id === source.id ? { ...cube, x: target.x, y: target.y, z: target.z } : cube))
        const nextCubes = spawnRedCube(devoured)
        setGameOver(evaluateEndlessBoard(nextCubes))
        return nextCubes
      })
      setScore((prev) => prev + (SCORE_VALUES[target.level - 1] ?? 10) * nextCombo.combo)
      if (target.color === 'yellow') {
        setCoins((prev) => prev + (COIN_VALUES[target.level - 1] ?? 1))
      }
      setSelectedCubeId(null)
    }
  }

  const clickCube = (cubeId: string) => {
    if (gameOver) return
    const cube = cubes.find((item) => item.id === cubeId)
    if (!cube) return

    if (!selectedCubeId) {
      if (cube.color === 'blue' || cube.color === 'yellow') {
        setSelectedCubeId(cube.id)
      }
      return
    }

    if (selectedCubeId === cube.id) {
      setSelectedCubeId(null)
      return
    }

    const source = cubes.find((item) => item.id === selectedCubeId)
    if (!source) {
      setSelectedCubeId(null)
      return
    }

    resolveAction(source, cube)
  }

  const clearSelection = () => {
    setSelectedCubeId(null)
  }

  const showLayerFromTop = (index: number) => {
    setControls((prev) => ({ ...prev, ySelection: index }))
    setSlice({ axis: 'y', index: getActualTopDownLayerIndex(index) })
  }

  const showScreenColumn = (index: number) => {
    const mapping = getScreenColumnMapping(camera.yaw)
    setControls((prev) => ({ ...prev, xSelection: index }))
    setSlice({ axis: mapping.axis, index: mapping.order[index] })
  }

  const resetSliceView = () => {
    setSlice({ axis: null, index: -1 })
    setControls({ xSelection: -1, ySelection: -1 })
  }

  const resetView = () => {
    resetSliceView()
    setCamera((prev) => ({ ...prev, yaw: 0, pitch: Math.PI / 2, resetVersion: prev.resetVersion + 1 }))
  }

  const updateCameraAngles = (yaw: number, pitch: number) => {
    setCamera((prev) => ({ ...prev, yaw, pitch }))
  }

  const value = useMemo<GameStoreValue>(() => ({
    cubes,
    visibleCubes,
    selectedCubeId,
    score,
    coins,
    comboCount,
    comboText,
    gameOver,
    mergeAnimation,
    slice,
    controls,
    camera,
    getCubeVisualState,
    clickCube,
    clearSelection,
    showLayerFromTop,
    showScreenColumn,
    resetSliceView,
    resetView,
    updateCameraAngles
  }), [cubes, visibleCubes, selectedCubeId, score, coins, comboCount, slice, controls, camera])

  return <GameStoreContext.Provider value={value}>{children}</GameStoreContext.Provider>
}

export function useGameStore() {
  const context = useContext(GameStoreContext)
  if (!context) throw new Error('useGameStore must be used within GameStoreProvider')
  return context
}
