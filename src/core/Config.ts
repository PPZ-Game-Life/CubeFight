/**
 * 方块颜色枚举
 */
export enum CubeColor {
  BLUE = 'blue',   // 玩家控制
  RED = 'red',     // 怪物障碍
  YELLOW = 'yellow' // 财宝资源
}

/**
 * 方块状态
 */
export enum CubeState {
  IDLE = 'idle',
  SELECTED = 'selected',
  MERGING = 'merging',
  DYING = 'dying'
}

/**
 * 游戏模式
 */
export enum GameMode {
  CAMPAIGN = 'campaign',    // 闯关模式
  ENDLESS = 'endless'       // 无尽模式
}

/**
 * 刷新模式
 */
export enum RefreshMode {
  STATIC = 'static',        // 静态解谜：不自动刷新
  DYNAMIC = 'dynamic'       // 动态补位：自动补充新方块
}

/**
 * 数值系统（按照EconomyAndNumbers.md）
 */
export const LEVEL_VALUES = {
  1: { score: 10, coin: 1, visual: 'basic' },
  2: { score: 30, coin: 3, visual: 'spark' },
  3: { score: 80, coin: 8, visual: 'burst' },
  4: { score: 200, coin: 20, visual: 'shake' },
  5: { score: 500, coin: 50, visual: 'beam' },
  6: { score: 1200, coin: 120, visual: 'glow' },
  7: { score: 3000, coin: 300, visual: 'awesome' },
  8: { score: 8000, coin: 800, visual: 'shockwave' },
  9: { score: 25000, coin: 2500, visual: 'godlike' }
};

/**
 * 游戏配置
 */
export const CONFIG = {
  // 网格配置
  GRID_SIZE: 3,           // 3x3x3
  CUBE_SIZE: 1,           // 方块尺寸
  CUBE_GAP: 0.2,          // 方块间距
  MAX_LEVEL: 9,           // 最大等级
  
  // 颜色配置
  COLORS: {
    [CubeColor.BLUE]: 0x3b82f6,
    [CubeColor.RED]: 0xef4444,
    [CubeColor.YELLOW]: 0xfbbf24
  },
  
  // 相机配置
  CAMERA: {
    FOV: 60,
    NEAR: 0.1,
    FAR: 1000,
    POSITION: { x: 5, y: 5, z: 5 }
  },
  
  // Combo系统
  COMBO_TIMEOUT: 3000,    // 3秒超时
  
  // 游戏模式配置
  GAME_MODES: {
    [GameMode.CAMPAIGN]: {
      refreshMode: RefreshMode.STATIC,
      maxRedLevel: 5,           // 前10关最高只能合出5级
      coinDropEnabled: false,   // 黄块不掉落金币
      levelRewards: {
        1: 50, 2: 60, 3: 70, 4: 80, 5: 90,
        6: 100, 7: 110, 8: 120, 9: 130, 10: 150
      }
    },
    [GameMode.ENDLESS]: {
      refreshMode: RefreshMode.DYNAMIC,
      maxRedLevel: 9,           // 无限制
      coinDropEnabled: true,    // 黄块掉落金币
      redLevelProgression: {
        0: 1,      // 0-1000分：1级红块
        1000: 2,   // 1000-3000分：2级红块
        3000: 3,   // 3000-8000分：3级红块
        8000: 4,   // 8000-20000分：4级红块
        20000: 5   // 20000+分：5级红块
      }
    }
  },
  
  // 皮肤定价（金币）
  SKIN_PRICES: {
    basic: 2000,
    advanced: 10000,
    epic: 50000
    // 神话级：不可购买，需观看20次广告
  }
};
