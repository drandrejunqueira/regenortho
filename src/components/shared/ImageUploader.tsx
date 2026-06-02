'use client'

import { useRef, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { processImageToDataUrl } from '@/lib/upload'

type UploadType = 'logo' | 'icon' | 'header' | 'og'

interface Props {
  type: UploadType
  label: string
  hint?: string
  currentUrl?: string | null
  onUploaded: (url: string) => void
  /** Proporção do preview (ex: '16/9', '1/1', '4/1'). Default: '16/9' */
  previewAspect?: string
  /** Classe extra para o preview */
  previewClass?: string
}

const ACCEPT: Record<UploadType, string> = {
  logo:   'image/png,image/jpeg,image/svg+xml,image/webp',
  icon:   'image/png,image/x-icon,image/svg+xml',
  header: 'image/png,image/jpeg,image/webp',
  og:     'image/png,image/jpeg,image/webp',
}

const LABELS: Record<UploadType, string> = {
  logo:   '2 MB · PNG, JPG, SVG, WEBP',
  icon:   '1 MB · PNG, ICO, SVG',
  header: '4 MB · PNG, JPG, WEBP',
  og:     '4 MB · PNG, JPG, WEBP (1200×630px)',
}

// Limite de tamanho do arquivo bruto (antes da conversão para WebP).
const MAX_BYTES: Record<UploadType, number> = {
  logo:   2 * 1024 * 1024,
  icon:   1 * 1024 * 1024,
  header: 4 * 1024 * 1024,
  og:     4 * 1024 * 1024,
}

export default function ImageUploader({
  type,
  label,
  hint,
  currentUrl,
  onUploaded,
  previewAspect = '16/9',
  previewClass = '',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [dragging, setDragging] = useState(false)

  // Sincroniza o preview quando currentUrl chega do servidor (carregamento assíncrono)
  // Só atualiza se não há um preview local de upload em andamento (data: URL)
  useEffect(() => {
    if (currentUrl && !preview?.startsWith('data:')) {
      setPreview(currentUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl])

  async function handleFile(file: File) {
    if (!file) return

    // Valida tamanho do arquivo bruto
    if (file.size > MAX_BYTES[type]) {
      const mb = (MAX_BYTES[type] / 1024 / 1024).toFixed(0)
      toast.error(`Arquivo muito grande. Limite: ${mb}MB`)
      return
    }

    setUploading(true)

    // Preview local imediato
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    try {
      // Processamento 100% no cliente: raster → WebP, SVG/ICO direto.
      // Resultado é um data URL base64 salvo direto no banco (sem /api/upload).
      const dataUrl = await processImageToDataUrl(file)
      setPreview(dataUrl)
      onUploaded(dataUrl)
      toast.success(`${label} enviado com sucesso!`)
    } catch {
      toast.error('Falha ao processar a imagem')
      setPreview(currentUrl ?? null)
    } finally {
      setUploading(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // reset para permitir re-upload do mesmo arquivo
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-[#718096]/60">{LABELS[type]}</span>
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative rounded-xl border-2 border-dashed transition-colors cursor-pointer
          ${dragging
            ? 'border-[#00BCE4] bg-[rgba(0,188,228,0.05)]'
            : 'border-[rgba(2,21,65,0.12)] hover:border-[#00BCE4] hover:bg-[rgba(0,188,228,0.02)]'
          }
        `}
        style={{ aspectRatio: previewAspect }}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
      {preview ? (
          <>
            {/* Fundo xadrez para imagens transparentes */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                backgroundImage: 'linear-gradient(45deg, #e8e8e8 25%, transparent 25%), linear-gradient(-45deg, #e8e8e8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e8e8e8 75%), linear-gradient(-45deg, transparent 75%, #e8e8e8 75%)',
                backgroundSize: '12px 12px',
                backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                opacity: 0.4,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={label}
              className={`absolute inset-0 w-full h-full rounded-xl object-contain ${previewClass}`}
            />
            {/* Overlay ao hover */}
            <div className="absolute inset-0 rounded-xl bg-[rgba(2,21,65,0.55)] opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>
                upload
              </span>
              <span className="text-white text-xs font-bold uppercase tracking-wider">Substituir</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            {uploading ? (
              <span className="material-symbols-outlined text-[#00BCE4] animate-spin" style={{ fontSize: '28px' }}>
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[rgba(2,21,65,0.25)]" style={{ fontSize: '28px' }}>
                cloud_upload
              </span>
            )}
            <p className="text-[11px] text-[#718096] text-center leading-relaxed">
              {uploading
                ? 'Enviando…'
                : hint ?? 'Clique ou arraste o arquivo aqui'}
            </p>
          </div>
        )}

        {uploading && preview && (
          <div className="absolute inset-0 rounded-xl bg-[rgba(255,255,255,0.6)] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#00BCE4] animate-spin" style={{ fontSize: '28px' }}>
              progress_activity
            </span>
          </div>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[type]}
        className="hidden"
        onChange={onInputChange}
      />

      {/* Botão explícito + URL atual */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#021541] bg-[rgba(2,21,65,0.06)] hover:bg-[rgba(0,188,228,0.12)] hover:text-[#00BCE4] transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>upload</span>
          {uploading ? 'Enviando…' : 'Selecionar arquivo'}
        </button>

        {preview && !preview.startsWith('data:') && (
          <a
            href={preview}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-[#718096] hover:text-[#00BCE4] transition-colors truncate max-w-[200px]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
            {preview.split('/').pop()}
          </a>
        )}
      </div>
    </div>
  )
}
