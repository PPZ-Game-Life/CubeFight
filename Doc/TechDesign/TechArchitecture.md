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

### 9.6 试玩版可交付行为基线（2026-03-21 定版）

#### 9.6.1 Run State 定义

| runState | 进入条件 | UI/交互表现 | 退出条件 |
| --- | --- | --- | --- |
| `idle` | 开局、取消选择、恢复后无待恢复动作 | 无遮罩；提示选择蓝块；允许切片/旋转/选块/炸弹 | 选择蓝块、进入炸弹瞄准、达成胜负 |
| `selected` | 成功选择一个当前可见的蓝块 | 高亮当前可用目标；提示二次点击结果落点；允许改选或直接执行目标动作 | 取消选择、提交有效动作、切片导致选中块不可见、暂停 |
| `targeting_bomb` | 点击炸弹按钮且库存 > 0 | 提示选择当前可见的红/黄块；不保留蓝块选择 | 成功炸掉目标、取消炸弹模式、暂停 |
| `resolving` | 执行蓝蓝合成后进入短暂结算 | 禁止暂停/炸弹/选块；显示 `Resolving move...` / `正在结算行动...` | 合成动画完成后重新评估胜负与交互流 |
| `paused` | 非结算/非胜负态时点击 Pause | 出现暂停遮罩；棋盘点击、HUD 按钮、切片控件全部禁用 | Resume 或 Restart |
| `victory` | 棋盘上已无红块 | 出现胜利遮罩；保持终局棋盘；只允许 Restart | Restart |
| `game_over` | 仍有红块，且已无合法蓝块行动，并且炸弹数为 0 | 出现失败遮罩；保持终局棋盘；只允许 Restart | Restart |

#### 9.6.2 Authored Playable Demo Config Contract

试玩版配置统一通过 `PlayableDemoConfig` 描述，并在启动时走校验器。当前定版合同如下：

- `board.gridSize`: 当前试玩版固定为 `3`。
- `board.cubes`: 作者预摆的初始棋盘；每个 cube 必须拥有唯一 `id`，且 `x/y/z` 坐标为 `0..gridSize-1` 的整数；不允许重叠占格。
- `inventory.bombCount`: 开局炸弹库存；当前定版为 `1`。
- `combo.timeoutMs`: Combo 连续操作窗口；当前定版为 `3000ms`。
- `combo.multiplierTable`: 非空倍率表；当前定版为 `[1, 1.5, 2, 3]`，按 `comboCount` 向上封顶取值。
- `scoring.mergeBase`: 蓝蓝合成后的结果等级得分表；必须覆盖关卡中可实际产出的合成结果等级。
- `scoring.devourRedBase`: 蓝吃红得分表；必须覆盖作者摆放的红块等级。
- `scoring.devourYellowBase`: 蓝吃黄得分表；必须覆盖作者摆放的黄块等级；吃黄额外获得等同于被吃等级的金币。
- `winLoss.victory`: 当前只允许 `clear_all_red`。
- `winLoss.requireNoMovesForGameOver`: 当前定版为 `true`。
- `winLoss.requireNoBombsForGameOver`: 当前定版为 `true`。
- `ui.showCombo`: 控制 HUD 是否显示 Combo 面板；当前定版为 `true`。
- `ui.showPause`: 保留配置字段做兼容，但当前 HUD 改版默认忽略，不再渲染 Pause 按钮。
- `ui.sliceLayout`: 当前只允许 `current-implementation`，即顶部/右侧层切与底部列切的现有布局与映射规则。

#### 9.6.3 胜利 / 失败条件

- 胜利条件：任意一步操作（棋盘动作或成功炸弹）结算后，只要棋盘上已不存在红块，立即进入 `victory`。
- 失败条件：棋盘上仍存在红块，且所有蓝块都没有合法相邻目标，同时炸弹数已经为 `0`，立即进入 `game_over`。
- 只要还保有炸弹库存，即使当前没有合法蓝块移动，也不会判负；玩家仍可通过炸弹继续破局。
- 黄块不会直接决定胜负；它只影响得分、金币与可行动路径。

#### 9.6.4 炸弹行为边界

- 炸弹只能命中“当前切片中可见”的红块或黄块，不能隔着隐藏层选中目标。
- 炸弹不能作用于蓝块，也不会造成范围伤害、连锁伤害、位移或重力结算。
- 成功使用炸弹后仅移除被命中的单个目标格内容，并消耗 `1` 枚炸弹。
- 炸弹不会提供分数、金币或 Combo 进度；Combo 只由棋盘主动动作推进。
- 炸弹模式会清空当前蓝块选择，避免蓝块动作与道具目标发生混用。

