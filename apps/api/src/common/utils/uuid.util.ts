/**
 * Loose UUID-shape check: 8-4-4-4-12 hexadecimal digits, case-insensitive.
 *
 * Five legacy ids in prisma/seed.ts predate seedUuid() and do not carry a
 * valid RFC 4122 version/variant combination. PostgreSQL's native uuid type
 * accepts them, so API boundaries that may receive those ids must validate
 * their shape rather than their RFC metadata.
 */
export const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLooseUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_SHAPE.test(value);
}
