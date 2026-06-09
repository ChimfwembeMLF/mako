/**
 * User-level roles on the `users` table (API RoleType enum).
 * Distinct from tenant workspace roles (Owner, Admin, etc.).
 */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export const USER_ROLES = [UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN] as const;

export function isSuperAdminRole(role?: string | null): boolean {
  return role === UserRole.SUPER_ADMIN;
}
