'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileUp } from 'lucide-react';
import { useRef, useState } from 'react';

import { previewImportAction, startImportAction } from '@/app/actions/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, NativeSelect } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/states';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { parseDelimited, toRowObjects } from '@/lib/delimited';

type Target = 'products' | 'orders';

interface Preview {
  columns: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
  suggestedMapping: Record<string, string>;
}

const MAX_FILE_BYTES = 4 * 1024 * 1024;

/**
 * Import wizard.
 *
 * Choose a file, map its columns, review a sample, then run. The mapping step
 * is not skippable: a spreadsheet from one merchant's supplier has nothing in
 * common with another's, and guessing silently is how an import quietly writes
 * prices into the SKU column.
 *
 * The file is parsed for a preview before anything is written. Only the rows
 * and the merchant's confirmed mapping are submitted.
 */
export function ImportWizard({
  source,
  fields,
  locale,
}: {
  source: string;
  fields: { products: string[]; orders: string[] };
  locale: string;
}) {
  const t = useTranslations('import');
  const tApp = useTranslations('app');
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);

  const [target, setTarget] = useState<Target>('products');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ jobId: string } | null>(null);

  const previewAction = useServerAction(previewImportAction);
  const runAction = useServerAction(startImportAction);

  const targetFields = fields[target];

  const pickFile = async (file: File) => {
    setFileError(null);
    setPreview(null);
    setResult(null);

    if (file.size > MAX_FILE_BYTES) {
      setFileError(t('fileTooLarge', { max: 4 }));
      return;
    }

    const content = await file.text();
    setFileName(file.name);
    setText(content);

    const response = await previewAction.run({ text: content, target });
    if (!response) return;

    setPreview(response);
    setMapping(response.suggestedMapping);
  };

  // Re-parsing on target change matters because the suggested mapping depends
  // on which set of platform fields we are matching against.
  const changeTarget = async (next: Target) => {
    setTarget(next);
    setResult(null);
    if (!text) return;

    const response = await previewAction.run({ text, target: next });
    if (!response) return;
    setPreview(response);
    setMapping(response.suggestedMapping);
  };

  const run = async () => {
    if (!text || !preview) return;

    const response = await runAction.run({
      source,
      target,
      mapping,
      // The whole file, not the 20-row preview sample. The server
      // re-validates the mapping and every value regardless.
      rows: toRowObjects(parseDelimited(text)),
    });
    if (!response) return;

    setResult(response);
    router.refresh();
  };

  const mappedFields = Object.values(mapping).filter(Boolean);
  const requiredFields = target === 'products' ? ['name', 'price'] : ['customerPhone', 'productName'];
  const missing = requiredFields.filter((field) => !mappedFields.includes(field));

  return (
    <div className="space-y-3">
      <FormError message={previewAction.error ?? runAction.error ?? fileError} />

      <Card>
        <CardHeader title={t('step1')} description={t('step1Hint')} />
        <CardBody className="space-y-4">
          <Field label={t('target')}>
            <NativeSelect
              value={target}
              onChange={(event) => void changeTarget(event.target.value as Target)}
            >
              <option value="products">{t('targets.products')}</option>
              <option value="orders">{t('targets.orders')}</option>
            </NativeSelect>
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              loading={previewAction.submitting}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp aria-hidden />
              {t('chooseFile')}
            </Button>
            {fileName ? (
              <span className="truncate text-xs text-muted-foreground">{fileName}</span>
            ) : null}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void pickFile(file);
              event.target.value = '';
            }}
          />
        </CardBody>
      </Card>

      {preview ? (
        <>
          <Card>
            <CardHeader
              title={t('step2')}
              description={t('step2Hint')}
              action={<Badge tone="outline">{t('rowCount', { count: preview.totalRows })}</Badge>}
            />
            <CardBody className="space-y-3">
              {missing.length > 0 ? (
                <p className="flex items-start gap-2 rounded-[var(--radius)] bg-[var(--warning-soft)] p-2.5 text-xs text-warning">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  {t('missingRequired', {
                    fields: missing.map((field) => t(`fields.${field}`)).join('، '),
                  })}
                </p>
              ) : null}

              <ul className="space-y-2">
                {preview.columns.map((column) => (
                  <li
                    key={column}
                    className="grid items-center gap-2 sm:grid-cols-[1fr_1fr] sm:gap-3"
                  >
                    <span className="truncate text-[13px] text-foreground" title={column}>
                      {column}
                    </span>
                    <NativeSelect
                      aria-label={column}
                      value={mapping[column] ?? ''}
                      onChange={(event) =>
                        setMapping((current) => ({ ...current, [column]: event.target.value }))
                      }
                    >
                      <option value="">{t('ignoreColumn')}</option>
                      {targetFields.map((field) => (
                        <option
                          key={field}
                          value={field}
                          // A field can only take one column; offering it twice
                          // just lets a merchant build an import that loses data.
                          disabled={mappedFields.includes(field) && mapping[column] !== field}
                        >
                          {t(`fields.${field}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('step3')} description={t('step3Hint')} />
            <CardBody className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-start text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {preview.columns.map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className={cn(
                            'px-2 py-1.5 text-start font-medium',
                            mapping[column] ? 'text-foreground' : 'text-subtle-foreground',
                          )}
                        >
                          {mapping[column] ? t(`fields.${mapping[column]}`) : column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 8).map((row, index) => (
                      <tr key={index} className="border-b border-border/60">
                        {preview.columns.map((column) => (
                          <td
                            key={column}
                            className={cn(
                              'max-w-[180px] truncate px-2 py-1.5',
                              mapping[column] ? 'text-muted-foreground' : 'text-subtle-foreground',
                            )}
                          >
                            {row[column]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button
                type="button"
                variant="primary"
                loading={runAction.submitting}
                disabled={missing.length > 0}
                onClick={run}
              >
                {t('runImport', { count: preview.totalRows })}
              </Button>
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon={<FileUp />}
              title={t('emptyTitle')}
              description={t('emptyHint')}
              compact
            />
          </CardBody>
        </Card>
      )}

      {result ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
            <p className="text-[13px] text-foreground">{t('finished')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${locale}/dashboard/integrations`)}
            >
              {tApp('viewAll')}
            </Button>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
