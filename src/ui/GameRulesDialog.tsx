import React from 'react'

import { audioManager } from '../audio/audioManager'
import { useLocale } from './LocaleProvider'

type GameRulesDialogProps = {
  onClose: () => void
  testId: string
}

export function GameRulesDialog({ onClose, testId }: GameRulesDialogProps) {
  const { t } = useLocale()

  return (
    <div aria-modal="true" className="main-menu__settings-overlay" role="dialog" data-testid={testId}>
      <div className="main-menu__settings-card main-menu__rules-card">
        <div className="main-menu__settings-header">
          <div>
            <div className="main-menu__settings-kicker">CubeFight</div>
            <h2 className="main-menu__settings-title">{t.sharedRules.title}</h2>
          </div>
          <button className="main-menu__settings-close" type="button" onClick={() => {
            void audioManager.playUiConfirm()
            onClose()
          }}>
            {t.sharedRules.close}
          </button>
        </div>

        <section className="main-menu__settings-section">
          <div className="main-menu__settings-hint">{t.sharedRules.intro}</div>
          <ol className="main-menu__rules-list">
            {t.sharedRules.items.map((item) => (
              <li key={item.title} className="main-menu__rules-item">
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
