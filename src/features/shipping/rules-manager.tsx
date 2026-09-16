'use client';

import { AlertTriangle, ArrowLeft, Plus, Route, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { deleteShippingRuleAction, saveShippingRuleAction } from '@/app/actions/shipping';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { EmptyState, PartialResultNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatMoney } from '@/lib/money';

interface RuleRow {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  matchState: string | null;
  matchCity: string | null;
  matchMinTotal: number | null;
  matchMaxTotal: number | null;
  matchMethodType: string | null;
  provider: { id: string; name: string; isConnected: boolean };
}

/**
 * Carrier assignment rules.
 *
 * Rules are shown in evaluation order, and ambiguous pairs (two active rules at
 * the same priority whose conditions overlap) are surfaced as a warning rather
 * than left to be discovered as a mis-routed order weeks later.
 */
export function ShippingRulesManager({
  rules,
  overlaps,
  providers,
  locale,
  currency,
  canManage,
}: {
  rules: RuleRow[];
  overlaps: Array<{ a: string; b: string }>;
  providers: Array<{ id: string; name: string }>;
  locale: string;
  currency: string;
  canManage: boolean;
}) {
  const t = useTranslations('shipping');
  const tApp = useTranslations('app');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const remove = useServerAction(deleteShippingRuleAction);

  const describe = (rule: RuleRow): string => {
    const parts: string[] = [];
    if (rule.matchState) parts.push(rule.matchState);
    if (rule.matchCity) parts.push(rule.matchCity);
    if (rule.matchMinTotal != null) {
      parts.push(`≥ ${formatMoney(rule.matchMinTotal, currency, locale)}`);
    }
    if (rule.matchMaxTotal != null) {
      parts.push(`≤ ${formatMoney(rule.matchMaxTotal, currency, locale)}`);
    }
    if (rule.matchMethodType) parts.push(t(`methodType.${rule.matchMethodType}`));
    return parts.length > 0 ? parts.join(' · ') : t('ruleFields.anyValue');
  };

  return (
    <div className="space-y-3">
      {overlaps.length > 0 ? (
        <PartialResultNotice
          message={overlaps.map((pair) => `${pair.a} ⇄ ${pair.b}`).join('، ')}
        />
      ) : null}

      <Card>
        <CardHeader
          title={t('rules')}
          description={t('rulesHint')}
          action={
            canManage && providers.length > 0 ? (
              <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
                <Plus aria-hidden />
                {t('createRule')}
              </Button>
            ) : null
          }
        />

        {rules.length === 0 ? (
          <EmptyState
            icon={<Route />}
            title={t('emptyRules')}
            description={
              providers.length === 0 ? t('notConnected') : t('emptyRulesDescription')
            }
            action={
              canManage && providers.length > 0 ? (
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
                      <span className="truncate">{describe(rule)}</span>
                      <ArrowLeft className="rtl-flip size-3 shrink-0 text-subtle-foreground" aria-hidden />
                      <span className="text-foreground">{rule.provider.name}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!rule.provider.isConnected ? (
                      <Badge tone="warning" icon={<AlertTriangle className="size-3" />}>
                        {t('notConnected')}
                      </Badge>
                    ) : null}
                    {!rule.isActive ? <Badge tone="neutral">{tApp('inactive')}</Badge> : null}
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
        providers={providers}
        currency={currency}
        nextPriority={rules.length}
      />
    </div>
  );
}

function RuleDialog({
  open,
  onOpenChange,
  providers,
  currency,
  nextPriority,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Array<{ id: string; name: string }>;
  currency: string;
  nextPriority: number;
}) {
  const t = useTranslations('shipping');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [matchState, setMatchState] = useState('');
  const [matchCity, setMatchCity] = useState('');
  const [matchMinTotal, setMatchMinTotal] = useState('');
  const [matchMaxTotal, setMatchMaxTotal] = useState('');
  const [matchMethodType, setMatchMethodType] = useState('');
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const [priority, setPriority] = useState(String(nextPriority));

  const action = useServerAction(async (input: unknown) => saveShippingRuleAction(null, input));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await action.run({
      name,
      priority,
      isActive: true,
      matchState,
      matchCity,
      matchMinTotal: matchMinTotal || null,
      matchMaxTotal: matchMaxTotal || null,
      matchMethodType,
      providerId,
    });

    if (result === null) return;
    toast({ title: t('createRule'), tone: 'success' });
    setName('');
    setMatchState('');
    setMatchCity('');
    setMatchMinTotal('');
    setMatchMaxTotal('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('createRule')}
        description={t('rulesHint')}
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

          <Field label={t('ruleFields.name')} required error={action.fieldError('name')}>
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('ruleFields.state')} optionalLabel={t('ruleFields.anyValue')}>
              <Input value={matchState} onChange={(event) => setMatchState(event.target.value)} />
            </Field>

            <Field label={t('ruleFields.city')} optionalLabel={t('ruleFields.anyValue')}>
              <Input value={matchCity} onChange={(event) => setMatchCity(event.target.value)} />
            </Field>

            <Field label={t('ruleFields.minTotal')} optionalLabel={t('ruleFields.anyValue')}>
              <Input
                value={matchMinTotal}
                inputMode="decimal"
                adornEnd={currency}
                onChange={(event) => setMatchMinTotal(event.target.value)}
              />
            </Field>

            <Field
              label={t('ruleFields.maxTotal')}
              optionalLabel={t('ruleFields.anyValue')}
              error={action.fieldError('matchMaxTotal')}
            >
              <Input
                value={matchMaxTotal}
                inputMode="decimal"
                adornEnd={currency}
                onChange={(event) => setMatchMaxTotal(event.target.value)}
              />
            </Field>

            <Field label={t('ruleFields.methodType')} optionalLabel={t('ruleFields.anyValue')}>
              <NativeSelect
                value={matchMethodType}
                onChange={(event) => setMatchMethodType(event.target.value)}
              >
                <option value="">{t('ruleFields.anyValue')}</option>
                <option value="DELIVERY">{t('methodType.DELIVERY')}</option>
                <option value="EXPRESS">{t('methodType.EXPRESS')}</option>
                <option value="PICKUP">{t('methodType.PICKUP')}</option>
              </NativeSelect>
            </Field>

            <Field label={t('ruleFields.priority')}>
              <Input
                value={priority}
                inputMode="numeric"
                onChange={(event) => setPriority(event.target.value)}
              />
            </Field>
          </div>

          <Field label={t('ruleFields.provider')} required error={action.fieldError('providerId')}>
            <NativeSelect value={providerId} onChange={(event) => setProviderId(event.target.value)}>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <button type="submit" className="sr-only">
            {tApp('create')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
