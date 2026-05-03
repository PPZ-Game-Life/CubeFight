import React from 'react'

import { audioManager } from '../audio/audioManager'
import type { ComboTextKey } from '../game/model/types'
import { useGameStore } from '../game/state/gameStore'
import { useLocale } from './LocaleProvider'

type LevelHudObjective = {
  text: string
  complete: boolean
}

type LevelHudInfo = {
  levelLabel: string
  stepsRemaining: number | null
  objectives: LevelHudObjective[]
}

const rootStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: 'var(--hud-padding, 16px)',
  pointerEvents: 'none',
  color: '#f4f1ea',
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  zIndex: 10
}

const statBarStyle: React.CSSProperties = {
  alignSelf: 'center',
  width: 'min(var(--hud-stat-max-width, 820px), calc(100vw - var(--hud-padding, 16px) * 2))',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  pointerEvents: 'none'
}

const bottomRowStyle: React.CSSProperties = {
  alignSelf: 'stretch',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 'var(--hud-gap-lg, 16px)'
}

const bottomRowLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 'var(--hud-gap-sm, 8px)'
}

const glassPanelStyle: React.CSSProperties = {
  border: '1px solid rgba(255, 255, 255, 0.18)',
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(122, 142, 150, 0.18), rgba(45, 58, 68, 0.24))',
  boxShadow: '0 18px 42px rgba(12, 18, 24, 0.18)',
  backdropFilter: 'blur(16px) saturate(140%)'
}

const statCardStyle: React.CSSProperties = {
  ...glassPanelStyle,
  flex: '0 0 auto',
  minWidth: 0,
  padding: 'var(--hud-card-padding, 12px 16px 14px)'
}

const scorePillStyle: React.CSSProperties = {
  ...glassPanelStyle,
  pointerEvents: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  maxWidth: 'calc(100vw - 120px)',
  padding: 'var(--hud-hero-padding, 8px 18px 10px)',
  background: 'linear-gradient(180deg, rgba(132, 154, 170, 0.12), rgba(34, 47, 59, 0.1))'
}

const compactLabelStyle: React.CSSProperties = {
  fontSize: 'var(--hud-label-size, 9px)',
  lineHeight: 1,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(244, 241, 234, 0.68)'
}

const scoreValueStyle: React.CSSProperties = {
  marginTop: 'var(--hud-value-margin, 8px)',
  fontSize: 'var(--hud-score-size, 38px)',
  lineHeight: 1,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.02em',
  color: '#f7fbff',
  textShadow: '0 0 18px rgba(214, 233, 255, 0.22)'
}

const secondaryValueStyle: React.CSSProperties = {
  marginTop: 'var(--hud-value-margin, 8px)',
  fontSize: 'var(--hud-secondary-size, 30px)',
  lineHeight: 1.1,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  color: '#edf1ea'
}

const bombDockStyle: React.CSSProperties = {
  ...glassPanelStyle,
  pointerEvents: 'auto',
  width: 'var(--hud-bomb-width, 148px)',
  minHeight: 'var(--hud-bomb-height, 92px)',
  padding: 'var(--hud-bomb-padding, 14px 16px 16px)',
  appearance: 'none',
  cursor: 'pointer',
  textAlign: 'center',
  color: '#f4f1ea',
  transition: 'transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease, border-color 160ms ease',
  backgroundImage: 'linear-gradient(180deg, rgba(255, 214, 148, 0.16), rgba(63, 73, 82, 0.22))'
}

const utilityButtonStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  width: 'var(--hud-utility-size, 46px)',
  height: 'var(--hud-utility-size, 46px)',
  appearance: 'none',
  cursor: 'pointer',
  color: '#e7edf2',
  border: '1px solid rgba(255, 255, 255, 0.16)',
  borderRadius: 16,
  background: 'linear-gradient(180deg, rgba(122, 142, 150, 0.14), rgba(45, 58, 68, 0.22))',
  boxShadow: '0 12px 28px rgba(12, 18, 24, 0.18)',
  backdropFilter: 'blur(14px) saturate(140%)',
  transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease'
}

const objectivePanelStyle: React.CSSProperties = {
  ...glassPanelStyle,
  width: 'var(--hud-objective-width, min(280px, calc(100vw - 96px)))',
  padding: 'var(--hud-objective-padding, 12px 14px)'
}

const topRightStackStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'var(--hud-objective-top, var(--hud-padding, 16px))',
  right: 'var(--hud-objective-right, var(--hud-padding, 16px))',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 'var(--hud-gap-sm, 8px)',
  pointerEvents: 'none'
}

const fpsPanelStyle: React.CSSProperties = {
  ...glassPanelStyle,
  minWidth: 72,
  padding: '8px 12px 10px',
  pointerEvents: 'none'
}

const diagnosticsPanelStyle: React.CSSProperties = {
  ...glassPanelStyle,
  minWidth: 210,
  padding: '10px 12px 12px',
  pointerEvents: 'none'
}