#### 9.6.5 Pause / Resume 行为

- 局内主 HUD 自 `2026-03-21` 起移除显式 `Pause` 按钮，避免顶部信息层与核心棋盘争抢注意力；常规流程依赖失焦暂停或宿主级暂停入口。
- 底层 `paused` / `pause` 状态机暂不删除，保留给失焦、平台事件或后续独立暂停入口复用；但本轮 HUD 改版不再把它作为默认可见功能。
- 若后续恢复手动暂停入口，仍需沿用原有行为约束：仅允许在 `idle`、`selected`、`targeting_bomb` 触发；暂停时冻结 Combo 剩余时间；恢复时回到记录的可交互目标状态。
- HUD 不再负责 `pause` 弹层；局内 Overlay 当前只承接 `victory / game_over` 两类终局结算面板。

#### 9.6.6 手工验收预期（实现记录）

本轮实现完成后，桌面端 / 移动端、中文 / 英文均按以下预期验收：

- Desktop + `en`: HUD 顶部显示 `Score / Combo / Coins` 的轻量悬浮统计条，底部显示 `Hint / Bombs`；右侧为 Layer rail，底部中侧为 Column rail；终局只出现 `Victory / Game Over` Overlay。
- Desktop + `zh-CN`: HUD 结构与英文一致；顶部不再显示 `Pause`；积分/状态提示/炸弹/胜负弹层按钮全部为中文，不允许回退英文文案。
- Mobile + `en`: HUD 顶/底行允许换行；切片 rail 与炸弹坞站保持可点击；竖屏下可完成选块、切片、炸弹全流程。
- Mobile + `zh-CN`: 与英文版保持相同交互能力；中文文案在窄屏下不应溢出关键按钮或导致主要 HUD 信息不可读。
- Both locales: 切片切换后若合法目标被隐藏，状态提示应明确提示调整切片；炸弹模式只提示可见红/黄目标；合成结算时显示 resolving 文案；胜利/失败后只保留 Restart。

#### 9.6.7 实施收口备注

- 本次试玩版 HUD / 状态提示 / 切片控件 / 结算遮罩 的结构基线已更新为“顶部统计条 + 底部 Hint/Bomb + 右侧 Layer rail + 底部 Column rail”。
- 请 `@主策划 樊老师` 将本次去除局内 Pause 按钮、保留终局 Overlay、以及切片控件归属更新同步回写到 `Doc/GameDesign/`，确保设计文档与实现口径一致。

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

## 11. 主菜单设置扩展（2026-03-22）

### 11.1 设置面板职责收口
- **入口位置**：主菜单 `Settings` 按钮打开局外设置弹层，不额外切独立场景，避免菜单展示盘面重建与额外性能抖动。
- **当前承载项**：
  1. **语言切换**：`zh-CN / en` 双语即时切换；
  2. **调试模式开关**：开发/测试辅助入口；
  3. **调试关卡选择**：仅在调试模式开启后显示。

### 11.2 状态归属与持久化
- **LocaleProvider** 负责浏览器语言探测、本地缓存用户语言选择，并向 UI 树暴露 `locale / setLocale / dictionary`。
- **CampaignRoot** 负责菜单调试设置持久化（`debugMode`, `debugLevelId`）、正常闯关进度 `campaignLevelId`、以及实际开局关卡 `sessionLevelId` 的装配。

### 11.3 调试模式运行原则
- **调试模式不污染正常闯关进度**：
  - 正常进度走 `campaignLevelId`；
  - 调试启动走 `debugLevelId`；
  - 实际运行关卡统一落到 `sessionLevelId`。
- **关卡白名单**：调试下仅暴露当前 runtime 可直接运行的 3x3x3 authored levels，避免误选未来 4x4 内容触发运行时异常。
- **性能取舍**：调试关卡选择走现有设置弹层 + 原生 `select`，优先稳定、低维护成本，不为开发入口额外堆复杂 3D 时间轴 UI。

### 11.4 UI 数据流
```text
MainMenu(Settings Dialog)
  ├─ locale -> LocaleProvider.setLocale()
  ├─ debugMode -> CampaignRoot state + localStorage
  └─ debugLevelId -> CampaignRoot state + localStorage

CampaignRoot.onStart()
  └─ sessionLevelId = debugMode ? debugLevelId : campaignLevelId
```

### 11.5 联调备注
- 本次改动不触碰关卡数值、目标公式与生成规则。
- 若项目决定把“调试模式入口”作为正式对外可见功能，请 `@主策划 樊老师` 将主菜单设置说明与调试入口可见性策略同步补进 `Doc/GameDesign/`，避免设计稿和实际入口不一致。

