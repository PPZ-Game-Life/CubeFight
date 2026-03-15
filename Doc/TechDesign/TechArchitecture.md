# CubeFight - 核心技术架构与选型规划 (Tech Design)

**作者**: Jeffy (主程序)  
**平台**: H5 WebGL (首发: CrazyGames)  
**更新日期**: 2026-03-15 (重大重构)

---

## 1. 3D 引擎选型：Three.js (最终方案)

**核心优势:**
1. **极速上手**: 纯代码驱动,无需云端Editor,1小时可跑通Demo
2. **包体极小**: 核心库仅 80KB (gzip),首屏加载 <1秒
3. **调试友好**: 纯JS代码,Chrome DevTools直接断点调试,无黑盒
4. **生态成熟**: CrazyGames平台大量Three.js游戏案例,兼容性有保障
5. **性能充足**: 对于3x3x3 (27个Cube) 的场景,轻松跑满60FPS

**技术栈:**
```
- Three.js r160+ (3D渲染)
- Vite 5.x (构建工具,HMR秒级热更新)
- TypeScript (类型安全)
- GSAP (动画库,用于合成/消失特效)
```

---

## 2. 项目架构设计 (ECS变体 + MVC)

```
src/
├── core/
│   ├── Game.ts              # 游戏主控制器
│   ├── SceneManager.ts      # Three.js场景管理
│   ├── InputManager.ts      # 输入事件统一处理
│   ├── Config.ts            # 全局配置
│   └── GameState.ts         # 游戏状态管理
├── entities/
│   ├── Cube.ts              # 方块实体类
│   ├── CubePool.ts          # 对象池
│   └── Grid3D.ts            # 3x3x3阵列数据结构
├── systems/
│   ├── GameLogicSystem.ts   # 游戏逻辑系统(合成/吞噬)
│   ├── SpawnSystem.ts       # 方块生成系统
│   ├── ComboSystem.ts       # 连击系统
│   ├── SliceSystem.ts       # 剖面切割
│   └── ScoreSystem.ts       # 积分/金币系统
├── managers/
│   ├── LevelManager.ts      # 关卡管理
│   ├── ItemManager.ts       # 道具管理
│   └── AudioManager.ts      # 音效管理
├── ui/
│   ├── UIManager.ts         # UI控制器
│   ├── HUD.ts               # 分数/Combo/道具显示
│   └── MenuSystem.ts        # 菜单系统
├── sdk/
│   └── CrazyGamesSDK.ts     # 广告/排行榜封装
└── main.ts                  # 入口
```

---

## 3. 核心数值系统实现

### 3.1 双轨经济模型
```typescript
// 积分(Score): 纯荣誉数值,用于排行榜
// 金币(Coin): 购买力货币,用于购买皮肤

interface EconomyConfig {
  // 1-9级积分收益(指数增长)
  SCORE_TABLE: [10, 30, 80, 200, 500, 1200, 3000, 8000, 25000];
  
  // 1-9级金币收益(仅吃黄块掉落)
  COIN_TABLE: [1, 3, 8, 20, 50, 120, 300, 800, 2500];
  
  // Combo乘数
  COMBO_MULTIPLIER: (combo: number) => Math.max(1, combo);
}
```

### 3.2 方块生成逻辑
```typescript
class SpawnSystem {
  // 红块生成等级 = [1, Max(1, 场上最高蓝块等级 - 1)]
  getRedSpawnLevel(): number {
    const maxBlueLevel = this.getMaxBlueLevelOnGrid();
    const minLevel = 1;
    const maxLevel = Math.max(1, maxBlueLevel - 1);
    return Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
  }
  
  // 黄块生成等级 = [1, 3] (前期) / [1, 5] (中期)
  getYellowSpawnLevel(gameProgress: number): number {
    const maxLevel = gameProgress < 0.5 ? 3 : 5;
    return Math.floor(Math.random() * maxLevel) + 1;
  }
}
```

---

## 4. 核心交互实现

