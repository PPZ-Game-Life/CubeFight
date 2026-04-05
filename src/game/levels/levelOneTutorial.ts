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
        en: 'This blue cube is your force. Blue cubes are the units you control on the board.',
        'zh-CN': '这个蓝色方块代表你的势力。蓝色方块就是你在棋盘上操控的单位。'
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
        en: 'Tap one Lv.1 blue cube, then tap the other. Same-level blue cubes merge into a stronger blue cube.',
        'zh-CN': '先点一个 1 级蓝块，再点另一个。同级蓝块可以合成为更强的蓝块。'
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
        en: 'Yellow cubes are treasure. They can also merge, and higher-value treasure is even better to claim later.',
        'zh-CN': '黄色方块是财宝。它们也能合成，而且更高价值的财宝会更值得你之后去吃掉。'
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
        en: 'Now merge the two yellow cubes. Treasure can merge just like blue cubes.',
        'zh-CN': '现在把这两个黄色方块合起来。财宝也和蓝块一样，可以通过同级合成升级。'
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
        en: 'A blue cube can also devour treasure if its level is high enough. Use the Lv.2 blue cube to consume the yellow cube.',
        'zh-CN': '只要等级足够，蓝块也可以吞掉财宝。用这个 2 级蓝块吃掉黄色方块。'
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
        en: 'Red cubes are enemies. They block your space, and you need stronger blue cubes to clear them out.',
        'zh-CN': '红色方块就是敌人。它们会占住空间，你需要更强的蓝块把它们清掉。'
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
        en: 'Finish the tutorial by using the blue cube to devour the red enemy.',
        'zh-CN': '最后一步：用蓝色方块吞掉这个红色敌人，完成教学。'
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