const bombDockDisabledStyle: React.CSSProperties = {
  ...bombDockStyle,
  opacity: 0.56,
  cursor: 'not-allowed'
}

const bombCountStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--hud-bomb-gap, 8px)',
  marginTop: 'var(--hud-bomb-margin, 10px)',
  fontVariantNumeric: 'tabular-nums'
}

const bombCountValueStyle: React.CSSProperties = {
  fontSize: 'var(--hud-score-size, 34px)',
  lineHeight: 1,
  fontWeight: 700,
  color: '#fff4d7'
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(17, 24, 31, 0.34)',
  pointerEvents: 'auto'
}

const overlayCardStyle: React.CSSProperties = {
  ...glassPanelStyle,
  minWidth: 300,
  maxWidth: 380,
  padding: 28,
  textAlign: 'center',
  background: 'linear-gradient(180deg, rgba(132, 151, 160, 0.24), rgba(40, 52, 60, 0.28))'
}

const overlayActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginTop: 20
}

const restartButtonStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  appearance: 'none',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 14,
  padding: '12px 18px',
  background: 'rgba(255, 244, 215, 0.1)',
  color: '#f7f3ea',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer'
}

const overlayTitleStyle: React.CSSProperties = {
  margin: '10px 0 0',
  fontSize: 34,
  lineHeight: 1.05,
  color: '#f6f1e8'
}

function getComboText(comboText: ComboTextKey | null, comboTexts: Record<ComboTextKey, string>): string | null {
  if (!comboText) {
    return null
  }

  return comboTexts[comboText]
}

function StatCard({ label, value, style }: { label: string; value: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ ...statCardStyle, ...style }}>
      <div style={compactLabelStyle}>{label}</div>
      <div>{value}</div>
    </section>
  )
}

function ScorePill({ score, scoreLabel }: { score: number; scoreLabel: string }) {
  return (
    <section className="hud__score-pill" data-testid="hud-score-hero" style={scorePillStyle}>
      <div className="hud__score-pill-side hud__score-pill-side--score">
        <div style={compactLabelStyle}>{scoreLabel}</div>
        <div style={scoreValueStyle}>{score}</div>
      </div>
    </section>
  )
}