### 11.6 关卡配置容错修正（2026-03-22）
- 线上排查发现 `config/json/levels.json` 中 `Level 02` 的 `gridSize` 被误写为 `2`，与 `LevelConfigSchema.md` 中“仅允许 `3 / 4`”的约束冲突，导致 `parseLevelCatalog()` 在启动阶段直接抛错。
- 本轮已将 `Level 02` 修正为 `3`；同时解析层与 schema 明确收口为允许 `3 / 4 / 5`，因为 10-30 关的 authored data 已经使用 `5x5x5`。
- 运行时仍不对非法尺寸做静默兜底；`2` 这类脏数据继续直接报错，避免错误配置被吞掉后进入更隐蔽的运行期问题。

### 11.7 多尺寸运行时支持（2026-03-22）
- **支持范围**：当前 React runtime 已打通 `3x3x3 / 4x4x4 / 5x5x5` 关卡的加载、渲染、切片和菜单开局。
- **状态层改造**：`GameStoreSnapshot` 新增 `gridSize`，切片映射不再依赖全局常量，而是按当前关卡尺寸动态计算。
- **切片控件改造**：`SliceControls` 的层/列按钮数量按 `gridSize` 动态生成；列切片的屏幕映射顺序也改成按尺寸生成升降序数组。
- **渲染层改造**：
  - `CubeMesh` / `GridRoot` / `TutorialMarkers` 的世界坐标换算改为按当前 `gridSize` 居中；
  - `CameraRig` 会按棋盘尺寸自动拉远镜头，避免 4x4x4、5x5x5 被裁切。
- **HUD 改造**：局面占用率改成 `cubes.length / gridSize^3`，高尺寸棋盘下危机氛围判断不再失真。
- **配置校验**：`PlayableDemoConfig` 校验现允许 `3 / 4 / 5`，并继续对越界坐标、重叠格、分值表缺口做严格拦截。
- **分值覆盖策略**：关卡运行时分值表统一补齐到 1-9 级，避免高密度棋盘里链式合成触发更高 merge result level 时被校验层拦住。
- 请 `@主策划 樊老师` 将 `LevelDesign.md` 中“阶段三仍写成 3x3x3 空间”的描述同步回写为真实的 4x4x4 / 5x5x5 扩盘节奏，避免策划文档继续和关卡表脱节。

### 11.8 调试局内自动验证按钮（2026-03-22）
- **入口位置**：仅在 `debugMode === true` 的单局 HUD 中显示 `Auto Clear` 按钮，不污染正式玩家 HUD。
- **行为定义**：按钮打开后，系统会周期性执行一轮启发式自动操作：
  1. 若已有选中块且当前可见目标存在，直接提交第一可行目标；
  2. 若当前切片挡住了目标，则优先重置切片；
  3. 若未选中，则复用菜单展示盘面的启发式选点逻辑，优先同色合成，其次蓝块吞噬。
- **用途定位**：这是**关卡可行性快检工具**，目标是帮助程序/策划快速判断 authored level 是否存在明显死局或路径中断，不承诺最优解，也不替代正式 solver。
- **安全边界**：自动验证在 `paused / resolving / targeting_bomb / overlay active` 时自动挂起，避免和结算态、暂停态抢状态机。
- **菜单展示盘面约束**：主菜单背景演示盘面固定使用 `3x3x3` 无尽模式起手盘面，不再从 authored campaign 关卡池里随机取样，确保首页视觉与正式无尽玩法保持一致。
- 请 `@主策划 樊老师` 若后续要把“自动验证”纳入关卡制作流程，请同步在 `Doc/GameDesign/` 中补一条关卡验收规范，明确它是“启发式自测工具”，不是设计层面的保底通关证明。

### 11.9 切片控件显示修正（2026-03-22）
- 回归排查发现 `LevelSessionShell` 曾把 `SliceControls` 的渲染条件错误写成 `currentLevelId >= 7`，导致 2-6 关局内分层/分列按钮整体消失。
- 当前已修正为：**仅第 1 关剧本教学隐藏切片控件，其余关卡全部显示**，与玩法文档中“剖面切割是通用系统”的定义保持一致。

### 11.10 竖屏终极空间 UI 布局法（2026-03-22）
- **切片控件飞升**：不再把 `Layer / Column` 大面板压在底部，而是改成贴近 3D 棋盘主体的精致胶囊条：
  - `Y` 层控件为右侧纵向 pill toolbar；
  - `XZ` 列控件为棋盘正下方横向 pill toolbar。
