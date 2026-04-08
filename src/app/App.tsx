import React from 'react'

import { AudioRuntime } from '../audio/AudioRuntime'
import { audioManager } from '../audio/audioManager'
import { buildPlayableConfigFromLevel, getLevelById } from '../game/levels/levelCatalog'
import { buildPlayableEndlessConfig } from '../game/levels/endlessConfig'
import { getLevelOneTutorialStep, LEVEL_ONE_TUTORIAL_STEP_COUNT } from '../game/levels/levelOneTutorial'
import { evaluateLevel } from '../game/levels/levelProgress'
import type { Locale } from '../game/model/types'
import { getValidTargets } from '../game/state/demoRules'
import type { GameStoreSnapshot } from '../game/state/gameStore'
import { GameStoreProvider, useGameStore } from '../game/state/gameStore'
import { getVisibleValidTargets } from '../game/state/demoRules'
import {
  GRID_UNLOCK_THRESHOLDS,
  getHighestMergeLevel,
  getHighestUnlockedGridSize,
  getWeeklyLeaderboard,
  normalizeProgress,
  readStoredProgress,
  submitWeeklyLeaderboardScore,
  updateProgressFromEndlessRun,
  writeStoredProgress,
  type EndlessGridSize,
  type LeaderboardEntry,
  type PlayerProgress
} from './endlessProgress'
import { getIsNonReleaseBuild, readStoredDebugOptions, writeStoredDebugOptions } from './debugOptions'
import { LocaleProvider, useLocale } from '../ui/LocaleProvider'
import { HUD } from '../ui/HUD'
import { MainMenu } from '../ui/MainMenu'
import { SliceControls } from '../ui/SliceControls'
import { GameCanvas } from './GameCanvas'

type SessionOverlayState = 'victory' | 'game_over' | 'tutorial_complete' | null

const ENDLESS_LEVEL_ID = 999
const TUTORIAL_ADVANCE_DELAY_MS = 900

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

function getTutorialMessage(levelId: number, locale: Locale, tutorialInstruction?: Record<Locale, string> | null): string | null {
  if (levelId === 1 && tutorialInstruction) {
    return tutorialInstruction[locale]
  }

  return null
}

function getTutorialAllowedCubeIds(levelId: number, snapshot: GameStoreSnapshot, tutorialStepIndex: number): string[] | null {
  if (levelId !== 1) {
    return null
  }

  const tutorialStep = getLevelOneTutorialStep(tutorialStepIndex).step

  if (tutorialStep.kind === 'info') {
    return []
  }

  if (snapshot.selectedCubeId) {
    return [snapshot.selectedCubeId, ...snapshot.validTargetIds]
  }

  return tutorialStep.sourceCubeId ? [tutorialStep.sourceCubeId] : []
}

function getTutorialMarkerCubeIds(snapshot: GameStoreSnapshot, tutorialStepIndex: number): string[] {
  const tutorialStep = getLevelOneTutorialStep(tutorialStepIndex).step

  if (tutorialStep.kind === 'info') {
    return []
  }

  if (snapshot.selectedCubeId) {
    return tutorialStep.targetCubeId ? [tutorialStep.targetCubeId] : []
  }

  return tutorialStep.sourceCubeId ? [tutorialStep.sourceCubeId] : []
}

function formatHintStep(step: { action: 'split_merge' | 'split_devour'; [key: string]: unknown }) {
  return step.action === 'split_merge' ? 'Merge the highlighted same-color pair.' : 'Use blue to devour the matching prey block.'
}

function didCompleteTutorialStep(snapshot: GameStoreSnapshot, tutorialStepIndex: number) {
  const tutorialStep = getLevelOneTutorialStep(tutorialStepIndex).step

  if (tutorialStep.kind !== 'action' || !tutorialStep.completion) {
    return false
  }

  if (snapshot.runState === 'resolving' || snapshot.selectedCubeId !== null) {
    return false
  }

  if (tutorialStep.completion.type === 'merge') {
    return (snapshot.actionStats.mergeCounts[`${tutorialStep.completion.color}:${tutorialStep.completion.nextLevel}`] ?? 0) > 0
  }

  return (snapshot.actionStats.devourCounts[`${tutorialStep.completion.color}:${tutorialStep.completion.consumedLevel}`] ?? 0) > 0
}

