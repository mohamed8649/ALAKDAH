'use client';

import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Monitor,
  Plus,
  Redo2,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { savePageAction, setPageStatusAction } from '@/app/actions/pages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/layout/icon';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { SwitchField } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useLocale, useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

import { BlockRenderer, type RenderContext } from './block-renderer';
import {
  BLOCK_ICONS,
  createBlock,
  PALETTE,
  type BlockType,
  type PageBlock,
  type PageDocument,
} from './blocks';
import { BlockPropsEditor } from './block-props-editor';

type Viewport = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

/**
 * Page builder.
 *
 * Block-based, not a raw HTML editor: the merchant composes from a fixed
 * palette and the stored document is data. The canvas renders with the exact
 * component the storefront uses, so the preview is the page.
 *
 * Undo/redo is a bounded history of documents. It is cheap here because a page
 * document is small, and it is what makes experimenting with layout safe.
 */
export function PageBuilder({
  pageId,
  initial,
  products,
  badges,
  storeSlug,
  currency,
  canManage,
}: {
  pageId: string | null;
  initial: {
    title: string;
    slug: string;
    productId: string | null;
    document: PageDocument;
    seoTitle: string;
    seoDescription: string;
    status: string;
  };
  products: Array<{ id: string; name: string; slug: string; price: number; imageUrl: string | null }>;
  badges: Array<{ id: string; title: string; description: string | null; icon: string }>;
  storeSlug: string;
  currency: string;
  canManage: boolean;
}) {
  const t = useTranslations('pages');
  const tBuilder = useTranslations('pages.builder');
  const tTypes = useTranslations('pages.blockTypes');
  const tApp = useTranslations('app');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [productId, setProductId] = useState(initial.productId ?? '');
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);

  const [blocks, setBlocks] = useState<PageBlock[]>(initial.document.blocks);
  const [history, setHistory] = useState<PageBlock[][]>([initial.document.blocks]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const save = useServerAction(async (input: unknown) => savePageAction(pageId, input));

  useUnsavedChanges(dirty && !save.submitting);

  const commit = useCallback(
    (next: PageBlock[]) => {
      setBlocks(next);
      setDirty(true);
      // Truncate any redo branch, then cap the history so a long editing
      // session does not grow without bound.
      setHistory((current) => [...current.slice(0, historyIndex + 1), next].slice(-40));
      setHistoryIndex((current) => Math.min(current + 1, 39));
    },
    [historyIndex],
  );

  const undo = () => {
    if (historyIndex <= 0) return;
    const index = historyIndex - 1;
    setHistoryIndex(index);
    setBlocks(history[index] ?? []);
    setDirty(true);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const index = historyIndex + 1;
    setHistoryIndex(index);
    setBlocks(history[index] ?? []);
    setDirty(true);
  };

  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    commit([...blocks, block]);
    setSelectedId(block.id);
    setPaletteOpen(false);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    commit(next);
  };

  const duplicate = (index: number) => {
    const source = blocks[index];
    if (!source) return;
    const copy: PageBlock = {
      ...source,
      id: `blk_${Math.random().toString(36).slice(2, 10)}`,
      props: { ...source.props },
    };
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    commit(next);
  };

  const remove = (index: number) => {
    const removed = blocks[index];
    commit(blocks.filter((_, position) => position !== index));
    if (removed && selectedId === removed.id) setSelectedId(null);
  };

  const updateProps = (id: string, props: Record<string, unknown>) => {
    commit(blocks.map((block) => (block.id === id ? { ...block, props } : block)));
  };

  const renderContext = useMemo<RenderContext>(
    () => ({
      currency,
      locale,
      badges,
      products: Object.fromEntries(products.map((product) => [product.id, product])),
    }),
    [currency, locale, badges, products],
  );

  const selected = blocks.find((block) => block.id === selectedId) ?? null;

  const persist = async (status?: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED') => {
    const result = await save.run({
      title,
      slug,
      productId: productId || null,
      document: { version: 1, blocks },
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      status,
    });

    if (!result) return;

    setDirty(false);
    toast({ title: status === 'PUBLISHED' ? tApp('published') : tBuilder('saved'), tone: 'success' });

    if (!pageId) router.replace(`/${locale}/dashboard/pages/${result.id}`);
    else router.refresh();
  };

  return (
    <div>
      <FormError message={save.error} />

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-surface-1 p-2">
        <div className="flex items-center gap-1">
          <IconButton
            label={tBuilder('undo')}
            icon={<Undo2 />}
            size="sm"
            disabled={historyIndex <= 0}
            onClick={undo}
          />
          <IconButton
            label={tBuilder('redo')}
            icon={<Redo2 />}
            size="sm"
            disabled={historyIndex >= history.length - 1}
            onClick={redo}
          />
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          {(['desktop', 'tablet', 'mobile'] as const).map((option) => {
            const ViewportIcon =
              option === 'desktop' ? Monitor : option === 'tablet' ? Tablet : Smartphone;
            return (
              <IconButton
                key={option}
                label={tBuilder(option)}
                icon={<ViewportIcon />}
                size="sm"
                variant={viewport === option ? 'solid' : 'ghost'}
                onClick={() => setViewport(option)}
              />
            );
          })}
        </div>

        <Button variant="secondary" size="sm" onClick={() => setPaletteOpen(true)} disabled={!canManage}>
          <Plus aria-hidden />
          {tBuilder('addBlock')}
        </Button>

        <div className="ms-auto flex items-center gap-2">
          {dirty ? (
            <span className="text-xs text-subtle-foreground">{tApp('unsavedChanges')}</span>
          ) : null}
          <Badge tone={initial.status === 'PUBLISHED' ? 'success' : 'neutral'}>
            {initial.status === 'PUBLISHED' ? tApp('published') : tApp('draft')}
          </Badge>

          {canManage ? (
            <>
              <Button variant="outline" size="sm" loading={save.submitting} onClick={() => persist()}>
                {tBuilder('saveDraft')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={save.submitting}
                onClick={() => persist('PUBLISHED')}
              >
                {tApp('publish')}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {/* Canvas */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <CardBody className="bg-surface-2 p-3">
              <div
                className="storefront-scope mx-auto overflow-hidden rounded-[var(--radius-lg)] border border-border bg-background transition-[max-width] duration-base"
                style={{ maxWidth: VIEWPORT_WIDTH[viewport] }}
              >
                {blocks.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {tBuilder('emptyCanvas')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tBuilder('emptyCanvasHint')}
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-4"
                      disabled={!canManage}
                      onClick={() => setPaletteOpen(true)}
                    >
                      <Plus aria-hidden />
                      {tBuilder('addBlock')}
                    </Button>
                  </div>
                ) : (
                  <ul>
                    {blocks.map((block, index) => (
                      <li
                        key={block.id}
                        className={cn(
                          'group relative border-b border-dashed border-transparent',
                          selectedId === block.id && 'ring-2 ring-inset ring-[var(--primary)]',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(block.id);
                            setPropsOpen(true);
                          }}
                          aria-label={tTypes(block.type)}
                          className="absolute inset-0 z-10 cursor-pointer"
                        />

                        {canManage ? (
                          <div className="absolute top-2 z-20 hidden gap-0.5 rounded-[var(--radius)] border border-border bg-surface-elevated p-0.5 shadow-overlay group-hover:flex inset-inline-end-0 end-2">
                            <IconButton
                              label={tBuilder('moveUp')}
                              icon={<ChevronUp />}
                              size="sm"
                              disabled={index === 0}
                              onClick={() => move(index, -1)}
                            />
                            <IconButton
                              label={tBuilder('moveDown')}
                              icon={<ChevronDown />}
                              size="sm"
                              disabled={index === blocks.length - 1}
                              onClick={() => move(index, 1)}
                            />
                            <IconButton
                              label={tBuilder('duplicate')}
                              icon={<Copy />}
                              size="sm"
                              onClick={() => duplicate(index)}
                            />
                            <IconButton
                              label={tBuilder('delete')}
                              icon={<Trash2 />}
                              size="sm"
                              variant="danger"
                              onClick={() => remove(index)}
                            />
                          </div>
                        ) : null}

                        <BlockRenderer block={block} context={renderContext} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Settings + properties */}
        <div className="space-y-3">
          <Card>
            <CardHeader title={tApp('settings')} />
            <CardBody className="space-y-4">
              <Field label={tApp('name')} required error={save.fieldError('title')}>
                <Input
                  value={title}
                  disabled={!canManage}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setDirty(true);
                  }}
                />
              </Field>

              <Field label={tApp('page')} hint={`/${storeSlug}/p/${slug || '…'}`}>
                <Input
                  dir="ltr"
                  value={slug}
                  disabled={!canManage}
                  onChange={(event) => {
                    setSlug(event.target.value);
                    setDirty(true);
                  }}
                />
              </Field>

              <Field label={t('ai.product')} optionalLabel={tApp('optional')}>
                <NativeSelect
                  value={productId}
                  disabled={!canManage}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">—</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              <Field label="SEO" optionalLabel={tApp('optional')}>
                <Input
                  value={seoTitle}
                  disabled={!canManage}
                  onChange={(event) => {
                    setSeoTitle(event.target.value);
                    setDirty(true);
                  }}
                />
              </Field>

              <Textarea
                value={seoDescription}
                disabled={!canManage}
                rows={2}
                aria-label="SEO description"
                onChange={(event) => {
                  setSeoDescription(event.target.value);
                  setDirty(true);
                }}
              />

              {pageId && initial.status === 'PUBLISHED' && canManage ? (
                <SwitchField
                  checked
                  onCheckedChange={async () => {
                    const result = await setPageStatusAction(pageId, 'UNPUBLISHED');
                    toast({
                      title: result.ok ? tApp('unpublish') : tApp('retry'),
                      tone: result.ok ? 'success' : 'error',
                    });
                    router.refresh();
                  }}
                  label={tApp('published')}
                />
              ) : null}

              {pageId ? (
                <Button asChild variant="outline" size="sm" block>
                  <a href={`/${locale}/${storeSlug}/p/${slug}`} target="_blank" rel="noreferrer">
                    <Eye aria-hidden />
                    {tApp('preview')}
                  </a>
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card className="hidden lg:block">
            <CardHeader title={tBuilder('properties')} />
            <CardBody>
              {selected ? (
                <BlockPropsEditor
                  block={selected}
                  products={products}
                  disabled={!canManage}
                  onChange={(props) => updateProps(selected.id, props)}
                />
              ) : (
                <p className="text-xs text-subtle-foreground">{tBuilder('noBlockSelected')}</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Palette */}
      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent title={tBuilder('addBlock')} side="inline-end">
          <ul className="grid grid-cols-2 gap-2">
            {PALETTE.map((type) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => addBlock(type)}
                  className="flex min-h-20 w-full flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] border border-border p-3 text-center transition-colors duration-fast hover:border-border-strong hover:bg-surface-2"
                >
                  <Icon name={BLOCK_ICONS[type]} className="size-4 text-primary" />
                  <span className="text-xs text-foreground">{tTypes(type)}</span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      {/* Properties on mobile */}
      <Sheet open={propsOpen && selected !== null} onOpenChange={setPropsOpen}>
        <SheetContent
          title={selected ? tTypes(selected.type) : tBuilder('properties')}
          side="bottom"
        >
          {selected ? (
            <BlockPropsEditor
              block={selected}
              products={products}
              disabled={!canManage}
              onChange={(props) => updateProps(selected.id, props)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
