import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { IntegrationsManager, type IntegrationRow } from '@/features/integrations/integrations-manager';
import { getTranslations } from '@/i18n/server';
import { formatDateTime } from '@/lib/datetime';
import { requirePermission } from '@/server/policies/context';
import { listImportJobs, listIntegrations } from '@/server/services/integration-service';

export const metadata: Metadata = { title: 'التكاملات' };
export const dynamic = 'force-dynamic';

const JOB_TONES = {
  PENDING: 'neutral',
  PROCESSING: 'info',
  COMPLETED: 'success',
  COMPLETED_WITH_ERRORS: 'warning',
  FAILED: 'danger',
} as const;

export default async function IntegrationsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('integrations.manage');
  const t = getTranslations(params.locale, 'integrations');
  const tImport = getTranslations(params.locale, 'import');

  const [integrations, jobs] = await Promise.all([
    listIntegrations(context),
    listImportJobs(context, 10),
  ]);

  const rows: IntegrationRow[] = integrations.map((card) => ({
    providerKey: card.provider.key,
    nameAr: card.provider.nameAr,
    descriptionAr: card.provider.descriptionAr,
    icon: card.provider.icon,
    capabilities: [...card.provider.capabilities],
    credentialFields: card.provider.credentialFields.map((field) => ({
      key: field.key,
      labelAr: field.labelAr,
      secret: field.secret,
      required: field.required,
      placeholder: field.placeholder,
      helpAr: field.helpAr,
    })),
    proposal: card.provider.proposal,
    status: card.status,
    publicValues: card.publicValues,
    secretMasks: card.secretMasks,
    lastSyncAt: card.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: card.lastSyncStatus,
    lastSyncMessage: card.lastSyncMessage,
  }));

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href={`/${params.locale}/dashboard/integrations/import`}>
              {t('startImport')}
            </Link>
          </Button>
        }
      />

      <IntegrationsManager integrations={rows} locale={params.locale} />

      <Card className="mt-4">
        <CardHeader title={tImport('history')} description={tImport('historyHint')} />
        <CardBody className="p-0">
          {jobs.length === 0 ? (
            <EmptyState title={tImport('noJobs')} description={tImport('noJobsHint')} compact />
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <Badge tone={JOB_TONES[job.status]}>{tImport(`status.${job.status}`)}</Badge>
                  <span className="text-[13px] text-foreground">{job.source}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {tImport('jobSummary', {
                      imported: job.imported,
                      skipped: job.skipped,
                      failed: job.failed,
                      total: job.totalRows,
                    })}
                  </span>
                  <span className="text-xs text-subtle-foreground ms-auto">
                    {formatDateTime(job.createdAt, params.locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
