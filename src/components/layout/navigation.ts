import type { Permission } from '@/server/policies/permissions';

/**
 * Dashboard navigation model.
 *
 * Nineteen modules will not fit on a phone, and a flat list of nineteen items
 * is not usable on a desktop either. So: five primary destinations in the
 * bottom bar, the rest grouped behind "more"; the sidebar shows the same groups
 * expanded. Items the signed-in role cannot use are removed, not disabled.
 */

export interface NavItem {
  key: string;
  href: string;
  icon: string;
  permission?: Permission;
  /** Also match nested routes under this href. */
  exact?: boolean;
  children?: Array<{ key: string; href: string; permission?: Permission }>;
}

export interface NavSection {
  key: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'main',
    items: [
      { key: 'dashboard', href: '/dashboard', icon: 'layout-dashboard', exact: true },
      { key: 'analytics', href: '/dashboard/analytics/orders', icon: 'bar-chart-3', permission: 'analytics.view' },
    ],
  },
  {
    key: 'commerce',
    items: [
      { key: 'orders', href: '/dashboard/orders', icon: 'shopping-bag', permission: 'orders.view' },
      { key: 'products', href: '/dashboard/products', icon: 'package', permission: 'products.view' },
      { key: 'customers', href: '/dashboard/customers', icon: 'users', permission: 'customers.view' },
      { key: 'campaigns', href: '/dashboard/campaigns', icon: 'percent', permission: 'campaigns.view' },
    ],
  },
  {
    key: 'operations',
    items: [
      {
        key: 'callCenter',
        href: '/dashboard/call-center',
        icon: 'headphones',
        permission: 'callcenter.view',
        children: [
          { key: 'agents', href: '/dashboard/call-center/agents' },
          { key: 'rules', href: '/dashboard/call-center/rules' },
        ],
      },
      {
        key: 'shipping',
        href: '/dashboard/shipping',
        icon: 'truck',
        permission: 'shipping.view',
        children: [
          { key: 'methods', href: '/dashboard/shipping/methods' },
          { key: 'providers', href: '/dashboard/shipping/providers' },
          { key: 'rules', href: '/dashboard/shipping/rules' },
          { key: 'deliverySlip', href: '/dashboard/shipping/delivery-slip' },
        ],
      },
    ],
  },
  {
    key: 'builder',
    items: [
      { key: 'pages', href: '/dashboard/pages', icon: 'file-text', permission: 'pages.view' },
      { key: 'design', href: '/dashboard/design', icon: 'palette', permission: 'storefront.manage' },
      { key: 'themes', href: '/dashboard/themes', icon: 'layout-template', permission: 'themes.manage' },
    ],
  },
  {
    key: 'growth',
    items: [
      { key: 'apps', href: '/dashboard/apps', icon: 'puzzle', permission: 'apps.manage' },
      { key: 'integrations', href: '/dashboard/integrations', icon: 'plug', permission: 'integrations.manage' },
      { key: 'pixels', href: '/dashboard/pixels', icon: 'activity', permission: 'pixels.manage' },
    ],
  },
  {
    key: 'system',
    items: [
      { key: 'settings', href: '/dashboard/settings', icon: 'settings', permission: 'settings.view' },
      { key: 'staff', href: '/dashboard/staff', icon: 'user-cog', permission: 'staff.view' },
      { key: 'billing', href: '/dashboard/billing', icon: 'credit-card', permission: 'billing.view' },
      { key: 'audit', href: '/dashboard/audit', icon: 'scroll-text', permission: 'audit.view' },
    ],
  },
];

/** The five destinations that reach the bottom bar on a phone. */
export const MOBILE_PRIMARY_KEYS = ['dashboard', 'orders', 'products', 'customers'] as const;

export function filterNavigation(permissions: readonly string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);
}

/**
 * Whether a nav item is the active destination for the current path.
 * `/dashboard` only matches exactly; everything else matches its subtree so a
 * product editor keeps "Products" highlighted.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  const normalised = stripLocale(pathname);
  if (item.exact) return normalised === item.href;
  return normalised === item.href || normalised.startsWith(`${item.href}/`);
}

export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(ar|en)(?=\/|$)/, '') || '/';
}
