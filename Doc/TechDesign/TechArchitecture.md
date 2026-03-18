# CubeFight - 核心技术架构与选型规划 (Tech Design)

**作者**: Jeffy (主程序)  
**平台**: H5 WebGL (首发: CrazyGames)  
**更新日期**: 2026-03-15 (重大重构)

---

## 1. 3D 引擎选型：React Three Fiber + Three.js (迁移中最终方案)

**迁移原因:**
1. **表现层组件化**: 3D节点、HUD、切面UI、本地化统一进入 React 组件树
2. **美术扩展性更强**: 更适合后续皮肤、后处理、材质效果、Composer Suite 管线扩展
3. **状态流更清晰**: 玩法 state 与渲染层解耦，避免 Three.js imperative 逻辑继续膨胀
4. **移动端适配更自然**: 竖屏 UI 与触摸交互可直接走 React 响应式布局
5. **生态成熟**: R3F + Drei + postprocessing 已是 H5 3D 表现层主流组合

**技术栈:**
```
- React 18
- React Three Fiber
- Drei
- Composer Suite / postprocessing
- Three.js r160+
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
  private polarAngle: number = Math.PI / 2; // 俯仰角(Pitch)
  
  // 当前试玩版按体验微调为 -25°到+25°
  private readonly MIN_POLAR_ANGLE = THREE.MathUtils.degToRad(65);
  private readonly MAX_POLAR_ANGLE = THREE.MathUtils.degToRad(115);
  
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

### 4.2 方块多面等级数字
```typescript
class Cube {
  private levelCanvas = document.createElement('canvas');
  private levelTexture = new THREE.CanvasTexture(this.levelCanvas);
  private levelSprites = [front, back, left, right, top, bottom];

  private refreshLevelLabel() {
    // Canvas绘制白色描边数字，并复用到六个面的Sprite材质
  }

  updateLevelLabelVisibility(camera) {
    // 用面法线 dot 相机方向，只有朝向玩家的面才显示
    // Sprite始终面向相机，保证玩家读到的是正字
  }
}
```
- **根因修复**: 不再依赖固定Plane朝向+背面剔除，而是改为“六面锚点 + 相机朝向Sprite”。这样相机绕Y轴旋转后，可见面会重新计算，数字也会始终正向朝向玩家。

### 4.3 切面UI与视角相关列选择
- **层(Y)**: 右侧纵向按钮 `0 / 1 / 2 / ALL`，但语义是“从上到下”；`0` 永远代表最上层。
- **列(X)**: 底部横向按钮 `0 / 1 / 2 / ALL`，但按钮语义是“当前屏幕从左到右的列”。
- **重映射时机**: 相机绕Y轴旋转后，现有列切面不会自动跳变；玩家再次点击列按钮时，系统才按当前朝向重新解释 `0/1/2`。
- **实现原则**: 用相机当前 `azimuthAngle` 判断朝向象限，再把屏幕列索引映射到世界 `x/z` 切面。

### 4.4 操作落点规则统一
- **第一下点击**: 选择主动执行动作的方块。
- **第二下点击**: 决定结果落点格子。
- **吞噬**: 主动方块移动到第二下点击的目标格子。
- **合成**: 无论蓝蓝还是黄黄，主动方块都移动到第二下点击的目标格子，然后在该位置升级。
- **设计收益**: 玩家只需要记住一个规则——“后点谁，结果落谁那里”。

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

### 7.3 Web部署与 Vercel 规范
- **部署平台**: Vercel（用于Web预览、联调与外部演示）
- **模块制式**: 项目 `package.json` 使用 `"type": "module"`，避免 Vite CJS Node API 弃用警告。
- **构建命令**: `npm run build`
- **输出目录**: `dist`
- **Node版本**: `>=18`
- **SPA 路由兜底**: 通过 `vercel.json` 将所有路径重写到 `index.html`，避免刷新深链接时返回 404。

> 注意：Vercel 仅作为常规Web部署环境。CrazyGames 平台相关能力（广告、排行榜、平台事件）仍需在 CrazyGames 实际环境单独验收。

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

### 9.4 UI本地化强制规范
**决策**: 所有UI文案必须支持本地化, 当前至少支持 `zh-CN` 与 `en` 两种语言。  
**原因**: CrazyGames 面向全球发行, UI硬编码中文会直接阻断英文玩家理解与转化。  
**实现要求**:
- 禁止在业务逻辑和UI组件中硬编码最终显示文案。
- 所有按钮、标题、提示、结算文案、道具名、模式名统一走 i18n 字典读取。
- 默认语言跟随浏览器语言, 不命中时回退到英文。
- 中文与英文都必须参与验收, 不能只做中文皮肤再临时翻译。

### 9.5 手机端与竖屏适配强制规范
**决策**: 所有新功能实现必须默认支持移动端触控, 并优先保证竖屏体验可用。  
**原因**: H5小游戏核心流量大量来自移动端, 竖屏是更高频的单手操作场景。  
**实现要求**:
- 输入系统必须同时支持鼠标与触摸, 不允许只针对PC交互设计。
- UI布局需要优先验证竖屏安全区, 核心按钮不可被遮挡或超出拇指热区。
- 切面按钮、确认按钮、道具按钮等交互元素需满足触屏点击尺寸要求。
- 相机控制、点击选块、切面操作都必须在手机竖屏下可稳定完成。
- 后续新增HUD或弹窗时, 先验证 `9:16` 竖屏, 再补横屏兼容。

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
