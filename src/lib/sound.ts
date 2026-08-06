// Aviso sonoro do sino de notificações.
// Gerado via Web Audio API em vez de arquivo de áudio: nenhum asset para
// carregar, funciona offline e não depende de política de autoplay de <audio>.

const NOTE_A5 = 880
const NOTE_D6 = 1174.7
const NOTE_MS = 140

// Sequência mais longa e insistente para lead novo: o aviso comum passa
// despercebido quando a recepção está em outra aba.
const LEAD_NOTES = [NOTE_A5, NOTE_D6, NOTE_A5, NOTE_D6]

const PREF_KEY = 'regenortho:som-avisos'

let audioCtx: AudioContext | null = null

/** O som fica ligado por padrão; só desliga se o usuário optou por isso. */
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PREF_KEY) !== '0'
  } catch {
    return true // modo privado bloqueia storage — não é motivo para silenciar
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, enabled ? '1' : '0')
  } catch {
    /* sem storage: a preferência vale só para esta sessão */
  }
}

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

function playSequence(notes: readonly number[], force: boolean): void {
  if (!force && !isSoundEnabled()) return
  try {
    const ctx = getContext()
    if (!ctx) return
    // O navegador suspende o contexto até haver interação do usuário; se ainda
    // estiver suspenso o som simplesmente não sai — nunca lança.
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    notes.forEach((freq, i) => playNote(ctx, freq, now + (i * NOTE_MS) / 1000))
  } catch {
    /* sem áudio disponível — o aviso visual no sino já cobre */
  }
}

/** Toca um "ding" curto de duas notas. Silencioso se o navegador bloquear áudio. */
export function playNotificationChime(): void {
  playSequence([NOTE_A5, NOTE_D6], false)
}

/** Aviso de lead novo: mais longo, para ser ouvido de outra aba. */
export function playLeadChime(): void {
  playSequence(LEAD_NOTES, false)
}

/** Toca ignorando a preferência — usado no botão "testar som" das configurações. */
export function playSoundTest(): void {
  playSequence([NOTE_A5, NOTE_D6], true)
}
