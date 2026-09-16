import type { Metadata } from 'next';

import { TokensManager } from '@/features/settings/tokens-manager';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listAccessTokens } from '@/server/services/token-service';

export const metadata: Metadata = { title: 'مفاتيح الوصول' };
export const dynamic = 'force-dynamic';

export default async function TokensPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('tokens.manage');
  const tokens = await listAccessTokens(context);

  return (
    <TokensManager
      tokens={JSON.parse(JSON.stringify(tokens))}
      // A token can never be granted a scope the creating member lacks, so the
      // picker only offers what they actually hold.
      availableScopes={[...context.permissions]}
      locale={params.locale}
      canManage={hasPermission(context, 'tokens.manage')}
    />
  );
}
