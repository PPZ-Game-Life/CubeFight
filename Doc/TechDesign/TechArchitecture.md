# CubeFight - 核心技术架构与实现 (Tech Design v2.0)

**作者**: Jeffy (主程序)  
**平台**: H5 WebGL (CrazyGames)  
**更新日期**: 2026-03-15 (完整重新实现)  
**状态**: 核心系统完成，UI系统待实现

---

## 1. 架构概览

### 1.1 核心系统架构

```
Game (主控制器)
├── GameStateManager (游戏状态管理)
│   ├── 积分系统 (Score + Combo)
│   ├── 金币系统 (Coin)
│   ├── 游戏模式 (Campaign / Endless)
│   └── 关卡管理
├── MergeSystem (合成系统)
│   ├── 蓝块+蓝块合成
│   └── 黄块+黄块合成
├── CombatSystem (吞噬系统)
│   ├── 蓝块吃红块
│   └── 蓝块吃黄块 (金币掉落)
├── RedBlockSpawner (红块生成)
│   ├── 动态补位模式
│   └── 难度递进逻辑
├── ItemSystem (道具系统)
│   ├── 6种道具管理
│   └── 道具效果执行
└── Grid3D (3D网格数据结构)
    └── 方块存储与查询
```

### 1.2 数据流

```
玩家点击方块
    ↓
InputManager 射线检测
    ↓
Game.handleCubeClick()
    ↓
canPerformAction() 检查规则
    ↓
MergeSystem / CombatSystem 执行操作
    ↓
GameStateManager 更新分数/金币/Combo
    ↓
RedBlockSpawner 生成新方块 (动态模式)
    ↓
checkGameOverCondition() 检查游戏结束
    ↓
updateScoreUI() 更新UI
```

---

## 2. 核心系统详解

### 2.1 GameStateManager (游戏状态管理)

**职责**:
- 管理单局游戏的所有数值状态
- 维护历史统计数据（用于排行榜）
- 管理Combo系统和超时逻辑

**关键方法**:
```typescript
addScore(baseScore: number): number          // 添加分数（自动应用Combo乘数）
addCoin(amount: number): void                // 添加金币
updateCombo(): void                          // 更新Combo计数
updateMaxMergedLevel(level: number): void    // 更新最高合成等级
getSessionStats(): object                    // 获取本局统计数据
```

**数值特性**:
- Combo超时: 3秒无操作则重置
- 分数乘数: Combo x1 ~ x∞
- 金币掉落: 仅在无尽模式且吃黄块时触发

### 2.2 MergeSystem (合成系统)

**规则** (按GameplayDesign.md):
- 蓝块+蓝块 → 蓝块+1级
- 黄块+黄块 → 黄块+1级
- 必须同等级、相邻、等级<9

**数值** (按EconomyAndNumbers.md):
| 等级 | 积分 | 金币(黄块) | 视觉特效 |
|------|------|-----------|--------|
| 1 | 10 | 1 | 基础 |
| 2 | 30 | 3 | 火花 |
| ... | ... | ... | ... |
| 9 | 25000 | 2500 | 神级 |

**关键方法**:
```typescript
canMerge(cube1: Cube, cube2: Cube): boolean
performMerge(sourceCube: Cube, targetCube: Cube): Promise<{newLevel, score, coin}>
```

### 2.3 CombatSystem (吞噬系统)

**规则**:
- 蓝块吃红块: 蓝等级 >= 红等级
- 蓝块吃黄块: 蓝等级 >= 黄等级
- 黄块吃红块: 不支持
- 黄块吃黄块: 使用MergeSystem

**金币掉落**:
- 闯关模式: 黄块吃掉不掉落金币
- 无尽模式: 黄块吃掉按等级掉落金币

**分数计算**:
- 吃红块: 基础分数 = LEVEL_VALUES[level].score
- 吃黄块: 基础分数 = LEVEL_VALUES[level].score × 2 (翻倍!)

### 2.4 RedBlockSpawner (红块生成)

**动态补位模式** (无尽模式):
- 每次操作后自动生成1个红块
- 红块等级根据当前分数递进

**难度递进** (按EconomyAndNumbers.md):
```
0分: 1级红块
1000分: 2级红块
3000分: 3级红块
8000分: 4级红块
20000分: 5级红块
```

**静态解谜模式** (闯关模式):
- 不自动生成红块
- 开局固定数量

### 2.5 ItemSystem (道具系统)

