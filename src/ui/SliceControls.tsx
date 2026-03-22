import React from 'react'
import { audioManager } from '../audio/audioManager'
import { useGameStore } from '../game/state/gameStore'
import { useLocale } from './LocaleProvider'

export function SliceControls() {
  const { t } = useLocale()
  const { controls, gridSize, overlay, resetSliceView, showLayerFromTop, showScreenColumn } = useGameStore()
  const overlayActive = overlay !== 'none'
  const indices = React.useMemo(() => Array.from({ length: gridSize }, (_, index) => index), [gridSize])

  return (
    <div className={`slice-controls${overlayActive ? ' is-disabled' : ''}`} data-testid="slice-controls-root">
      <div className="slice-controls__cluster" data-testid="slice-controls-cluster">
        <section aria-label={t.layer} className="slice-controls__panel slice-controls__panel--layer" data-testid="slice-layer-rail">
          <div className="slice-controls__buttons slice-controls__buttons--vertical">
            {indices.map((index) => (
              <button
                key={index}
                aria-pressed={controls.ySelection === index}
                className={`slice-controls__button${controls.ySelection === index ? ' is-active' : ''}`}
                disabled={overlayActive}
                type="button"
                onClick={() => {
                  void audioManager.playSlice(index)
                  showLayerFromTop(index)
                }}
              >
                {index}
              </button>
            ))}
            <button
              aria-pressed={controls.ySelection === -1}
              className={`slice-controls__button${controls.ySelection === -1 ? ' is-active' : ''}`}
              disabled={overlayActive}
              type="button"
              onClick={() => {
                void audioManager.playUiConfirm()
                resetSliceView()
              }}
            >
              {t.all}
            </button>
          </div>
        </section>

        <section aria-label={t.column} className="slice-controls__panel slice-controls__panel--column" data-testid="slice-column-rail">
          <div className="slice-controls__buttons slice-controls__buttons--horizontal" style={{ gridTemplateColumns: `repeat(${gridSize + 1}, minmax(0, 1fr))` }}>
            {indices.map((index) => (
              <button
                key={index}
                aria-pressed={controls.xSelection === index}
                className={`slice-controls__button${controls.xSelection === index ? ' is-active' : ''}`}
                disabled={overlayActive}
                type="button"
                onClick={() => {
                  void audioManager.playSlice(index)
                  showScreenColumn(index)
                }}
              >
                {index}
              </button>
            ))}
            <button
              aria-pressed={controls.xSelection === -1}
              className={`slice-controls__button${controls.xSelection === -1 ? ' is-active' : ''}`}
              disabled={overlayActive}
              type="button"
              onClick={() => {
                void audioManager.playUiConfirm()
                resetSliceView()
              }}
            >
              {t.all}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
