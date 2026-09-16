import { describe, expect, it } from 'vitest';

import {
  canAssignRole,
  isRoleKey,
  permissionsForRole,
  PERMISSIONS,
  roleRank,
  ROLE_KEYS,
} from '@/server/policies/permissions';

/**
 * Privilege escalation is the failure mode that matters here: a manager who
 * can mint an owner has effectively taken the store. The rank comparison is
 * what prevents it, so it is pinned directly rather than only through the
 * service that calls it.
 */
describe('canAssignRole', () => {
  it('lets an owner assign anything except another owner', () => {
    expect(canAssignRole('owner', 'admin')).toBe(true);
    expect(canAssignRole('owner', 'analyst')).toBe(true);
    expect(canAssignRole('owner', 'owner')).toBe(false);
  });

  it('never lets a role assign its own rank or above', () => {
    for (const role of ROLE_KEYS) {
      if (role === 'owner') continue;
      expect(canAssignRole(role, role)).toBe(false);
      expect(canAssignRole(role, 'owner')).toBe(false);
    }
  });

  it('stops an admin from minting an owner', () => {
    expect(canAssignRole('admin', 'owner')).toBe(false);
    expect(canAssignRole('admin', 'manager')).toBe(true);
  });

  it('stops a lower rank from promoting upwards', () => {
    expect(canAssignRole('order_agent', 'manager')).toBe(false);
    expect(canAssignRole('analyst', 'admin')).toBe(false);
  });

  it('treats an unknown role as having no authority', () => {
    expect(canAssignRole('made_up', 'analyst')).toBe(false);
    expect(canAssignRole('', 'analyst')).toBe(false);
  });
});

describe('roleRank', () => {
  it('orders the roles as the product intends', () => {
    expect(roleRank('owner')).toBeGreaterThan(roleRank('admin'));
    expect(roleRank('admin')).toBeGreaterThan(roleRank('manager'));
    expect(roleRank('manager')).toBeGreaterThan(roleRank('order_agent'));
  });

  it('gives an unknown role the lowest possible rank', () => {
    expect(roleRank('nope')).toBe(0);
  });
});

describe('permissionsForRole', () => {
  it('gives the owner everything', () => {
    expect(permissionsForRole('owner')).toEqual(PERMISSIONS);
  });

  it('never grants a permission that is not in the master list', () => {
    for (const role of ROLE_KEYS) {
      for (const permission of permissionsForRole(role)) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it('keeps a call-centre agent away from billing and staff', () => {
    const granted = permissionsForRole('call_center_agent');
    expect(granted).not.toContain('billing.manage');
    expect(granted).not.toContain('staff.manage');
  });

  it('keeps an analyst read-only over orders', () => {
    const granted = permissionsForRole('analyst');
    expect(granted).not.toContain('orders.delete');
    expect(granted).not.toContain('orders.change_status');
  });
});

describe('isRoleKey', () => {
  it('accepts only the defined roles', () => {
    expect(isRoleKey('owner')).toBe(true);
    expect(isRoleKey('Owner')).toBe(false);
    expect(isRoleKey('superuser')).toBe(false);
  });
});
