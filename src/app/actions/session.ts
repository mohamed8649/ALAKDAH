'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/db/client';
import { toActionResult, type ActionResult, ok } from '@/lib/errors';
import { destroyAgentSession, destroyUserSession, writeActiveStoreId } from '@/server/auth/session';
import { getSessionUser } from '@/server/auth/session';

/** Session-level actions shared by every shell. */

export async function switchStoreAction(storeId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) return toActionResult(new Error('unauthenticated'));

    // The requested store is only honoured if the user is actually a member.
    const membership = await prisma.storeMember.findFirst({
      where: { userId: user.id, storeId, isActive: true },
      select: { storeId: true },
    });
    if (!membership) return toActionResult(new Error('forbidden'));

    writeActiveStoreId(membership.storeId);
    revalidatePath('/', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function logoutAction(locale: string): Promise<void> {
  await destroyUserSession();
  redirect(`/${locale}/login`);
}

export async function agentLogoutAction(locale: string): Promise<void> {
  await destroyAgentSession();
  redirect(`/${locale}/agent/login`);
}