### 4.1 轨道控制器(符合GameplayDesign.md规范)
```typescript
class InputManager {
  private azimuthAngle: number = 0;        // 水平环绕(Yaw)
  private polarAngle: number = Math.PI / 4; // 俯仰角(Pitch)
  
  // 严格限制俯仰角 -15°到+15°(接近平视)
  private readonly MIN_POLAR_ANGLE = THREE.MathUtils.degToRad(60); // 75度(俯视15度)
  private readonly MAX_POLAR_ANGLE = THREE.MathUtils.degToRad(105); // 105度(仰视15度)
  
  // 阻尼惯性
  private velocity = { azimuth: 0, polar: 0 };
  private readonly DAMPING = 0.9;
  
  updateCameraPosition() {
    // 球坐标转笛卡尔坐标
    const x = distance * Math.sin(polarAngle) * Math.sin(azimuthAngle);
    const y = distance * Math.cos(polarAngle);
    const z = distance * Math.sin(polarAngle) * Math.cos(azimuthAngle);
    
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0); // 地平线锁定
  }
}
```

### 4.2 智能高亮系统
```typescript
// 选中蓝块后,自动高亮可操作目标
highlightValidTargets(sourceCube: Cube) {
  const neighbors = grid.getNeighbors(x, y, z);
  
  neighbors.forEach(neighbor => {
    if (canPerformAction(sourceCube, neighbor.cube)) {
      neighbor.cube.setHighlight(true);  // 绿色边框
    } else {
      neighbor.cube.setDimmed(true);     // 透明度0.3
    }
  });
}
```

### 4.3 Combo系统
```typescript
class ComboSystem {
  private comboCount: number = 0;
  private lastActionTime: number = 0;
  private readonly COMBO_TIMEOUT = 3000; // 3秒超时
  
  updateCombo(): number {
    const now = Date.now();
    if (now - this.lastActionTime > this.COMBO_TIMEOUT) {
      this.comboCount = 0; // 超时重置
    }
    this.comboCount++;
    this.lastActionTime = now;
    return this.comboCount;
  }
  
  getMultiplier(): number {
    return Math.max(1, this.comboCount);
  }
}
```

---

## 5. 游戏模式实现

### 5.1 关卡模式
```typescript
interface LevelConfig {
  id: number;
  name: string;
  gridSize: 3 | 4 | 5;
  initialCubes: CubeSpawnData[];
  spawnMode: 'static' | 'dynamic';
  objective: {
    type: 'merge' | 'devour' | 'score';
    target: number;
  };
  reward: {
    coins: number;
  };
}

// 示例: 第1关(纯教学)
const LEVEL_1: LevelConfig = {
  id: 1,
  name: "初识合成",
  gridSize: 3,
  initialCubes: [
    { color: 'blue', level: 1, x: 0, y: 0, z: 0 },
    { color: 'blue', level: 1, x: 1, y: 0, z: 0 },
    { color: 'yellow', level: 1, x: 2, y: 0, z: 0 }
  ],
  spawnMode: 'static',
  objective: { type: 'merge', target: 2 }, // 合成一个2级蓝块
  reward: { coins: 50 }
};
```

### 5.2 无尽模式
```typescript
class EndlessMode {
  private score: number = 0;
  private spawnInterval: number = 1000; // 初始1秒刷新一次
  
  update(deltaTime: number) {
    // 动态难度: 分数越高,刷新越快
    this.spawnInterval = Math.max(300, 1000 - this.score / 100);
    
    // 每次操作后在空位生成红块
    if (this.shouldSpawn()) {
      const emptyPos = this.grid.getRandomEmptyPosition();
      if (emptyPos) {
        const level = this.getRedSpawnLevel();
        this.spawnRedCube(emptyPos, level);
      }
    }
    
    // 检查Game Over
    if (this.grid.isFull() && !this.hasValidMoves()) {
      this.gameOver();
    }
  }
}
```

---

## 6. 道具系统实现

