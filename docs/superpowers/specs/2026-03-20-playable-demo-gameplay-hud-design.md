# CubeFight Playable Demo Gameplay + HUD Design

- Date: 2026-03-20
- Author: Jeffy
- Status: Approved by user
- Scope: First playable demo slice for core gameplay loop and in-game HUD/UI refresh

## 1. Goal

Deliver a playable demo that proves the core loop in the current React + R3F runtime without attempting full production completeness.

This slice uses a static puzzle-style ruleset as the gameplay carrier, while the HUD structure stays compatible with future endless mode expansion.

## 2. In Scope

- Blue cube selection and valid-target highlighting
- Merge and devour actions
- Score updates
- Combo timer and combo feedback
- Basic win/lose evaluation
- One real usable item: bomb
- Restart flow
- HUD refresh aligned with `Doc/ArtDesign/InGameUI_UX.md`
- Slice controls visual refresh only; no change to existing slice logic
- i18n coverage for all new UI text
- Config-driven gameplay and UI constants where tuning is likely

## 3. Out of Scope

- Dynamic refill / endless spawning logic
- Full next-queue gameplay logic
- CrazyGames SDK integration
- Shop, skins, monetization flow
- Multi-item system beyond bomb placeholders
- Full tutorial system
- Heavy polish or expensive post-processing work beyond lightweight feedback

## 4. Recommended Delivery Strategy

Use a combined approach:

1. Stabilize the game state and action boundaries first
2. Then implement the player path vertically from interaction to resolution

This keeps gameplay truth centralized while still shipping a demo in user-visible slices.

## 4.1 Demo Board Definition

This slice uses one fixed authored puzzle board loaded from config rather than procedural generation.

Board contract:

- Board source: config-authored demo level data
- Grid shape: existing project-supported cube grid, using orthogonal cell coordinates
- Coordinate bounds: `x`, `y`, and `z` each use zero-based integer coordinates in the inclusive range `0..gridSize-1`
- Cube schema: `id`, `color`, `level`, `x`, `y`, `z`
- Initial bomb inventory is part of the same demo config payload

Restart semantics:

- `restartDemo()` restores the authored starting board
- `restartDemo()` restores initial bomb inventory
- `restartDemo()` resets score, combo, run state, overlays, status hint, slice state, and transient targeting state
- Initial load and restart both reset slice state to `all`
- Camera reset is recommended for a cleaner demo loop but is not required unless current implementation already supports it cleanly

## 5. Architecture Boundaries

### 5.1 Rules Layer

The rules layer owns gameplay truth and state transitions.

Primary responsibilities:

- Board state
  - Grid size
  - Cube data
  - Slice filter state
  - Valid action results
- Run state
  - `idle`
  - `selected`
  - `itemTargeting`
  - `resolving`
  - `victory`
  - `gameOver`
  - `paused`
  - `paused` stores `resumeTargetState` as `idle`, `selected`, or `itemTargeting`
- Progress state
  - Score
  - Combo count
  - Combo timing window state
  - Bomb inventory
  - Current level result state

The existing store should be tightened around these responsibilities instead of introducing another large controller.

Public rules-layer contract for this slice:

- Actions
  - `selectCube(cubeId)`
  - `activateBomb()`
  - `cancelTargeting()`
  - `commitBoardAction(targetCubeId)`
  - `restartDemo()`
  - `pauseGame()`
  - `resumeGame()`
- Derived selectors
  - `getRunState()`
  - `getSelectedCube()`
  - `getValidTargets()`
  - `getBombTargets()`
  - `getScore()`
  - `getComboState()`
  - `getBombInventory()`
  - `getStatusHintKey()`
  - `getMatchResult()`
  - `getSliceState()`

These names may vary in implementation, but equivalent boundaries must exist so the rules layer can be understood and tested without reading render internals.

### 5.2 Render Layer

R3F components render state and dispatch user interactions but do not decide gameplay legality.

Expected responsibilities:

- `GridRoot`: board layout, visibility, click routing
- `CubeMesh`: appearance, selected state, highlight state, dim state, sliced visibility state
- `CameraRig`: orbit camera and damping behavior
- `Effects`: combo feedback, hit feedback, bomb feedback placeholders

Rule checks such as "can merge" or "can devour" must stay outside render components.

### 5.3 UI Layer

DOM-based UI handles readable HUD, controls, and overlays.

Expected responsibilities:

- `HUD`: score, combo, pause, item slots, lightweight status hint
- `SliceControls`: same logic, refreshed presentation
- Overlay / modal components: one overlay family with `pause`, `victory`, and `gameOver` variants; `restart` is a button inside pause, victory, and game-over overlays rather than a standalone modal
- `LocaleProvider`: all user-facing text resolved from locale keys

DOM remains the default for information-heavy controls. Spatial UI is reserved for high-value 3D feedback such as combo popups.

`SliceControls` contract for this slice:

- Inputs
  - Current slice state from store
  - Localized labels for layer / column / all
  - Button disabled state when blocked by overlays such as pause, victory, or game over
- Outputs
  - Dispatch current existing slice actions only
- Preserved behavior
  - Supported modes in this slice are `layer`, `column`, and `all`
  - `layer` selects the existing Y-layer filter behavior
  - `column` selects the existing column filter behavior already implemented in the project
  - `all` clears active slice filtering
  - No new remapping, filtering, or target-legality rules are introduced here
  - This unit changes appearance and layout only

## 6. State Flow

### 6.1 Normal action flow

`enter match` -> `idle` -> select blue cube -> `selected` -> compute and show valid targets -> click valid target -> `resolving` -> apply merge or devour -> update score/combo/board -> evaluate victory/game over -> return to `idle` or move to terminal state

If the player clicks an invalid target during `selected`:

- The action does not resolve
- The current blue selection remains active
- The status hint updates to the localized equivalent of `chooseValidTarget`
- Optional lightweight feedback such as shake/flash may be added, but is not required for this slice

### 6.2 Bomb flow

Click bomb slot -> `itemTargeting` -> show valid target affordance -> click target -> destroy target -> decrement inventory -> evaluate victory/game over -> return to `idle` if game continues

Bomb targeting rules for this slice:

- Bomb can target any currently visible cube on the board
- Bomb destroys exactly one targeted cube
- Bomb does not affect adjacent cubes, score, score multipliers, or combo count in this slice
- If the player clicks outside a valid target while targeting, targeting remains active and the status hint stays in bomb-targeting mode until the player selects a target or cancels

### 6.3 Guardrails

- Entering `itemTargeting` clears normal cube selection
- Action resolution is serialized through a single post-action path
- Victory and game over checks run after every successful merge, devour, or bomb action
- Pause blocks all board interactions and item activation until resumed
- Combo timer is frozen while paused
- Slice controls do not receive new gameplay rules in this slice; their interactive behavior stays aligned with the current implementation, with only visual presentation refreshed
- Hidden cubes are not clickable while filtered out; move legality is still computed from full board truth, but the UI only exposes currently visible valid targets
- Changing slice state during `selected` preserves the selected cube if it remains visible; otherwise selection is cleared and run state returns to `idle`
- Changing slice state during `itemTargeting` preserves targeting mode and recomputes valid visible bomb targets against the new slice view

Authoritative legality note:

- End-state checks use full-board legality, not only currently visible cubes
- A move hidden by slice state is still considered a legal move for game-over purposes
- The player is expected to rotate or change slice state to reveal that move
- The status hint may surface a localized equivalent of `movesHiddenByView` when no visible legal target exists for the current selection but full-board legal moves still exist

Status-hint priority, highest first:

1. No hint when pause, victory, or game-over overlay is visible
2. `bombTargeting` while bomb targeting is active and inventory is available
3. `noBombs` after clicking a disabled bomb slot at zero inventory
4. `movesHiddenByView` when current selection has no visible legal target but full-board legal targets exist
5. `chooseValidTarget` immediately after an invalid click during `selected`
6. `chooseTarget` during normal selected state with visible legal targets
7. `selectCube` during idle state
8. `noMoves` when no legal move and no bomb inventory remain, immediately before game-over transition

Selection-state interaction rules:

- Clicking another selectable blue cube while already in `selected` switches selection to the newly clicked blue cube and recomputes valid targets
- Clicking the currently selected blue cube again clears selection and returns to `idle`
- Triggering pause during `idle`, `selected`, or `itemTargeting` changes run state to `paused`, stores `resumeTargetState`, and opens the pause overlay
- Resuming from pause restores the stored `resumeTargetState` and recomputes any derived highlights needed for that state
- Pause input during `resolving` is ignored in this slice

## 7. Gameplay Behavior for This Demo

### 7.1 Core action rules

- Only blue cubes can be actively selected for standard actions
- Adjacency means the six orthogonal neighbors on the grid only: `+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`
- Diagonal cells are never legal neighbors for merge or devour
- Valid targets are:
  - Adjacent same-level blue cubes for merge
  - Adjacent red or yellow cubes with level less than or equal to the active blue cube for devour
- The second click decides the result position
- Merge resolution contract:
  - Source cube = first selected blue cube
  - Target cube = second clicked same-level blue cube
  - Result cube color = blue
  - Result cube level = `source.level + 1`
  - Result cube position = target cube position
  - Source cube is removed from its original cell
  - Target cube is replaced by the upgraded result cube
- Devour resolution contract:
  - Source cube = first selected blue cube
  - Target cube = second clicked red or yellow cube
  - Surviving cube color = blue
  - Surviving cube level = source cube level (no level gain in this slice)
  - Surviving cube position = target cube position
  - Source cube is removed from its original cell
  - Target cube is removed and replaced by the moved blue cube
- Invalid targets do not resolve and should keep feedback clear

### 7.2 Score and combo

- Every successful merge or devour action updates score
- Demo scoring contract is config-backed but functionally fixed for this slice:
  - Merge score = `mergeBase[levelAfterMerge]`
  - Devour red score = `devourRedBase[targetLevel]`
  - Devour yellow score = `devourYellowBase[targetLevel]`
  - On a successful merge or devour, combo count increments first
  - Final awarded score for merge or devour = `baseScore * multiplierTable[currentComboCount - 1]`, clamped to the last table entry
  - Bomb score = `0`
- Combo increments on successful merge and devour only
- Bomb use neither increments combo nor grants combo score
- Bomb use also does not break an active combo timer window; the timer simply continues counting down from the last scoring action
- Each successful merge or devour refreshes the combo timer back to the full configured timeout duration
- Combo resets on timeout, restart, victory, and game over
- Combo increments inside a configurable time window
- Invalid clicks, canceling bomb targeting, slice changes, and pause/resume do not reset combo by themselves
- HUD must expose combo state clearly
- At least one lightweight feedback channel is required:
  - popup text
  - score bounce
  - status feedback

### 7.3 Bomb item

Bomb is the only fully implemented item in this slice.

Required behavior:

- Visible item slot in HUD
- Quantity or availability state visible
- Zero inventory keeps the bomb slot visible but disabled
- Clicking a zero-inventory bomb slot does not enter targeting and updates the status hint to the localized equivalent of `noBombs`
- Click enters targeting mode
- Valid target feedback appears on board
- Click target destroys that cube
- Inventory is reduced
- Post-action game-state evaluation runs immediately

Other items may exist only as config and UI placeholders.

### 7.4 Match flow

- Demo supports lightweight loop closure only
- Victory condition: all red cubes are cleared from the board
- Failure condition: at least one red cube remains and the player has no legal merge, no legal devour action, and no remaining bomb inventory, with legality evaluated against the full board state rather than current slice visibility
- Show `Victory` overlay on success
- Show `Game Over` overlay on failure
- Provide `Restart`
- No full settlement or next-level system in this slice