- **底部四角安全区**：HUD 底部只保留两类高频元素：
  - 左下角：`Lobby` 小号毛玻璃图标块；
  - 右下角：`Bomb / Debug` 操作卡片；
  - 左右底边基线强制对齐，确保中间 3D 空间完全释放。
- **实现策略**：本轮优先走纯 CSS 布局重构，不引入 runtime 的 3D 世界坐标跟随，降低实现复杂度与维护成本；视觉上已满足“贴模型边缘悬浮”的空间感。

### 11.11 棋盘整体缩放与竖屏默认适配（2026-03-22）
- **交互缩放**：`CameraRig` 已开启 `OrbitControls.enableZoom`，桌面端支持鼠标滚轮缩放，移动端支持双指捏合缩放。
- **默认适配策略**：根据 `gridSize + viewport aspectRatio` 动态计算默认镜头距离；竖屏越窄，默认镜头越后退，保证 3D 棋盘按比例缩进安全显示区。
- **缩放边界**：当前缩放范围限制为默认距离的约 `0.72x ~ 1.95x`，避免用户把镜头拉得过近导致裁切，也避免缩得过远影响操作读数。

### 11.12 第一关教学步进闪烁修正（2026-03-22）
- 问题根因：第 1 关完成教学步骤后，`onAdvanceTutorialStep()` 同时递增了 `tutorialStepIndex` 和 `runNonce`，导致 `GameStoreProvider` 与 `LevelSessionShell` 被双重重建，R3F `Canvas` 背景出现一次可见闪烁。
- 修复策略：教学步进只推进 `tutorialStepIndex`；`runNonce` 仅用于真正意义上的重开/重试。`storeKey` 额外拼入 `tutorialStepIndex`，保证教学盘面切换仍能正确刷新 store，但不再制造额外整局重挂。

### 11.13 核心玩法验证期：临时冻结道具系统（2026-03-22）
- 当前阶段先验证 `蓝合蓝 / 蓝吃红 / 蓝吃黄 / 黄合黄` 的核心闭环，道具系统整体降级到关闭态。
- 已执行收口：
  - 主菜单隐藏 `Skin Shop`；
  - 局内 HUD 隐藏炸弹/道具按钮；
  - 所有关卡 runtime 默认 `bombCount = 0`；
  - 第 1 关教学配置也不再注入临时炸弹库存。
- 本轮**不改黄块金币逻辑**，仅关闭“黄块产生道具”的链路与局内道具入口。
- 请 `@主策划 樊老师` 将 `Doc/GameDesign/GameplayDesign.md` 中现阶段关于“道具常驻右下角 / 黄块掉落道具”的描述同步标注为“后续阶段开放”，避免当前设计文档与试玩版本目标不一致。

### 11.14 第一关教学节奏重构（2026-03-22）
- **教学脚本重排**：第 1 关改成 7 步极简教学，目标是让玩家最快理解核心闭环：
  1. 展示单个蓝块，说明“这是你方势力”；
  2. 展示两个 1 级蓝块，教学蓝蓝合成；
  3. 展示两个黄块，说明“这是财宝，也可以合成”；
  4. 让玩家亲手合成两个黄块；
  5. 展示高等级蓝块 + 黄块，教学蓝吃黄；
  6. 展示红块，说明“这是敌人”；
  7. 展示高等级蓝块 + 红块，教学蓝吃红；
  完成后直接结束教学，不再额外插入“黄先合再吞、红黄连吃”等复合动作。
