'use client';

import { useRouter } from 'next/navigation';
import { Package, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createManualOrderAction } from '@/app/actions/orders';
import { searchProductsAction } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useTranslations } from '@/i18n/provider';
import { formatMoney, parseMoney } from '@/lib/money';
import { isValidPhone } from '@/lib/phone';
import { clientRequestId } from '@/lib/client-id';

/**
 * Manual order form.
 *
 * The staff path for an order taken over the phone. Totals are shown live for
 * the operator's benefit but recomputed on the server from the catalogue — the
 * number shown here is never what gets stored.
 *
 * An idempotency key is generated once per form instance, so a slow network and
 * an impatient second click produce one order, not two.
 */

interface LineDraft {
  key: string;
  productId: string;
  variantId: string;
  quantity: string;
  unitPrice: string;
  name: string;
  variants: Array<{ id: string; title: string; price: number | null; stockQuantity: number }>;
}

interface PickerProduct {
  id: string;
  name: string;
  price: number;
  sku: string | null;
  imageUrl: string | null;
  hasVariants: boolean;
  variants: Array<{ id: string; title: string; price: number | null; stockQuantity: number }>;
}

export function ManualOrderForm({
  locale,
  currency,
  shippingMethods,
  agents,
  defaultShipping,
}: {
  locale: string;
  currency: string;
  shippingMethods: Array<{ id: string; name: string; price: number }>;
  agents: Array<{ id: string; name: string }>;
  defaultShipping: number;
}) {
  const t = useTranslations('orders');
  const tApp = useTranslations('app');
  const tValidation = useTranslations('validation');
  const router = useRouter();
  const { toast } = useToast();

  const idempotencyKey = useRef(clientRequestId()).current;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [shippingMethodId, setShippingMethodId] = useState(shippingMethods[0]?.id ?? '');
  const [shippingAmount, setShippingAmount] = useState(String(defaultShipping / 1000));
  const [agentId, setAgentId] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [catalogue, setCatalogue] = useState<PickerProduct[]>([]);
  const action = useServerAction(createManualOrderAction);

  const dirty = customerName !== '' || customerPhone !== '' || lines.length > 0;
  useUnsavedChanges(dirty && !action.submitting);

  useEffect(() => {
    void searchProductsAction('').then((result) => {
      if (result.ok) setCatalogue(result.data);
    });
  }, []);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const price = parseMoney(line.unitPrice || '0', currency) ?? 0;
        const quantity = Number(line.quantity) || 0;
        return sum + price * quantity;
      }, 0),
    [lines, currency],
  );

  const shipping = parseMoney(shippingAmount || '0', currency) ?? 0;
  const total = subtotal + shipping;

  const addLine = () => {
    const first = catalogue[0];
    setLines((current) => [
      ...current,
      {
        key: `${Date.now()}-${current.length}`,
        productId: first?.id ?? '',
        variantId: first?.variants[0]?.id ?? '',
        quantity: '1',
        unitPrice: first ? String(first.price / 1000) : '',
        name: first?.name ?? '',
        variants: first?.variants ?? [],
      },
    ]);
    setItemsError(null);
  };

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    );
  };

  const onProductChange = (index: number, productId: string) => {
    const product = catalogue.find((entry) => entry.id === productId);
    if (!product) return;
    updateLine(index, {
      productId,
      name: product.name,
      variants: product.variants,
      variantId: product.variants[0]?.id ?? '',
      unitPrice: String((product.variants[0]?.price ?? product.price) / 1000),
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    let valid = true;

    if (!isValidPhone(customerPhone)) {
      setPhoneError(tValidation('invalidPhone'));
      valid = false;
    } else {
      setPhoneError(null);
    }

    if (lines.length === 0) {
      setItemsError(t('manual.noItems'));
      valid = false;
    }

    if (!valid) return;

    const result = await action.run({
      customerName,
      customerPhone,
      state,
      city,
      address,
      notes: notes || null,
      shippingMethodId: shippingMethodId || null,
      shippingAmount,
      assignedAgentId: agentId || null,
      idempotencyKey,
      items: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId || null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    });

    if (!result) return;

    toast({ title: t('manual.created', { number: result.orderNumber }), tone: 'success' });
    router.replace(`/${locale}/dashboard/orders/${result.id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <FormError message={action.error} />

        <Card>
          <CardHeader title={t('manual.customerSection')} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={tApp('name')} required error={action.fieldError('customerName')}>
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </Field>

            <Field label={tApp('phone')} required error={phoneError ?? action.fieldError('customerPhone')}>
              <Input
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={customerPhone}
                onChange={(event) => {
                  setCustomerPhone(event.target.value);
                  setPhoneError(null);
                }}
                placeholder="091 234 5678"
              />
            </Field>

            <Field label={tApp('region')} error={action.fieldError('state')}>
              <Input value={state} onChange={(event) => setState(event.target.value)} />
            </Field>

            <Field label={tApp('city')} error={action.fieldError('city')}>
              <Input value={city} onChange={(event) => setCity(event.target.value)} />
            </Field>

            <Field label={tApp('address')} className="sm:col-span-2" error={action.fieldError('address')}>
              <Input value={address} onChange={(event) => setAddress(event.target.value)} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('manual.itemsSection')}
            action={
              <Button type="button" variant="secondary" size="sm" onClick={addLine} disabled={catalogue.length === 0}>
                <Plus aria-hidden />
                {t('manual.addItem')}
              </Button>
            }
          />
          <CardBody className="space-y-3">
            {itemsError ? (
              <p className="text-xs text-danger" role="alert">
                {itemsError}
              </p>
            ) : null}

            {lines.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-6 text-center text-xs text-subtle-foreground">
                <Package className="mx-auto mb-2 size-5" aria-hidden />
                {t('manual.noItems')}
              </p>
            ) : (
              <ul className="space-y-3">
                {lines.map((line, index) => (
                  <li key={line.key} className="rounded-[var(--radius)] border border-border p-3">
                    <div className="grid gap-3 sm:grid-cols-12">
                      <Field label={t('manual.product')} className="sm:col-span-5">
                        <NativeSelect
                          value={line.productId}
                          onChange={(event) => onProductChange(index, event.target.value)}
                        >
                          {catalogue.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>

                      {line.variants.length > 0 ? (
                        <Field label={t('manual.variant')} className="sm:col-span-3">
                          <NativeSelect
                            value={line.variantId}
                            onChange={(event) => updateLine(index, { variantId: event.target.value })}
                          >
                            {line.variants.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.title}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                      ) : null}

                      <Field label={tApp('quantity')} className="sm:col-span-2">
                        <Input
                          value={line.quantity}
                          inputMode="numeric"
                          onChange={(event) => updateLine(index, { quantity: event.target.value })}
                        />
                      </Field>

                      <Field label={tApp('price')} className="sm:col-span-2">
                        <Input
                          value={line.unitPrice}
                          inputMode="decimal"
                          onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="mt-2 flex items-center justify-end">
                      <IconButton
                        label={t('manual.removeItem')}
                        icon={<Trash2 />}
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          setLines((current) => current.filter((_, position) => position !== index))
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('manual.deliverySection')} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {shippingMethods.length > 0 ? (
              <Field label={t('manual.deliveryMethod')}>
                <NativeSelect
                  value={shippingMethodId}
                  onChange={(event) => {
                    setShippingMethodId(event.target.value);
                    const method = shippingMethods.find((entry) => entry.id === event.target.value);
                    if (method) setShippingAmount(String(method.price / 1000));
                  }}
                >
                  {shippingMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}

            <Field label={tApp('shipping')}>
              <Input
                value={shippingAmount}
                inputMode="decimal"
                adornEnd={currency}
                onChange={(event) => setShippingAmount(event.target.value)}
              />
            </Field>

            {agents.length > 0 ? (
              <Field label={t('assignAgent')}>
                <NativeSelect value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                  <option value="">{t('unassigned')}</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}

            <Field label={tApp('notes')} className="sm:col-span-2">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
            </Field>
          </CardBody>
        </Card>
      </div>

      {/* Summary — sticky on desktop, in-flow with a sticky CTA on mobile. */}
      <div className="lg:sticky lg:top-[calc(var(--topbar-height)+1rem)] lg:h-fit">
        <Card>
          <CardHeader title={t('manual.summarySection')} />
          <CardBody className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tApp('subtotal')}</span>
              <span className="tabular-nums text-foreground">
                {formatMoney(subtotal, currency, locale)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tApp('shipping')}</span>
              <span className="tabular-nums text-foreground">
                {formatMoney(shipping, currency, locale)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-medium text-foreground">{tApp('total')}</span>
              <span className="text-[15px] font-semibold tabular-nums text-foreground">
                {formatMoney(total, currency, locale)}
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="touch"
              block
              className="mt-3"
              loading={action.submitting}
            >
              {t('manual.submit')}
            </Button>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
