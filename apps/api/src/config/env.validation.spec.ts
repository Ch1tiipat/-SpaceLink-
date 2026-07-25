import { validationSchema } from './env.validation';

/** The variables every environment needs, so a case can vary only what it tests. */
const REQUIRED = {
  DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  DIRECT_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder',
  SUPABASE_JWT_SECRET: 'placeholder',
};

/** Matches how @nestjs/config calls the schema. */
function validate(env: Record<string, string>) {
  return validationSchema.validate(
    { ...REQUIRED, ...env },
    { allowUnknown: true, abortEarly: false },
  );
}

describe('env validation', () => {
  describe('slip verifier defaults', () => {
    it('defaults to the mock verifier outside production', () => {
      const { error, value } = validate({});

      expect(error).toBeUndefined();
      expect(value).toMatchObject({
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
      const { error, value } = validate({
        NODE_ENV: 'production',
        SLIP_VERIFIER: 'mock',
        SLIP_VERIFIER_MODE: 'always-invalid',
      });

      expect(error).toBeUndefined();
      expect(value).toMatchObject({ SLIP_VERIFIER_MODE: 'always-invalid' });
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
