import type { PlayableDemoConfig } from '../model/types'
import { buildPlayableDemoConfig } from '../config/playableDemo'

export type LevelOneTutorialStep = {
  instruction: string
  objectiveText: string
  sourceCubeId?: string
  targetCubeId?: string
  showSwipeIndicator?: boolean
  uiTarget?: 'slice-layer-1'
}

function baseTutorialConfig(): PlayableDemoConfig {
  const config = buildPlayableDemoConfig()
  return {
    ...config,
    board: { gridSize: 3, cubes: [] },
    inventory: { bombCount: 1 },
    winLoss: { ...config.winLoss, victory: 'none' },
    ui: { ...config.ui, showCombo: false, showPause: false }
  }
}

export function getLevelOneTutorialStep(stepIndex: number): { config: PlayableDemoConfig; step: LevelOneTutorialStep } {
  const config = baseTutorialConfig()

  if (stepIndex === 0) {
    config.board.cubes = [
      { id: 'tutorial-blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 1 },
      { id: 'tutorial-blue-b', color: 'blue', level: 1, x: 1, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        instruction: 'Tap the two blue cubes to merge them into Lv.2.',
        objectiveText: 'Merge the blue pair',
        sourceCubeId: 'tutorial-blue-a',
        targetCubeId: 'tutorial-blue-b'
      }
    }
  }

  if (stepIndex === 1) {
    config.board.cubes = [
      { id: 'tutorial-blue-core', color: 'blue', level: 2, x: 0, y: 0, z: 1 },
      { id: 'tutorial-red-a', color: 'red', level: 1, x: 1, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        instruction: 'Tap the Lv.2 blue cube, then devour the red blocker.',
        objectiveText: 'Devour the red cube',
        sourceCubeId: 'tutorial-blue-core',
        targetCubeId: 'tutorial-red-a'
      }
    }
  }

  if (stepIndex === 2) {
    config.board.cubes = [
      { id: 'tutorial-yellow-a', color: 'yellow', level: 1, x: 0, y: 0, z: 1 },
      { id: 'tutorial-yellow-b', color: 'yellow', level: 1, x: 1, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        instruction: 'Tap the two yellow cubes to merge them into Lv.2.',
        objectiveText: 'Merge the yellow pair',
        sourceCubeId: 'tutorial-yellow-a',
        targetCubeId: 'tutorial-yellow-b'
      }
    }
  }

  config.board.cubes = [
    { id: 'tutorial-blue-hunter', color: 'blue', level: 2, x: 0, y: 0, z: 1 },
    { id: 'tutorial-yellow-target', color: 'yellow', level: 2, x: 1, y: 0, z: 1 },
    { id: 'tutorial-red-target', color: 'red', level: 1, x: 2, y: 0, z: 1 }
  ]
  return {
    config,
    step: {
      instruction: 'Use the Lv.2 blue cube to eat the yellow cube, then eat the red cube to finish.',
      objectiveText: 'Devour yellow, then devour red',
      sourceCubeId: 'tutorial-blue-hunter',
      targetCubeId: 'tutorial-yellow-target'
    }
  }
}
