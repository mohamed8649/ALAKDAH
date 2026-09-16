/**
 * Permission catalogue and role definitions.
 *
 * Authorisation is enforced in the service layer on the server. Hiding a button
 * in the UI is presentation, never protection — every mutation re-checks.
 */

export const PERMISSIONS = [
  'orders.view',
  'orders.create',
  'orders.edit',
  'orders.change_status',
  'orders.delete',
  'orders.export',
  'orders.assign',

  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'products.import',

  'inventory.view',
  'inventory.manage',

  'customers.view',
  'customers.edit',

  'callcenter.view',
  'callcenter.manage',

  'shipping.view',
  'shipping.manage',

  'analytics.view',

  'storefront.manage',
  'pages.view',
  'pages.manage',
  'themes.manage',

  'campaigns.view',
  'campaigns.manage',

  'apps.manage',
  'integrations.manage',
  'pixels.manage',

  'billing.view',
  'billing.manage',

  'staff.view',
  'staff.manage',

  'settings.view',
  'settings.manage',

  'tokens.manage',
  'audit.view',

  'ai.use',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = [
  'owner',
  'admin',
  'manager',
  'order_agent',
  'call_center_agent',
  'product_manager',
  'shipping_operator',
  'analyst',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export interface RoleDefinition {
  key: RoleKey;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  /** Higher rank may manage lower ranks. Prevents privilege escalation. */
  rank: number;
  permissions: readonly Permission[] | 'ALL';
}

const ORDER_AGENT_PERMISSIONS: readonly Permission[] = [
  'orders.view',
  'orders.create',
  'orders.edit',
  'orders.change_status',
  'customers.view',
  'customers.edit',
  'products.view',
];

export const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  owner: {
    key: 'owner',
    nameAr: 'المالك',
    nameEn: 'Owner',
    descriptionAr: 'صلاحية كاملة على المتجر بما في ذلك الفوترة وحذف المتجر.',
    rank: 100,
    permissions: 'ALL',
  },
  admin: {
    key: 'admin',
    nameAr: 'مدير عام',
    nameEn: 'Admin',
    descriptionAr: 'إدارة كاملة للمتجر عدا نقل الملكية.',
    rank: 90,
    permissions: PERMISSIONS.filter((p) => p !== 'billing.manage'),
  },
  manager: {
    key: 'manager',
    nameAr: 'مدير',
    nameEn: 'Manager',
    descriptionAr: 'إدارة الطلبات والمنتجات والشحن والتقارير.',
    rank: 70,
    permissions: [
      'orders.view', 'orders.create', 'orders.edit', 'orders.change_status', 'orders.export', 'orders.assign',
      'products.view', 'products.create', 'products.edit', 'products.import',
      'inventory.view', 'inventory.manage',
      'customers.view', 'customers.edit',
      'callcenter.view', 'callcenter.manage',
      'shipping.view', 'shipping.manage',
      'analytics.view',
      'campaigns.view', 'campaigns.manage',
      'pages.view', 'pages.manage',
      'storefront.manage',
      'settings.view',
      'ai.use',
    ],
  },
  order_agent: {
    key: 'order_agent',
    nameAr: 'موظف طلبات',
    nameEn: 'Order Agent',
    descriptionAr: 'معالجة الطلبات وتحديث حالاتها فقط.',
    rank: 40,
    permissions: ORDER_AGENT_PERMISSIONS,
  },
  call_center_agent: {
    key: 'call_center_agent',
    nameAr: 'وكيل مركز اتصال',
    nameEn: 'Call Center Agent',
    descriptionAr: 'تأكيد الطلبات المسندة إليه عبر الهاتف.',
    rank: 30,
    permissions: ['orders.view', 'orders.edit', 'orders.change_status', 'customers.view', 'products.view'],
  },
  product_manager: {
    key: 'product_manager',
    nameAr: 'مدير منتجات',
    nameEn: 'Product Manager',
    descriptionAr: 'إدارة الكتالوج والمخزون.',
    rank: 50,
    permissions: [
      'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import',
      'inventory.view', 'inventory.manage',
      'pages.view',
      'analytics.view',
      'ai.use',
    ],
  },
  shipping_operator: {
    key: 'shipping_operator',
    nameAr: 'مسؤول شحن',
    nameEn: 'Shipping Operator',
    descriptionAr: 'إدارة الشحن وتحديث حالات التوصيل.',
    rank: 45,
    permissions: [
      'orders.view', 'orders.change_status', 'orders.export',
      'shipping.view', 'shipping.manage',
      'customers.view',
    ],
  },
  analyst: {
    key: 'analyst',
    nameAr: 'محلل',
    nameEn: 'Analyst',
    descriptionAr: 'اطلاع على التقارير فقط.',
    rank: 20,
    permissions: ['analytics.view', 'orders.view', 'products.view', 'customers.view', 'orders.export'],
  },
};

export function permissionsForRole(roleKey: string): readonly Permission[] {
  const definition = ROLE_DEFINITIONS[roleKey as RoleKey];
  if (!definition) return [];
  return definition.permissions === 'ALL' ? PERMISSIONS : definition.permissions;
}

export function roleRank(roleKey: string): number {
  return ROLE_DEFINITIONS[roleKey as RoleKey]?.rank ?? 0;
}

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * A member may only assign roles strictly below their own rank. An admin
 * cannot mint another owner, and nobody can promote themselves.
 */
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'owner') return targetRole !== 'owner';
  return roleRank(actorRole) > roleRank(targetRole);
}