- **教学拆步**：仍保持 `说明步(info) -> 操作步(action)` 的节奏。玩家先读文字，再点 `继续` 进入真实操作。
- **结算后再步进**：操作步不再在动作触发瞬间切下一课，而是等待 `runState` 退出 `resolving`、选中态清空、分数结算完成后才推进教学步骤。
- **结算停顿补偿**：动作达成后额外保留约 `900ms` 观察窗口，再切到下一教学步或胜利结算，确保玩家能看清落点、升级结果和得分反馈。
- **教学态屏蔽底层结束弹层**：第 1 关教学阶段即便底层 store 因“当前教学盘面已无后续合法步”短暂计算出 `game_over`，HUD 也不再直接弹出失败/胜利面板，而是统一由教学步进流程接管展示，避免玩家误以为教程失败。
- **教学完成专用面板**：第 1 关最后一步完成后，不再复用通用 `Victory` 面板，而是弹出 `tutorial_complete` 专用面板，明确告诉玩家“你已完成教学”，主按钮直接引导进入第 2 关。
- **教学完成后三岔路**：`tutorial_complete` 面板现提供 3 个出口：`继续闯关 / 开始无尽模式 / 返回大厅`。其中无尽模式在完成教学后立即解锁。
- **少量方块展示居中**：第 1 关教学渲染时，会根据当前可见方块包围盒重新计算展示偏移，将 1-2 个教学方块居中放到视野核心，避免 sparse board 靠边导致注意力分散。
- **双语文案**：第一关教学说明已切到 `en / zh-CN` 双语，中文模式下使用完整中文提示与按钮文案。
- **界面收口**：右上角关卡说明/目标面板已从实际运行 UI 中移除，避免教学期信息竞争，只保留顶部教学提示条。
- 请 `@主策划 樊老师` 将第 1 关教学流程同步更新到 `Doc/GameDesign/`，特别说明新的 7 步脚本、“成功动作后保留约 900ms 观察窗口”，以及“教学步中不展示失败弹层”的节奏，避免策划稿与实机教学手感脱节。

### 11.15 分数达标后允许继续刷分（2026-03-22）
- **目标类型**：当前针对带 `score` objective 的关卡生效。
- **新流程**：当玩家首次达到目标分数时，局内弹出 `Target Reached / 目标已达成` 结算层，玩家可选：
  - 直接结算并进入下一关；
  - 继续留在本局刷更高分数。
- **按钮显示约束**：仅当局面仍存在至少一个合法的 `merge / devour` 行动时，才显示 `Continue Scoring`；不受当前切片可见性影响。如果达标瞬间已无任何合法行动，则直接按胜利收口，不提供无意义的继续按钮。
- **胜负锁定**：一旦分数目标已达成，系统会锁定本局的胜利资格。之后即使玩家继续操作直到无路可走，只要此前已经达标，最终也按 `Victory` 结算，而不是 `Game Over`。
- **风险隔离**：未达标前仍按原规则处理步数耗尽/无可行动作失败，不放宽失败条件。
- 请 `@主策划 樊老师` 将 `Doc/GameDesign/LevelDesign.md` 中分数关的结算规则同步更新为“达标即可收官，但可主动继续刷分”，否则设计文档仍会默认达标后立即结束。

### 11.16 金币前台冻结（2026-03-22）
- 当前试玩验证阶段暂不开放金币消费闭环，因此前台 UI 先移除金币展示，避免玩家看到无用途数值产生认知负担。
- 已执行收口：
  - HUD 顶部只保留 `Score` 主牌；
  - 关卡结算层不再展示 `Reward +X coins` 文案。
- 底层数据结构暂不删除，后续若重启皮肤商店/局外经济，可低成本恢复。
- 请 `@主策划 樊老师` 将 `Doc/GameDesign/` 中当前试玩版本描述同步标注为“金币系统前台暂时关闭”，避免设计稿继续把金币当作玩家即时目标。

### 11.17 主菜单模式分流与新手进度重置（2026-03-22）
- **主菜单入口切换**：玩家完成教学后，主菜单主入口不再是单个 `开始闯关`，而是拆成 `闯关模式` + `无尽模式` 两个独立入口。
- **无尽模式入口策略**：当前无尽模式默认使用 `3x3x3` 棋盘启动，便于与教学/早期关卡保持一致认知；菜单文案明确标注“排行榜记录无尽积分”。
- **无尽模式开局来源**：运行时不再直接复用旧 `999` 关的静态初始盘面，而是改用项目内置的可玩 `3x3x3` demo board 作为无尽模式起手，随后按无尽规则继续推进，避免开场即死局。
- **进度持久化**：前端通过本地存储记住 `campaignLevelId / tutorialCompleted / endlessUnlocked`，保证玩家回到大厅后仍保持解锁态。
- **调试重置**：设置面板在 `Debug Mode` 下新增“重置新手关进度”，可一键恢复到未完成教学状态，并重新锁定无尽模式，方便反复验证首日流程。
- 请 `@主策划 樊老师` 将 `Doc/GameDesign/` 中新手完成后的大厅结构同步更新为“双入口模式”，并明确无尽模式在当前试玩版本于“完成教学后”即解锁。

