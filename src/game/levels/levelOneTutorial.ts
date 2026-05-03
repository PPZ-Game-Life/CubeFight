import { buildPlayableDemoConfig } from '../config/playableDemo'
import type { Locale, PlayableDemoConfig } from '../model/types'

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

type TutorialStepBundle = {
  config: PlayableDemoConfig
  step: LevelOneTutorialStep
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

function createTutorialBundle(cubes: PlayableDemoConfig['board']['cubes'], step: LevelOneTutorialStep): TutorialStepBundle {
  const config = baseTutorialConfig()
  config.board.cubes = cubes
  return { config, step }
}

const LEVEL_ONE_TUTORIAL_STEPS: TutorialStepBundle[] = [
  createTutorialBundle(
    [{ id: 'tutorial-blue-home', color: 'blue', level: 1, x: 0, y: 0, z: 1 }],
    {
      kind: 'info',
      instruction: {
        en: 'Blue cubes are yours.',
        'zh-CN': '蓝块是你控制的方块。'
      },
      continueLabel: {
        en: 'Continue',
        'zh-CN': '继续'
      }
    }
  ),
  createTutorialBundle(
    [
      { id: 'tutorial-blue-a', color: 'blue', level: 1, x: 0, y: 0, z: 1 },
      { id: 'tutorial-blue-b', color: 'blue', level: 1, x: 1, y: 0, z: 1 }
    ],
    {
      kind: 'action',
      instruction: {
        en: 'Tap both blue cubes to merge.',
        'zh-CN': '点击两个蓝块，合成更强蓝块。'
      },
      objectiveText: {
        en: 'Merge the two blue cubes',
        'zh-CN': '合成这两个蓝色方块'
      },
      completion: { type: 'merge', color: 'blue', nextLevel: 2 },
      sourceCubeId: 'tutorial-blue-a',
      targetCubeId: 'tutorial-blue-b'
    }
  ),
  createTutorialBundle(
    [
      { id: 'tutorial-yellow-a', color: 'yellow', level: 1, x: 0, y: 0, z: 1 },
      { id: 'tutorial-yellow-b', color: 'yellow', level: 1, x: 1, y: 0, z: 1 }
    ],
    {
      kind: 'info',
      instruction: {
        en: 'Yellow cubes are treasure.',
        'zh-CN': '黄块是财宝。'
      },
      continueLabel: {
        en: 'Continue',
        'zh-CN': '继续'
      }
    }
  ),
  createTutorialBundle(
    [
      { id: 'tutorial-yellow-a', color: 'yellow', level: 1, x: 0, y: 0, z: 1 },
      { id: 'tutorial-yellow-b', color: 'yellow', level: 1, x: 1, y: 0, z: 1 }
    ],
    {
      kind: 'action',
      instruction: {
        en: 'Yellow cubes can merge too.',
        'zh-CN': '黄块也能合成。'
      },
      objectiveText: {
        en: 'Merge the two yellow cubes',
        'zh-CN': '合成这两个黄色方块'
      },
      completion: { type: 'merge', color: 'yellow', nextLevel: 2 },
      sourceCubeId: 'tutorial-yellow-a',
      targetCubeId: 'tutorial-yellow-b'
    }
  ),
  createTutorialBundle(
    [
      { id: 'tutorial-blue-hunter', color: 'blue', level: 2, x: 0, y: 0, z: 1 },
      { id: 'tutorial-yellow-target', color: 'yellow', level: 2, x: 1, y: 0, z: 1 }
    ],
    {
      kind: 'action',
      instruction: {
        en: 'Higher blue cubes can eat treasure.',
        'zh-CN': '高等级蓝块可以吃掉财宝。'
      },
      objectiveText: {
        en: 'Devour the yellow cube',
        'zh-CN': '吞掉黄色方块'
      },
      completion: { type: 'devour', color: 'yellow', consumedLevel: 2 },
      sourceCubeId: 'tutorial-blue-hunter',
      targetCubeId: 'tutorial-yellow-target'
    }
  ),
  createTutorialBundle(
    [{ id: 'tutorial-red-enemy', color: 'red', level: 1, x: 0, y: 0, z: 1 }],
    {
      kind: 'info',
      instruction: {
        en: 'Red cubes are enemies.',
        'zh-CN': '红块是敌人。'
      },
      continueLabel: {
        en: 'Continue',
        'zh-CN': '继续'
      }
    }
  ),
  createTutorialBundle(
    [
      { id: 'tutorial-blue-finisher', color: 'blue', level: 2, x: 0, y: 0, z: 1 },
      { id: 'tutorial-red-target', color: 'red', level: 1, x: 1, y: 0, z: 1 }
    ],
    {
      kind: 'action',
      instruction: {
        en: 'Eat the red cube to finish.',
        'zh-CN': '吃掉红块，完成教学。'
      },
      objectiveText: {
        en: 'Devour the red cube',
        'zh-CN': '吞掉红色方块'
      },
      completion: { type: 'devour', color: 'red', consumedLevel: 1 },
      sourceCubeId: 'tutorial-blue-finisher',
      targetCubeId: 'tutorial-red-target'
    }
  )
]

export const LEVEL_ONE_TUTORIAL_STEP_COUNT = LEVEL_ONE_TUTORIAL_STEPS.length

export function getLevelOneTutorialStep(stepIndex: number): TutorialStepBundle {
  return LEVEL_ONE_TUTORIAL_STEPS[Math.max(0, Math.min(stepIndex, LEVEL_ONE_TUTORIAL_STEPS.length - 1))]
}
