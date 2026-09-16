'use client';

import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { deleteCollectionAction, saveCollectionAction } from '@/app/actions/collections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { SwitchField } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ImageField } from '@/features/settings/image-field';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

export interface CollectionRow {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  productCount: number;
  productIds: string[];
}

interface ProductOption {
  id: string;
  name: string;
}

const EMPTY: CollectionRow = {
  id: '',
  title: '',
  handle: '',
  description: null,
  imageUrl: null,
  isActive: true,
  productCount: 0,
  productIds: [],
};

/**
 * Collections.
 *
 * Membership is edited here rather than product-by-product, because that is how
 * a merchant thinks about it: "what is in the summer collection", not "which
 * collections is this one product in". The product editor still shows its
 * collections, so neither view is a dead end.
 */
export function CollectionsManager({
  collections,
  products,
  canManage,
}: {
  collections: CollectionRow[];
  products: ProductOption[];
  canManage: boolean;
}) {
  const t = useTranslations('collections');
  const tApp = useTranslations('app');
  const tProducts = useTranslations('products');
  const { toast } = useToast();

  const [editing, setEditing] = useState<CollectionRow | null>(null);
  const [values, setValues] = useState<CollectionRow>(EMPTY);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<CollectionRow | null>(null);

  const save = useServerAction((input: unknown) =>
    saveCollectionAction(editing?.id || null, input),
  );
  const remove = useServerAction(deleteCollectionAction);

  const open = (collection: CollectionRow | null) => {
    save.reset();
    setSearch('');
    setValues(collection ?? EMPTY);
    setEditing(collection ?? EMPTY);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await save.run({
      title: values.title,
      handle: values.handle,
      description: values.description,
      imageUrl: values.imageUrl,
      isActive: values.isActive,
      productIds: values.productIds,
    });
    if (result === null) return;

    setEditing(null);
    toast({ title: tApp('save'), tone: 'success' });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const result = await remove.run(deleting.id);
    setDeleting(null);
    if (result === null) return;
    toast({ title: tApp('delete'), tone: 'success' });
  };

  const toggleProduct = (productId: string) =>
    setValues((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((id) => id !== productId)
        : [...current.productIds, productId],
    }));

  const visibleProducts = search
    ? products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <>
      {canManage ? (
        <div className="mb-3">
          <Button variant="primary" size="sm" onClick={() => open(null)}>
            <Plus aria-hidden />
            {t('create')}
          </Button>
        </div>
      ) : null}

      {collections.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Layers />}
              title={t('empty')}
              description={t('emptyDescription')}
              action={
                canManage ? (
                  <Button variant="primary" size="sm" onClick={() => open(null)}>
                    {t('create')}
                  </Button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Card className="h-full">
                <CardBody className="flex h-full gap-3">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] bg-surface-2">
                    {collection.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- arbitrary upload path
                      <img src={collection.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Layers className="size-5 text-subtle-foreground" aria-hidden />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {collection.title}
                    </p>
                    <p dir="ltr" className="truncate text-xs text-subtle-foreground">
                      /{collection.handle}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="outline">
                        {t('productsCount', { count: collection.productCount })}
                      </Badge>
                      {collection.isActive ? null : (
                        <Badge tone="neutral">{tApp('hidden')}</Badge>
                      )}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      <IconButton
                        label={tApp('edit')}
                        icon={<Pencil />}
                        size="sm"
                        variant="ghost"
                        onClick={() => open(collection)}
                      />
                      <IconButton
                        label={tApp('delete')}
                        icon={<Trash2 />}
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleting(collection)}
                      />
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          size="lg"
          title={editing?.id ? editing.title : t('create')}
          footer={
            <Button type="submit" form="collection-form" variant="primary" loading={save.submitting}>
              {tApp('save')}
            </Button>
          }
        >
          <form id="collection-form" onSubmit={submit} noValidate className="space-y-4">
            <FormError message={save.error} />

            <Field label={t('titleField')} required error={save.fieldError('title')}>
              <Input
                value={values.title}
                onChange={(event) =>
                  setValues((current) => ({ ...current, title: event.target.value }))
                }
              />
            </Field>

            <Field
              label={t('handle')}
              optionalLabel={tApp('optional')}
              hint={t('handleHint')}
              error={save.fieldError('handle')}
            >
              <Input
                dir="ltr"
                value={values.handle}
                onChange={(event) =>
                  setValues((current) => ({ ...current, handle: event.target.value }))
                }
              />
            </Field>

            <Field label={tApp('description')} optionalLabel={tApp('optional')}>
              <Textarea
                rows={2}
                value={values.description ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>

            <ImageField
              label={t('image')}
              value={values.imageUrl ?? ''}
              folder="collections"
              onChange={(url) => setValues((current) => ({ ...current, imageUrl: url || null }))}
            />

            <SwitchField
              checked={values.isActive}
              onCheckedChange={(checked) =>
                setValues((current) => ({ ...current, isActive: checked }))
              }
              label={tApp('active')}
            />

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-foreground">{tProducts('title')}</p>
                <Badge tone="outline">{values.productIds.length}</Badge>
              </div>

              <Input
                type="search"
                value={search}
                placeholder={tApp('searchPlaceholder')}
                onChange={(event) => setSearch(event.target.value)}
              />

              {visibleProducts.length === 0 ? (
                <p className="py-4 text-center text-xs text-subtle-foreground">
                  {tApp('noResults')}
                </p>
              ) : (
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                  {visibleProducts.map((product) => {
                    const selected = values.productIds.includes(product.id);
                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleProduct(product.id)}
                          className={cn(
                            'flex min-h-11 w-full items-center gap-2 rounded-[var(--radius)] border px-2.5 text-start text-[13px] transition-colors duration-fast',
                            selected
                              ? 'border-primary bg-[var(--primary-soft)] text-primary'
                              : 'border-border text-muted-foreground hover:border-border-strong',
                          )}
                        >
                          <span className="truncate">{product.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteTitle')}
        description={t('deleteWarning')}
        confirmLabel={tApp('delete')}
        cancelLabel={tApp('cancel')}
        loading={remove.submitting}
        onConfirm={confirmDelete}
      />
    </>
  );
}
