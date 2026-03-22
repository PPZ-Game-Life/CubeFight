import React from 'react'

import { buildPlayableConfigFromLevel, getLevelById, levelCatalog } from '../game/levels/levelCatalog'
import { getLevelOneTutorialStep } from '../game/levels/levelOneTutorial'
import { evaluateLevel, formatObjectiveText } from '../game/levels/levelProgress'
import type { Locale } from '../game/model/types'
import type { GameStoreSnapshot } from '../game/state/gameStore'
import { GameStoreProvider, useGameStore } from '../game/state/gameStore'
import { getVisibleValidTargets } from '../game/state/demoRules'
import { LocaleProvider, useLocale } from '../ui/LocaleProvider'
import { HUD } from '../ui/HUD'
import { MainMenu } from '../ui/MainMenu'
import { SliceControls } from '../ui/SliceControls'
import { GameCanvas } from './GameCanvas'

type SessionOverlayState = 'victory' | 'game_over' | null

const MENU_SETTINGS_STORAGE_KEY = 'cubefight.menu.settings'
const CAMPAIGN_FINAL_LEVEL_ID = 10
const PLAYABLE_LEVEL_IDS = levelCatalog.levels.filter((level) => level.id !== 999).map((level) => level.id)
const DEFAULT_DEBUG_LEVEL_ID = PLAYABLE_LEVEL_IDS[0] ?? 1

type StoredMenuSettings = {
  debugMode: boolean
  debugLevelId: number
}

function formatLevelLabel(levelId: number) {
  return `Level ${String(levelId).padStart(2, '0')}`
}

function getNextPlayableLevelId(levelId: number): number | null {
  const currentIndex = PLAYABLE_LEVEL_IDS.indexOf(levelId)
  if (currentIndex === -1) {
    return null
  }

  return PLAYABLE_LEVEL_IDS[currentIndex + 1] ?? null
}

function normalizeDebugLevelId(levelId: number) {
  return PLAYABLE_LEVEL_IDS.includes(levelId) ? levelId : DEFAULT_DEBUG_LEVEL_ID
}

function readStoredMenuSettings(): StoredMenuSettings {
  if (typeof window === 'undefined') {
    return { debugMode: false, debugLevelId: DEFAULT_DEBUG_LEVEL_ID }
  }

  const rawValue = window.localStorage.getItem(MENU_SETTINGS_STORAGE_KEY)
  if (!rawValue) {
    return { debugMode: false, debugLevelId: DEFAULT_DEBUG_LEVEL_ID }
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredMenuSettings>
    return {
      debugMode: parsed.debugMode === true,
      debugLevelId: normalizeDebugLevelId(typeof parsed.debugLevelId === 'number' ? parsed.debugLevelId : DEFAULT_DEBUG_LEVEL_ID)
    }
  } catch {
    return { debugMode: false, debugLevelId: DEFAULT_DEBUG_LEVEL_ID }
  }
}

function pickMenuDemoMove(snapshot: GameStoreSnapshot): { sourceId: string; targetId: string } | null {
  const visiblePlayableCubes = snapshot.visibleCubes.filter((cube) => cube.color === 'blue' || cube.color === 'yellow')
  const candidates = visiblePlayableCubes.flatMap((source) => {
    const targets = getVisibleValidTargets(snapshot.cubes, source.id, snapshot.slice)
      .map((targetId) => snapshot.cubes.find((cube) => cube.id === targetId))
      .filter((target): target is NonNullable<typeof target> => Boolean(target))

    return targets.map((target) => ({
      sourceId: source.id,
      targetId: target.id,
      priority: target.color === source.color ? 2 : 1,
      score: source.level + target.level
    }))
  })

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority
    }

    return right.score - left.score
  })

  return { sourceId: candidates[0].sourceId, targetId: candidates[0].targetId }
}

function pickMenuShowcaseLevelId() {
  const showcaseCandidates = levelCatalog.levels
    .filter((level) => level.id >= 8 && level.id <= 20 && level.initialMap.length >= 6)
    .map((level) => level.id)

  if (showcaseCandidates.length === 0) {
    return PLAYABLE_LEVEL_IDS.find((levelId) => levelId > 1) ?? DEFAULT_DEBUG_LEVEL_ID
  }

  return showcaseCandidates[Math.floor(Math.random() * showcaseCandidates.length)]
}

