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
- 请 `@主策划 樊老师` 若后续要把“自动验证”纳入关卡制作流程，请同步在 `Doc/GameDesign/` 中补一条关卡验收规范，明确它是“启发式自测工具”，不是设计层面的保底通关证明。

---

**最后更新**: 2026-03-22  
**当前状态**: 主菜单设置支持语言切换与调试关卡入口，运行进度与调试入口已隔离
