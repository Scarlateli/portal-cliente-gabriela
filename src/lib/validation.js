/* --------------------------- validação --------------------------------
   Schemas Zod para os formulários críticos. Usar validate(schema, values)
   para obter { ok, data, errors } com errors[campo] = mensagem.
   --------------------------------------------------------------------- */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
  pass: z.string().min(1, 'Informe sua senha.'),
});

export const newProjectSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código do projeto.'),
  name: z.string().trim().min(1, 'Informe o nome do projeto.'),
  clientName: z.string().trim().min(1, 'Informe o nome do cliente.'),
  clientEmail: z
    .string()
    .trim()
    .min(1, 'Informe o e-mail do cliente.')
    .email('E-mail do cliente inválido.'),
  address: z.string().optional(),
  start: z.string().optional(),
  due: z.string().optional(),
  pass: z.string().min(4, 'A senha inicial deve ter ao menos 4 caracteres.'),
});

/** Roda safeParse e devolve a primeira mensagem de erro por campo. */
export function validate(schema, values) {
  const r = schema.safeParse(values);
  if (r.success) return { ok: true, data: r.data, errors: {} };
  const errors = {};
  for (const issue of r.error.issues) {
    const key = issue.path[0];
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, data: null, errors };
}
