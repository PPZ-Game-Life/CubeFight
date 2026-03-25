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
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif'
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

const bottomRowRightStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'flex-end',
  gap: 'var(--hud-gap-lg, 16px)',
  pointerEvents: 'none'
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

const debugDockStyle: React.CSSProperties = {
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
  backgroundImage: 'linear-gradient(180deg, rgba(145, 220, 255, 0.14), rgba(48, 71, 92, 0.24))'
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
  pointerEvents: 'auto',
  position: 'absolute',
  top: 'var(--hud-objective-top, var(--hud-padding, 16px))',
  right: 'var(--hud-objective-right, var(--hud-padding, 16px))',
  width: 'var(--hud-objective-width, min(280px, calc(100vw - 96px)))',
  padding: 'var(--hud-objective-padding, 12px 14px)'
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
  onBackToLobby,
  debugAction,
  suppressResultOverlay = false
}: {
  levelInfo?: LevelHudInfo
  onBackToLobby: () => void
  debugAction?: { active: boolean; onToggle: () => void } | null
  suppressResultOverlay?: boolean
}) {
  const { t } = useLocale()
  const {
    cubes,
    comboCount,
    comboText,
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
        <button aria-label={t.hud.lobby} className="hud__lobby-button" data-testid="hud-lobby-button" style={utilityButtonStyle} type="button" onClick={() => {
          void audioManager.playUiConfirm()
          onBackToLobby()
        }}>
          <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>⌂</span>
        </button>

        <div className="hud__bottom-row-right" style={bottomRowRightStyle}>
          {debugAction ? (
            <button
              aria-label={debugAction.active ? t.hud.stopAutoSolve : t.hud.autoSolve}
              className="hud__debug-dock"
              data-testid="hud-debug-auto-solve"
              style={{
                ...debugDockStyle,
                borderColor: debugAction.active ? 'rgba(133, 228, 184, 0.34)' : 'rgba(255, 255, 255, 0.18)',
                backgroundImage: debugAction.active
                  ? 'linear-gradient(180deg, rgba(133, 228, 184, 0.18), rgba(45, 88, 69, 0.26))'
                  : debugDockStyle.backgroundImage
              }}
              type="button"
               onClick={() => {
                 void audioManager.playUiConfirm()
                 debugAction.onToggle()
               }}
             >
              <div style={compactLabelStyle}>Debug</div>
              <div style={{ ...secondaryValueStyle, marginTop: 10, fontSize: 20, color: debugAction.active ? '#b8f3c8' : '#dceef9' }}>
              {debugAction.active ? t.hud.stopAutoSolve : t.hud.autoSolve}
            </div>
          </button>
          ) : null}
        </div>
      </div>

      <GameOverlay overlay={effectiveOverlay} restartDemo={restartDemo} restartLabel={t.hud.restart} title={overlayTitle} />
    </div>
  )
}
