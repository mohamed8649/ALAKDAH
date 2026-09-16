'use client';

import { ArrowLeft, Plus, Trash2, UserCheck } from 'lucide-react';
import { useState } from 'react';

import { createAgentRuleAction, deleteAgentRuleAction } from '@/app/actions/call-center';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';

interface RuleRow {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  agent: { id: string; fullName: string; isActive: boolean };
  product: { id: string; name: string } | null;
}

/**
 * Agent routing rules.
 *
 * Order matters and is visible: rules render in evaluation order with their
 * priority shown, because "first match wins" is only predictable if the
 * merchant can see the order.
 */
export function AgentRulesManager({
  rules,
  agents,
  products,
  canManage,
}: {
  rules: RuleRow[];
  agents: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const t = useTranslations('callCenter');
  const tApp = useTranslations('app');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const remove = useServerAction(deleteAgentRuleAction);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader
          title={t('rulesTitle')}
          description={t('rulesHint')}
          action={
            canManage && agents.length > 0 ? (
              <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
                <Plus aria-hidden />
                {t('createRule')}
              </Button>
            ) : null
          }
        />

        {rules.length === 0 ? (
          <EmptyState
            icon={<UserCheck />}
            title={t('emptyRules')}
            description={t('emptyRulesDescription')}
            action={
              canManage && agents.length > 0 ? (
                <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
                  <Plus aria-hidden />
                  {t('createRule')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <CardBody className="p-0">
            <ol className="divide-y divide-border">
              {rules.map((rule, index) => (
                <li key={rule.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{rule.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{rule.product?.name ?? t('ruleAllProducts')}</span>
                      <ArrowLeft className="rtl-flip size-3 text-subtle-foreground" aria-hidden />
                      <span className="text-foreground">{rule.agent.fullName}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!rule.agent.isActive ? (
                      <Badge tone="warning">{tApp('inactive')}</Badge>
                    ) : null}
                    <Badge tone="outline">{rule.priority}</Badge>
                    {canManage ? (
                      <IconButton
                        label={tApp('delete')}
                        icon={<Trash2 />}
                        variant="danger"
                        size="sm"
                        disabled={remove.submitting}
                        onClick={async () => {
                          const result = await remove.run(rule.id);
                          if (result !== null) toast({ title: tApp('delete'), tone: 'success' });
                          else if (remove.error) toast({ title: remove.error, tone: 'error' });
                        }}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        )}
      </Card>

      <RuleDialog
        open={open}
        onOpenChange={setOpen}
        agents={agents}
        products={products}
        nextPriority={rules.length}
      />
    </div>
  );
}

function RuleDialog({
  open,
  onOpenChange,
  agents,
  products,
  nextPriority,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  nextPriority: number;
}) {
  const t = useTranslations('callCenter');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const [productId, setProductId] = useState('');
  const [priority, setPriority] = useState(String(nextPriority));

  const action = useServerAction(createAgentRuleAction);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await action.run({ name, agentId, productId, priority, isActive: true });
    if (result === null) return;

    toast({ title: t('createRule'), tone: 'success' });
    setName('');
    setProductId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('createRule')}
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
              {tApp('create')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={action.error} />

          <Field label={t('ruleName')} required error={action.fieldError('name')}>
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>

          <Field label={t('ruleProduct')} hint={t('ruleAllProducts')}>
            <NativeSelect value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">{t('ruleAllProducts')}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label={t('ruleAgent')} required error={action.fieldError('agentId')}>
            <NativeSelect value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label={t('rulePriority')} hint={t('priorityHint')}>
            <Input
              value={priority}
              inputMode="numeric"
              onChange={(event) => setPriority(event.target.value)}
              className="max-w-28"
            />
          </Field>

          <button type="submit" className="sr-only">
            {tApp('create')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
