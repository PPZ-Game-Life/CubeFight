import React from 'react'

import type { Locale } from '../game/model/types'
import { useLocale } from './LocaleProvider'

type MainMenuProps = {
  currentLevelLabel?: string
  endlessUnlocked?: boolean
  locale: Locale
  debugMode: boolean
  selectableLevels: number[]
  selectedLevelId: number
  onStart: () => void
  onLocaleChange: (locale: Locale) => void
  onDebugModeChange: (enabled: boolean) => void
  onSelectedLevelChange: (levelId: number) => void
}

export function MainMenu({
  currentLevelLabel,
  endlessUnlocked,
  locale,
  debugMode,
  selectableLevels,
  selectedLevelId,
  onStart,
  onLocaleChange,
  onDebugModeChange,
  onSelectedLevelChange
}: MainMenuProps) {
  const { t } = useLocale()
  const [settingsOpen, setSettingsOpen] = React.useState(false)

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
            <div className="main-menu__logo-kicker">AI Cube Arena</div>
            <h1 className="main-menu__logo" data-testid="main-menu-logo">{t.title}</h1>
          </div>
        </div>
      </header>

      <main className="main-menu__centerpiece">
        <div className="main-menu__action-stack" data-testid="main-menu-actions">
          <button className="main-menu__action main-menu__action--play" data-testid="main-menu-start" type="button" onClick={onStart}>
            <span className="main-menu__action-title">{t.menu.startJourney}</span>
            <span className="main-menu__action-subtitle">{currentLevelLabel ?? t.menu.currentLevel('Level 01')}</span>
          </button>

          <button className="main-menu__action main-menu__action--secondary" type="button">
            <span className="main-menu__action-title">{t.menu.skinShop}</span>
            <span className="main-menu__action-subtitle">{t.menu.skinTeaser}</span>
          </button>

          <button className="main-menu__action main-menu__action--secondary" type="button">
            <span className="main-menu__action-title">{t.menu.leaderboard}</span>
            <span className="main-menu__action-subtitle">{endlessUnlocked ? t.menu.leaderboardHint : t.menu.unlockHint}</span>
          </button>

          <button className="main-menu__action main-menu__action--secondary" data-testid="main-menu-settings" type="button" onClick={() => setSettingsOpen(true)}>
            <span className="main-menu__action-title">{t.menu.settings}</span>
            <span className="main-menu__action-subtitle">{debugMode ? t.menu.debugActive : t.menu.help}</span>
          </button>
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
              <button className="main-menu__settings-close" type="button" onClick={() => setSettingsOpen(false)}>
                {t.menu.closeSettings}
              </button>
            </div>

            <section className="main-menu__settings-section">
              <div className="main-menu__settings-label">{t.menu.language}</div>
              <div className="main-menu__segmented" role="group" aria-label={t.menu.language}>
                {(['zh-CN', 'en'] as Locale[]).map((localeOption) => (
                  <button
                    key={localeOption}
                    className={`main-menu__segmented-option${locale === localeOption ? ' is-active' : ''}`}
                    data-testid={`main-menu-locale-${localeOption}`}
                    type="button"
                    onClick={() => onLocaleChange(localeOption)}
                  >
                    {t.menu.languageOptions[localeOption]}
                  </button>
                ))}
              </div>
            </section>

            <section className="main-menu__settings-section">
              <label className="main-menu__toggle-row">
                <span>
                  <span className="main-menu__settings-label">{t.menu.debugMode}</span>
                  <span className="main-menu__settings-hint">{t.menu.debugModeHint}</span>
                </span>
                <input
                  checked={debugMode}
                  data-testid="main-menu-debug-toggle"
                  type="checkbox"
                  onChange={(event) => onDebugModeChange(event.target.checked)}
                />
              </label>
            </section>

            {debugMode ? (
              <section className="main-menu__settings-section">
                <label className="main-menu__select-row" htmlFor="debug-level-select">
                  <span className="main-menu__settings-label">{t.menu.debugLevel}</span>
                </label>
                <select
                  id="debug-level-select"
                  className="main-menu__select"
                  data-testid="main-menu-debug-level-select"
                  value={selectedLevelId}
                  onChange={(event) => onSelectedLevelChange(Number(event.target.value))}
                >
                  {selectableLevels.map((levelId) => (
                    <option key={levelId} value={levelId}>{`Level ${String(levelId).padStart(2, '0')}`}</option>
                  ))}
                </select>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
