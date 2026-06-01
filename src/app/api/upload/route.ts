import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Tipos aceitos e seus limites
const ALLOWED: Record<string, { maxBytes: number; ext: string[] }> = {
  logo:    { maxBytes: 2 * 1024 * 1024, ext: ['png', 'jpg', 'jpeg', 'svg', 'webp'] },
  icon:    { maxBytes: 1 * 1024 * 1024, ext: ['png', 'ico', 'svg'] },
  header:  { maxBytes: 4 * 1024 * 1024, ext: ['png', 'jpg', 'jpeg', 'webp'] },
  og:      { maxBytes: 4 * 1024 * 1024, ext: ['png', 'jpg', 'jpeg', 'webp'] },
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const type = (form.get('type') as string | null) ?? 'logo'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const config = ALLOWED[type]
    if (!config) {
      return NextResponse.json({ error: 'Tipo de upload inválido' }, { status: 400 })
    }

    // Valida extensão
    const originalName = file.name.toLowerCase()
    const ext = originalName.split('.').pop() ?? ''
    if (!config.ext.includes(ext)) {
      return NextResponse.json(
        { error: `Formato inválido. Aceitos: ${config.ext.join(', ')}` },
        { status: 400 },
      )
    }

    // Valida tamanho
    if (file.size > config.maxBytes) {
      const mb = (config.maxBytes / 1024 / 1024).toFixed(0)
      return NextResponse.json({ error: `Arquivo muito grande. Limite: ${mb}MB` }, { status: 400 })
    }

    // Garante que o diretório existe
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Nome único: tipo + timestamp + ext
    const fileName = `${type}-${Date.now()}.${ext}`
    const filePath = join(uploadDir, fileName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const url = `/uploads/${fileName}`
    return NextResponse.json({ url }, { status: 200 })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Erro interno no upload' }, { status: 500 })
  }
}