Pause behavior for this slice:

- Pause is functional, not decorative
- Tapping pause opens a lightweight pause overlay
- While paused, board input, item activation, and combo countdown are suspended
- While paused, slice controls are disabled and visually dimmed
- Pause overlay exposes resume and restart only
- Victory and game-over overlays expose restart only

## 8. HUD and Slice UI Design Constraints

The UI must follow the "Yield & Float" direction from `Doc/ArtDesign/InGameUI_UX.md`.

Implementation constraints:

- Keep the central board visually dominant
- Use lightweight floating glass-style panels
- Use a minimal three-zone layout: top header, unobtrusive side/bottom controls, clean center gameplay field
- Avoid placing persistent 2D panels over the board center
- Prefer thin translucent panels with readable typography over large opaque cards
- Keep score left/top priority, combo in the header, item slot near lower-right reach zone, and pause in the upper utility area
- Refresh only presentation for slice controls; preserve current logic behavior
- Keep header, item slot area, status hint, and overlays stylistically consistent
- Avoid turning routine controls into 3D spatial widgets unless visual value clearly outweighs usability cost
- Support both Chinese and English without clipping and keep mobile-safe touch targets

Target HUD surface for this slice:

- Header: score, combo, pause
- Item slot area: bomb plus placeholder-capable structure
- Status hint area: selection / targeting / no-move messaging
- Overlays: pause, victory, and game over, with restart embedded in overlay actions
- Slice controls: visually refreshed and i18n-safe

## 9. Configuration Strategy

The following values should be config-driven rather than hardcoded in UI components:

Suggested config contract for this slice:

```ts
interface PlayableDemoConfig {
  board: {
    gridSize: number
    cubes: Array<{ id: string; color: 'blue' | 'red' | 'yellow'; level: number; x: number; y: number; z: number }>
  }
  inventory: {
    bombCount: number
  }
  combo: {
    timeoutMs: number
    multiplierTable: number[]
  }
  scoring: {
    mergeBase: Record<number, number>
    devourRedBase: Record<number, number>
    devourYellowBase: Record<number, number>
  }
  winLoss: {
    victory: 'clear_all_red'
    requireNoMovesForGameOver: true
    requireNoBombsForGameOver: true
  }
  ui: {
    showCombo: boolean
    showPause: boolean
    sliceLayout: 'current-implementation'
  }
}
```

- Combo timeout window
- Initial bomb inventory
- Score rule tables used by this demo
  - `mergeBase`
  - `devourRedBase`
  - `devourYellowBase`
  - `multiplierTable`
- Demo success condition (all red cubes cleared)
- Demo failure condition checks
- Overlay button text keys
- HUD feature visibility toggles
- Slice control layout definitions

For this slice, combo multiplier is authored as a table where index `0` is combo x1, index `1` is combo x2, and larger combo counts clamp to the last entry.

Worked scoring example:

- First successful merge in a fresh run sets combo count to `1` and uses `multiplierTable[0]`
- Second successful scoring action inside the timeout sets combo count to `2` and uses `multiplierTable[1]`
- If the timer expires before the next scoring action, combo resets and the next successful scoring action again uses `multiplierTable[0]`

Config validity rules:

- Cube `id` values must be unique
- Cube coordinates must be inside board bounds
- No two cubes may occupy the same cell
- Score tables must include every level referenced by authored cubes and expected merge results in the demo board
- `multiplierTable` must contain at least one entry
- Invalid config should fail fast during demo initialization rather than silently auto-correcting

Invalid config failure surface:

- Demo initialization throws a typed configuration error in development
- Production/demo build shows a lightweight blocking error screen instead of entering gameplay
- The error screen does not try to recover or patch invalid data at runtime

This allows later tuning without pushing rules into presentation code.

## 10. Internationalization Strategy

All new UI text must use locale keys. No hardcoded Chinese strings should be introduced into components.

Minimum coverage:

