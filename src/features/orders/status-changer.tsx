'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { useTranslations } from '@/i18n/provider';

import {
  allowedTransitions,
  isDestructive,
  isTerminal,
  requiresReason,
  type OrderStatus,
} from './state-machine';

/**
 * Status changer.
 *
 * Only offers the transitions the state machine actually permits, so an
 * operator cannot attempt an invalid change and receive an error for it. A
 * destructive or failure transition collects a reason first — that reason lands
 * in the order history and the audit log.
 *
 * The trigger is disabled while a change is in flight, so a double-click cannot
 * queue two transitions.
 */
export function OrderStatusChanger({
  current,
  onChange,
  loading,
}: {
  current: OrderStatus;
  onChange: (to: OrderStatus, reason: string | null) => Promise<boolean>;
  loading?: boolean;
}) {
  const t = useTranslations('orders');
  const tApp = useTranslations('app');

  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const transitions = allowedTransitions(current);

  if (isTerminal(current) || transitions.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        {t('status.' + current)}
      </Button>
    );
  }

  const select = async (status: OrderStatus) => {
    if (requiresReason(status)) {
      setPending(status);
      setReason('');
      setReasonError(null);
      return;
    }
    await onChange(status, null);
  };

  const confirm = async () => {
    if (!pending) return;
    if (!reason.trim()) {
      setReasonError(tApp('required'));
      return;
    }
    const ok = await onChange(pending, reason.trim());
    if (ok) setPending(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="primary" size="sm" loading={loading} disabled={loading}>
            {t('changeStatus')}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{t('status.' + current)}</DropdownMenuLabel>
          {transitions.map((status) => (
            <DropdownMenuItem
              key={status}
              tone={isDestructive(status) ? 'danger' : 'default'}
              onSelect={() => void select(status)}
            >
              {t(`status.${status}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent
          size="sm"
          title={pending ? t(`status.${pending}`) : ''}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPending(null)} disabled={loading}>
                {tApp('cancel')}
              </Button>
              <Button
                variant={pending && isDestructive(pending) ? 'danger' : 'primary'}
                onClick={confirm}
                loading={loading}
              >
                {tApp('confirm')}
              </Button>
            </>
          }
        >
          <Field label={t('statusChangeReason')} required error={reasonError}>
            <Textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(null);
              }}
              rows={3}
              autoFocus
            />
          </Field>
        </DialogContent>
      </Dialog>
    </>
  );
}