### 11.18 无尽模式回合制自动补位（2026-03-25）
- **规则来源**：本轮按 `Doc/GameDesign/LevelDesign.md` 第二部分，以及 `@主策划 樊老师` 新补充的无尽模式说明实现。
- **触发时机**：无尽模式下，每次成功的 `merge / devour` 动作结算后，若盘面存在空位，则进入约 `300ms` 的短暂 `resolving` 停顿，再执行一次自动补位；炸弹不触发补位。
- **生成位置**：从当前所有空位中随机选取一个格子生成新方块。
- **生成颜色权重**：基础读取 `levels.json -> id:999 -> dynamicParams` 的 `redWeight / yellowWeight`，`blueWeight` 由剩余权重自动补齐；同时会随分数上升逐步提高红块压力、压缩蓝块占比。
- **生成等级控制**：新方块等级 = `Random(1, max(1, highestBlueLevel - 1))`，保证不会刷出高于当前最高蓝块的压制级怪物。
- **终局判定**：无尽模式改用专属 `checkEndlessGameOver()`：仅当 `27 格填满 + 无合法 merge + 无合法 devour + bombCount === 0` 四条件同时成立时，才进入 `game_over`。
- **起手棋盘**：无尽模式入口使用项目内置的可玩 `3x3x3` demo board 作为初始局面，再叠加上述动态补位规则。
- 请 `@主策划 樊老师` 若后续要继续调无尽难度曲线，请把“分数提升后红权重增长速率”的目标区间补进 `Doc/GameDesign/`，当前程序侧已预留按分数递增的压力曲线。

### 11.19 右上角 FPS 运行诊断面板（2026-04-08）
- **显示策略**：局内 HUD 右上角固定追加轻量 `FPS` 面板；若同时存在关卡目标面板，则两者按纵向堆叠，避免互相覆盖。
- **采样策略**：前端通过 `requestAnimationFrame` 统计近 `500ms` 帧数并取整刷新，不走逐帧 React setState，避免为了显示监控值反向污染 HUD 性能。
- **告警颜色**：`FPS >= 55` 显示绿色、`30~54` 显示黄色、`< 30` 显示红色，方便测试和运营快速肉眼识别性能档位。
- **交互边界**：诊断面板仅展示运行信息，保持 `pointer-events: none`，不抢占棋盘或右上角目标卡的触控事件。

### 11.20 方块内核球体收口（2026-04-08）
- **渲染调整**：局内方块移除中心内核/球体几何渲染，当前只保留圆角外壳、Fresnel rim、数字面与地面选择环。
- **目的**：减少视觉噪声，避免内核球体在小尺寸棋盘和密集堆叠下抢走等级数字与阵营识别的注意力。
- **性能收益**：每个方块减少一层以上内部 mesh/材质更新，降低透明叠层与逐帧内核动画开销。

### 11.21 移动端帧率稳定性收口（2026-04-08）
- **移动端 DPR 限幅**：检测到粗指针设备时，`Canvas.dpr` 从桌面档 `1~1.75` 下调为 `1~1.25`，优先保住 GPU fill-rate。
- **后处理分级**：粗指针设备关闭 `SSAO`，仅保留弱化版 `Bloom`，避免接触阴影在中低端手机上吞掉稳定帧率。
- **逐帧分配治理**：`CubeMesh` 的朝向标签更新不再在 `useFrame` 中反复 `new Vector3/Quaternion/Matrix4`，统一复用 scratch 对象，减少 GC 抖动导致的掉帧尖峰。
- **移动端方块简化**：粗指针设备只保留单个朝向镜头的数字面，并将壳体从 `MeshPhysicalMaterial` 降级为更便宜的 `MeshStandardMaterial`，进一步压低透明折射与每帧面片朝向成本。

### 11.22 主菜单安全区适配（2026-04-08）
- **适配范围**：主菜单根容器与顶部品牌区接入 `env(safe-area-inset-top/bottom)`，兼容刘海屏、手势条和浏览器 UI 挤压场景。
- **目标**：避免主 Logo、顶部品牌块和底部按钮在移动端浏览器/WebView 中被系统安全区吞边。

### 11.23 闯关模式前台隐藏与新手后直入无尽（2026-04-08）
- **大厅入口收口**：正式玩家完成第 1 关教学后，主菜单不再展示 `闯关模式`，前台只保留 `无尽模式` 作为主入口，整体节奏聚焦长线刷分。
- **教学完成落点**：`tutorial_complete` 结算层主按钮改为直接启动 `无尽模式`，不再引导进入第 2 关。
- **调试模式例外**：仅在 `Debug Mode` 下保留“按指定 authored level 直接开局”的隐藏入口，按钮文案从 `Campaign Mode` 改成 `Debug Run / 调试关卡`，避免前台语义和正式版本入口混淆。

