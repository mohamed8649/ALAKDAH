import { z } from 'zod';

export const agentSchema = z.object({
  fullName: z.string().trim().min(2, 'validation.required').max(120),
  email: z.string().trim().email('validation.invalidEmail').max(200).optional().or(z.literal('')),
  username: z
    .string()
    .trim()
    .min(3, 'validation.tooShort')
    .max(40)
    .regex(/^[a-z0-9_.]+$/, 'validation.invalidUsername'),
  password: z.string().min(8, 'validation.passwordTooWeak').max(200).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  roleKey: z.enum(['call_center_agent', 'order_agent']).default('call_center_agent'),
});

export type AgentInput = z.infer<typeof agentSchema>;

export const agentRuleSchema = z.object({
  name: z.string().trim().min(2, 'validation.required').max(120),
  agentId: z.string().min(1, 'validation.required'),
  productId: z.string().optional().or(z.literal('')),
  priority: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export type AgentRuleInput = z.infer<typeof agentRuleSchema>;

export const agentLoginSchema = z.object({
  storeIdentifier: z.string().trim().min(1, 'validation.required').max(80),
  username: z.string().trim().min(1, 'validation.required').max(40),
  password: z.string().min(1, 'validation.required').max(200),
});

export type AgentLoginInput = z.infer<typeof agentLoginSchema>;
