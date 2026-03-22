# 关卡配置表结构定义 (LevelConfig Schema)

**适用范围**: 客户端读取关卡数据 / 策划配置关卡表
**格式**: JSON
**更新日期**: 2026-03-14

```json
{
  "levels": [
    {
      "id": 1,
      "name": "level_01_tutorial",
      "gridSize": 3,
      "spawnMode": "static",
      "objectives": [
        {
          "type": "merge",
          "targetLevel": 2,
          "targetColor": "blue"
        }
      ],
      "limits": null,
      "initialMap": [
        {"x": 1, "y": 1, "z": 1, "color": "blue", "level": 1},
        {"x": 1, "y": 1, "z": 2, "color": "blue", "level": 1}
      ],
      "dynamicParams": null,
      "reward": {
        "coins": 50
      }
    },
    {
      "id": 19,
      "name": "level_19_hard_puzzle",
      "gridSize": 3,
      "spawnMode": "static",
      "objectives": [
        {
          "type": "merge",
          "targetLevel": 7,
          "targetColor": "blue"
        }
      ],
      "limits": {
        "steps": 15
      },
      "initialMap": [
        {"x": 0, "y": 0, "z": 0, "color": "red", "level": 5},
        {"x": 1, "y": 1, "z": 1, "color": "blue", "level": 4}
        // ... 其他初始方块
      ],
      "dynamicParams": null,
      "reward": {
        "coins": 500
      }
    },
    {
      "id": 999,
      "name": "endless_mode",
      "gridSize": 4,
      "spawnMode": "dynamic",
      "objectives": [
        {
          "type": "score",
          "targetCount": -1 
        }
      ],
      "limits": null,
      "initialMap": [
        {"x": 1, "y": 1, "z": 1, "color": "blue", "level": 2},
        {"x": 2, "y": 2, "z": 2, "color": "yellow", "level": 1}
      ],
      "dynamicParams": {
        "spawnIntervalSteps": 1,
        "redWeight": 70,
        "yellowWeight": 30
      },
      "reward": {
        "coins": 0 
      }
    }
  ]
}
```

## 字段说明 (Field Definitions)

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | int | 关卡唯一ID，1-30 为关卡模式，999 为无尽模式。 |
| `name` | string | 关卡内部名称（用于埋点或多语言Key）。 |
| `gridSize` | int | 棋盘尺寸，目前支持 3 (3x3x3)、4 (4x4x4) 或 5 (5x5x5)。决定了相机的初始距离。 |
| `spawnMode` | enum | `static` (静态解谜，不刷怪) 或 `dynamic` (动态补位，操作后刷怪)。 |
| `objectives` | array | 过关条件数组，必须全部满足才算过关。 |
| └ `type` | enum | `merge` (合成指定等级)、`devour` (吃掉指定颜色/等级数量)、`score` (达到指定积分)、`clear_all_red` (清空全场红块)。 |
| └ `targetLevel` | int | 目标等级 (条件依赖)。 |
| └ `targetCount` | int | 目标数量 (条件依赖，如无尽模式的 score 为 -1 表示无限)。 |
| `limits` | object | 关卡限制条件 (可选)，用于增加解谜难度。 |
| └ `steps` | int | 最大允许操作步数。 |
| └ `time` | int | 最大允许时间 (秒)，用于闪电战。 |
| `initialMap` | array | 关卡初始方块的摆放数据。 |
| └ `x, y, z` | int | 逻辑坐标 (基于 gridSize，如 3x3x3 则范围是 0~2)。 |
| └ `color` | enum | `blue` (玩家), `red` (怪物), `yellow` (财宝)。 |
| └ `level` | int | 方块初始等级 (1-9)。 |
| `dynamicParams` | object | 仅在 `spawnMode` 为 `dynamic` 时生效的刷怪规则。 |
| └ `spawnIntervalSteps`| int | 玩家每进行几次有效合并/吞噬，触发一次全局空位刷怪。 |
| └ `red/yellowWeight` | int | 空位刷出红块或黄块的权重比例。 |
| `reward` | object | 首次通关的固定奖励。无尽模式局外结算单独计算。 |
