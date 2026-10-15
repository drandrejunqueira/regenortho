import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getClientIp } from '@/lib/rate-limit'
import {
  LoginBloqueado,
  normalizarEmail,
  registrarFalhaLogin,
  tempoDeBloqueio,
} from '@/lib/auth/loginGuard'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export interface UsuarioAutenticado {
  id: string
  name: string
  email: string
  role: string
  customPermissions: string[] | null
}

/**
 * `authorize` do provider de credenciais. Fica fora do `NextAuth({...})` para
 * poder ser testado sem subir o handler inteiro.
 */
export async function autorizarCredenciais(
  credentials: Partial<Record<string, unknown>>,
  request: Request,
): Promise<UsuarioAutenticado | null> {
  const parsed = loginSchema.safeParse(credentials)
  if (!parsed.success) return null

  const { email, password } = parsed.data
  const chave = normalizarEmail(email)
  const ip = getClientIp(request)

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  // O bloqueio é conferido antes do bcrypt: a conta travada não gasta os ~200 ms
  // do hash, e a senha certa durante o bloqueio também é recusada — senão o
  // atacante saberia que acertou.
  if ((await tempoDeBloqueio(chave, user?.lastLoginAt)) > 0) {
    await registrarFalhaLogin({ email: chave, ip, userId: user?.id ?? null, motivo: 'bloqueado' })
    throw new LoginBloqueado()
  }

  if (!user || !user.isActive) {
    await registrarFalhaLogin({ email: chave, ip, userId: user?.id ?? null, motivo: user ? 'inativo' : 'usuario' })
    return null
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    await registrarFalhaLogin({ email: chave, ip, userId: user.id, motivo: 'senha' })
    return null
  }

  // `lastLoginAt` é também o marco que zera a contagem de falhas.
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id))

  // NÃO incluir avatar aqui: a foto é base64 e estouraria o cookie do JWT.
  // O avatar é lido do banco via /api/perfil (hook useProfile).
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customPermissions: user.customPermissions ?? null,
  }
}