- HUD labels: score, combo, pause, items, bomb
- Overlay labels: victory, gameOver, restart, resume
- Status hints: selectCube, chooseTarget, chooseValidTarget, bombTargeting, noMoves, movesHiddenByView, noBombs
- Slice controls: layer, column, all

Guidelines:

- Separate labels from numeric values
- Size UI for longer English strings, not only Chinese copy
- Keep future locale additions possible without component rewrites

## 11. Rendering and Performance Principles

- Keep gameplay legality in selectors/store, not meshes
- Use DOM for dense informational UI and actions
- Use R3F for world rendering and high-value feedback only
- Avoid adding heavy post-processing or unnecessary per-cube logic in this slice
- Prefer component reuse and derived selectors over duplicated transient state

## 12. Delivery Order

### Step 1 - Stabilize state and action boundaries

- Refine store state groups
- Normalize run states
- Unify action entry points
- Add config and locale skeletons first

### Step 2 - Finish playable rules

- Blue selection
- Merge/devour resolution
- Score update
- Combo logic
- Victory/game over evaluation
- Restart loop

### Step 3 - Integrate bomb item

- Item slot UI
- Targeting mode
- Target click and effect
- Inventory consumption
- Post-action victory/game over recheck

### Step 4 - Refresh HUD, slice UI, and overlays

- Header and item slot styling
- Status hint presentation
- Slice control visual redesign
- Victory/game over overlay styling
- Chinese/English layout verification

## 13. Risks and Mitigations

- Rules leaking into view components
  - Mitigation: valid-target sets and action legality come only from rules/selectors
- Slice filtering conflicting with action targeting
  - Mitigation: slice changes visibility/click availability only; board truth stays global
- Bomb targeting conflicting with normal selection
  - Mitigation: run states are mutually exclusive and selection is cleared on item targeting entry
- Inconsistent end-state checks
  - Mitigation: every resolved action funnels through one post-action resolution path
- UI refresh harming usability
  - Mitigation: prioritize information hierarchy and board visibility before visual polish

## 14. Verification Requirements

### Rules verification

- Same-level blue cubes merge correctly
- Blue cubes devour allowed red/yellow targets correctly
- Invalid targets do not resolve
- Result position always follows second-click rule
- Bomb removal keeps board data consistent
- Hidden legal moves do not trigger a false game over
- Zero-inventory bomb clicks never enter targeting mode

### Flow verification

- Selection -> action -> HUD update chain is stable
- Invalid target clicks do not clear the active selection unexpectedly
- Combo timeout resets correctly
- Pause freezes input and combo timing, then resumes cleanly
- Resume restores the correct pre-pause state (`idle`, `selected`, or `itemTargeting`)
- Victory and game over appear only at correct times
- Restart reconstructs the initial board state
- Restart from pause, victory, and game-over overlays reconstructs the same authored starting state
- Slice controls retain current gameplay behavior while receiving only visual refresh in this slice
- Bomb targeting only applies to visible targets and destroys exactly one cube
- Invalid config prevents gameplay start and surfaces the expected blocking error path

### UI and i18n verification

- Chinese and English both display correctly
- Header, slice controls, and overlays do not obstruct the core board on desktop or mobile
- Slice UI refresh does not change underlying logic expectations

## 15. Definition of Done

This design is complete for planning when the implementation can produce:

- A stable playable demo loop
- One fully usable item: bomb
- HUD and slice UI at demo quality
- i18n-complete user-facing text for the new surfaces
- Config-driven tunable values for the likely adjustment points
- Updated technical documentation during implementation if final rule or tuning decisions become locked

## 16. Cross-Document Follow-up

If implementation locks down any of the following as concrete project rules, they must be mirrored in project docs:

- Final combo timing value
- Demo victory / failure criteria
- Bomb effect boundary

When those values are finalized, update technical documentation and notify `@主策划 樊老师` to sync the corresponding gameplay rule changes into `Doc/GameDesign/`.
