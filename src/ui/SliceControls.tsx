import React from 'react'
import { useGameStore } from '../game/state/gameStore'
import { useLocale } from './LocaleProvider'

export function SliceControls() {
  const { t } = useLocale()
  const { controls, resetView, resetSliceView, showLayerFromTop, showScreenColumn } = useGameStore()

  return (
    <>
      <div id="slice-controls">
        <div className="slice-group">
          <div className="slice-label">{t.layer} (Y)</div>
          <div className="slice-buttons vertical">
            {[0, 1, 2].map((index) => (
              <button key={index} className={`slice-btn ${controls.ySelection === index ? 'active' : ''}`} onClick={() => showLayerFromTop(index)}>{index}</button>
            ))}
            <button className={`slice-btn ${controls.ySelection === -1 ? 'active' : ''}`} onClick={resetSliceView}>{t.all}</button>
          </div>
        </div>
      </div>

      <div id="controls">
        <div id="bottom-slice-controls">
          <div className="slice-label">{t.column}</div>
          <div className="slice-buttons horizontal">
            {[0, 1, 2].map((index) => (
              <button key={index} className={`slice-btn ${controls.xSelection === index ? 'active' : ''}`} onClick={() => showScreenColumn(index)}>{index}</button>
            ))}
            <button className={`slice-btn ${controls.xSelection === -1 ? 'active' : ''}`} onClick={resetSliceView}>{t.all}</button>
          </div>
        </div>
        <div className="control-row">
          <button className="btn" onClick={resetView}>{t.resetView}</button>
        </div>
      </div>
    </>
  )
}
