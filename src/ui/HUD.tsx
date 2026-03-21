import React from 'react'

import type { ComboTextKey, GameOverlay, StatusHintKey } from '../game/model/types'
import { useGameStore } from '../game/state/gameStore'
import { useLocale } from './LocaleProvider'

const overlayLabels: Record<Exclude<GameOverlay, 'none'>, 'paused' | 'victory' | 'gameOver'> = {
  pause: 'paused',
  victory: 'victory',
  game_over: 'gameOver'
}

const rootStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: 16,
  color: '#f5f7fb',
  fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif'
}

const topRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'flex-start',
  justifyContent: 'space-between'
}

const bottomRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'flex-end',
  justifyContent: 'space-between'
}

const clusterStyle: React.CSSProperties = {
  display: 'flex',
  flex: '1 1 320px',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'stretch',
  minWidth: 0
}

const surfaceStyle: React.CSSProperties = {
  flex: '1 1 120px',
  minWidth: 0,
  padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 14,
  background: 'rgba(10, 18, 31, 0.72)',
  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
  backdropFilter: 'blur(10px)'
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(235, 242, 255, 0.74)'
}

const valueStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1
}

const hintStyle: React.CSSProperties = {
  ...surfaceStyle,
  flex: '999 1 260px',
  width: '100%',
  maxWidth: 380
}

const actionButtonStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  appearance: 'none',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 12,
  padding: '12px 16px',
  background: 'rgba(14, 25, 41, 0.84)',
  color: '#f5f7fb',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
  maxWidth: '100%'
}

const actionButtonDisabledStyle: React.CSSProperties = {
  ...actionButtonStyle,
  opacity: 0.45,
  cursor: 'not-allowed'
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(3, 8, 15, 0.6)',
  pointerEvents: 'auto'
}

const overlayCardStyle: React.CSSProperties = {
  minWidth: 280,
  maxWidth: 360,
  padding: 24,
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'linear-gradient(180deg, rgba(18, 31, 50, 0.96), rgba(9, 18, 32, 0.96))',
  boxShadow: '0 22px 48px rgba(0, 0, 0, 0.32)',
  textAlign: 'center'
}

const overlayActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  justifyContent: 'center',
  flexWrap: 'wrap',
  marginTop: 20
}

function getHintText(
  statusHintKey: StatusHintKey | null,
  statusHints: Record<StatusHintKey, string>
): string | null {
  if (!statusHintKey) {
    return null
  }

  return statusHints[statusHintKey]
}

function getComboText(comboText: ComboTextKey | null, comboTexts: Record<ComboTextKey, string>): string | null {
  if (!comboText) {
    return null
  }

  return comboTexts[comboText]
}

function Surface({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <section style={surfaceStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </section>
  )
}

export function HUD() {
  const { t } = useLocale()
  const {
    bombCount,
    coins,
    comboCount,
    comboText,
    overlay,
    pauseGame,
    restartDemo,
    resumeGame,
    runState,
    score,
    statusHintKey,
    ui,
    activateBomb,
    cancelTargeting
  } = useGameStore()

  const hintText = getHintText(statusHintKey, t.hud.statusHints)
  const localizedComboText = getComboText(comboText, t.hud.comboTexts)
  const showComboSurface = ui.showCombo && (comboCount > 0 || comboText !== null)
  const showPauseButton = ui.showPause && overlay === 'none'
  const bombVisuallyDisabled = bombCount <= 0
  const bombInteractionDisabled = overlay !== 'none' || runState === 'resolving'
  const bombDisabled = bombVisuallyDisabled || bombInteractionDisabled
  const bombActive = runState === 'targeting_bomb'
  const overlayTitle = overlay === 'none' ? null : t.hud[overlayLabels[overlay]]

  return (
    <div id="ui-overlay" style={rootStyle}>
      <div style={topRowStyle}>
        <div style={clusterStyle}>
          <Surface label={t.hud.score} value={score} />
          {showComboSurface ? <Surface label={t.hud.combo} value={localizedComboText ? `x${comboCount} ${localizedComboText}` : comboCount} /> : null}
          <Surface label={t.coins} value={coins} />
        </div>
        {showPauseButton ? (
          <button style={{ ...actionButtonStyle, flex: '0 1 auto' }} type="button" onClick={pauseGame}>
            {t.hud.pause}
          </button>
        ) : null}
      </div>

      <div style={bottomRowStyle}>
        <section style={hintStyle}>
          <div style={labelStyle}>{t.hud.status}</div>
          <div style={{ marginTop: 8, fontSize: 16, lineHeight: 1.4 }}>{hintText}</div>
        </section>

        <button
          aria-label={t.hud.bombs}
          aria-disabled={bombDisabled}
          aria-pressed={bombActive}
          disabled={bombInteractionDisabled}
          style={{ ...(bombDisabled ? actionButtonDisabledStyle : actionButtonStyle), flex: '1 1 160px' }}
          type="button"
          onClick={bombActive ? cancelTargeting : () => {
            if (bombInteractionDisabled) {
              return
            }

            activateBomb()
          }}
        >
          <span style={{ ...labelStyle, display: 'block', color: 'inherit' }}>{t.hud.bombs}</span>
          <span style={{ display: 'block', marginTop: 6, fontSize: 24 }}>{bombCount}</span>
        </button>
      </div>

      {overlay !== 'none' ? (
        <div aria-label={overlayTitle ?? undefined} role="dialog" style={overlayStyle}>
          <div style={overlayCardStyle}>
            <div style={{ ...labelStyle, color: 'rgba(235, 242, 255, 0.8)' }}>{t.title}</div>
            <h2 style={{ margin: '10px 0 0', fontSize: 32 }}>{overlayTitle}</h2>
            <div style={overlayActionsStyle}>
              {overlay === 'pause' ? (
                <button style={actionButtonStyle} type="button" onClick={resumeGame}>
                  {t.hud.resume}
                </button>
              ) : null}
              <button style={actionButtonStyle} type="button" onClick={restartDemo}>
                {t.hud.restart}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
