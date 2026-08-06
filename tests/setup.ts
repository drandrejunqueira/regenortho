import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Uma URL de banco falsa evita que o import de src/lib/db exploda em módulos que
// só precisam do schema. Testes que tocam o banco de verdade sobrescrevem isso.
process.env.DATABASE_URL ||= 'postgres://user:pass@localhost:5432/test'
process.env.CRON_SECRET ||= 'test-cron-secret'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// jsdom não implementa Web Audio; lib/sound.ts precisa disso para não explodir.
if (!('AudioContext' in globalThis)) {
  // @ts-expect-error — stub mínimo, só o que lib/sound.ts usa.
  globalThis.AudioContext = class {
    state = 'running'
    currentTime = 0
    destination = {}
    resume() {}
    createOscillator() {
      return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      }
    }
  }
}