function getTutorialMessage(levelId: number, tutorialInstruction?: string | null): string | null {
  if (levelId === 1 && tutorialInstruction) {
    return tutorialInstruction
  }

  switch (levelId) {
    case 2:
      return 'Level 02: full 3x3x3 puzzle. Score 300 to pass.'
    case 3:
      return 'Level 03: eliminate every red cube in the chamber.'
    case 4:
      return 'Level 04: grow yellow value before you cash it in.'
    case 5:
      return 'Level 05: chain three actions fast for a combo x3.'
    case 6:
      return 'Rotate the view until you see the hidden target on the back.'
    case 7:
      return 'Use slice view to expose the core and remove the red cube.'
    case 8:
      return 'Free solve: convert the pyramid setup into a Lv.5 blue cube.'
    case 9:
      return 'Use the bomb to break the deadlock, then clean the board.'
    case 10:
      return 'Final exam: grow, slice, and defeat the Lv.4 red boss. Endless unlocks after this.'
    default:
      return null
  }
}

function getTutorialAllowedCubeIds(levelId: number, snapshot: GameStoreSnapshot, tutorialStepIndex: number): string[] | null {
  if (levelId !== 1) {
    return null
  }

  const tutorialStep = getLevelOneTutorialStep(tutorialStepIndex).step

  if (snapshot.selectedCubeId) {
    return [snapshot.selectedCubeId, ...snapshot.validTargetIds]
  }

  return tutorialStep.sourceCubeId ? [tutorialStep.sourceCubeId] : []
}

function getTutorialMarkerCubeIds(snapshot: GameStoreSnapshot, tutorialStepIndex: number): string[] {
  const tutorialStep = getLevelOneTutorialStep(tutorialStepIndex).step

  if (snapshot.selectedCubeId) {
    return tutorialStep.targetCubeId ? [tutorialStep.targetCubeId] : []
  }

  return tutorialStep.sourceCubeId ? [tutorialStep.sourceCubeId] : []
}

function formatHintStep(step: { action: 'split_merge' | 'split_devour'; [key: string]: unknown }) {
  return step.action === 'split_merge' ? 'Merge the highlighted same-color pair.' : 'Use blue to devour the matching prey block.'
}

function shouldAutoSolvePause(snapshot: GameStoreSnapshot) {
  return snapshot.overlay !== 'none' || snapshot.runState === 'paused' || snapshot.runState === 'resolving' || snapshot.runState === 'targeting_bomb'
}