```typescript
enum ItemType {
  BOMB = 'bomb',           // 精准打击
  HAMMER = 'hammer',       // 降级锤
  PAINT = 'paint',         // 色彩置换
  RAINBOW = 'rainbow',     // 万能块
  SHUFFLE = 'shuffle',     // 重力洗牌
  LASER = 'laser'          // 十字星爆
}

class ItemManager {
  private inventory: Map<ItemType, number> = new Map();
  
  useItem(type: ItemType, target: Cube) {
    switch(type) {
      case ItemType.BOMB:
        this.destroyCube(target);
        break;
      case ItemType.HAMMER:
        target.level = Math.max(1, target.level - 1);
        break;
      case ItemType.PAINT:
        target.color = CubeColor.BLUE;
        break;
      // ... 其他道具
    }
    
    this.inventory.set(type, this.inventory.get(type)! - 1);
  }
}
```

---

## 7. CrazyGames SDK 接入

### 7.1 激励视频封装
```typescript
class AdsManager {
  async showRewardedAd(type: 'revive' | 'item' | 'double'): Promise<boolean> {
    game.pause();
    
    try {
      await window.CrazyGames.SDK.ad.requestAd('rewarded');
      return true; // 用户看完广告
    } catch (error) {
      console.error('Ad failed:', error);
      return false;
    } finally {
      game.resume();
    }
  }
  
  // 插屏广告(每3-5关)
  async showInterstitial() {
    await window.CrazyGames.SDK.ad.requestAd('midgame');
  }
}
```

### 7.2 排行榜上报
```typescript
class LeaderboardManager {
  submitEndlessScore(score: number, maxLevel: number) {
    // 提交到"无尽之王"周榜
    window.CrazyGames.SDK.game.showInviteButton();
  }
  
  submitTotalCoins(totalCoins: number) {
    // 提交到"方块大亨"永久榜
  }
}
```

---

## 8. 性能优化策略

### 8.1 对象池
```typescript
class CubePool {
  private pool: Cube[] = [];
  
  acquire(color: CubeColor, level: number): Cube {
    const cube = this.pool.pop() || new Cube();
    cube.reset(color, level);
    return cube;
  }
  
  release(cube: Cube) {
    cube.mesh.visible = false;
    this.pool.push(cube);
  }
}
```

### 8.2 GPU Instancing(后期优化)
对于同色同级方块,使用 `THREE.InstancedMesh` 批量渲染,将DrawCall从27降至3。

---

## 9. 关键设计决策记录

### 9.1 无重力系统
**决策**: 方块消失后不会掉落填补  
**原因**: 强调空间预判与策略性,避免变成传统消除游戏  
**影响**: 需要设计动态刷新机制防止空位过多

### 9.2 Combo超时时间: 3秒
**决策**: 3秒内连续操作才能维持Combo  
**原因**: 平衡策略思考与快速操作,3秒是经过测试的最佳值  
**数据来源**: 参考《GameplayDesign.md》第52行

### 9.3 红块生成等级上限
**决策**: 红块等级 ≤ 场上最高蓝块等级 - 1  
**原因**: 保证玩家永远有翻盘机会,不会被超级红块直接卡死  
**数据来源**: 参考《LevelDesign.md》第34行

---

## 10. 待实现功能清单

**Day 2 (03-15 今天):**
- [x] 更新技术架构文档
- [ ] 实现双轨经济系统(积分+金币)
- [ ] 实现方块生成系统(红块/黄块动态刷新)
- [ ] 实现黄块合成逻辑
- [ ] 实现道具系统框架
- [ ] 实现关卡模式框架
- [ ] 实现无尽模式框架
- [ ] 完善UI系统(HUD/菜单)

**Day 3 (03-16 周一 - Feature Freeze):**
- [ ] CrazyGames SDK完整对接
- [ ] 音效系统接入
- [ ] 性能优化(对象池/GPU Instancing)
- [ ] 移动端适配测试
- [ ] 30个关卡配置
- [ ] 皮肤系统基础框架

---

**最后更新**: 2026-03-15 10:00  
**当前状态**: 重构中,基于设计文档重新实现完整游戏逻辑
