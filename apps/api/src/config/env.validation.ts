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
  SUPABASE_JWT_SECRET: Joi.string().required(),
  PORT: Joi.number().default(3000),
});
