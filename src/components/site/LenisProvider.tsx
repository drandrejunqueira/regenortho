'use client'

import { ReactLenis } from 'lenis/react'

interface Props {
  children: React.ReactNode
}

export function LenisProvider({ children }: Props) {
  return (
    <ReactLenis
      root
      options={{
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
        wheelMultiplier: 1,
        orientation: 'vertical',
      }}
    >
      {children}
    </ReactLenis>
  )
}