function hasAnyLegalBoardAction(snapshot: GameStoreSnapshot) {
  return snapshot.cubes.some((cube) => {
    if (cube.color !== 'blue' && cube.color !== 'yellow') {
      return false
    }

    return getValidTargets(snapshot.cubes, cube.id).length > 0
  })
}

function SessionOverlay({
  sessionLabel,
  mode,
  canAdvance,
  canContinue,
  headlineOverride,
  onAdvance,
  onContinue,
  onRetry,
  onBackToLobby,
  onStartEndless
}: {
  sessionLabel: string
  mode: SessionOverlayState
  canAdvance: boolean
  canContinue: boolean
  headlineOverride?: string | null
  onAdvance: () => void
  onContinue: () => void
  onRetry: () => void
  onBackToLobby: () => void
  onStartEndless: () => void
}) {
  const { t } = useLocale()

  if (!mode) {
    return null
  }

  const isTutorialComplete = mode === 'tutorial_complete'
  const title = isTutorialComplete
    ? t.hud.tutorialCompleteTitle
    : (headlineOverride ?? (mode === 'victory' ? t.hud.victory : t.hud.gameOver))

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(8, 12, 20, 0.42)', pointerEvents: 'auto', zIndex: 30 }}>
      <div style={{ minWidth: 320, maxWidth: 420, borderRadius: 24, border: '1px solid rgba(255,255,255,0.16)', background: 'linear-gradient(180deg, rgba(132,151,160,0.22), rgba(26,35,44,0.32))', boxShadow: '0 18px 42px rgba(6,10,16,0.28)', backdropFilter: 'blur(16px) saturate(140%)', padding: 28, color: '#f7f3ea', textAlign: 'center' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(244, 241, 234, 0.66)' }}>{sessionLabel}</div>
        <h2 style={{ margin: '10px 0 0', fontSize: 34 }}>{title}</h2>
        {isTutorialComplete ? <div style={{ marginTop: 10, color: 'rgba(244, 241, 234, 0.82)', lineHeight: 1.55 }}>{t.hud.tutorialCompleteBody}</div> : null}
        <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
          {(canAdvance || isTutorialComplete) ? <button style={overlayButtonStyle(true)} type="button" onClick={isTutorialComplete ? onStartEndless : onAdvance}>{isTutorialComplete ? t.hud.startLevelTwo : 'Next Level'}</button> : null}
          {!isTutorialComplete && canContinue ? <button style={overlayButtonStyle(false)} type="button" onClick={onContinue}>{t.hud.continueRun}</button> : null}
          {!isTutorialComplete ? <button style={overlayButtonStyle(false)} type="button" onClick={onRetry}>{t.hud.restart}</button> : null}
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

function LevelSessionShell({
  currentLevelId,
  isEndlessSession,
  showEndlessDiagnostics,
  showFps,
  tutorialStepIndex,
  onAdvanceTutorialStep,
  onBackToLobby,
  onRetryLevel,
  onStartEndless,
  onCompleteTutorial,
  onCompleteEndlessRun
}: {
  currentLevelId: number
  isEndlessSession: boolean
  showEndlessDiagnostics: boolean
  showFps: boolean
  tutorialStepIndex: number
  onAdvanceTutorialStep: () => void
  onBackToLobby: () => void
  onRetryLevel: () => void
  onStartEndless: () => void
  onCompleteTutorial: () => void
  onCompleteEndlessRun: (summary: { score: number; maxMergeLevel: number }) => void
}) {
  const snapshot = useGameStore()
  const { locale, t } = useLocale()
  const level = React.useMemo(() => getLevelById(currentLevelId), [currentLevelId])
  const [sessionOverlay, setSessionOverlay] = React.useState<SessionOverlayState>(null)
  const evaluation = React.useMemo(() => evaluateLevel(snapshot, level), [level, snapshot])
  const tutorialBundle = React.useMemo(() => (currentLevelId === 1 ? getLevelOneTutorialStep(tutorialStepIndex) : null), [currentLevelId, tutorialStepIndex])
  const tutorialMessage = getTutorialMessage(currentLevelId, locale, tutorialBundle?.step.instruction)
  const [showHint, setShowHint] = React.useState(false)
  const [hasLockedVictory, setHasLockedVictory] = React.useState(false)
  const [continueAfterGoal, setContinueAfterGoal] = React.useState(false)
  const endlessRunReportedRef = React.useRef(false)
  const highestMergeLevelRef = React.useRef(getHighestMergeLevel(snapshot.cubes))
  const tutorialAdvanceTimerRef = React.useRef<number | null>(null)
  const lastQueuedTutorialStepRef = React.useRef<number | null>(null)
  const tutorialAllowedCubeIds = React.useMemo(() => getTutorialAllowedCubeIds(currentLevelId, snapshot, tutorialStepIndex), [currentLevelId, snapshot, tutorialStepIndex])
  const tutorialMarkerCubeIds = React.useMemo(() => (currentLevelId === 1 ? getTutorialMarkerCubeIds(snapshot, tutorialStepIndex) : []), [currentLevelId, snapshot, tutorialStepIndex])
  const sessionLabel = isEndlessSession
    ? `${t.menu.endlessMode} ${snapshot.gridSize}×${snapshot.gridSize}×${snapshot.gridSize}`
    : `Level ${String(currentLevelId).padStart(2, '0')}`

  const clearTutorialAdvanceTimer = React.useCallback(() => {
    if (tutorialAdvanceTimerRef.current !== null) {
      globalThis.clearTimeout(tutorialAdvanceTimerRef.current)
      tutorialAdvanceTimerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    setHasLockedVictory(false)
    setContinueAfterGoal(false)
    endlessRunReportedRef.current = false
    highestMergeLevelRef.current = getHighestMergeLevel(snapshot.cubes)
    clearTutorialAdvanceTimer()
    lastQueuedTutorialStepRef.current = null
  }, [clearTutorialAdvanceTimer, currentLevelId, isEndlessSession, tutorialStepIndex])

  React.useEffect(() => {
    highestMergeLevelRef.current = Math.max(highestMergeLevelRef.current, getHighestMergeLevel(snapshot.cubes))
  }, [snapshot.cubes])

  React.useEffect(() => {
    if (!isEndlessSession || snapshot.overlay !== 'game_over' || endlessRunReportedRef.current) {
      return
    }

    endlessRunReportedRef.current = true
    onCompleteEndlessRun({
      score: snapshot.score,
      maxMergeLevel: highestMergeLevelRef.current
    })
  }, [isEndlessSession, onCompleteEndlessRun, snapshot.overlay, snapshot.score])

  React.useEffect(() => () => {
    clearTutorialAdvanceTimer()
  }, [currentLevelId, tutorialStepIndex])

  React.useEffect(() => {
    if (currentLevelId !== 1 || !tutorialBundle) {
      return
    }

    if (didCompleteTutorialStep(snapshot, tutorialStepIndex)) {
      if (lastQueuedTutorialStepRef.current === tutorialStepIndex) {
        return
      }

      lastQueuedTutorialStepRef.current = tutorialStepIndex
      clearTutorialAdvanceTimer()
      tutorialAdvanceTimerRef.current = globalThis.setTimeout(() => {
        tutorialAdvanceTimerRef.current = null
        if (tutorialStepIndex >= LEVEL_ONE_TUTORIAL_STEP_COUNT - 1) {
          onCompleteTutorial()
          setSessionOverlay('tutorial_complete')
          return
        }

        onAdvanceTutorialStep()
      }, TUTORIAL_ADVANCE_DELAY_MS)
    }
  }, [clearTutorialAdvanceTimer, currentLevelId, onAdvanceTutorialStep, onCompleteTutorial, snapshot, tutorialBundle, tutorialStepIndex])

  React.useEffect(() => {
    if (currentLevelId === 1) {
      return
    }

    const hasScoreObjective = level.objectives.some((objective) => objective.type === 'score')
    const hasContinuableBoardAction = hasAnyLegalBoardAction(snapshot)
    const canContinueScoring = hasScoreObjective
      && evaluation.completed
      && hasContinuableBoardAction
      && !continueAfterGoal
      && !evaluation.failed
      && snapshot.overlay !== 'game_over'

    if (evaluation.completed) {
      setHasLockedVictory(true)

      if (canContinueScoring) {
        setSessionOverlay('victory')
        return
      }

      if (!hasScoreObjective) {
        setSessionOverlay('victory')
        return
      }
    }

    if (hasLockedVictory && (evaluation.failed || snapshot.overlay === 'game_over')) {
      setSessionOverlay('victory')
      return
    }

    if (evaluation.failed || snapshot.overlay === 'game_over') {
      setSessionOverlay('game_over')
      return
    }

    setSessionOverlay(null)
  }, [continueAfterGoal, currentLevelId, evaluation.completed, evaluation.failed, hasLockedVictory, level.objectives, snapshot.overlay])

  const hasScoreObjective = level.objectives.some((objective) => objective.type === 'score')
  const hasContinuableBoardAction = hasAnyLegalBoardAction(snapshot)
  const canContinueScoring = currentLevelId !== 1
    && hasScoreObjective
    && evaluation.completed
    && hasContinuableBoardAction
    && !continueAfterGoal
    && !evaluation.failed
    && snapshot.overlay !== 'game_over'

  const tutorialStep = tutorialBundle?.step
  const tutorialIsInfoStep = tutorialStep?.kind === 'info'
  const tutorialContinueLabel = tutorialStep?.continueLabel?.[locale] ?? (locale === 'zh-CN' ? '继续' : 'Continue')

  return (
    <>
      <AudioRuntime scene="game" />
      <GameCanvas allowedCubeIds={tutorialAllowedCubeIds} centerVisibleCubes={currentLevelId === 1} interactive={sessionOverlay === null} tutorialMarkerCubeIds={tutorialMarkerCubeIds} />
      <HUD onBackToLobby={onBackToLobby} showEndlessDiagnostics={showEndlessDiagnostics} showFps={showFps} suppressResultOverlay={currentLevelId === 1} />
      {currentLevelId !== 1 ? <SliceControls /> : null}
      {currentLevelId === 1 && tutorialMessage && !sessionOverlay ? (
        <div style={{ position: 'absolute', left: '50%', top: 132, transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 40px))', borderRadius: 18, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(8, 14, 24, 0.52)', boxShadow: '0 14px 28px rgba(4,8,14,0.18)', backdropFilter: 'blur(12px) saturate(140%)', padding: '14px 18px', color: '#eef4f8', zIndex: 20, pointerEvents: tutorialIsInfoStep ? 'auto' : 'none', textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(244,241,234,0.62)' }}>{locale === 'zh-CN' ? '教学' : 'Tutorial'}</div>
          <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{tutorialMessage}</div>
          {tutorialIsInfoStep ? (
            <button style={{ ...overlayButtonStyle(true), marginTop: 14, minWidth: 148 }} type="button" onClick={onAdvanceTutorialStep}>{tutorialContinueLabel}</button>
          ) : null}
          {tutorialStep?.objectiveText ? (
            <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.45, color: 'rgba(244,241,234,0.72)' }}>{tutorialStep.objectiveText[locale]}</div>
          ) : null}
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
        canAdvance={sessionOverlay === 'victory'}
        canContinue={sessionOverlay === 'victory' && canContinueScoring}
        headlineOverride={sessionOverlay === 'victory' && canContinueScoring ? t.hud.targetReached : null}
        mode={sessionOverlay}
        onAdvance={onBackToLobby}
        onBackToLobby={onBackToLobby}
        onContinue={() => {
          if (!canContinueScoring) {
            return
          }
          setContinueAfterGoal(true)
          setSessionOverlay(null)
        }}
        onStartEndless={onStartEndless}
        onRetry={onRetryLevel}
        sessionLabel={sessionLabel}
      />
    </>
  )
}

function MenuShell({
  progress,
  locale,
  leaderboardEntries,
  playerLeaderboardEntry,
  currentArenaGridSize,
  debugGridSize,
  debugMode,
  debugSettingsAvailable,
  nextUnlockTarget,
  onDebugGridSizeChange,
  onDebugModeChange,
  onResetTutorialProgress,
  onStartTutorial,
  onStartEndless,
  onLocaleChange
}: {
  progress: PlayerProgress
  locale: Locale
  leaderboardEntries: LeaderboardEntry[]
  playerLeaderboardEntry: LeaderboardEntry | null
  currentArenaGridSize: EndlessGridSize
  debugGridSize: EndlessGridSize
  debugMode: boolean
  debugSettingsAvailable: boolean
  nextUnlockTarget: { gridSize: EndlessGridSize; score: number } | null
  onDebugGridSizeChange: (gridSize: EndlessGridSize) => void
  onDebugModeChange: (enabled: boolean) => void
  onResetTutorialProgress: () => void
  onStartTutorial: () => void
  onStartEndless: () => void
  onLocaleChange: (locale: Locale) => void
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
      <AudioRuntime scene="menu" />
      <GameCanvas interactive={false} />
      <MainMenu
        currentLevelLabel={t.menu.currentLevel('Level 01')}
        currentArenaGridSize={currentArenaGridSize}
        debugGridSize={debugGridSize}
        debugMode={debugMode}
        debugSettingsAvailable={debugSettingsAvailable}
        endlessUnlocked={progress.endlessUnlocked}
        leaderboardEntries={leaderboardEntries}
        locale={locale}
        onDebugGridSizeChange={onDebugGridSizeChange}
        onDebugModeChange={onDebugModeChange}
        onResetTutorialProgress={onResetTutorialProgress}
        onLocaleChange={onLocaleChange}
        onStartTutorial={onStartTutorial}
        onStartEndless={onStartEndless}
        playerLeaderboardEntry={playerLeaderboardEntry}
        tutorialCompleted={progress.tutorialCompleted}
        nextUnlockTarget={nextUnlockTarget}
      />
    </>
  )
}

function CampaignRoot() {
  const { locale, setLocale } = useLocale()
  const initialProgress = React.useMemo(() => readStoredProgress(), [])
  const initialDebugOptions = React.useMemo(() => readStoredDebugOptions(), [])
  const debugSettingsAvailable = React.useMemo(() => getIsNonReleaseBuild(), [])
  const [sessionLevelId, setSessionLevelId] = React.useState(1)
  const [sessionGridSize, setSessionGridSize] = React.useState<EndlessGridSize>(getHighestUnlockedGridSize(initialProgress.bestScore))
  const [screen, setScreen] = React.useState<'menu' | 'game'>('menu')
  const [sessionMode, setSessionMode] = React.useState<'tutorial' | 'endless'>('tutorial')
  const [runNonce, setRunNonce] = React.useState(0)
  const [tutorialStepIndex, setTutorialStepIndex] = React.useState(0)
  const [progress, setProgress] = React.useState(initialProgress)
  const [debugMode, setDebugMode] = React.useState(initialDebugOptions.debugMode)
  const [debugGridSize, setDebugGridSize] = React.useState<EndlessGridSize>(initialDebugOptions.debugGridSize)
  const activeLevelId = sessionLevelId
  const leaderboard = React.useMemo(() => getWeeklyLeaderboard(progress), [progress])
  const currentArenaGridSize = React.useMemo(() => getHighestUnlockedGridSize(progress.bestScore), [progress.bestScore])
  const nextUnlockTarget = React.useMemo(() => {
    const unlockOrder: EndlessGridSize[] = [3, 4, 5]
    const nextGridSize = unlockOrder.find((size) => size > currentArenaGridSize)

    if (!nextGridSize) {
      return null
    }

    return {
      gridSize: nextGridSize,
      score: GRID_UNLOCK_THRESHOLDS[nextGridSize]
    }
  }, [currentArenaGridSize])

  React.useEffect(() => {
    writeStoredProgress(progress)
  }, [progress])

  React.useEffect(() => {
    writeStoredDebugOptions({ debugMode, debugGridSize })
  }, [debugGridSize, debugMode])

  React.useEffect(() => {
    const normalizedProgress = normalizeProgress(progress)
    if (normalizedProgress.preferredGridSize !== progress.preferredGridSize) {
      setProgress(normalizedProgress)
      return
    }

    setSessionGridSize((current) => (current === getHighestUnlockedGridSize(normalizedProgress.bestScore) ? current : getHighestUnlockedGridSize(normalizedProgress.bestScore)))
  }, [progress])

  const startTutorial = React.useCallback(() => {
    void audioManager.playUiConfirm()
    setSessionMode('tutorial')
    setTutorialStepIndex(0)
    setSessionLevelId(1)
    setRunNonce((value) => value + 1)
    setScreen('game')
  }, [])

  const startEndless = React.useCallback(() => {
    void audioManager.playUiConfirm()
    setSessionMode('endless')
    setTutorialStepIndex(0)
    setSessionLevelId(ENDLESS_LEVEL_ID)
    setSessionGridSize(debugMode ? debugGridSize : currentArenaGridSize)
    setRunNonce((value) => value + 1)
    setScreen('game')
  }, [currentArenaGridSize, debugGridSize, debugMode])

  const playableConfig = React.useMemo(() => {
    if (screen === 'game' && sessionMode === 'tutorial' && sessionLevelId === 1) {
      return getLevelOneTutorialStep(tutorialStepIndex).config
    }

    if (screen === 'game' && sessionMode === 'endless') {
      return buildPlayableEndlessConfig(sessionGridSize)
    }

    if (screen === 'menu') {
      return buildPlayableEndlessConfig(3)
    }

    return buildPlayableConfigFromLevel(activeLevelId)
  }, [activeLevelId, screen, sessionGridSize, sessionLevelId, sessionMode, tutorialStepIndex])
  const tutorialStoreSegment = screen === 'game' && sessionMode === 'tutorial' && sessionLevelId === 1 ? `:tutorial-${tutorialStepIndex}` : ''
  const storeKey = `${screen}:${activeLevelId}:${sessionGridSize}:${runNonce}${tutorialStoreSegment}`

  return (
    <GameStoreProvider config={playableConfig} storeKey={storeKey}>
      {screen === 'menu' ? (
        <MenuShell
          currentArenaGridSize={currentArenaGridSize}
          debugGridSize={debugGridSize}
          debugMode={debugMode}
          debugSettingsAvailable={debugSettingsAvailable}
          leaderboardEntries={leaderboard.entries}
          locale={locale}
          onDebugGridSizeChange={setDebugGridSize}
          onDebugModeChange={setDebugMode}
          onResetTutorialProgress={() => {
            setTutorialStepIndex(0)
            setSessionMode('tutorial')
            setSessionLevelId(1)
            setProgress((current) => normalizeProgress({
              ...current,
              tutorialCompleted: false,
              endlessUnlocked: false
            }))
          }}
          onLocaleChange={setLocale}
          onStartTutorial={startTutorial}
          onStartEndless={startEndless}
          playerLeaderboardEntry={leaderboard.playerEntry}
          progress={progress}
          nextUnlockTarget={nextUnlockTarget}
        />
      ) : (
        <LevelSessionShell
          key={`level-session-${sessionLevelId}-${runNonce}`}
          currentLevelId={sessionLevelId}
          isEndlessSession={sessionMode === 'endless'}
          showEndlessDiagnostics={debugMode && sessionMode === 'endless'}
          showFps={debugMode}
          tutorialStepIndex={tutorialStepIndex}
          onCompleteTutorial={() => {
            setProgress((current) => normalizeProgress({
              ...current,
              tutorialCompleted: true,
              endlessUnlocked: true
            }))
          }}
          onCompleteEndlessRun={({ score, maxMergeLevel }) => {
            setProgress((current) => {
              const nextProgress = updateProgressFromEndlessRun(current, score, maxMergeLevel)
              submitWeeklyLeaderboardScore(nextProgress, score, maxMergeLevel)
              return nextProgress
            })
          }}
          onAdvanceTutorialStep={() => {
            setTutorialStepIndex((value) => value + 1)
          }}
          onBackToLobby={() => {
            setTutorialStepIndex(0)
            setScreen('menu')
          }}
          onStartEndless={startEndless}
          onRetryLevel={() => {
            if (sessionMode === 'tutorial' && sessionLevelId === 1) {
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
