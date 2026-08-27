import * as Joi from 'joi';

/**
 * Boot-time validation checks presence and safe provider selection. Real
 * credentials remain in .env only; placeholder values are valid for offline
 * build and test environments.
 */
export const validationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),
  SUPABASE_URL: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

  SUPABASE_JWT_SECRET: Joi.string().empty(''),
  SUPABASE_JWKS_URL: Joi.string().uri().empty(''),

  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .empty('')
    .default('development'),
  CORS_ORIGIN: Joi.string().empty(''),
  PORT: Joi.number().empty('').default(3000),

  VAPID_SUBJECT: Joi.string().empty(''),
  VAPID_PUBLIC_KEY: Joi.string().empty(''),
  VAPID_PRIVATE_KEY: Joi.string().empty(''),

  SLIP_VERIFIER: Joi.string()
    .valid('mock', 'manual', 'slipok')
    .empty('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .required()
        .messages({
          'any.required':
            'SLIP_VERIFIER must be set explicitly when NODE_ENV=production. ' +
            'There is no production default because the mock verifier can auto-confirm unpaid bookings.',
        }),
      otherwise: Joi.string().default('mock'),
    }),

  SLIP_VERIFIER_MODE: Joi.string()
    .valid('always-verified', 'always-invalid')
    .empty('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.when('SLIP_VERIFIER', {
        is: 'mock',
        then: Joi.string().required().messages({
          'any.required':
            'SLIP_VERIFIER_MODE must be set explicitly when NODE_ENV=production and SLIP_VERIFIER=mock.',
        }),
      }),
      otherwise: Joi.string().default('always-verified'),
    }),

  SLIPOK_BRANCH_ID: Joi.string().empty('').when('SLIP_VERIFIER', {
    is: 'slipok',
    then: Joi.string().required(),
  }),
  SLIPOK_API_KEY: Joi.string().empty('').when('SLIP_VERIFIER', {
    is: 'slipok',
    then: Joi.string().required(),
  }),

  ZONE_RECOMMENDER: Joi.string()
    .valid('rule', 'gemini')
    .empty('')
    .default('rule'),
  SUPPORT_ASSISTANT: Joi.string()
    .valid('rule', 'gemini')
    .empty('')
    .default('rule'),
  GEMINI_API_KEY: Joi.string()
    .empty('')
    .when('SUPPORT_ASSISTANT', {
      is: 'gemini',
      then: Joi.string().required(),
      otherwise: Joi.when('ZONE_RECOMMENDER', {
        is: 'gemini',
        then: Joi.string().required(),
      }),
    }),
  GEMINI_MODEL: Joi.string()
    .empty('')
    .pattern(/^gemini-[a-z0-9.-]*flash(?:-lite)?(?:-[a-z0-9.-]+)?$/i)
    .default('gemini-3.5-flash-lite')
    .messages({
      'string.pattern.base':
        'GEMINI_MODEL must be a Gemini Flash or Flash-Lite model. Pro models are forbidden.',
    }),
  GEMINI_SUPPORT_MODEL: Joi.string()
    .empty('')
    .pattern(/^gemini-[a-z0-9.-]*flash(?:-lite)?(?:-[a-z0-9.-]+)?$/i)
    .default('gemini-3.6-flash')
    .messages({
      'string.pattern.base':
        'GEMINI_SUPPORT_MODEL must be a Gemini Flash or Flash-Lite model. Pro models are forbidden.',
    }),
})
  .and('VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY')
  .xor('SUPABASE_JWT_SECRET', 'SUPABASE_JWKS_URL')
  .messages({
    'object.missing':
      'Set exactly one of SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET. Newer projects use JWKS; older projects use HS256.',
    'object.xor':
      'SUPABASE_JWKS_URL and SUPABASE_JWT_SECRET are both set. Keep exactly one signing scheme.',
  });
