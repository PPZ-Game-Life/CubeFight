import React from 'react'
import { EffectComposer, Bloom, SSAO } from '@react-three/postprocessing'

export function Effects() {
  return (
    <EffectComposer enableNormalPass multisampling={0}>
      <SSAO
        samples={12}
        radius={0.18}
        intensity={10}
        luminanceInfluence={0.35}
        worldDistanceThreshold={0.8}
        worldDistanceFalloff={0.2}
        worldProximityThreshold={0.7}
        worldProximityFalloff={0.2}
      />
      <Bloom intensity={0.18} luminanceThreshold={0.82} />
    </EffectComposer>
  )
}
