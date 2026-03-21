import React from 'react'

import { useLocale } from './LocaleProvider'

export function MainMenu({ onStart }: { onStart: () => void }) {
  const { t } = useLocale()

  return (
    <div className="main-menu" data-testid="main-menu">
      <div className="main-menu__backdrop" />

      <header className="main-menu__header">
        <div className="main-menu__logo-block">
          <div className="main-menu__logo-kicker">AI Cube Arena</div>
          <h1 className="main-menu__logo">{t.title}</h1>
        </div>
      </header>

      <main className="main-menu__centerpiece">
        <div aria-hidden="true" className="main-menu__hero-shell">
          <div className="main-menu__hero-aura main-menu__hero-aura--blue" />
          <div className="main-menu__hero-aura main-menu__hero-aura--amber" />
          <div className="main-menu__hero-shadow" />
          <div className="main-menu__hero-prop">
            <div className="main-menu__hero-core" />
            <div className="main-menu__hero-frame main-menu__hero-frame--one" />
            <div className="main-menu__hero-frame main-menu__hero-frame--two" />
            <div className="main-menu__hero-frame main-menu__hero-frame--three" />
          </div>
        </div>

        <div className="main-menu__action-stack" data-testid="main-menu-actions">
          <button className="main-menu__action main-menu__action--play" data-testid="main-menu-start" type="button" onClick={onStart}>
            <span className="main-menu__action-title">{t.menu.startJourney}</span>
            <span className="main-menu__action-subtitle">{t.menu.currentLevel}</span>
          </button>

          <button className="main-menu__action main-menu__action--secondary" type="button">
            <span className="main-menu__action-title">{t.menu.skinShop}</span>
            <span className="main-menu__action-subtitle">{t.menu.skinTeaser}</span>
          </button>

          <button className="main-menu__action main-menu__action--secondary" type="button">
            <span className="main-menu__action-title">{t.menu.leaderboard}</span>
            <span className="main-menu__action-subtitle">{t.menu.leaderboardHint}</span>
          </button>

          <button className="main-menu__action main-menu__action--secondary" type="button">
            <span className="main-menu__action-title">{t.menu.settings}</span>
            <span className="main-menu__action-subtitle">{t.menu.help}</span>
          </button>
        </div>
      </main>
    </div>
  )
}