**6种道具**:
1. **精准打击 (BOMB)**: 摧毁任意方块
2. **空间降维 (DOWNGRADE_HAMMER)**: 方块等级-1
3. **色彩置换 (COLOR_SWAP)**: 红块→蓝/黄
4. **彩虹块 (RAINBOW_BLOCK)**: 任意合成
5. **大地震 (EARTHQUAKE)**: 重新洗牌
6. **轨道炮 (ORBITAL_CANNON)**: 十字星爆

**获取方式**:
- 吃掉高级黄块随机掉落
- 观看激励视频获取 (限次)

---

## 3. 游戏模式

### 3.1 闯关模式 (Campaign)

**特性**:
- 刷新模式: 静态解谜 (不自动生成)
- 红块上限: 5级
- 金币掉落: 禁用
- 通关奖励: 固定金币

**流程**:
1. 开局固定生成方块
2. 玩家通过合成/吞噬达成目标
3. 达成目标 → 通关 → 获得金币 → 解锁下一关

### 3.2 无尽模式 (Endless)

**特性**:
- 刷新模式: 动态补位 (自动生成)
- 红块上限: 9级
- 金币掉落: 启用
- 难度递进: 根据分数

**流程**:
1. 开局随机生成蓝块和黄块
2. 每次操作后自动补充红块
3. 红块等级随分数提升
4. 棋盘满且无可操作 → Game Over → 结算

---

## 4. 已实现的核心功能

### ✅ 完成

- [x] 3D网格数据结构 (Grid3D)
- [x] 方块实体类 (Cube) - 含升级/降级/变色动画
- [x] 游戏状态管理 (GameStateManager)
- [x] 合成系统 (MergeSystem)
- [x] 吞噬系统 (CombatSystem)
- [x] 红块生成系统 (RedBlockSpawner)
- [x] 道具系统 (ItemSystem)
- [x] 轨道控制器 (InputManager)
- [x] 剖面切割系统 (SliceSystem)
- [x] 智能高亮系统
- [x] Combo系统 (3秒超时)
- [x] 游戏结束检测

### ⏳ 待实现

- [ ] 完整UI系统 (分数/Combo/道具栏/模式选择)
- [ ] 关卡模式框架 (30关设计)
- [ ] 音效系统
- [ ] CrazyGames SDK对接 (广告/排行榜)
- [ ] 皮肤系统
- [ ] 性能优化 (GPU Instancing)
- [ ] 移动端适配

---

## 5. 关键设计决策

### 5.1 数值系统

**为什么合成收益 > 2倍?**
- 2合1的成本很高（需要找到同级方块）
- 收益必须 > 2倍才能激励玩家冒险合成
- 指数级膨胀保证高级方块的爽感

**为什么黄块吃掉分数翻倍?**
- 黄块是稀缺资源（需要合成）
- 翻倍分数激励玩家追求高级黄块
- 形成"贪心"博弈动机

### 5.2 游戏模式

**为什么分离闯关和无尽?**
- 闯关: 教学 + 目标感 + 前期变现
- 无尽: 挑战 + 排行榜 + 长线留存

**为什么无尽模式自动生成红块?**
- 保证游戏压力持续上升
- 防止玩家无限刷分
- 自然形成Game Over

### 5.3 Combo系统

**为什么3秒超时?**
- 足够快速玩家连续操作
- 足够长防止误触重置
- 心理学上的"流"状态时间

---

## 6. 性能指标

### 当前性能

- **DrawCall**: 27个Cube → 3个 (按颜色分组)
- **内存占用**: ~50MB (包含Three.js)
- **首屏加载**: <1秒
- **FPS**: 60 (移动端可能降至30)

### 优化方案

1. **GPU Instancing**: 同色同级方块合并为1个DrawCall
2. **对象池**: 复用Cube实例，减少GC压力
3. **LOD系统**: 远处方块降低细节
4. **资源压缩**: glTF/GLB + Draco压缩

---

## 7. 下一步计划

### Phase 2 (UI系统)
- [ ] HUD显示 (分数/金币/Combo)
- [ ] 道具栏UI
- [ ] 游戏结束面板
- [ ] 模式选择界面

### Phase 3 (关卡系统)
- [ ] 30关设计
- [ ] 关卡目标系统
- [ ] 难度曲线

### Phase 4 (平台对接)
- [ ] CrazyGames SDK
- [ ] 广告系统
- [ ] 排行榜上报

### Phase 5 (优化)
- [ ] 性能优化
- [ ] 移动端适配
- [ ] 音效系统

---

**最后更新**: 2026-03-15 14:00  
**重大进展**: 完整重新实现了核心游戏逻辑系统，所有关键系统已集成到Game.ts中。项目已可编译运行。
