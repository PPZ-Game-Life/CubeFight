import React from 'react'

import { audioManager } from '../audio/audioManager'
import type { Locale } from '../game/model/types'
import type { EndlessGridSize, LeaderboardEntry } from '../app/endlessProgress'
import { useLocale } from './LocaleProvider'
import { GameRulesDialog } from './GameRulesDialog'

type MainMenuProps = {
  currentArenaGridSize: EndlessGridSize
  currentLevelLabel?: string
  debugGridSize: EndlessGridSize
  debugMode: boolean
  debugSettingsAvailable: boolean
  tutorialCompleted?: boolean
  endlessUnlocked?: boolean
  leaderboardEntries: LeaderboardEntry[]
  locale: Locale
  onDebugGridSizeChange: (gridSize: EndlessGridSize) => void
  onDebugModeChange: (enabled: boolean) => void
  onResetTutorialProgress: () => void
  onStartTutorial: () => void
  onStartEndless: () => void
  onLocaleChange: (locale: Locale) => void
  playerLeaderboardEntry: LeaderboardEntry | null
  nextUnlockTarget: { gridSize: EndlessGridSize; score: number } | null
}

export function MainMenu({
  currentArenaGridSize,
  currentLevelLabel,
  debugGridSize,
  debugMode,
  debugSettingsAvailable,
  tutorialCompleted,
  endlessUnlocked,
  leaderboardEntries,
  locale,
  onDebugGridSizeChange,
  onDebugModeChange,
  onResetTutorialProgress,
  onStartTutorial,
  onStartEndless,
  onLocaleChange,
  playerLeaderboardEntry,
  nextUnlockTarget
}: MainMenuProps) {
  const { t } = useLocale()
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = React.useState(false)
  const [rulesOpen, setRulesOpen] = React.useState(false)
  const [audioVolume, setAudioVolume] = React.useState(() => audioManager.getUserVolume())

  React.useEffect(() => {
    setAudioVolume(audioManager.getUserVolume())
  }, [])

  return (
    <div className="main-menu" data-testid="main-menu">
      <div className="main-menu__backdrop" />

      <header className="main-menu__header">
        <div className="main-menu__brand-lockup">
          <div aria-hidden="true" className="main-menu__hero-shell main-menu__hero-shell--brand" data-testid="main-menu-hero">
            <div className="main-menu__hero-aura main-menu__hero-aura--blue" />
            <div className="main-menu__hero-aura main-menu__hero-aura--red" />
            <div className="main-menu__hero-aura main-menu__hero-aura--amber" />
            <div className="main-menu__hero-shadow" />
            <div className="main-menu__hero-prop">
              <div className="main-menu__hero-shell-glass" />
              <div className="main-menu__hero-shell-rim" />
              <div className="main-menu__hero-gloss" />
              <div className="main-menu__hero-core-glow" />
              <div className="main-menu__hero-core" />
              <div className="main-menu__hero-frame main-menu__hero-frame--one" />
              <div className="main-menu__hero-frame main-menu__hero-frame--two" />
            </div>
          </div>

          <div className="main-menu__logo-block">
            <div className="main-menu__logo-kicker">Cube Arena</div>
            <h1 className="main-menu__logo" data-testid="main-menu-logo">{t.title}</h1>
          </div>
        </div>
      </header>

      <main className="main-menu__centerpiece">
        <div className="main-menu__action-stack" data-testid="main-menu-actions">
          {!tutorialCompleted ? (
            <button className="main-menu__action main-menu__action--play" data-testid="main-menu-start" type="button" onClick={onStartTutorial}>
              <span className="main-menu__action-title">{t.menu.startGame}</span>
              <span className="main-menu__action-subtitle">{currentLevelLabel ?? t.menu.currentLevel('Level 01')}</span>
            </button>
          ) : (
            <button className="main-menu__action main-menu__action--play" data-testid="main-menu-start-endless" type="button" onClick={onStartEndless}>
              <span className="main-menu__action-title">{t.menu.startGame}</span>
              <span className="main-menu__action-subtitle">
                {debugMode
                  ? t.menu.debugStartHint(debugGridSize)
                  : nextUnlockTarget
                  ? t.menu.startGameHint(currentArenaGridSize, nextUnlockTarget.gridSize, nextUnlockTarget.score)
                  : t.menu.startGameHintMax(currentArenaGridSize)}
              </span>
            </button>
          )}

          <div className="main-menu__secondary-actions">
            <button className="main-menu__action main-menu__action--secondary" data-testid="main-menu-leaderboard" type="button" onClick={() => {
              if (!endlessUnlocked) {
                void audioManager.playUiConfirm()
                return
              }

              void audioManager.playUiConfirm()
              setLeaderboardOpen(true)
            }}>
              <span className="main-menu__action-title">{t.menu.leaderboard}</span>
              <span className="main-menu__action-subtitle">{endlessUnlocked ? t.menu.leaderboardHint : t.menu.unlockHint}</span>
            </button>

            <button className="main-menu__action main-menu__action--secondary" data-testid="main-menu-settings" type="button" onClick={() => {
              void audioManager.playUiConfirm()
              setSettingsOpen(true)
            }}>
              <span className="main-menu__action-title">{t.menu.settings}</span>
              <span className="main-menu__action-subtitle">{t.menu.help}</span>
            </button>
          </div>
        </div>
      </main>

      {settingsOpen ? (
        <div aria-modal="true" className="main-menu__settings-overlay" role="dialog" data-testid="main-menu-settings-dialog">
          <div className="main-menu__settings-card">
            <div className="main-menu__settings-header">
              <div>
                <div className="main-menu__settings-kicker">CubeFight</div>
                <h2 className="main-menu__settings-title">{t.menu.settingsTitle}</h2>
              </div>
              <button className="main-menu__settings-close" type="button" onClick={() => {
                void audioManager.playUiConfirm()
                setSettingsOpen(false)
                setRulesOpen(false)
              }}>
                {t.menu.closeSettings}
              </button>
            </div>

            <section className="main-menu__settings-section">
              <button className="main-menu__action main-menu__action--secondary main-menu__settings-rule-button" data-testid="main-menu-game-rules" type="button" onClick={() => {
                void audioManager.playUiConfirm()
                setRulesOpen(true)
              }}>
                <span className="main-menu__action-title">{t.menu.gameRules}</span>
                <span className="main-menu__action-subtitle">{t.menu.gameRulesHint}</span>
              </button>
            </section>

            <section className="main-menu__settings-section">
              <div className="main-menu__settings-label">{t.menu.volume}</div>
              <div className="main-menu__settings-hint">{t.menu.volumeHint}</div>
              <div className="main-menu__volume-row">
                <input
                  aria-label={t.menu.volume}
                  className="main-menu__volume-slider"
                  data-testid="main-menu-volume-slider"
                  max={100}
                  min={0}
                  type="range"
                  value={Math.round(audioVolume * 100)}
                  onChange={(event) => {
                    const nextVolume = Number(event.currentTarget.value) / 100
                    audioManager.setUserVolume(nextVolume)
                    setAudioVolume(nextVolume)
                  }}
                />
                <div className="main-menu__volume-value">{t.menu.volumeLevel(Math.round(audioVolume * 100))}</div>
              </div>
            </section>

            <section className="main-menu__settings-section">
              <div className="main-menu__settings-label">{t.menu.language}</div>
              <div className="main-menu__segmented" role="group" aria-label={t.menu.language}>
                {(['zh-CN', 'en'] as Locale[]).map((localeOption) => (
                  <button
                    key={localeOption}
                    className={`main-menu__segmented-option${locale === localeOption ? ' is-active' : ''}`}
                    data-testid={`main-menu-locale-${localeOption}`}
                    type="button"
                    onClick={() => {
                      void audioManager.playUiConfirm()
                      onLocaleChange(localeOption)
                    }}
                  >
                    {t.menu.languageOptions[localeOption]}
                  </button>
                ))}
              </div>
            </section>

            {debugSettingsAvailable ? (
              <section className="main-menu__settings-section">
                <div className="main-menu__toggle-row">
                  <div>
                    <div className="main-menu__settings-label">{t.menu.debugMode}</div>
                    <div className="main-menu__settings-hint">{t.menu.debugModeHint}</div>
                  </div>
                  <input
                    checked={debugMode}
                    data-testid="main-menu-debug-toggle"
                    type="checkbox"
                    onChange={(event) => {
                      void audioManager.playUiConfirm()
                      onDebugModeChange(event.currentTarget.checked)
                    }}
                  />
                </div>

                {debugMode ? (
                  <div className="main-menu__select-row">
                    <div className="main-menu__settings-label" style={{ marginTop: 16 }}>{t.menu.debugGridSize}</div>
                    <div className="main-menu__segmented" role="group" aria-label={t.menu.debugGridSize}>
                      {([3, 4, 5] as EndlessGridSize[]).map((gridSize) => (
                        <button
                          key={gridSize}
                          className={`main-menu__segmented-option${debugGridSize === gridSize ? ' is-active' : ''}`}
                          data-testid={`main-menu-debug-grid-${gridSize}`}
                          type="button"
                          onClick={() => {
                            void audioManager.playUiConfirm()
                            onDebugGridSizeChange(gridSize)
                          }}
                        >
                          {gridSize}×{gridSize}×{gridSize}
                        </button>
                      ))}
                    </div>

                    <button
                      className="main-menu__settings-close"
                      data-testid="main-menu-reset-tutorial-progress"
                      style={{ marginTop: 16, width: '100%' }}
                      type="button"
                      onClick={() => {
                        void audioManager.playUiConfirm()
                        onResetTutorialProgress()
                      }}
                    >
                      {t.menu.resetTutorialProgress}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {rulesOpen ? <GameRulesDialog onClose={() => setRulesOpen(false)} testId="main-menu-rules-dialog" /> : null}

      {leaderboardOpen ? (
        <div aria-modal="true" className="main-menu__settings-overlay" role="dialog" data-testid="main-menu-leaderboard-dialog">
          <div className="main-menu__settings-card" style={{ maxWidth: 560 }}>
            <div className="main-menu__settings-header">
              <div>
                <div className="main-menu__settings-kicker">CubeFight</div>
                <h2 className="main-menu__settings-title">{t.menu.leaderboard}</h2>
              </div>
              <button className="main-menu__settings-close" type="button" onClick={() => {
                void audioManager.playUiConfirm()
                setLeaderboardOpen(false)
              }}>
                {t.menu.closeLeaderboard}
              </button>
            </div>

            <section className="main-menu__settings-section">
              <div className="main-menu__settings-label">{t.menu.weeklyLadder}</div>
              <div className="main-menu__settings-hint">{t.menu.weeklyLadderHint}</div>
              {leaderboardEntries.length > 0 ? (
                <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
                  {leaderboardEntries.slice(0, 8).map((entry) => (
                  <div key={`${entry.playerId}-${entry.rank}`} data-testid={`leaderboard-entry-${entry.rank}`} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) 120px 92px', alignItems: 'center', gap: 12, borderRadius: 16, padding: '12px 14px', border: entry.isCurrentPlayer ? '1px solid rgba(255,204,85,0.42)' : '1px solid rgba(255,255,255,0.08)', background: entry.isCurrentPlayer ? 'rgba(255,204,85,0.12)' : 'rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(244,241,234,0.62)' }}>#{entry.rank}</div>
                    <div style={{ minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.playerId}</div>
                    <div style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{entry.score}</div>
                    <div style={{ fontSize: 12, color: 'rgba(244,241,234,0.74)', textAlign: 'right' }}>Lv.{entry.maxMergeLevel}</div>
                  </div>
                  ))}
                </div>
              ) : (
                <div data-testid="leaderboard-empty" style={{ marginTop: 16, borderRadius: 16, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(244,241,234,0.76)' }}>{t.menu.noLocalRecord}</div>
              )}
            </section>

            {playerLeaderboardEntry ? (
              <section className="main-menu__settings-section">
                <div className="main-menu__settings-label">{t.menu.yourRank}</div>
                <div style={{ marginTop: 12, borderRadius: 18, border: '1px solid rgba(255,204,85,0.38)', background: 'rgba(255,204,85,0.12)', padding: '14px 16px', display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) 120px 92px', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,241,198,0.78)' }}>#{playerLeaderboardEntry.rank}</div>
                  <div style={{ minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{playerLeaderboardEntry.playerId}</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{playerLeaderboardEntry.score}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,241,198,0.78)', textAlign: 'right' }}>Lv.{playerLeaderboardEntry.maxMergeLevel}</div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
