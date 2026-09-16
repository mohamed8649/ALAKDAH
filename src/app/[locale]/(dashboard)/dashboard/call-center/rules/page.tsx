import type { Metadata } from 'next';

import { AgentRulesManager } from '@/features/call-center/rules-manager';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listAgentRules, listAgents } from '@/server/services/agent-service';
import { searchProductsForPicker } from '@/server/services/product-service';

export const metadata: Metadata = { title: 'قواعد التوزيع' };
export const dynamic = 'force-dynamic';

export default async function AgentRulesPage() {
  const context = await requirePermission('callcenter.view');

  const [rules, agents, products] = await Promise.all([
    listAgentRules(context),
    listAgents(context),
    hasPermission(context, 'products.view')
      ? searchProductsForPicker(context, '', 100)
      : Promise.resolve([]),
  ]);

  return (
    <AgentRulesManager
      rules={JSON.parse(JSON.stringify(rules))}
      agents={agents.filter((agent) => agent.isActive).map((agent) => ({ id: agent.id, name: agent.fullName }))}
      products={products.map((product) => ({ id: product.id, name: product.name }))}
      canManage={hasPermission(context, 'callcenter.manage')}
    />
  );
}
