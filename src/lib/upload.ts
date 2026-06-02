/**
 * Upload de imagens 100% client-side, sem rede.
 * Imagens rasterizadas são convertidas para WebP (redimensionadas) e
 * codificadas como data URL base64 para gravação direta no banco (coluna TEXT).
 *
 * Formatos vetoriais/ícones (SVG, ICO) são lidos diretamente, sem rasterizar,
 * para preservar a qualidade e a transparência.
 */

/** Converte e redimensiona uma imagem rasterizada para WebP. */
export async function toWebP(file: File, maxWidth = 1400, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const ratio = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas indisponível')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('WebP falhou')); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
        },
        'image/webp', quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Falha ao carregar imagem')) }
    img.src = objectUrl
  })
}

/** Lê um arquivo como data URL base64 (string). */
export function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}

const RASTER_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Processa um arquivo de imagem e retorna um data URL base64 pronto para o banco.
 * - PNG/JPEG/WEBP → converte para WebP redimensionado.
 * - SVG/ICO e demais → lê diretamente, sem rasterizar.
 */
export async function processImageToDataUrl(file: File, maxWidth = 1400): Promise<string> {
  if (RASTER_TYPES.includes(file.type)) {
    const webp = await toWebP(file, maxWidth)
    return uploadImage(webp)
  }
  return uploadImage(file)
}
