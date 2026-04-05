# AGENTS.md
Guide for coding agents in `E:\WorkSpace\MiniGame\CubeFight`.

## Project summary
- Stack: React 18, TypeScript, Vite, Vitest, React Three Fiber, Three.js.
- Domain: H5 3D puzzle game with authored levels, tutorial flow, endless mode, and generated audio.
- Gameplay truth lives in a custom external store under `src/game/state/`.
- The `Doc/` folder is the main source of truth for architecture and gameplay intent.

## Read these docs before changing behavior
1. `Doc/TechDesign/TechArchitecture.md`
2. `Doc/GameDesign/LevelDesign.md`
3. `Doc/MusicDesign/AudioSpec_8Bit.md`
4. Other `Doc/TechDesign/*.md` and `Doc/AudioDesign/*.md`
- If you change technical behavior, update `Doc/TechDesign/`.
- If you change gameplay rules, pacing, scoring, tutorial flow, endless logic, or economy, also flag that `Doc/GameDesign/` needs sync.

## Cursor / Copilot rules
- `.cursor/rules/` → not present
- `.cursorrules` → not present
- `.github/copilot-instructions.md` → not present
- Repo guidance therefore comes from `Doc/` plus existing code patterns.

## Install / build / run commands
Use Node 18+.

```powershell
npm install
npm run dev
npm run dev -- --host 0.0.0.0
npm run build
npm run preview
```

Notes:
- There is **no lint script** in `package.json`.
- `npm run build` is the main compile/type gate.

## Test commands
Full suite:

```powershell
npm test
```

Watch mode:

```powershell
npm run test:watch
```

Smoke run:

```powershell
npm run test:smoke
```

Single file:

```powershell
npx vitest run src/app/App.test.tsx
```

Single named test:

```powershell
npx vitest run src/app/App.test.tsx -t "shows the main menu first and enters gameplay after pressing play"
```

Pattern run:

```powershell
npx vitest run --grep "tutorial"
```

Current known issue:
- There is an existing failing test in `src/game/state/demoRules.test.ts:50`; do not assume all red tests come from your change.

## Generation commands

```powershell
npm run levels:generate
npm run audio:generate
```

- Generated audio is stored in `public/audio/generated/` and checked into source control.

## Important directories
- `src/app/` → app shell, screen flow, menu/game transitions
- `src/game/state/` → gameplay rules, store, selectors, state transitions
- `src/game/levels/` → level parsing and runtime mapping
- `src/game/config/` → config builders and validation
- `src/render/` → 3D rendering components
- `src/ui/` → menu, HUD, locale provider, UI tests
- `src/audio/` → Web Audio runtime and sprite playback
- `config/json/levels.json` → authored level data

## Formatting and syntax
- TypeScript for app/game logic
- single quotes
- no semicolons
- match surrounding formatting; no visible Prettier/ESLint enforcement
- prefer early returns over nested `else`
- keep helper functions small and explicit

## Imports
Typical order used in the repo:
1. `import React from 'react'`
2. blank line
3. local value imports
4. `import type` lines

Rules:
- Use `import type` for type-only imports
- Prefer relative imports already used nearby
- Do not leave unused imports behind

## Types and config modeling
- Prefer `type` aliases for object shapes and unions
- Use narrow string unions for modes/states
- Keep config serializable and explicit
- Clone nested config/state intentionally; mutation safety matters here

When adding config fields, update all of these:
1. `src/game/model/types.ts`
2. config builders
3. config validation
4. runtime consumers
5. tests where relevant

## Naming conventions
- Components: `PascalCase`
- Functions/helpers: `camelCase`
- Module constants: `UPPER_SNAKE_CASE`
- Localized keys: lower camelCase nested objects
- Test names: sentence-style behavior descriptions
- Use gameplay vocabulary consistently: `merge`, `devour`, `tutorial`, `endless`, `slice`, `overlay`, `runState`

## React and UI conventions
- Prefer function components
- Type props with nearby `type ...Props` aliases or inline typed objects
- Use `data-testid` for important UI elements that tests rely on
- Preserve existing test IDs when editing menu/HUD/app flow
- Keep UI state local; keep gameplay truth in the store

## Gameplay and state conventions
- Core gameplay logic belongs in `src/game/state/`, not React components
- React state is mainly for screen flow, session flow, and menu settings
- Respect the distinction between `runState`, `overlay`, `matchResult`, and `actionStats`
- If behavior depends on authored content, inspect both runtime code and `levels.json`

## Error handling
- Throw explicit `Error` messages during config parsing and validation
- Fail fast on malformed authored level data
- Browser asset/audio fetches may use graceful `null` fallback if that file already follows that pattern
- Avoid silent swallowing unless the surrounding code intentionally treats failure as non-fatal

## Testing expectations
- Gameplay/store changes → `src/game/state/*.test.tsx`
- Level parsing/config changes → `src/game/levels/*.test.ts`
- Menu/HUD/app flow changes → `src/app/*.test.tsx` and `src/ui/*.test.tsx`
- Prefer focused assertions over broad snapshots

## Agent cautions
- Read docs before changing behavior
- Update `Doc/TechDesign/` when changing technical behavior
- Mention `Doc/GameDesign/` sync when gameplay rules change
- Do not invent a lint command
- Before claiming success, run `npm run build`
- If behavior changed, run the smallest relevant Vitest command too

## Current repo gotchas
- Tutorial/menu/endless flows are actively evolving; inspect adjacent code before editing
- Some generated assets are versioned and should not be ignored automatically
- Endless mode uses both authored dynamic params and runtime logic
- Audio changes often require both script changes and regenerated output files