function useFpsCounter() {
  const [fps, setFps] = React.useState(0)

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return
    }

    let frameCount = 0
    let lastSampleTime = performance.now()
    let frameId = 0

    const tick = (now: number) => {
      frameCount += 1

      const elapsed = now - lastSampleTime
      if (elapsed >= 500) {
        setFps(Math.round((frameCount * 1000) / elapsed))
        frameCount = 0
        lastSampleTime = now
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  return fps
}

export function getFpsColor(fps: number) {
  if (fps >= 55) {
    return '#b8f3c8'
  }

  if (fps >= 30) {
    return '#ffe08a'
  }

  return '#ff9b9b'
}

function FpsPanel({ label, fps }: { label: string; fps: number }) {
  const fpsColor = getFpsColor(fps)

  return (
    <section className="hud__fps-panel" data-testid="hud-fps-panel" style={fpsPanelStyle}>
      <div style={compactLabelStyle}>{label}</div>
      <div style={{ ...secondaryValueStyle, marginTop: 6, fontSize: 20, color: fpsColor }}>{fps}</div>
    </section>
  )
}

function EndlessDiagnosticsPanel({
  dominantBlueId,
  dominantBlueState,
  pityCount,
  stage,
  t
}: {
  dominantBlueId: string | null
  dominantBlueState: 'active' | 'observe' | 'none'
  pityCount: number
  stage: 'early' | 'mid' | 'late' | 'endgame'
  t: ReturnType<typeof useLocale>['t']
}) {
  return (
    <section className="hud__endless-diagnostics-panel" data-testid="hud-endless-diagnostics-panel" style={diagnosticsPanelStyle}>
      <div style={compactLabelStyle}>{t.hud.endlessDiagnostics}</div>
      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
        <div style={{ ...compactLabelStyle, letterSpacing: '0.08em', lineHeight: 1.4 }}>{t.hud.endlessStageLabel}: {t.hud.endlessStages[stage]}</div>
        <div style={{ ...compactLabelStyle, letterSpacing: '0.08em', lineHeight: 1.4 }}>{t.hud.endlessDominantBlueLabel}: {dominantBlueId ?? t.hud.endlessNoDominantBlue}</div>
        <div style={{ ...compactLabelStyle, letterSpacing: '0.08em', lineHeight: 1.4 }}>{t.hud.endlessDominanceStateLabel}: {t.hud.endlessDominanceStates[dominantBlueState]}</div>
        <div style={{ ...compactLabelStyle, letterSpacing: '0.08em', lineHeight: 1.4 }}>{t.hud.endlessYellowPityLabel}: {pityCount}</div>
      </div>
    </section>
  )
}

function GameOverlay({ overlay, title, restartLabel, restartDemo }: {
  overlay: 'none' | 'pause' | 'victory' | 'game_over'
  title: string | null
  restartLabel: string
  restartDemo: () => void
}) {
  if (overlay !== 'victory' && overlay !== 'game_over') {
    return null
  }

  return (
    <div aria-label={title ?? undefined} role="dialog" style={overlayStyle}>
      <div style={overlayCardStyle}>
        <div style={compactLabelStyle}>CubeFight</div>
        <h2 style={overlayTitleStyle}>{title}</h2>
        <div style={overlayActionsStyle}>
          <button style={restartButtonStyle} type="button" onClick={restartDemo}>
            {restartLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function HUD({
  levelInfo,
  showEndlessDiagnostics = false,
  onBackToLobby,
  showFps = false,
  suppressResultOverlay = false
}: {
  levelInfo?: LevelHudInfo
  showEndlessDiagnostics?: boolean
  onBackToLobby: () => void
  showFps?: boolean
  suppressResultOverlay?: boolean
}) {
  const { t } = useLocale()
  const fps = useFpsCounter()
  const [audioMuted, setAudioMuted] = React.useState(() => audioManager.isUserMuted())
  const {
    cubes,
    comboCount,
    comboText,
    endlessDiagnostics,
    gridSize,
    overlay,
    restartDemo,
    score,
    ui
  } = useGameStore()

  const effectiveOverlay = suppressResultOverlay && (overlay === 'victory' || overlay === 'game_over') ? 'none' : overlay

  const localizedComboText = getComboText(comboText, t.hud.comboTexts)
  const showComboSurface = ui.showCombo && (comboCount > 0 || comboText !== null)
  const overlayTitle = effectiveOverlay === 'victory' ? t.hud.victory : effectiveOverlay === 'game_over' ? t.hud.gameOver : null
  const boardFillRatio = cubes.length / Math.pow(gridSize, 3)
  const showCrisisGlow = boardFillRatio >= 0.7

  return (
    <div className="hud" id="ui-overlay" style={rootStyle}>
      <div className="hud__top-right-stack" style={topRightStackStyle}>
        {showFps ? <FpsPanel fps={fps} label={t.hud.fps} /> : null}

        {showEndlessDiagnostics && endlessDiagnostics ? (
          <EndlessDiagnosticsPanel
            dominantBlueId={endlessDiagnostics.dominantBlueId}
            dominantBlueState={endlessDiagnostics.dominantBlueState}
            pityCount={endlessDiagnostics.yellowFamilyPityCount}
            stage={endlessDiagnostics.stage}
            t={t}
          />
        ) : null}

        {levelInfo ? (
          <section className="hud__level-panel" data-testid="hud-level-panel" style={objectivePanelStyle}>
            <div style={compactLabelStyle}>{levelInfo.levelLabel}</div>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {levelInfo.objectives.map((objective) => (
                <div key={objective.text} style={{ ...compactLabelStyle, color: objective.complete ? '#b8f3c8' : 'rgba(244, 241, 234, 0.78)', letterSpacing: '0.08em', lineHeight: 1.4 }}>
                  {objective.complete ? 'OK ' : ''}{objective.text}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="hud__stat-bar" data-testid="hud-stat-bar" style={statBarStyle}>
        <ScorePill score={score} scoreLabel={t.hud.score} />
      </div>

      {showComboSurface ? (
        <div aria-live="polite" className="hud__combo-callout" data-testid="hud-combo-callout">
          <span className="hud__combo-chip">x{comboCount}</span>
          {localizedComboText ? <span className="hud__combo-text">{localizedComboText}</span> : null}
        </div>
      ) : null}

      {showCrisisGlow ? <div className="hud__crisis-glow" data-testid="hud-crisis-glow" /> : null}

      <div className="hud__bottom-row" data-testid="hud-bottom-row" style={bottomRowStyle}>
        <div className="hud__bottom-row-left" style={bottomRowLeftStyle}>
          <button aria-label={t.hud.lobby} className="hud__lobby-button" data-testid="hud-lobby-button" style={utilityButtonStyle} type="button" onClick={() => {
            void audioManager.playUiConfirm()
            onBackToLobby()
          }}>
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>⌂</span>
          </button>

          <button aria-label={audioMuted ? t.hud.audioToggleOn : t.hud.audioToggleOff} aria-pressed={!audioMuted} className="hud__audio-button" data-testid="hud-audio-toggle" style={utilityButtonStyle} type="button" onClick={() => {
            const nextMuted = !audioMuted
            audioManager.setUserMuted(nextMuted)
            setAudioMuted(nextMuted)
            if (!nextMuted) {
              void audioManager.playUiConfirm()
            }
          }}>
            <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{audioMuted ? '🔇' : '🔊'}</span>
          </button>
        </div>

      </div>

      <GameOverlay overlay={effectiveOverlay} restartDemo={restartDemo} restartLabel={t.hud.restart} title={overlayTitle} />
    </div>
  )
}
