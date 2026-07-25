import * as Joi from 'joi';

/**
 * Boot-time environment validation.
 *
 * Checks that every required variable is PRESENT, not that its value works.
 * Placeholder values are expected until Supabase setup is finished — a missing
 * variable must fail fast here rather than surface as `undefined` at runtime.
 */
export const validationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),
  SUPABASE_URL: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

  // A Supabase project signs its tokens one of two ways depending on when it
  // was created, so neither variable can be required on its own — but one of
  // them must be set or no token can ever be verified.
  //
  // `.empty('')` throughout this block: .env.example ships these keys with no
  // value, so an untouched line must read as unset rather than as the empty
  // string — otherwise `.or()` below would accept `SUPABASE_JWT_SECRET=`.
  SUPABASE_JWT_SECRET: Joi.string().empty(''),
  SUPABASE_JWKS_URL: Joi.string().uri().empty(''),

  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .empty('')
    .default('development'),
  CORS_ORIGIN: Joi.string().empty(''),
  PORT: Joi.number().empty('').default(3000),

  // Which slip verifier to bind (src/slips/slips.module.ts). `slipok` is a
  // valid value but has no implementation yet — it is accepted here and
  // rejected at boot by the module, so the error names the missing ticket
  // rather than an unknown env value.
  SLIP_VERIFIER: Joi.string()
    .valid('mock', 'manual', 'slipok')
    .empty('')
    .default('mock'),

  // Only read when SLIP_VERIFIER=mock.
  SLIP_VERIFIER_MODE: Joi.string()
    .valid('always-verified', 'always-invalid')
    .empty('')
    .default('always-verified'),

  // Which zone recommender to bind (src/ai/ai.module.ts). `gemini` is a valid
  // value but has no implementation yet — same arrangement as SLIP_VERIFIER
  // above: accepted here, rejected at boot by the module, so the error names
  // the missing ticket rather than an unknown env value.
  ZONE_RECOMMENDER: Joi.string()
    .valid('rule', 'gemini')
    .empty('')
    .default('rule'),
})
  .or('SUPABASE_JWT_SECRET', 'SUPABASE_JWKS_URL')
  .messages({
    'object.missing':
      'Set exactly one of SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET. ' +
      'Newer Supabase projects sign tokens with asymmetric keys — use ' +
      'SUPABASE_JWKS_URL (Dashboard → Project Settings → API → JWT Keys). ' +
      'Older projects use a shared HS256 secret — use SUPABASE_JWT_SECRET.',
  });
