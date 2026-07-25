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
  //
  // No default in production, on purpose. The mock verifier returns VERIFIED
  // for every slip, and a VERIFIED slip auto-confirms its booking with no human
  // in the loop (CLAUDE.md §8 step 3) — so a deploy that simply forgot this
  // variable would take payment-free bookings and look completely healthy doing
  // it. The only signal would be a per-call logger.warn nobody reads on a
  // hosted platform. Refusing to boot is the one failure mode that gets noticed.
  SLIP_VERIFIER: Joi.string()
    .valid('mock', 'manual', 'slipok')
    .empty('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().required().messages({
        'any.required':
          'SLIP_VERIFIER must be set explicitly when NODE_ENV=production. ' +
          'There is no default in production: the mock verifier approves ' +
          'every slip, which would confirm bookings that were never paid for. ' +
          'Use SLIP_VERIFIER=manual until the SlipOK client exists.',
      }),
      otherwise: Joi.string().default('mock'),
    }),

  // Only read when SLIP_VERIFIER=mock — hence required in production only in
  // that case. Demanding it alongside SLIP_VERIFIER=manual would fail the boot
  // over a variable that changes nothing.
  SLIP_VERIFIER_MODE: Joi.string()
    .valid('always-verified', 'always-invalid')
    .empty('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.when('SLIP_VERIFIER', {
        is: 'mock',
        then: Joi.string().required().messages({
          'any.required':
            'SLIP_VERIFIER_MODE must be set explicitly when NODE_ENV=production ' +
            'and SLIP_VERIFIER=mock. It would otherwise default to ' +
            'always-verified and auto-confirm every booking.',
        }),
      }),
      otherwise: Joi.string().default('always-verified'),
    }),

  // Which zone recommender to bind (src/ai/ai.module.ts). `gemini` is a valid
  // value but has no implementation yet — same arrangement as SLIP_VERIFIER
  // above: accepted here, rejected at boot by the module, so the error names
  // the missing ticket rather than an unknown env value.
  ZONE_RECOMMENDER: Joi.string()
    .valid('rule', 'gemini')
    .empty('')
    .default('rule'),
})
  // `.xor`, not `.or`: with both set, SupabaseTokenService silently picks JWKS
  // and ignores the secret. A half-finished migration would then verify against
  // whichever one nobody meant, and look fine until it did not.
  .xor('SUPABASE_JWT_SECRET', 'SUPABASE_JWKS_URL')
  .messages({
    'object.missing':
      'Set exactly one of SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET. ' +
      'Newer Supabase projects sign tokens with asymmetric keys — use ' +
      'SUPABASE_JWKS_URL (Dashboard → Project Settings → API → JWT Keys). ' +
      'Older projects use a shared HS256 secret — use SUPABASE_JWT_SECRET.',
    'object.xor':
      'SUPABASE_JWKS_URL and SUPABASE_JWT_SECRET are both set. Exactly one ' +
      'signing scheme applies to a Supabase project — keep the one your ' +
      'project actually uses and remove the other, rather than leaving it to ' +
      'the backend to guess which you meant.',
  });
