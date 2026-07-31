import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

// De quanto em quanto tempo o JWT é reconferido contra o banco. Curto o
// bastante para revogar acesso rápido, longo o bastante para não fazer uma
// consulta por requisição.
const REVALIDATE_SESSION_MS = 5 * 60 * 1000

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        })

        if (!user || !user.isActive) return null

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)
        if (!passwordMatch) return null

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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as { role: string }).role
        token.customPermissions = (user as { customPermissions?: string[] | null }).customPermissions ?? null
        token.checkedAt = Date.now()
      }
      // Reflete edições leves do próprio perfil (apenas nome/email) na sessão
      if (trigger === 'update' && session) {
        const s = session as Record<string, unknown>
        if (s.name !== undefined) token.name = s.name as string
        if (s.email !== undefined) token.email = s.email as string
      }

      // Revalida contra o banco de tempos em tempos. Sem isto, role, isActive e
      // permissões personalizadas ficavam congelados no JWT: desativar ou
      // rebaixar um usuário não tinha efeito nenhum até o token expirar.
      const checkedAt = typeof token.checkedAt === 'number' ? token.checkedAt : 0
      if (token.id && Date.now() - checkedAt > REVALIDATE_SESSION_MS) {
        const current = await db.query.users.findFirst({
          where: eq(users.id, token.id as string),
          columns: { role: true, isActive: true, customPermissions: true },
        })
        // Usuário removido ou desativado: derruba a sessão.
        if (!current || !current.isActive) return null
        token.role = current.role
        token.customPermissions = current.customPermissions ?? null
        token.checkedAt = Date.now()
      }

      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.customPermissions = (token.customPermissions as string[] | null) ?? null
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
})
