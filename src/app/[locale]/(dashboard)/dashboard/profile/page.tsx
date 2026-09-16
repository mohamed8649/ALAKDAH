import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { prisma } from '@/db/client';
import { ProfileForm } from '@/features/settings/profile-form';
import { getTranslations } from '@/i18n/server';
import { getSessionUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'الملف الشخصي' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: { locale: string } }) {
  // This page belongs to the person, not to a store, so it asks for a session
  // rather than a store permission — a staff member with no settings access
  // still gets to edit their own account.
  const session = await getSessionUser();
  if (!session) redirect(`/${params.locale}/login`);

  const t = getTranslations(params.locale, 'settings.profile');

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, fullName: true, phone: true, avatarUrl: true, locale: true },
  });
  if (!user) redirect(`/${params.locale}/login`);

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <ProfileForm
        initial={{
          fullName: user.fullName,
          phone: user.phone ?? '',
          avatarUrl: user.avatarUrl ?? '',
          locale: user.locale === 'en' ? 'en' : 'ar',
        }}
        email={user.email}
        locale={params.locale}
      />
    </div>
  );
}
