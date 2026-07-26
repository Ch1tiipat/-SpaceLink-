import * as Joi from 'joi';
import { validationSchema } from './env.validation';

/** The variables every environment needs, so a case can vary only what it tests. */
const REQUIRED = {
  DATABASE_URL:
    'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  DIRECT_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder',
  SUPABASE_JWT_SECRET: 'placeholder',
};

/**
 * Matches how @nestjs/config calls the schema.
 *
 * The return type is written out rather than inferred: `Joi.object({...})` is
 * an `ObjectSchema<any>`, so an inferred `value` is `any` and every read of it
 * is an unchecked assignment. Naming the shape once here keeps that out of the
 * cases below.
 */
function validate(
  env: Record<string, string>,
): Joi.ValidationResult<Record<string, unknown>> {
  return validationSchema.validate(
    { ...REQUIRED, ...env },
    { allowUnknown: true, abortEarly: false },
  );
}

/**
 * The environment the schema produced, for the cases that assert on defaults it
 * filled in.
 *
 * `Joi.ValidationResult` is a discriminated union, and its *failure* branch
 * declares `value: any` — so no type argument on `validate` can make `value`
 * safe to read. It has to be narrowed on `error` first, which is what this
 * does. Throwing rather than asserting is what makes the narrowing real to the
 * compiler; an unexpected validation error still fails the test, and does it
 * with joi's own message instead of as an `undefined` two assertions later.
 */
function validatedEnv(env: Record<string, string>): Record<string, unknown> {
  const result = validate(env);

  if (result.error) {
    throw result.error;
  }

  return result.value;
}

describe('env validation', () => {
  describe('slip verifier defaults', () => {
    it('defaults to the mock verifier outside production', () => {
      expect(validatedEnv({})).toMatchObject({
        SLIP_VERIFIER: 'mock',
        SLIP_VERIFIER_MODE: 'always-verified',
      });
    });

    /*
     * The finding this guards: an unset SLIP_VERIFIER in production used to
     * default to a mock that returns VERIFIED for every slip, which confirms a
     * booking nobody paid for (CLAUDE.md §8 step 3). A deploy that forgot the
     * variable booted green.
     */
    it('refuses to boot in production when SLIP_VERIFIER is unset', () => {
      const { error } = validate({ NODE_ENV: 'production' });

      expect(error?.message).toContain('SLIP_VERIFIER');
    });

    it('refuses to boot in production when the mock has no explicit mode', () => {
      const { error } = validate({
        NODE_ENV: 'production',
        SLIP_VERIFIER: 'mock',
      });

      expect(error?.message).toContain('SLIP_VERIFIER_MODE');
    });

    // The mode only applies to the mock, so requiring it here would fail a boot
    // over a variable that changes nothing.
    it('does not demand a mode in production when the verifier is not the mock', () => {
      const { error } = validate({
        NODE_ENV: 'production',
        SLIP_VERIFIER: 'manual',
      });

      expect(error).toBeUndefined();
    });

    it('accepts an explicit production configuration', () => {
      expect(
        validatedEnv({
          NODE_ENV: 'production',
          SLIP_VERIFIER: 'mock',
          SLIP_VERIFIER_MODE: 'always-invalid',
        }),
      ).toMatchObject({ SLIP_VERIFIER_MODE: 'always-invalid' });
    });
  });

  describe('token verification keys', () => {
    it('accepts exactly one signing scheme', () => {
      expect(validate({}).error).toBeUndefined();
      expect(
        validate({
          SUPABASE_JWT_SECRET: '',
          SUPABASE_JWKS_URL: 'https://placeholder.supabase.co/jwks.json',
        }).error,
      ).toBeUndefined();
    });

    // Both set is a half-finished migration. SupabaseTokenService would pick
    // JWKS and silently ignore the secret, so the boot has to say so instead.
    it('rejects both being set', () => {
      const { error } = validate({
        SUPABASE_JWKS_URL: 'https://placeholder.supabase.co/jwks.json',
      });

      expect(error?.message).toContain('both set');
    });

    it('rejects neither being set', () => {
      const { error } = validate({ SUPABASE_JWT_SECRET: '' });

      expect(error?.message).toContain('Set exactly one');
    });
  });
});
