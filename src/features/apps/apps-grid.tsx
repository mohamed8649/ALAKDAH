'use client';

import Link from 'next/link';
import { Lock, Settings } from 'lucide-react';
import { useState } from 'react';

import { setAppEnabledAction } from '@/app/actions/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Icon } from '@/components/layout/icon';
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useLocale, useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

export interface AppCardData {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: string;
  icon: string;
  settingsRoute: string | null;
  isCore: boolean;
  isEnabled: boolean;
  availableInPlan: boolean;
}

const CATEGORIES = ['general', 'sales', 'operations', 'marketing', 'security', 'integrations'];

/**
 * Apps grid.
 *
 * An app the plan does not include shows a locked toggle and says so, rather
 * than appearing available and failing on click. The toggle is optimistic but
 * reverts if the server refuses.
 */
export function AppsGrid({ apps, locale }: { apps: AppCardData[]; locale: string }) {
  const t = useTranslations('apps');
  const tApp = useTranslations('app');
  const tBilling = useTranslations('billing');
  const currentLocale = useLocale();
  const { toast } = useToast();

  const [states, setStates] = useState(
    Object.fromEntries(apps.map((app) => [app.key, app.isEnabled])),
  );
  const [pending, setPending] = useState<string | null>(null);

  const toggle = async (app: AppCardData, next: boolean) => {
    setPending(app.key);
    setStates((current) => ({ ...current, [app.key]: next }));

    const result = await setAppEnabledAction(app.key, next);
    setPending(null);

    if (!result.ok) {
      // Revert: the server is the source of truth, not the switch.
      setStates((current) => ({ ...current, [app.key]: !next }));
      toast({
        title: result.error.code === 'FEATURE_NOT_IN_PLAN' ? t('notInPlan') : tApp('retry'),
        tone: 'error',
      });
      return;
    }

    toast({ title: next ? t('enabledToast') : t('disabledToast'), tone: 'success' });
  };

  const renderApps = (list: AppCardData[]) => (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((app) => {
        const enabled = states[app.key] ?? app.isEnabled;
        const locked = !app.availableInPlan;

        return (
          <li key={app.key}>
            <Card className={cn('h-full', locked && 'opacity-75')}>
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)]',
                      enabled && !locked
                        ? 'bg-[var(--primary-soft)] text-primary'
                        : 'bg-surface-3 text-muted-foreground',
                    )}
                  >
                    <Icon name={app.icon} className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {currentLocale === 'ar' ? app.nameAr : app.nameEn}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {currentLocale === 'ar' ? app.descriptionAr : app.descriptionEn}
                    </p>
                  </div>

                  <Switch
                    checked={enabled && !locked}
                    disabled={locked || pending === app.key}
                    onCheckedChange={(next) => toggle(app, next)}
                    aria-label={currentLocale === 'ar' ? app.nameAr : app.nameEn}
                    className="mt-0.5 shrink-0"
                  />
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  {app.isCore ? <Badge tone="info">{t('core')}</Badge> : null}
                  {locked ? (
                    <Badge tone="warning" icon={<Lock className="size-3" />}>
                      {t('notInPlan')}
                    </Badge>
                  ) : enabled ? (
                    <Badge tone="success" dot>
                      {t('enabled')}
                    </Badge>
                  ) : null}

                  {locked ? (
                    <Button asChild variant="ghost" size="sm" className="ms-auto">
                      <Link href={`/${locale}/dashboard/billing`}>{tBilling('changePlan')}</Link>
                    </Button>
                  ) : app.settingsRoute && enabled ? (
                    <Button asChild variant="ghost" size="sm" className="ms-auto">
                      <Link href={`/${locale}${app.settingsRoute}`}>
                        <Settings aria-hidden />
                        {t('configure')}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Tabs defaultValue="all">
      <TabsList>
        <TabsTrigger value="all">{tApp('all')}</TabsTrigger>
        {CATEGORIES.map((category) => (
          <TabsTrigger key={category} value={category}>
            {t(`categories.${category}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="all" className="mt-4">
        {renderApps(apps)}
      </TabsContent>

      {CATEGORIES.map((category) => (
        <TabsContent key={category} value={category} className="mt-4">
          {renderApps(apps.filter((app) => app.category === category))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
