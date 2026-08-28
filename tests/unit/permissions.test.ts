import { describe, expect, it } from 'vitest'
import { checkPermission, getEffectivePermissions, hasPermission, ROLE_PRESETS } from '@/lib/permissions'

describe('presets por papel', () => {
  it('admin tem acesso a todos os módulos sensíveis', () => {
    expect(hasPermission('admin', 'users:delete')).toBe(true)
    expect(hasPermission('admin', 'financial:delete')).toBe(true)
    expect(hasPermission('admin', 'patients:create_clinical')).toBe(true)
  })

  it('médico não tem acesso a financeiro nem a leads', () => {
    expect(hasPermission('doctor', 'financial:view')).toBe(false)
    expect(hasPermission('doctor', 'leads:view')).toBe(false)
    expect(hasPermission('doctor', 'patients:view_clinical')).toBe(true)
  })

  it('médico altera a própria consulta, mas marcar e cancelar continua da recepção', () => {
    expect(hasPermission('doctor', 'agenda:edit')).toBe(true)
    expect(hasPermission('doctor', 'agenda:create')).toBe(false)
    expect(hasPermission('doctor', 'agenda:delete')).toBe(false)
  })

  it('recepcionista não tem acesso a prontuário clínico nem financeiro', () => {
    expect(hasPermission('receptionist', 'patients:view_clinical')).toBe(false)
    expect(hasPermission('receptionist', 'financial:view')).toBe(false)
    expect(hasPermission('receptionist', 'agenda:create')).toBe(true)
  })

  it('financeiro não tem acesso a agenda nem a prontuário', () => {
    expect(hasPermission('financial', 'agenda:view')).toBe(false)
    expect(hasPermission('financial', 'patients:view_clinical')).toBe(false)
    expect(hasPermission('financial', 'reports:balancete')).toBe(true)
  })
})

describe('permissões customizadas', () => {
  it('uma lista customizada não-vazia substitui totalmente o preset do papel', () => {
    const custom = ['agenda:view']
    expect(hasPermission('admin', 'users:delete', custom)).toBe(false)
    expect(hasPermission('admin', 'agenda:view', custom)).toBe(true)
  })

  it('lista customizada vazia cai de volta para o preset (não vira "sem permissão nenhuma")', () => {
    expect(getEffectivePermissions('receptionist', [])).toEqual(ROLE_PRESETS.receptionist)
    expect(hasPermission('receptionist', 'leads:view', [])).toBe(true)
  })

  it('customPermissions null ou undefined usa o preset', () => {
    expect(getEffectivePermissions('doctor', null)).toEqual(ROLE_PRESETS.doctor)
    expect(getEffectivePermissions('doctor', undefined)).toEqual(ROLE_PRESETS.doctor)
  })
})

describe('checkPermission', () => {
  it('não lança quando o papel tem a permissão', () => {
    expect(() => checkPermission('admin', 'settings:edit')).not.toThrow()
  })

  it('lança erro descritivo quando a permissão falta', () => {
    expect(() => checkPermission('receptionist', 'financial:view')).toThrow(
      "Acesso negado: permissão 'financial:view' requerida.",
    )
  })
})
