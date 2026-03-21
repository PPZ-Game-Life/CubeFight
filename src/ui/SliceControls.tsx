import React from 'react'
import { useGameStore } from '../game/state/gameStore'
import { useLocale } from './LocaleProvider'

export function SliceControls() {
  const { t } = useLocale()
  const { controls, overlay, resetView, resetSliceView, showLayerFromTop, showScreenColumn } = useGameStore()
  const overlayActive = overlay !== 'none'

  return (
    <div className={`slice-controls${overlayActive ? ' is-disabled' : ''}`}>
      <section aria-labelledby="slice-controls-layer" className="slice-controls__panel">
        <div className="slice-controls__header">
          <h2 className="slice-controls__label" id="slice-controls-layer">{t.layer}</h2>
          <span aria-hidden="true" className="slice-controls__meta">Y</span>
        </div>
        <div className="slice-controls__buttons slice-controls__buttons--vertical">
          {[0, 1, 2].map((index) => (
            <button
              key={index}
              aria-pressed={controls.ySelection === index}
              className={`slice-controls__button${controls.ySelection === index ? ' is-active' : ''}`}
              disabled={overlayActive}
              type="button"
              onClick={() => showLayerFromTop(index)}
            >
              {index}
            </button>
          ))}
          <button
            aria-pressed={controls.ySelection === -1}
            className={`slice-controls__button${controls.ySelection === -1 ? ' is-active' : ''}`}
            disabled={overlayActive}
            type="button"
            onClick={resetSliceView}
          >
            {t.all}
          </button>
        </div>
      </section>

      <section aria-labelledby="slice-controls-column" className="slice-controls__panel">
        <div className="slice-controls__header">
          <h2 className="slice-controls__label" id="slice-controls-column">{t.column}</h2>
        </div>
        <div className="slice-controls__buttons slice-controls__buttons--horizontal">
          {[0, 1, 2].map((index) => (
            <button
              key={index}
              aria-pressed={controls.xSelection === index}
              className={`slice-controls__button${controls.xSelection === index ? ' is-active' : ''}`}
              disabled={overlayActive}
              type="button"
              onClick={() => showScreenColumn(index)}
            >
              {index}
            </button>
          ))}
          <button
            aria-pressed={controls.xSelection === -1}
            className={`slice-controls__button${controls.xSelection === -1 ? ' is-active' : ''}`}
            disabled={overlayActive}
            type="button"
            onClick={resetSliceView}
          >
            {t.all}
          </button>
        </div>
      </section>

      <div className="slice-controls__actions">
        <button className="slice-controls__reset" disabled={overlayActive} type="button" onClick={resetView}>
          {t.resetView}
        </button>
      </div>
    </div>
  )
}