function SessionOverlay({
  currentLevelId,
  mode,
  rewardCoins,
  canAdvance,
  onAdvance,
  onRetry,
  onBackToLobby
}: {
  currentLevelId: number
  mode: SessionOverlayState
  rewardCoins: number
  canAdvance: boolean
  onAdvance: () => void
  onRetry: () => void
  onBackToLobby: () => void
}) {
  const { t } = useLocale()

  if (!mode) {
    return null
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(8, 12, 20, 0.42)', pointerEvents: 'auto', zIndex: 30 }}>
      <div style={{ minWidth: 320, maxWidth: 420, borderRadius: 24, border: '1px solid rgba(255,255,255,0.16)', background: 'linear-gradient(180deg, rgba(132,151,160,0.22), rgba(26,35,44,0.32))', boxShadow: '0 18px 42px rgba(6,10,16,0.28)', backdropFilter: 'blur(16px) saturate(140%)', padding: 28, color: '#f7f3ea', textAlign: 'center' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(244, 241, 234, 0.66)' }}>{`Level ${String(currentLevelId).padStart(2, '0')}`}</div>
        <h2 style={{ margin: '10px 0 0', fontSize: 34 }}>{mode === 'victory' ? t.hud.victory : t.hud.gameOver}</h2>
        {mode === 'victory' ? <div style={{ marginTop: 10, color: '#f3cc7b', fontWeight: 700 }}>{`Reward +${rewardCoins} coins`}</div> : null}
        <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
          {canAdvance ? <button style={overlayButtonStyle(true)} type="button" onClick={onAdvance}>Next Level</button> : null}
          <button style={overlayButtonStyle(false)} type="button" onClick={onRetry}>{t.hud.restart}</button>
          <button style={overlayButtonStyle(false)} type="button" onClick={onBackToLobby}>{t.hud.lobby}</button>
        </div>
      </div>
    </div>
  )
}

function overlayButtonStyle(primary: boolean): React.CSSProperties {
  return {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 14,
    padding: '12px 16px',
    background: primary ? 'linear-gradient(135deg, rgba(255,204,85,0.94), rgba(241,134,53,0.9))' : 'rgba(255,255,255,0.08)',
    color: primary ? '#432201' : '#f7f3ea',
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer'
  }
}

function LevelSessionShell({ currentLevelId, tutorialStepIndex, debugMode, onAdvanceTutorialStep, onBackToLobby, onAdvanceLevel, onRetryLevel, canAdvanceToNextLevel }: { currentLevelId: number; tutorialStepIndex: number; debugMode: boolean; onAdvanceTutorialStep: () => void; onBackToLobby: () => void; onAdvanceLevel: () => void; onRetryLevel: () => void; canAdvanceToNextLevel: boolean }) {
  const snapshot = useGameStore()
  const level = React.useMemo(() => getLevelById(currentLevelId), [currentLevelId])
  const [sessionOverlay, setSessionOverlay] = React.useState<SessionOverlayState>(null)
  const evaluation = React.useMemo(() => evaluateLevel(snapshot, level), [level, snapshot])
  const tutorialBundle = React.useMemo(() => (currentLevelId === 1 ? getLevelOneTutorialStep(tutorialStepIndex) : null), [currentLevelId, tutorialStepIndex])
  const tutorialMessage = getTutorialMessage(currentLevelId, tutorialBundle?.step.instruction)
  const [showHint, setShowHint] = React.useState(false)
  const [autoSolveEnabled, setAutoSolveEnabled] = React.useState(false)
  const tutorialAllowedCubeIds = React.useMemo(() => getTutorialAllowedCubeIds(currentLevelId, snapshot, tutorialStepIndex), [currentLevelId, snapshot, tutorialStepIndex])
  const tutorialMarkerCubeIds = React.useMemo(() => (currentLevelId === 1 ? getTutorialMarkerCubeIds(snapshot, tutorialStepIndex) : []), [currentLevelId, snapshot, tutorialStepIndex])

  React.useEffect(() => {
    if (!debugMode) {
      setAutoSolveEnabled(false)
    }
  }, [debugMode])

  React.useEffect(() => {
    if (!autoSolveEnabled || shouldAutoSolvePause(snapshot)) {
      return
    }

    const timer = globalThis.setTimeout(() => {
      if (snapshot.selectedCubeId) {
        if (snapshot.validTargetIds.length > 0) {
          snapshot.commitBoardAction(snapshot.validTargetIds[0])
          return
        }

        if (snapshot.slice.axis) {
          snapshot.resetSliceView()
          return
        }

        snapshot.clearSelection()
        return
      }

      const move = pickMenuDemoMove(snapshot)
      if (move) {
        snapshot.selectCube(move.sourceId)
        return
      }

      if (snapshot.slice.axis) {
        snapshot.resetSliceView()
      }
    }, 240)

    return () => globalThis.clearTimeout(timer)
  }, [autoSolveEnabled, snapshot])

  React.useEffect(() => {
    if (currentLevelId !== 1 || !tutorialBundle) {
      return
    }

    if (tutorialStepIndex === 0 && (snapshot.actionStats.mergeCounts['blue:2'] ?? 0) > 0) {
      onAdvanceTutorialStep()
      return
    }

    if (tutorialStepIndex === 1 && (snapshot.actionStats.devourCounts['red:1'] ?? 0) > 0) {
      onAdvanceTutorialStep()
      return
    }

    if (tutorialStepIndex === 2 && (snapshot.actionStats.mergeCounts['yellow:2'] ?? 0) > 0) {
      onAdvanceTutorialStep()
      return
    }

    if (tutorialStepIndex === 3 && (snapshot.actionStats.devourCounts['red:1'] ?? 0) > 0) {
      setSessionOverlay('victory')
    }
  }, [currentLevelId, onAdvanceTutorialStep, snapshot.actionStats.actionsUsed, tutorialBundle, tutorialStepIndex])

  React.useEffect(() => {
    if (currentLevelId === 1) {
      return
    }

    if (evaluation.completed) {
      setSessionOverlay('victory')
      return
    }

    if (evaluation.failed || snapshot.overlay === 'game_over') {
      setSessionOverlay('game_over')
      return
    }

    setSessionOverlay(null)
  }, [evaluation.completed, evaluation.failed, snapshot.overlay])

  const levelInfo = {
    levelLabel: `${level.id === 999 ? 'Endless' : `Level ${String(level.id).padStart(2, '0')}`}`,
    stepsRemaining: currentLevelId === 1 ? null : evaluation.stepsRemaining,
    objectives: currentLevelId === 1 && tutorialBundle
      ? [{ text: tutorialBundle.step.objectiveText, complete: false }]
      : evaluation.objectives.map((objective) => ({
          text: formatObjectiveText(objective),
          complete: objective.complete
        }))
  }

  return (
    <>
      <GameCanvas allowedCubeIds={tutorialAllowedCubeIds} interactive={sessionOverlay === null} tutorialMarkerCubeIds={tutorialMarkerCubeIds} />
      <HUD
        debugAction={debugMode ? { active: autoSolveEnabled, onToggle: () => setAutoSolveEnabled((value) => !value) } : null}
        levelInfo={levelInfo}
        onBackToLobby={onBackToLobby}
      />
      {currentLevelId >= 7 ? <SliceControls /> : null}
      {currentLevelId === 1 && tutorialMessage && !sessionOverlay ? (
        <div style={{ position: 'absolute', left: '50%', top: 132, transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 40px))', borderRadius: 18, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(8, 14, 24, 0.52)', boxShadow: '0 14px 28px rgba(4,8,14,0.18)', backdropFilter: 'blur(12px) saturate(140%)', padding: '14px 18px', color: '#eef4f8', zIndex: 20, pointerEvents: 'none', textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(244,241,234,0.62)' }}>Tutorial</div>
          <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{tutorialMessage}</div>
        </div>
      ) : null}
      {level.generatedHintPath && level.generatedHintPath.length > 0 ? (
        <div style={{ position: 'absolute', right: 16, bottom: 20, width: 280, zIndex: 20, pointerEvents: 'auto' }}>
          <button onClick={() => setShowHint((value) => !value)} style={{ ...overlayButtonStyle(false), width: '100%' }} type="button">{showHint ? 'Hide Hint' : 'Show Hint'}</button>
          {showHint ? (
            <div style={{ marginTop: 10, borderRadius: 18, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(8, 14, 24, 0.42)', boxShadow: '0 14px 28px rgba(4,8,14,0.18)', backdropFilter: 'blur(12px) saturate(140%)', padding: '12px 14px', color: '#eef4f8' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(244,241,234,0.62)' }}>Hint Path</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {level.generatedHintPath.slice(0, 4).map((step, index) => (
                  <div key={`${step.action}-${index}`} style={{ fontSize: 13, lineHeight: 1.4 }}>{index + 1}. {formatHintStep(step)}</div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <SessionOverlay
        canAdvance={sessionOverlay === 'victory' ? canAdvanceToNextLevel : false}
        currentLevelId={currentLevelId}
        mode={sessionOverlay}
        rewardCoins={level.reward.coins}
        onAdvance={onAdvanceLevel}
        onBackToLobby={onBackToLobby}
        onRetry={onRetryLevel}
      />
    </>
  )
}

function MenuShell({
  currentLevelId,
  endlessUnlocked,
  locale,
  debugMode,
  selectedDebugLevelId,
  onStart,
  onLocaleChange,
  onDebugModeChange,
  onSelectedDebugLevelChange
}: {
  currentLevelId: number
  endlessUnlocked: boolean
  locale: Locale
  debugMode: boolean
  selectedDebugLevelId: number
  onStart: () => void
  onLocaleChange: (locale: Locale) => void
  onDebugModeChange: (enabled: boolean) => void
  onSelectedDebugLevelChange: (levelId: number) => void
}) {
  const snapshot = useGameStore()
  const { t } = useLocale()
  const { clearSelection, commitBoardAction, overlay, restartDemo, runState, selectCube, selectedCubeId, validTargetIds } = snapshot

  React.useEffect(() => {
    const delayMs = selectedCubeId ? 820 : 1320
    const timer = globalThis.setTimeout(() => {
      if (overlay !== 'none') {
        restartDemo()
        return
      }

      if (runState === 'resolving' || runState === 'paused') {
        return
      }

      if (selectedCubeId) {
        if (validTargetIds.length > 0) {
          commitBoardAction(validTargetIds[0])
        } else {
          clearSelection()
        }
        return
      }

      const move = pickMenuDemoMove(snapshot)
      if (!move) {
        restartDemo()
        return
      }

      selectCube(move.sourceId)
    }, delayMs)

    return () => globalThis.clearTimeout(timer)
  }, [clearSelection, commitBoardAction, overlay, restartDemo, runState, selectCube, selectedCubeId, snapshot, validTargetIds])

  return (
    <>
      <GameCanvas interactive={false} />
      <MainMenu
        currentLevelLabel={t.menu.currentLevel(formatLevelLabel(currentLevelId))}
        debugMode={debugMode}
        endlessUnlocked={endlessUnlocked}
        locale={locale}
        onDebugModeChange={onDebugModeChange}
        onLocaleChange={onLocaleChange}
        onSelectedLevelChange={onSelectedDebugLevelChange}
        onStart={onStart}
        selectableLevels={PLAYABLE_LEVEL_IDS}
        selectedLevelId={selectedDebugLevelId}
      />
    </>
  )
}

function CampaignRoot() {
  const { locale, setLocale } = useLocale()
  const initialMenuSettings = React.useMemo(() => readStoredMenuSettings(), [])
  const [campaignLevelId, setCampaignLevelId] = React.useState(1)
  const [sessionLevelId, setSessionLevelId] = React.useState(1)
  const [menuLevelId, setMenuLevelId] = React.useState(() => pickMenuShowcaseLevelId())
  const [screen, setScreen] = React.useState<'menu' | 'game'>('menu')
  const [runNonce, setRunNonce] = React.useState(0)
  const [tutorialStepIndex, setTutorialStepIndex] = React.useState(0)
  const [endlessUnlocked, setEndlessUnlocked] = React.useState(false)
  const [debugMode, setDebugMode] = React.useState(initialMenuSettings.debugMode)
  const [debugLevelId, setDebugLevelId] = React.useState(initialMenuSettings.debugLevelId)
  const selectedMenuLevelId = debugMode ? debugLevelId : campaignLevelId
  const activeLevelId = screen === 'menu' ? menuLevelId : sessionLevelId

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(MENU_SETTINGS_STORAGE_KEY, JSON.stringify({ debugMode, debugLevelId }))
  }, [debugLevelId, debugMode])

  const playableConfig = React.useMemo(() => {
    if (screen === 'game' && sessionLevelId === 1) {
      return getLevelOneTutorialStep(tutorialStepIndex).config
    }

    return buildPlayableConfigFromLevel(activeLevelId)
  }, [activeLevelId, screen, sessionLevelId, tutorialStepIndex])
  const storeKey = `${screen}:${activeLevelId}:${runNonce}`
  const debugNextLevelId = getNextPlayableLevelId(sessionLevelId)
  const canAdvanceDebugRun = debugMode && debugNextLevelId !== null
  const canAdvanceCampaignRun = !debugMode && sessionLevelId < CAMPAIGN_FINAL_LEVEL_ID

  return (
    <GameStoreProvider config={playableConfig} storeKey={storeKey}>
      {screen === 'menu' ? (
        <MenuShell
          currentLevelId={selectedMenuLevelId}
          debugMode={debugMode}
          endlessUnlocked={endlessUnlocked}
          locale={locale}
          onDebugModeChange={setDebugMode}
          onLocaleChange={setLocale}
          onSelectedDebugLevelChange={(levelId) => setDebugLevelId(normalizeDebugLevelId(levelId))}
          onStart={() => {
          if (selectedMenuLevelId === 1) {
            setTutorialStepIndex(0)
          }
          setSessionLevelId(selectedMenuLevelId)
          setRunNonce((value) => value + 1)
          setScreen('game')
          }}
          selectedDebugLevelId={debugLevelId}
        />
      ) : (
        <LevelSessionShell
          key={`level-session-${sessionLevelId}-${runNonce}`}
          canAdvanceToNextLevel={canAdvanceDebugRun || canAdvanceCampaignRun}
          currentLevelId={sessionLevelId}
          debugMode={debugMode}
          tutorialStepIndex={tutorialStepIndex}
          onAdvanceTutorialStep={() => {
            setTutorialStepIndex((value) => value + 1)
            setRunNonce((value) => value + 1)
          }}
          onAdvanceLevel={() => {
            if (debugMode) {
              if (debugNextLevelId !== null) {
                setSessionLevelId(debugNextLevelId)
                setTutorialStepIndex(0)
                setRunNonce((value) => value + 1)
                return
              }

              setMenuLevelId(pickMenuShowcaseLevelId())
              setScreen('menu')
              return
            }

            if (sessionLevelId < CAMPAIGN_FINAL_LEVEL_ID) {
              setCampaignLevelId((value) => value + 1)
              setSessionLevelId((value) => value + 1)
              setTutorialStepIndex(0)
              setRunNonce((value) => value + 1)
              return
            }

            setEndlessUnlocked(true)
            setMenuLevelId(pickMenuShowcaseLevelId())
            setScreen('menu')
          }}
          onBackToLobby={() => {
            setTutorialStepIndex(0)
            setMenuLevelId(pickMenuShowcaseLevelId())
            setScreen('menu')
          }}
          onRetryLevel={() => {
            if (sessionLevelId === 1) {
              setTutorialStepIndex(0)
            }
            setRunNonce((value) => value + 1)
          }}
        />
      )}
    </GameStoreProvider>
  )
}

export function App() {
  return (
    <LocaleProvider>
      <CampaignRoot />
    </LocaleProvider>
  )
}
