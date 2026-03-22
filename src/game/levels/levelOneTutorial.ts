import type { Locale, PlayableDemoConfig } from '../model/types'
import { buildPlayableDemoConfig } from '../config/playableDemo'

export type TutorialCopy = Record<Locale, string>

export type LevelOneTutorialStep = {
  kind: 'info' | 'action'
  instruction: TutorialCopy
  objectiveText?: TutorialCopy
  continueLabel?: TutorialCopy
  completion?:
    | { type: 'merge'; color: 'blue' | 'yellow'; nextLevel: number }
    | { type: 'devour'; color: 'red' | 'yellow'; consumedLevel: number }
  sourceCubeId?: string
  targetCubeId?: string
}

function baseTutorialConfig(): PlayableDemoConfig {
  const config = buildPlayableDemoConfig()
  return {
    ...config,
    board: { gridSize: 3, cubes: [] },
    inventory: { bombCount: 0 },
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
        kind: 'info',
        instruction: {
          en: 'This is a blue cube. Blue cubes are the units you control, and matching blue cubes can merge into a stronger one.',
          'zh-CN': '这是蓝色方块。蓝色方块是你操控的单位，同级蓝色方块可以合成为更高等级。'
        },
        continueLabel: {
          en: 'Continue',
          'zh-CN': '继续'
        }
      }
    }
  }

  if (stepIndex === 1) {
    config.board.cubes = [
      { id: 'tutorial-blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 1 },
      { id: 'tutorial-blue-b', color: 'blue', level: 1, x: 1, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        kind: 'action',
        instruction: {
          en: 'Tap the highlighted blue cube, then tap the other blue cube to merge. Wait until the merge animation and score finish.',
          'zh-CN': '先点击高亮蓝色方块，再点击另一个蓝色方块完成合成。等待合成动画和加分完全结算。'
        },
        objectiveText: {
          en: 'Merge the blue pair',
          'zh-CN': '合成这对蓝色方块'
        },
        completion: { type: 'merge', color: 'blue', nextLevel: 2 },
        sourceCubeId: 'tutorial-blue-a',
        targetCubeId: 'tutorial-blue-b'
      }
    }
  }

  if (stepIndex === 2) {
    config.board.cubes = [
      { id: 'tutorial-blue-core', color: 'blue', level: 2, x: 0, y: 0, z: 1 },
      { id: 'tutorial-red-a', color: 'red', level: 1, x: 1, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        kind: 'info',
        instruction: {
          en: 'Red cubes are blockers. A strong enough blue cube can devour a red cube and take its place.',
          'zh-CN': '红色方块是障碍。等级足够的蓝色方块可以吞掉红色方块，并占据它的位置。'
        },
        continueLabel: {
          en: 'Continue',
          'zh-CN': '继续'
        }
      }
    }
  }

  if (stepIndex === 3) {
    config.board.cubes = [
      { id: 'tutorial-blue-core', color: 'blue', level: 2, x: 0, y: 0, z: 1 },
      { id: 'tutorial-red-a', color: 'red', level: 1, x: 1, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        kind: 'action',
        instruction: {
          en: 'Tap the Lv.2 blue cube, then devour the red blocker. Wait for the move and score to settle before the next lesson.',
          'zh-CN': '点击 Lv.2 蓝色方块，再吞掉红色障碍。等待移动和加分结算完成后，再进入下一课。'
        },
        objectiveText: {
          en: 'Devour the red cube',
          'zh-CN': '吞掉红色方块'
        },
        completion: { type: 'devour', color: 'red', consumedLevel: 1 },
        sourceCubeId: 'tutorial-blue-core',
        targetCubeId: 'tutorial-red-a'
      }
    }
  }

  if (stepIndex === 4) {
    config.board.cubes = [
      { id: 'tutorial-yellow-a', color: 'yellow', level: 1, x: 0, y: 0, z: 1 },
      { id: 'tutorial-yellow-b', color: 'yellow', level: 1, x: 1, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        kind: 'info',
        instruction: {
          en: 'Yellow cubes can also merge. Building yellow value creates better targets for future blue devours.',
          'zh-CN': '黄色方块也可以合成。把黄色方块升值后，会成为后续更有价值的蓝色吞噬目标。'
        },
        continueLabel: {
          en: 'Continue',
          'zh-CN': '继续'
        }
      }
    }
  }

  if (stepIndex === 5) {
    config.board.cubes = [
      { id: 'tutorial-yellow-a', color: 'yellow', level: 1, x: 0, y: 0, z: 1 },
      { id: 'tutorial-yellow-b', color: 'yellow', level: 1, x: 1, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        kind: 'action',
        instruction: {
          en: 'Now merge the yellow pair. Let the merge animation fully finish before continuing.',
          'zh-CN': '现在合成这对黄色方块。等合成动画完整播放结束后，再继续。'
        },
        objectiveText: {
          en: 'Merge the yellow pair',
          'zh-CN': '合成这对黄色方块'
        },
        completion: { type: 'merge', color: 'yellow', nextLevel: 2 },
        sourceCubeId: 'tutorial-yellow-a',
        targetCubeId: 'tutorial-yellow-b'
      }
    }
  }

  if (stepIndex === 6) {
    config.board.cubes = [
      { id: 'tutorial-blue-hunter', color: 'blue', level: 2, x: 0, y: 0, z: 1 },
      { id: 'tutorial-yellow-target', color: 'yellow', level: 2, x: 1, y: 0, z: 1 },
      { id: 'tutorial-red-target', color: 'red', level: 1, x: 2, y: 0, z: 1 }
    ]
    return {
      config,
      step: {
        kind: 'info',
        instruction: {
          en: 'Final lesson: first devour the Lv.2 yellow cube, then devour the red cube to finish the tutorial.',
          'zh-CN': '最后一课：先吞掉 Lv.2 黄色方块，再吞掉红色方块，完成整个教学。'
        },
        continueLabel: {
          en: 'Start Final Step',
          'zh-CN': '开始最后一步'
        }
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
      kind: 'action',
      instruction: {
        en: 'Devour the yellow cube first, then devour the red cube to complete the tutorial.',
        'zh-CN': '先吞掉黄色方块，再吞掉红色方块，完成教学。'
      },
      objectiveText: {
        en: 'Devour yellow, then devour red',
        'zh-CN': '先吞黄，再吞红'
      },
      completion: { type: 'devour', color: 'red', consumedLevel: 1 },
      sourceCubeId: 'tutorial-blue-hunter',
      targetCubeId: 'tutorial-yellow-target'
    }
  }
}