### 11.24 彻底移除闯关模式与调试入口（2026-04-08）
- **正式产品流**：试玩版当前正式收口为 `主菜单 -> 新手教学(第1关) -> 无尽模式`，不再保留 authored campaign 的前台入口。
- **设置面板收口**：主菜单设置只保留正式玩家配置；`Debug Mode / Debug Level / 重置新手关进度` 等调试项已全部移除。
- **局内调试收口**：HUD 中的 `Auto Clear` 自动验证按钮同步删除，不再暴露任何调试操作入口。
- **状态持久化收口**：前端进度存储仅保留 `tutorialCompleted / endlessUnlocked`，不再记录 `campaignLevelId / debugLevelId`。
- 请 `@主策划 樊老师` 尽快同步更新 `Doc/GameDesign/LevelDesign.md`、`CoreDesign.md`、`SystemDesign.md`、`EconomyAndNumbers.md`，删除所有“闯关模式 / 调试入口 / 教学后进入第二关”的描述，否则策划文档会继续和当前试玩版分叉。

### 11.25 纯无尽空间扩容与本地周榜落地（2026-04-08）
- **无尽开局尺寸**：正式无尽模式默认从 `3x3x3` 开局，不再把 `2x2x2` 作为前台正式入口。
- **解锁门槛**：前端基于历史最高分做尺寸成长解锁：`默认 3x3x3`、`20000 -> 4x4x4`、`100000 -> 5x5x5`。
- **无尽配置来源**：运行时不再把尺寸能力写死在 `levels.json`。程序侧新增 `buildPlayableEndlessConfig(gridSize)`，复用 `999` 无尽关的动态补位参数与计分表，只覆盖起手棋盘和目标条件。
- **起手棋盘策略**：针对 `2~5` 维度内置满盘 starter board，开局即填满当前维度全部格子，不允许出现“初始缺块”。盘面内部仍强制保留至少一组合法合成/吞噬机会，保证玩家首回合可操作。
- **排行榜落地**：增加本地周榜 fallback。每次无尽结算会记录本局最高分与本局最高合成等级，按周维度重置并在大厅弹窗展示；当前用于 Web/本地调试环境，后续 CrazyGames 实榜接入时可直接替换提交层。
- **进度持久化扩展**：本地存档新增 `bestScore / preferredGridSize / playerId / weeklyBestScore / leaderboardWeekKey`；当前 `preferredGridSize` 已退化为兼容旧存档字段，正式前台实际开局尺寸统一由历史最高分自动推导。

### 11.26 首页收口为直接开局页（2026-04-08）
- **信息架构调整**：首页不再承担“模式/战场选择页”职责，而是收口为“直接开局页”。前台只保留一个主 CTA：`开始游戏`。
- **战场尺寸展示**：前台只展示正式无尽成长链 `3x3x3 -> 4x4x4 -> 5x5x5`；`2x2x2` 不再进入首页展示与开局逻辑。首页仅展示“当前战场”与“下一阶段解锁条件”。实际开局尺寸由历史最高分自动推导。
- **次级入口降权**：`排行榜 / 设置 / 玩法说明` 继续保留，但统一降为次级入口，视觉权重低于主 CTA，避免首屏分散玩家注意力。
- **背景 3D 约束**：首页背景盘面固定展示 `3x3x3` 无尽模式演示局，不随当前已解锁战场变化；同时上层暗遮罩增强，弱化 3D 表现，保证首屏按钮层级优先。
- 请 `@主策划 樊老师` 同步更新 `Doc/GameDesign/SystemDesign.md`、`CoreDesign.md` 中“主界面自由选择已解锁战场规模开局”的描述；当前正式前台已改为“战场尺寸隐性成长，首页只负责直接开局”。

### 11.27 正式无尽默认 3x3x3 开局（2026-04-08）
- **产品结论**：`2x2x2` 仅保留为内部兼容/实验配置，不再作为正式无尽主流程的一部分。首页点击 `开始游戏` 后，教学完成用户直接进入 `3x3x3` 无尽。
- **排行榜一致性**：大厅、结算、周榜文案与成长提示同步按 `3x3x3 / 4x4x4 / 5x5x5` 三段式表达，移除 `2x2x2` 对玩家的公开展示，避免误导“正式无尽从 2x2 开始”。
- **实现约束**：当前 arena 推导逻辑以 `bestScore` 为准，最低正式尺寸钳制为 `3x3x3`；后续若重启 `2x2x2`，必须先补产品定位，不允许再直接混回首页主路径。
- 请 `@主策划 樊老师` 同步更新 `Doc/GameDesign/SystemDesign.md`、`CoreDesign.md`、`GameplayDesign.md`、`EconomyAndNumbers.md`，把“正式无尽默认 2x2x2 开局 / 2x2x2 属于战场成长首段”的描述全部改掉，否则策划文档会继续和当前实现分叉。

