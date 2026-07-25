import { Prisma, SlipStatus } from '@prisma/client';

/**
 * DI token for the slip verifier. An interface disappears at compile time, so
 * Nest needs a runtime token to inject against — hence a Symbol rather than a
 * class. Inject with `@Inject(SLIP_VERIFIER)`.
 */
export const SLIP_VERIFIER = Symbol('SLIP_VERIFIER');

/*
 * Money on both sides of this contract is `Prisma.Decimal`, never `number`
 * (AGENTS.md §6.1).
 *
 * This is an internal TypeScript contract, not the HTTP boundary. A provider
 * that talks to an external API owns the conversion from its own wire format
 * (SlipOK sends a JSON number) into `Decimal`, and does it inside itself.
 * Callers never pass a float in and never receive one back.
 *
 * The reason it matters: invariant §6.3.7 compares the slip amount to
 * `booking.boothPrice` for **exact equality**. Binary floating point cannot
 * represent every two-decimal baht value, so a `number` round-trip can make an
 * amount that is correct to the satang compare as unequal — and a vendor who
 * paid the right amount would be told their slip is invalid.
 */

/** What the caller hands a verifier. */
export interface SlipVerificationInput {
  /**
   * Short-lived signed URL to the slip image in Supabase Storage. The bucket is
   * private (AGENTS.md §14.1) — never a permanent public URL.
   */
  slipImageUrl: string;

  /**
   * `booking.boothPrice`, the amount the slip must show (invariant §6.3.7).
   * Pass the `Decimal` straight off the booking row — do not convert it.
   */
  expectedAmount: Prisma.Decimal;
}

/**
 * What a verifier returns. Field names match model `VerifiedSlip` in
 * schema.prisma one for one, so the caller can persist the result without a
 * translation layer.
 *
 * Everything except `status` is optional: a failed or errored verification
 * carries no transaction details.
 */
export interface SlipVerificationResult {
  /** Persisted as `verifiedSlip.slipokStatus`. */
  status: SlipStatus;

  /** Bank transaction reference. Unique — this is the duplicate-slip guard (§6.3.7). */
  transRef?: string;

  /**
   * Amount read off the slip, already converted to `Decimal` by the provider.
   * Compare against `expectedAmount` with `.equals()`, not `===`, and persist
   * it as `verifiedSlip.amount` unchanged.
   */
  amount?: Prisma.Decimal;

  sendingBank?: string;

  /**
   * Payer identity. Admin-facing only — never returned to a vendor and never
   * logged (AGENTS.md §14.1).
   */
  senderName?: string;
  receiverName?: string;

  /**
   * The provider's untouched response, persisted as `verifiedSlip.slipokRaw`.
   * Contains payer name and bank: never log it, never send it to a vendor.
   */
  raw?: unknown;

  /** Human-readable explanation for a non-VERIFIED status. Safe to show an admin. */
  message?: string;
}

/**
 * The socket a real SlipOK client plugs into. Consumers depend on this
 * interface only, so swapping mock → manual → slipok is an env-var change and
 * touches no calling code.
 */
export interface SlipVerifier {
  verify(input: SlipVerificationInput): Promise<SlipVerificationResult>;
}
