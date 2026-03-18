import React from 'react'
import { useGameStore } from '../game/state/gameStore'
import { useLocale } from './LocaleProvider'

export function HUD() {
  const { t } = useLocale()
  const { score, coins, comboCount, comboText, gameOver } = useGameStore()

  return (
    <div id="ui-overlay">
      <div id="score">{t.score}: {score} | {t.coins}: {coins}{comboCount > 1 ? ` | Combo x${comboCount}` : ''}</div>
      <div id="info">
        <div>🎮 {t.title}</div>
        <div style={{ fontSize: 12, marginTop: 5 }}>{t.modeEndless}</div>
      </div>
      {comboText ? (
        <div style={{
          position: 'absolute',
          top: '22%',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#fff',
          fontSize: 28,
          fontWeight: 'bold',
          textShadow: '0 4px 12px rgba(0,0,0,0.45)',
          pointerEvents: 'none'
        }}>
          {t.combo} x{comboCount} · {comboText}
        </div>
      ) : null}
      {gameOver ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)',
          color: '#fff',
          fontSize: 42,
          fontWeight: 'bold',
          textShadow: '0 6px 16px rgba(0,0,0,0.45)',
          pointerEvents: 'none'
        }}>
          {t.gameOver}
        </div>
      ) : null}
    </div>
  )
}
