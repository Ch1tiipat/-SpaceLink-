import * as Joi from 'joi';
import { validationSchema } from './env.validation';

const REQUIRED = {
  DATABASE_URL:
    'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  DIRECT_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder',
  SUPABASE_JWT_SECRET: 'placeholder',
};

function validate(
  env: Record<string, string>,
): Joi.ValidationResult<Record<string, unknown>> {
  return validationSchema.validate(
    { ...REQUIRED, ...env },
    { allowUnknown: true, abortEarly: false },
  );
}

function validatedEnv(env: Record<string, string>): Record<string, unknown> {
  const result = validate(env);
  if (result.error) throw result.error;
  return result.value;
}

describe('env validation', () => {
  it('keeps safe local defaults', () => {
    expect(validatedEnv({})).toMatchObject({
      SLIP_VERIFIER: 'mock',
      SLIP_VERIFIER_MODE: 'always-verified',
      ZONE_RECOMMENDER: 'rule',
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
    });
  });

  it('requires an explicit production slip verifier', () => {
    expect(validate({ NODE_ENV: 'production' }).error?.message).toContain(
      'SLIP_VERIFIER',
    );
  });

  it('requires an explicit production mock mode', () => {
    expect(
      validate({
        NODE_ENV: 'production',
        SLIP_VERIFIER: 'mock',
      }).error?.message,
    ).toContain('SLIP_VERIFIER_MODE');
  });

  it('does not require a mock mode for a production real verifier', () => {
    expect(
      validate({
        NODE_ENV: 'production',
        SLIP_VERIFIER: 'slipok',
        SLIPOK_BRANCH_ID: 'branch',
        SLIPOK_API_KEY: 'key',
      }).error,
    ).toBeUndefined();
  });

  it('requires SlipOK credentials only when SlipOK is selected', () => {
    const { error } = validate({ SLIP_VERIFIER: 'slipok' });

    expect(error?.message).toContain('SLIPOK_BRANCH_ID');
    expect(error?.message).toContain('SLIPOK_API_KEY');
    expect(
      validate({
        SLIP_VERIFIER: 'slipok',
        SLIPOK_BRANCH_ID: 'branch',
        SLIPOK_API_KEY: 'key',
      }).error,
    ).toBeUndefined();
  });

  it('requires a Gemini key only when Gemini is selected', () => {
    expect(validate({ ZONE_RECOMMENDER: 'gemini' }).error?.message).toContain(
      'GEMINI_API_KEY',
    );
    expect(
      validate({
        ZONE_RECOMMENDER: 'gemini',
        GEMINI_API_KEY: 'key',
      }).error,
    ).toBeUndefined();
  });

  it('rejects Pro models and accepts Flash models', () => {
    expect(
      validate({ GEMINI_MODEL: 'gemini-2.5-pro' }).error?.message,
    ).toContain('Flash or Flash-Lite');
    expect(
      validate({ GEMINI_MODEL: 'gemini-2.5-flash' }).error,
    ).toBeUndefined();
  });

  it('accepts exactly one Supabase signing scheme', () => {
    expect(validate({}).error).toBeUndefined();
    expect(
      validate({
        SUPABASE_JWT_SECRET: '',
        SUPABASE_JWKS_URL: 'https://placeholder.supabase.co/jwks.json',
      }).error,
    ).toBeUndefined();
    expect(
      validate({
        SUPABASE_JWKS_URL: 'https://placeholder.supabase.co/jwks.json',
      }).error?.message,
    ).toContain('both set');
    expect(validate({ SUPABASE_JWT_SECRET: '' }).error?.message).toContain(
      'Set exactly one',
    );
  });
});
