import React from 'react'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.18} luminanceThreshold={0.82} />
    </EffectComposer>
  )
}
