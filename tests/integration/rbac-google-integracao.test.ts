/**
 * RBAC — /api/admin/google/*
 *
 * `connect` e `callback` são o par de OAuth que grava `google_refresh_token` na
 * tabela `configuracoes`: uma credencial ÚNICA e global da clínica. O servidor
 * usa esse token depois em dois caminhos:
 *   1. /trafego (Search Console, GA4, Google Ads) — obterClienteAutorizado()
 *   2. getClientForUser() em src/lib/google/calendar.ts, fallback #2: escreve os
 *      eventos da agenda (nome do paciente e observações no corpo do evento)
 *      quando o médico não tem conta própria conectada.
 *
 * Hoje as duas rotas só chamam auth(): QUALQUER papel logado troca a conexão
 * Google da clínica inteira pela conta dele. Deve exigir 'settings:edit', a
 * mesma permissão que já protege /api/configuracoes/sistema (onde o client
 * id/secret do Google são editados).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/google/oauth', () => ({
  gerarUrlConsentimento: vi.fn(async () => 'https://accounts.google.com/o/oauth2/auth?fake=1'),
  googleConfigurado: vi.fn(async () => true),
  trocarCodePorToken: vi.fn(async () => undefined),
}))

import { auth } from '@/lib/auth/config'
import { gerarUrlConsentimento, trocarCodePorToken } from '@/lib/google/oauth'
import { GET as CONNECT } from '@/app/api/admin/google/connect/route'
import { GET as CALLBACK } from '@/app/api/admin/google/callback/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions, name: 'Fulano', email: 'f@x.com' } }
}

const SEM_SETTINGS_EDIT = ['doctor', 'receptionist', 'financial'] as const

function connectReq() {
  return new NextRequest('http://localhost/api/admin/google/connect')
}

function callbackReq() {
  return new NextRequest('http://localhost/api/admin/google/callback?code=fake-code&state=/trafego')
}

describe('GET /api/admin/google/connect — troca a conexão Google da clínica', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(SEM_SETTINGS_EDIT)(
    '403 para %s: sem settings:edit ninguém inicia o consentimento da clínica',
    async (role) => {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))

      const res = await CONNECT(connectReq())

      expect(res.status).toBe(403)
      expect(gerarUrlConsentimento).not.toHaveBeenCalled()
    },
  )

  it('admin passa', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))

    const res = await CONNECT(connectReq())

    expect(res.status).toBe(307)
    expect(gerarUrlConsentimento).toHaveBeenCalled()
  })

  it('customPermissions substituem o preset: admin sem settings:edit também leva 403', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin', ['dashboard:view', 'traffic:view']))

    const res = await CONNECT(connectReq())

    expect(res.status).toBe(403)
    expect(gerarUrlConsentimento).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/google/callback — grava o refresh_token global', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(SEM_SETTINGS_EDIT)(
    '403 para %s: o token da clínica não pode ser sobrescrito sem settings:edit',
    async (role) => {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))

      const res = await CALLBACK(callbackReq())

      expect(res.status).toBe(403)
      expect(trocarCodePorToken).not.toHaveBeenCalled()
    },
  )

  it('admin passa', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))

    const res = await CALLBACK(callbackReq())

    expect(res.status).toBe(307)
    expect(trocarCodePorToken).toHaveBeenCalled()
  })
})
