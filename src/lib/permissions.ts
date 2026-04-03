export type UserRole = 'admin' | 'receptionist' | 'financial' | 'doctor'

export type Permission =
  | 'dashboard:view'
  | 'leads:view' | 'leads:create' | 'leads:edit' | 'leads:delete'
  | 'agenda:view' | 'agenda:create' | 'agenda:edit' | 'agenda:delete'
  | 'patients:view' | 'patients:create' | 'patients:edit'
  | 'patients:view_clinical' | 'patients:create_clinical'
  | 'financial:view' | 'financial:create' | 'financial:edit' | 'financial:delete'
  | 'materials:view' | 'materials:create' | 'materials:edit'
  | 'reports:view' | 'reports:export'
  | 'traffic:view'
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete'
  | 'settings:view' | 'settings:edit'

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    'dashboard:view',
    'leads:view', 'leads:create', 'leads:edit', 'leads:delete',
    'agenda:view', 'agenda:create', 'agenda:edit', 'agenda:delete',
    'patients:view', 'patients:create', 'patients:edit',
    'patients:view_clinical', 'patients:create_clinical',
    'financial:view', 'financial:create', 'financial:edit', 'financial:delete',
    'materials:view', 'materials:create', 'materials:edit',
    'reports:view', 'reports:export',
    'traffic:view',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'settings:view', 'settings:edit',
  ],
  receptionist: [
    'dashboard:view',
    'leads:view', 'leads:create', 'leads:edit',
    'agenda:view', 'agenda:create', 'agenda:edit',
    'patients:view', 'patients:create', 'patients:edit',
    'materials:view',
    'reports:view',
  ],
  financial: [
    'dashboard:view',
    'financial:view', 'financial:create', 'financial:edit',
    'reports:view', 'reports:export',
    'patients:view',
    'traffic:view',
  ],
  doctor: [
    'dashboard:view',
    'agenda:view',
    'patients:view', 'patients:view_clinical', 'patients:create_clinical',
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function checkPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Acesso negado: permissão '${permission}' requerida.`)
  }
}
