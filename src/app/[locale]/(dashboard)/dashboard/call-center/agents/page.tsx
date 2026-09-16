import type { Metadata } from 'next';

import { AgentsManager } from '@/features/call-center/agents-manager';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listAgents } from '@/server/services/agent-service';

export const metadata: Metadata = { title: 'الوكلاء' };
export const dynamic = 'force-dynamic';

export default async function AgentsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('callcenter.view');
  const agents = await listAgents(context);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return (
    <AgentsManager
      agents={JSON.parse(JSON.stringify(agents))}
      locale={params.locale}
      agentLoginUrl={`${appUrl}/${params.locale}/agent/login`}
      canManage={hasPermission(context, 'callcenter.manage')}
    />
  );
}
