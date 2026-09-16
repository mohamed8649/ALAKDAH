import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { StaffManager } from '@/features/staff/staff-manager';
import { getTranslations } from '@/i18n/server';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { canAssignRole } from '@/server/policies/permissions';
import { listRoles, listStaff } from '@/server/services/staff-service';

export const metadata: Metadata = { title: 'الموظفون والصلاحيات' };
export const dynamic = 'force-dynamic';

export default async function StaffPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('staff.view');
  const t = getTranslations(params.locale, 'staff');

  const members = await listStaff(context);
  const roles = listRoles();

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <StaffManager
        members={JSON.parse(JSON.stringify(members))}
        roles={roles.map((role) => ({
          key: role.key,
          nameAr: role.nameAr,
          descriptionAr: role.descriptionAr,
          permissionCount: role.permissions.length,
          // The server decides which roles this member may hand out; the
          // dropdown merely reflects that decision.
          assignable: canAssignRole(context.roleKey, role.key),
        }))}
        currentUserId={context.actor.id}
        locale={params.locale}
        canManage={hasPermission(context, 'staff.manage')}
      />
    </div>
  );
}
