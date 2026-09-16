import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AgentShell } from '@/features/call-center/agent-shell';
import { getSessionAgent } from '@/server/auth/session';

/**
 * Agent portal layout.
 *
 * A separate experience, not the merchant dashboard with a different title: one
 * job (work the assigned queue), a two-item navigation, and no access to
 * catalogue, settings or billing.
 */
export default async function AgentPortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const agent = await getSessionAgent();
  if (!agent) redirect(`/${params.locale}/agent/login`);

  return (
    <AgentShell
      agent={{ fullName: agent.fullName, username: agent.username, storeName: agent.storeName }}
      locale={params.locale}
    >
      {children}
    </AgentShell>
  );
}
