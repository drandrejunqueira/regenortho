import type { DefaultSession, DefaultJWT } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      /** Permissões personalizadas que substituem as do papel, quando definidas. */
      customPermissions: string[] | null
    } & DefaultSession['user']
  }

  interface User {
    role: string
    customPermissions?: string[] | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    role: string
    customPermissions?: string[] | null
    /** Timestamp da última revalidação do token contra o banco. */
    checkedAt?: number
  }
}
