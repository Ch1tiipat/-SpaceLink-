import { Prisma } from '@prisma/client';

/**
 * Converts a nullable Decimal column to its string form for an API response.
 *
 * Money and coordinates are `Decimal` in the schema and must cross the API
 * boundary via `.toString()`, never `parseFloat` or a JSON number (AGENTS.md
 * §6.1) — a float silently loses precision on exactly the values that matter.
 *
 * Only for nullable columns. A required Decimal — `Booth.boothPrice` — calls
 * `.toString()` directly, so its response field stays `string` rather than
 * widening to `string | null` for a null that cannot happen.
 */
export function decimalString(value: Prisma.Decimal | null): string | null {
  return value?.toString() ?? null;
}
