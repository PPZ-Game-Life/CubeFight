# CubeFight - 轻休闲 8-Bit 音频生成与落地方案

**作者**: Jeffy (主程序)  
**更新日期**: 2026-05-03

---

## 1. 目标

- 对齐 `Doc/MusicDesign/AudioSpec_8Bit.md` 的轻休闲 Chiptune 风格，先落一套**可直接试听的程序合成原型**。
- 在没有外部 DAW/转码器的开发环境下，先生成低保真 `wav`，后续由音频同学统一转成 `mp3/m4a` 发包。
- SFX 直接按 Audio Sprite 规范输出单文件 + JSON，减少 H5 并发请求与首播延迟。

## 2. 当前产物

- `public/audio/generated/main_menu_bgm.wav`
- `public/audio/generated/ingame_bgm_base.wav`
- `public/audio/generated/ingame_bgm_melody.wav`
- `public/audio/generated/sfx_sprite.wav`
- `public/audio/generated/sfx_sprite.json`

## 3. 技术取舍

- **生成方式**: Node 脚本直接合成 `pulse / square / triangle / saw / noise`。
- **采样策略**:
  - BGM: `16kHz`, `8-bit`, `mono`
  - SFX Sprite: `11.025kHz`, `8-bit`, `mono`
- **原因**:
  - 8-Bit 音色天然容忍低采样率；
  - 先把包体压住，避免原型阶段音频资产直接爆 2MB 目标；
  - 当前容器无 `ffmpeg`，不适合在仓库里强绑额外音频编码链路。

## 4. 结构约定

- `main_menu_bgm.wav`: 16 小节循环，主菜单使用更明亮、松弛的旋律钩子，避免压迫感。
- `ingame_bgm_base.wav`: 局内基础层，保留轻节奏推进与低存在感鼓点。
- `ingame_bgm_melody.wav`: 局内点缀层，供高 Fill Ratio / 高 Combo 时做轻微抬升。
- `sfx_sprite.wav`: Hover / Click / Select / Merge / Devour / Combo 的短音效合集，整体收软。
- `sfx_sprite.json`: 引擎端按 `start/end` 秒数切片播放。

## 5. 引擎接入建议

- BGM 常驻仅播 `ingame_bgm_base.wav`。
- 当 `fillRatio >= 0.7` 或 `comboCount >= 3` 时，轻微淡入 `ingame_bgm_melody.wav`。
- 当触发高级合成或 Combo 收尾时，对 BGM 做 `2-4dB` ducking，并在 `0.5s` 内恢复。
- 同帧同类音效并发实例限制为 `2-3` 个，超出直接丢弃。

## 5.1 当前运行时接线

- `src/audio/audioManager.ts`：统一管理 `AudioContext`、BGM 分层、Sprite 播放与 Ducking。
- `src/audio/AudioRuntime.tsx`：监听 `GameStoreSnapshot` 的选择、切片、合成、吞噬、Combo 变化并触发音频。
- 菜单 / HUD / SliceControls 的按钮点击已接入基础确认音，确保首个用户手势即可唤醒音频上下文。

## 6. 再加工建议

- 这批是**程序原型音频**，适合联调、验节奏、验打击反馈。
- 若要正式上线 CrazyGames，建议由 `@继超` 基于这套节奏骨架二次精修，并统一转码到 `mp3/m4a`。
- 当前未修改任何玩法数值、生成规则、Combo 时间窗，不需要同步策划规则文档。

## 7. 2026-05-03 休闲化调整记录

- 生成脚本新增 `sine` 振荡器，BGM 与 SFX 高频辅助层从硬脉冲/方波改为更圆的正弦/三角波组合。
- 主菜单 BGM 从 `126 BPM` 下修到约 `104 BPM`；局内 BGM 从 `128 BPM` 下修到约 `108 BPM`。
- 局内鼓点由密集 kick/snare 改成轻 kick/clap，降低“战斗警报”感。
- `audioManager` 全局增益、SFX 播放增益与 ducking 强度同步下修，目标是普通休闲游戏的轻松底噪，不再制造紧张压迫。

## 8. 2026-05-03 局内音频开关

- 单局 HUD 左下角在 Lobby 返回按钮旁新增音频总开关，统一控制 BGM 与 SFX。
- 状态由 `audioManager.setUserMuted()` 管理，并持久化到 `localStorage: cubefight.audio-muted`。
- 用户静音与 CrazyGames 平台静音分层：平台静音 `platformMuted` 仍保持最高优先级；用户静音 `userMuted` 只代表玩家主动开关。
- 关闭音频时，BGM gain 与 SFX gain 均淡出到 0，且 `playSprite()` 直接短路，避免静音状态下继续创建短音源。

## 9. 2026-05-03 设置音量滑杆

- 设置弹窗新增音量大小滑杆，统一控制 BGM 与 SFX 的 `masterGain`，取值范围 `0-100%`。
- 状态由 `audioManager.setUserVolume()` 管理，并持久化到 `localStorage: cubefight.audio-volume`；默认值保持当前混音响度 `78%`，避免上线音量突变。
- 音量大小与用户静音、CrazyGames 平台静音分层：音量滑杆只控制总体响度，用户静音仍通过 `cubefight.audio-muted` 短路 SFX，平台静音仍最高优先级。

## 10. 2026-05-03 大厅 BGM 偶发缺失修复

- 问题来源：BGM buffer promise 曾经会把一次性 fetch/decode 失败永久缓存为 `null`，后续回到大厅或再次触发解锁时不会重试，表现为“大厅有时候没有 BGM”。
- 当前策略：BGM 与 SFX 资源加载失败后清空对应 promise，下次 `setScene()` / `unlock()` / 播放入口会重新拉取资源。
- 场景切换保护：`syncScenePlayback()` 增加序号防抖；异步加载完成后会复查当前 scene、解锁状态和可见性，避免菜单/局内快速切换时旧请求启动错误 BGM loop。
- 可见性恢复：页面从后台回前台后重新走 `syncScenePlayback()`，不只恢复 gain，确保被浏览器挂起期间未成功创建的 BGM loop 能补建。
