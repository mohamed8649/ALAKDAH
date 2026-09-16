'use client';

import { Plus, Shield, Trash2, UserCog } from 'lucide-react';
import { useState } from 'react';

import { addStaffAction, changeStaffRoleAction, removeStaffAction } from '@/app/actions/staff';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatDate } from '@/lib/datetime';

interface Member {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  roleKey: string;
  isActive: boolean;
  isOwner: boolean;
  createdAt: string;
}

interface Role {
  key: string;
  nameAr: string;
  descriptionAr: string;
  permissionCount: number;
  assignable: boolean;
}

/**
 * Staff and roles.
 *
 * The owner's row and the signed-in member's own row have no role control —
 * matching the server rules exactly, so the UI never offers an action that will
 * be refused.
 */
export function StaffManager({
  members,
  roles,
  currentUserId,
  locale,
  canManage,
}: {
  members: Member[];
  roles: Role[];
  currentUserId: string;
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations('staff');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);

  const remove = useServerAction(removeStaffAction);

  const assignableRoles = roles.filter((role) => role.assignable);

  const changeRole = async (member: Member, roleKey: string) => {
    setPendingRole(member.id);
    const result = await changeStaffRoleAction(member.id, roleKey);
    setPendingRole(null);

    toast({
      title: result.ok ? tApp('save') : t('cannotAssignRole'),
      tone: result.ok ? 'success' : 'error',
    });
  };

  return (
    <Tabs defaultValue="members">
      <TabsList>
        <TabsTrigger value="members">{t('members')}</TabsTrigger>
        <TabsTrigger value="roles">{t('roles')}</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="mt-4">
        <Card>
          <CardHeader
            title={t('members')}
            action={
              canManage && assignableRoles.length > 0 ? (
                <Button variant="primary" size="sm" onClick={() => setInviting(true)}>
                  <Plus aria-hidden />
                  {t('invite')}
                </Button>
              ) : null
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const editable = canManage && !member.isOwner && !isSelf;

                return (
                  <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[13px] font-medium text-foreground">
                        {member.fullName}
                        {isSelf ? <Badge tone="outline">{t('you')}</Badge> : null}
                        {member.isOwner ? <Badge tone="primary">{t('owner')}</Badge> : null}
                      </p>
                      <p className="truncate text-xs text-subtle-foreground" dir="ltr">
                        {member.email}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {editable ? (
                        <NativeSelect
                          value={member.roleKey}
                          disabled={pendingRole === member.id}
                          aria-label={t('role')}
                          className="w-40"
                          onChange={(event) => changeRole(member, event.target.value)}
                        >
                          {assignableRoles.map((role) => (
                            <option key={role.key} value={role.key}>
                              {role.nameAr}
                            </option>
                          ))}
                          {/* The member's current role stays selectable even if
                              this actor could not otherwise assign it. */}
                          {!assignableRoles.some((role) => role.key === member.roleKey) ? (
                            <option value={member.roleKey}>
                              {t(`roleNames.${member.roleKey}`)}
                            </option>
                          ) : null}
                        </NativeSelect>
                      ) : (
                        <Badge tone="neutral" size="md">
                          {t(`roleNames.${member.roleKey}`)}
                        </Badge>
                      )}

                      <span className="hidden text-2xs text-subtle-foreground sm:inline">
                        {formatDate(member.createdAt, locale)}
                      </span>

                      {editable ? (
                        <IconButton
                          label={t('remove')}
                          icon={<Trash2 />}
                          variant="danger"
                          size="sm"
                          onClick={() => setRemoving(member)}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <InviteDialog
          open={inviting}
          onOpenChange={setInviting}
          roles={assignableRoles}
          onSaved={() => setInviting(false)}
        />

        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t('remove')}
          description={t('removeWarning')}
          confirmLabel={t('remove')}
          cancelLabel={tApp('cancel')}
          loading={remove.submitting}
          onConfirm={async () => {
            if (!removing) return;
            const result = await remove.run(removing.id);
            setRemoving(null);
            if (result !== null) toast({ title: t('remove'), tone: 'success' });
            else if (remove.error) toast({ title: remove.error, tone: 'error' });
          }}
        />
      </TabsContent>

      <TabsContent value="roles" className="mt-4">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <li key={role.key}>
              <Card className="h-full">
                <CardBody className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] bg-surface-3 text-muted-foreground">
                      {role.key === 'owner' ? (
                        <Shield className="size-4" aria-hidden />
                      ) : (
                        <UserCog className="size-4" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {role.nameAr}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {role.descriptionAr}
                      </p>
                    </div>
                  </div>

                  <Badge tone="outline">
                    {role.permissionCount} {t('permissions')}
                  </Badge>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  roles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  onSaved: () => void;
}) {
  const t = useTranslations('staff');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? '');

  const action = useServerAction(addStaffAction);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await action.run({ email, roleKey });
    if (result === null) return;

    setEmail('');
    toast({ title: t('invite'), tone: 'success' });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('invite')}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={action.submitting}>
              {tApp('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={submit as unknown as () => void}
              loading={action.submitting}
            >
              {tApp('add')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={action.error} />

          <Field label={tApp('email')} required error={action.fieldError('email')}>
            <Input
              type="email"
              dir="ltr"
              value={email}
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label={t('role')} required error={action.fieldError('roleKey')}>
            <NativeSelect value={roleKey} onChange={(event) => setRoleKey(event.target.value)}>
              {roles.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.nameAr}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <button type="submit" className="sr-only">
            {tApp('add')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
