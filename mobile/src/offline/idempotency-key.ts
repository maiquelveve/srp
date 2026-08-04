import * as Crypto from 'expo-crypto';

/** Client-generated UUID sent as the `Idempotency-Key` header (FR-011a, contracts/movements.md). */
export function generateIdempotencyKey(): string {
  return Crypto.randomUUID();
}
