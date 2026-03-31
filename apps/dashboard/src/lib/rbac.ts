import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Check if the current user has at least the required role.
 * Returns the user's role if authorized, null if not.
 */
export async function checkRole(
  supabase: SupabaseClient,
  requiredRole: Role,
): Promise<{ authorized: boolean; role: Role | null; orgId: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, role: null, orgId: null };

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) return { authorized: false, role: null, orgId: null };

  const userRole = membership.role as Role;
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return {
    authorized: userLevel >= requiredLevel,
    role: userRole,
    orgId: membership.org_id,
  };
}

/**
 * Permission matrix for dashboard actions.
 */
export const PERMISSIONS = {
  'settings.update': 'admin' as Role,
  'team.invite': 'admin' as Role,
  'team.remove': 'admin' as Role,
  'team.change-role': 'owner' as Role,
  'api-keys.create': 'admin' as Role,
  'api-keys.delete': 'admin' as Role,
  'budgets.create': 'admin' as Role,
  'budgets.delete': 'admin' as Role,
  'guards.configure': 'admin' as Role,
  'billing.manage': 'owner' as Role,
  'org.delete': 'owner' as Role,
  'dashboard.view': 'viewer' as Role,
  'traces.view': 'viewer' as Role,
} as const;

export function canPerform(
  userRole: Role | null,
  action: keyof typeof PERMISSIONS,
): boolean {
  if (!userRole) return false;
  const requiredRole = PERMISSIONS[action];
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}
