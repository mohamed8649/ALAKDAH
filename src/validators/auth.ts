import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('validation.invalidEmail').max(200),
  password: z.string().min(1, 'validation.required').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'validation.required').max(120),
    email: z.string().trim().email('validation.invalidEmail').max(200),
    password: z.string().min(8, 'validation.passwordTooWeak').max(200),
    confirmPassword: z.string().min(1, 'validation.required'),
    storeName: z.string().trim().min(2, 'validation.required').max(120),
    storeSlug: z
      .string()
      .trim()
      .min(3, 'validation.tooShort')
      .max(40)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'validation.invalidSlug'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'validation.passwordMismatch',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
