// Aviso sonoro do sino de notificações.
// Gerado via Web Audio API em vez de arquivo de áudio: nenhum asset para
// carregar, funciona offline e não depende de política de autoplay de <audio>.

const NOTE_A5 = 880
const NOTE_D6 = 1174.7
const NOTE_MS = 140

let audioCtx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioCtx) return audioCtx
  const AudioCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return null
  audioCtx = new AudioCtor()
  return audioCtx
}

function playNote(ctx: AudioContext, frequency: number, startAt: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency

  // Envelope curto: sobe rápido e decai, senão o corte abrupto vira um "clique".
  const end = startAt + NOTE_MS / 1000
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(end + 0.02)
}

/** Toca um "ding" curto de duas notas. Silencioso se o navegador bloquear áudio. */
export function playNotificationChime(): void {
  try {
    const ctx = getContext()
    if (!ctx) return
    // O navegador suspende o contexto até haver interação do usuário; se ainda
    // estiver suspenso o som simplesmente não sai — nunca lança.
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    playNote(ctx, NOTE_A5, now)
    playNote(ctx, NOTE_D6, now + NOTE_MS / 1000)
  } catch {
    /* sem áudio disponível — o aviso visual no sino já cobre */
  }
}
