import React from 'react'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

export function Effects({ reducedQuality = false }: { reducedQuality?: boolean }) {
  return (
    <EffectComposer enableNormalPass multisampling={0}>
      <Bloom intensity={reducedQuality ? 0.1 : 0.18} luminanceThreshold={0.82} />
    </EffectComposer>
  )
}