### 11.28 非发布版调试模式入口回收（2026-04-08）
- **可见性约束**：设置面板恢复 `Debug Mode` 开关，但仅在非发布版本可见；正式发布版继续隐藏，避免调试能力泄露到前台玩家。
- **调试能力范围**：勾选后会同时启用局内 `FPS` 面板，并开放 `3x3x3 / 4x4x4 / 5x5x5` 棋盘尺寸选择，用于性能与遮挡验证。
- **教学重置**：调试模式下额外提供“重置新手关进度”，可把 `tutorialCompleted / endlessUnlocked` 回退到未完成教学状态，方便反复验证首日引导链路。
- **正式逻辑隔离**：调试尺寸选择不改变正式成长链，不改排行榜规则，不改玩家公开首页文案；仅影响当前本地调试开局尺寸与 HUD 诊断显示。
- **状态持久化**：调试开关与调试棋盘尺寸单独写入本地存储 `cubefight.debug-options`，与正式进度存档隔离。

### 11.29 局内 SSAO 下线以消除动作黑闪（2026-04-08）
- **问题根因**：合并/吞噬瞬间，透明玻璃壳体方块在重叠、缩放、移位时会导致 SSAO 的屏幕空间遮蔽骤增，视觉上表现为整屏暗部瞬时压黑，像“背景闪黑”。
- **处理方案**：局内后处理暂时移除 `SSAO`，仅保留弱化 `Bloom`。当前材质体系以 `transmission + transparent` 为主，SSAO 收益低于副作用，先以稳定性优先。
- **后续约束**：若未来要恢复 AO，需先改为更保守参数，或改成只对不透明代理几何生效，不能直接把高强度 SSAO 重新接回当前透明材质链路。

### 11.30 无尽算法管线接入（2026-04-09）
- **统一管线**：无尽补位已从“单次随机颜色 + 线性等级”升级为统一 `endlessSpawnPipeline` 思路：`阶段判定 -> 保底修正 -> 颜色抽取 -> 等级抽取 -> 刷点加权`。
- **三套节奏参数**：程序侧按 `3x3x3 / 4x4x4 / 5x5x5` 内置三套 tuning，覆盖阶段阈值、颜色权重、等级带、金黄概率与蓝块保底数量。
- **阶段提升规则**：按 `score` 与 `highestBlueLevel` 共同抬阶段；任一维度命中更高阶段即整体升压。
- **保底规则**：
  - 蓝块数量低于尺寸下限时，提升蓝块权重，避免垃圾盘化；
  - 连续 5 次补位未出现黄系时，下次补位强制进入黄/金黄家族；
  - 最近 6 次有效得分若由同一蓝块主导，则提高其周边红块压力，并把黄系目标往远端/副运营区推。
- **刷点逻辑**：补位不再纯随机落空位；蓝块偏向新支点，红块偏向关键通路与主操作区，黄/金黄偏向“看得见但不顺手”的远端位。
- **金黄落地方式**：当前 runtime 为 `CubeData.variant = 'golden'` 的黄色稀有变体。它继承黄色合成/吞噬规则，并使用独立视觉表现；由于首发前台道具系统仍冻结，当前只先承担“高价值黄系目标”职责，不额外掉落局内道具。
- 请 `@主策划 樊老师` 同步更新 `Doc/GameDesign/SystemDesign.md`、`CoreDesign.md` 中仍然写着“正式无尽从固定简单随机补位起盘”或“金黄色必掉道具”的表述。当前实现已接入阶段化生成，但金黄掉落道具链路仍处于冻结态，策划稿需要明确这一点，避免联调误判。

### 11.31 Debug Mode 无尽算法诊断面板（2026-04-09）
- **显示条件**：仅在 `Debug Mode` 开启且当前处于无尽单局时显示，不进入正式玩家 HUD。
- **实时字段**：当前面板固定展示 `当前阶段(stage)`、`主导蓝块 ID`、`主导状态(active / observe / none)`、`黄系保底计数`，用于联调 EndlessAlgorithm 的阶段切换与反制逻辑。
- **数据来源**：`gameStore` 快照新增 `endlessDiagnostics`，由无尽生成管线实时导出；HUD 只读消费，不在 UI 层重复推导，避免诊断口径和实际补位逻辑分叉。

---

**最后更新**: 2026-03-22  
**当前状态**: 主菜单设置支持语言切换与调试关卡入口，运行进度与调试入口已隔离
