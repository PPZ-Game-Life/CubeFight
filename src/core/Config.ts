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
  LEVEL = 'level',     // 关卡模式
  ENDLESS = 'endless'  // 无尽模式
}

/**
 * 刷新模式
 */
export enum RefreshMode {
  STATIC = 'static',   // 静态解谜(不刷新)
  DYNAMIC = 'dynamic'  // 动态补位(持续刷新)
}

/**
 * 游戏配置
 */
export const CONFIG = {
  GRID_SIZE: 3,           // 3x3x3
  CUBE_SIZE: 1,           // 方块尺寸
  CUBE_GAP: 0.2,          // 方块间距
  MAX_LEVEL: 9,           // 最大等级
  
  COLORS: {
    [CubeColor.BLUE]: 0x3b82f6,
    [CubeColor.RED]: 0xef4444,
    [CubeColor.YELLOW]: 0xfbbf24
  },
  
  CAMERA: {
    FOV: 60,
    NEAR: 0.1,
    FAR: 1000,
    POSITION: { x: 5, y: 5, z: 5 }
  },
  
  // Combo系统
  COMBO_TIMEOUT: 3000,  // 3秒超时
  
  // 游戏模式配置
  GAME_MODES: {
    [GameMode.LEVEL]: {
      refreshMode: RefreshMode.STATIC,
      hasRedSpawn: false
    },
    [GameMode.ENDLESS]: {
      refreshMode: RefreshMode.DYNAMIC,
      hasRedSpawn: true
    }
  }
};

/**
 * 数值表: 1-9级的积分和金币收益(基于EconomyAndNumbers.md)
 */
export const LEVEL_VALUES = {
  // 积分收益(指数增长,用于排行榜)
  SCORE: [10, 30, 80, 200, 500, 1200, 3000, 8000, 25000],
  
  // 金币收益(仅吃黄块掉落,用于购买皮肤)
  COIN: [1, 3, 8, 20, 50, 120, 300, 800, 2500]
};
