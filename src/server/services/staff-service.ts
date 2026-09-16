import 'server-only';

import { prisma } from '@/db/client';
import { AppError } from '@/lib/errors';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import {
  canAssignRole,
  isRoleKey,
  permissionsForRole,
  ROLE_DEFINITIONS,
  ROLE_KEYS,
} from '@/server/policies/permissions';

import { recordAudit } from './audit-service';
import { assertWithinLimit } from './billing-service';

/**
 * Staff and roles.
 *
 * Privilege escalation is prevented structurally: a member can only assign a
 * role strictly below their own rank, and the owner's role cannot be granted at
 * all. Every check runs here, on the server, not in the role dropdown.
 */

export interface StaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  roleKey: string;
  isActive: boolean;
  isOwner: boolean;
  createdAt: Date;
}

export async function listStaff(context: StoreContext): Promise<StaffMember[]> {
  assertPermission(context, 'staff.view');

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: context.storeId },
    select: { ownerId: true },
  });

  const members = await prisma.storeMember.findMany({
    where: { storeId: context.storeId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      roleKey: true,
      isActive: true,
      createdAt: true,
      user: { select: { fullName: true, email: true } },
    },
  });

  return members.map((member) => ({
    id: member.id,
    userId: member.userId,
    fullName: member.user.fullName,
    email: member.user.email,
    roleKey: member.roleKey,
    isActive: member.isActive,
    isOwner: member.userId === store.ownerId,
    createdAt: member.createdAt,
  }));
}

export function listRoles() {
  return ROLE_KEYS.map((key) => ({
    key,
    nameAr: ROLE_DEFINITIONS[key].nameAr,
    nameEn: ROLE_DEFINITIONS[key].nameEn,
    descriptionAr: ROLE_DEFINITIONS[key].descriptionAr,
    rank: ROLE_DEFINITIONS[key].rank,
    permissions: permissionsForRole(key),
  }));
}

/**
 * Add an existing user to the store.
 *
 * REBUILD PROPOSAL — email invitations are out of scope for this phase, so a
 * member is added by the email of an account that already exists. The alternative
 * (creating a shell account from an email) would let anyone probe which emails
 * are registered, which is worse than the extra step.
 */
export async function addStaffMember(
  context: StoreContext,
  input: { email: string; roleKey: string },
): Promise<{ id: string }> {
  assertPermission(context, 'staff.manage');
  await assertWithinLimit(context.storeId, 'staff');

  if (!isRoleKey(input.roleKey) || !canAssignRole(context.roleKey, input.roleKey)) {
    throw new AppError('FORBIDDEN', 'Cannot assign this role.', {
      fieldErrors: { roleKey: ['staff.cannotAssignRole'] },
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    select: { id: true },
  });
  if (!user) {
    throw new AppError('NOT_FOUND', 'No account with that email.', {
      fieldErrors: { email: ['errors.NOT_FOUND'] },
    });
  }

  const existing = await prisma.storeMember.findFirst({
    where: { storeId: context.storeId, userId: user.id },
    select: { id: true },
  });
  if (existing) {
    throw new AppError('CONFLICT', 'Already a member.', {
      fieldErrors: { email: ['errors.CONFLICT'] },
    });
  }

  const member = await prisma.storeMember.create({
    data: {
      storeId: context.storeId,
      userId: user.id,
      roleKey: input.roleKey,
      invitedBy: context.actor.id,
    },
    select: { id: true },
  });

  await recordAudit(context, {
    action: 'STAFF_ROLE_CHANGED',
    entityType: 'store_member',
    entityId: member.id,
    after: { email: input.email, roleKey: input.roleKey },
  });

  return member;
}

export async function changeStaffRole(
  context: StoreContext,
  memberId: string,
  roleKey: string,
): Promise<void> {
  assertPermission(context, 'staff.manage');

  if (!isRoleKey(roleKey) || !canAssignRole(context.roleKey, roleKey)) {
    throw new AppError('FORBIDDEN', 'Cannot assign this role.', {
      fieldErrors: { roleKey: ['staff.cannotAssignRole'] },
    });
  }

  const member = await prisma.storeMember.findFirst({
    where: { id: memberId, storeId: context.storeId },
    select: { id: true, userId: true, roleKey: true },
  });
  if (!member) throw new AppError('NOT_FOUND', 'Member not found.');

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: context.storeId },
    select: { ownerId: true },
  });

  // The owner's own membership is not editable — demoting them would leave the
  // store with no one able to manage billing or transfer ownership.
  if (member.userId === store.ownerId) {
    throw new AppError('FORBIDDEN', 'The owner role cannot be changed.');
  }

  // A member may not change their own role, in either direction.
  if (member.userId === context.actor.id) {
    throw new AppError('FORBIDDEN', 'You cannot change your own role.');
  }

  // Nor demote someone who outranks them.
  if (!canAssignRole(context.roleKey, member.roleKey)) {
    throw new AppError('FORBIDDEN', 'Cannot modify a member with an equal or higher role.');
  }

  await prisma.storeMember.update({ where: { id: memberId }, data: { roleKey } });

  await recordAudit(context, {
    action: 'STAFF_ROLE_CHANGED',
    entityType: 'store_member',
    entityId: memberId,
    before: { roleKey: member.roleKey },
    after: { roleKey },
  });
}

export async function removeStaffMember(context: StoreContext, memberId: string): Promise<void> {
  assertPermission(context, 'staff.manage');

  const member = await prisma.storeMember.findFirst({
    where: { id: memberId, storeId: context.storeId },
    select: { id: true, userId: true, roleKey: true },
  });
  if (!member) throw new AppError('NOT_FOUND', 'Member not found.');

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: context.storeId },
    select: { ownerId: true },
  });

  if (member.userId === store.ownerId) {
    throw new AppError('FORBIDDEN', 'The owner cannot be removed.');
  }
  if (member.userId === context.actor.id) {
    throw new AppError('FORBIDDEN', 'You cannot remove yourself.');
  }
  if (!canAssignRole(context.roleKey, member.roleKey)) {
    throw new AppError('FORBIDDEN', 'Cannot remove a member with an equal or higher role.');
  }

  await prisma.storeMember.delete({ where: { id: memberId } });

  await recordAudit(context, {
    action: 'STAFF_REMOVED',
    entityType: 'store_member',
    entityId: memberId,
    before: { roleKey: member.roleKey },
  });
}
