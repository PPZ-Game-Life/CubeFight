import React from 'react'

export function Lights() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 10, 5]} intensity={1.1} />
    </>
  )
}
