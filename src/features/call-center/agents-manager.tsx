'use client';

import {
  Copy,
  Headphones,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import {
  archiveAgentAction,
  createAgentAction,
  setAgentActiveAction,
  updateAgentAction,
} from '@/app/actions/call-center';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SwitchField,
} from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatRelative } from '@/lib/datetime';
import { formatNumber } from '@/lib/money';

export interface AgentRow {
  id: string;
  fullName: string;
  email: string | null;
  username: string;
  isActive: boolean;
  roleKey: string;
  lastLoginAt: string | null;
  ordersCount: number;
}

/**
 * Agent management.
 *
 * Agents are cards, not table rows: the useful information (who they are, their
 * sign-in name, whether they are active, how many orders they hold) does not
 * need six columns, and cards work identically on a phone.
 */
export function AgentsManager({
  agents,
  locale,
  agentLoginUrl,
  canManage,
}: {
  agents: AgentRow[];
  locale: string;
  agentLoginUrl: string;
  canManage: boolean;
}) {
  const t = useTranslations('callCenter');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [editing, setEditing] = useState<AgentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AgentRow | null>(null);

  const archive = useServerAction(archiveAgentAction);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: tApp('copied'), tone: 'success' });
    } catch {
      toast({ title: tApp('copy'), description: text, tone: 'info', durationMs: 10_000 });
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-subtle-foreground">{t('loginUrl')}</p>
            <p className="truncate font-mono text-[13px] text-foreground" dir="ltr">
              {agentLoginUrl}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => copy(agentLoginUrl)}>
            <Copy aria-hidden />
            {tApp('copy')}
          </Button>
        </CardBody>
      </Card>

      {agents.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Headphones />}
            title={t('emptyAgents')}
            description={t('emptyAgentsDescription')}
            action={
              canManage ? (
                <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                  <Plus aria-hidden />
                  {t('emptyAgentsCta')}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {canManage ? (
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {t('createAgent')}
              </Button>
            </div>
          ) : null}

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <li key={agent.id}>
                <Card>
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {agent.fullName}
                        </p>
                        <p className="truncate font-mono text-xs text-subtle-foreground" dir="ltr">
                          {agent.username}
                        </p>
                      </div>

                      {canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton label={tApp('actions')} icon={<MoreHorizontal />} size="sm" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditing(agent)}>
                              <Pencil />
                              {tApp('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => copy(agent.username)}>
                              <Copy />
                              {t('copyUsername')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={async () => {
                                const result = await setAgentActiveAction(agent.id, !agent.isActive);
                                toast({
                                  title: result.ok ? tApp('save') : tApp('retry'),
                                  tone: result.ok ? 'success' : 'error',
                                });
                              }}
                            >
                              <Power />
                              {agent.isActive ? t('deactivate') : t('activate')}
                            </DropdownMenuItem>
                            <DropdownMenuItem tone="danger" onSelect={() => setDeleting(agent)}>
                              <Trash2 />
                              {t('deleteAgent')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={agent.isActive ? 'success' : 'neutral'} dot>
                        {agent.isActive ? tApp('active') : tApp('inactive')}
                      </Badge>
                      <Badge tone="outline">
                        {t('assignedOrders')}: {formatNumber(agent.ordersCount, locale)}
                      </Badge>
                    </div>

                    <p className="text-2xs text-subtle-foreground">
                      {agent.lastLoginAt
                        ? formatRelative(agent.lastLoginAt, locale)
                        : tApp('none')}
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {canManage ? (
        <>
          <AgentDialog
            open={creating}
            onOpenChange={setCreating}
            agent={null}
            onSaved={() => setCreating(false)}
          />
          <AgentDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            agent={editing}
            onSaved={() => setEditing(null)}
          />
          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={(open) => !open && setDeleting(null)}
            title={t('deleteAgent')}
            description={t('deleteAgentWarning')}
            confirmLabel={tApp('delete')}
            cancelLabel={tApp('cancel')}
            loading={archive.submitting}
            onConfirm={async () => {
              if (!deleting) return;
              const result = await archive.run(deleting.id);
              setDeleting(null);
              if (result !== null) toast({ title: tApp('delete'), tone: 'success' });
              else if (archive.error) toast({ title: archive.error, tone: 'error' });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function AgentDialog({
  open,
  onOpenChange,
  agent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentRow | null;
  onSaved: () => void;
}) {
  const t = useTranslations('callCenter');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [fullName, setFullName] = useState(agent?.fullName ?? '');
  const [email, setEmail] = useState(agent?.email ?? '');
  const [username, setUsername] = useState(agent?.username ?? '');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(agent?.isActive ?? true);
  const [roleKey, setRoleKey] = useState(agent?.roleKey ?? 'call_center_agent');

  // Re-seed the form whenever a different agent is opened.
  const [seededFor, setSeededFor] = useState<string | null>(agent?.id ?? null);
  if (open && (agent?.id ?? null) !== seededFor) {
    setSeededFor(agent?.id ?? null);
    setFullName(agent?.fullName ?? '');
    setEmail(agent?.email ?? '');
    setUsername(agent?.username ?? '');
    setPassword('');
    setIsActive(agent?.isActive ?? true);
    setRoleKey(agent?.roleKey ?? 'call_center_agent');
  }

  const action = useServerAction(async (input: unknown) =>
    agent ? updateAgentAction(agent.id, input) : createAgentAction(input),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await action.run({
      fullName,
      email,
      username: username.toLowerCase(),
      password,
      isActive,
      roleKey,
    });

    if (result === null) return;
    toast({ title: agent ? t('agentUpdated') : t('agentCreated'), tone: 'success' });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={agent ? t('editAgent') : t('createAgent')}
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
              {tApp('save')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={action.error} />

          <Field label={t('agentFields.fullName')} required error={action.fieldError('fullName')}>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus />
          </Field>

          <Field
            label={t('agentFields.email')}
            optionalLabel={tApp('optional')}
            error={action.fieldError('email')}
          >
            <Input
              type="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label={t('agentFields.username')}
            required
            hint={t('usernameHint')}
            error={action.fieldError('username')}
          >
            <Input
              dir="ltr"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              autoComplete="off"
            />
          </Field>

          <Field
            label={agent ? t('agentFields.newPassword') : t('agentFields.password')}
            required={!agent}
            optionalLabel={agent ? tApp('optional') : undefined}
            hint={t('passwordHint')}
            error={action.fieldError('password')}
          >
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </Field>

          <Field label={t('agentFields.role')}>
            <NativeSelect value={roleKey} onChange={(event) => setRoleKey(event.target.value)}>
              <option value="call_center_agent">{t('title')}</option>
              <option value="order_agent">{t('agentFields.role')}</option>
            </NativeSelect>
          </Field>

          <SwitchField
            checked={isActive}
            onCheckedChange={setIsActive}
            label={t('agentFields.status')}
          />

          {/* Submit target for Enter-to-save; the visible action is in the footer. */}
          <button type="submit" className="sr-only">
            {tApp('save')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
