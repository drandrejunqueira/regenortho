/**
 * Matriz de viewports para a galeria de telas.
 * Usada pela captura (capture.spec.ts) e citada pelos agentes de UI do Codex.
 */
export interface Viewport {
  label: string
  width: number
  height: number
  /** Emula toque + user agent móvel */
  mobile: boolean
  /** Para quem essa largura importa na clínica */
  persona: string
}

export const VIEWPORTS: Viewport[] = [
  { label: 'mobile-320',  width: 320,  height: 720,  mobile: true,  persona: 'piso absoluto — nada pode quebrar aqui' },
  { label: 'mobile-375',  width: 375,  height: 812,  mobile: true,  persona: 'iPhone padrão — médico entre atendimentos' },
  { label: 'mobile-414',  width: 414,  height: 896,  mobile: true,  persona: 'celular grande — paciente no portal' },
  { label: 'tablet-768',  width: 768,  height: 1024, mobile: true,  persona: 'iPad retrato — recepção no balcão' },
  { label: 'laptop-1024', width: 1024, height: 768,  mobile: false, persona: 'notebook antigo da clínica' },
  { label: 'desktop-1440',width: 1440, height: 900,  mobile: false, persona: 'estação da recepção' },
  { label: 'desktop-1920',width: 1920, height: 1080, mobile: false, persona: 'monitor grande do consultório' },
]

export const MOBILE_VIEWPORTS = VIEWPORTS.filter((v) => v.mobile)
export const DESKTOP_VIEWPORTS = VIEWPORTS.filter((v) => !v.mobile)
