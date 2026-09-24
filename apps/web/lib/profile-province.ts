export const MAX_PROVINCE_LENGTH = 100;

export function normalizeProvince(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function provinceValidationError(value: string): string | null {
  const normalized = normalizeProvince(value);
  if (!normalized) return null;
  if (normalized.length > MAX_PROVINCE_LENGTH) {
    return `จังหวัดต้องมีความยาวไม่เกิน ${MAX_PROVINCE_LENGTH} ตัวอักษร`;
  }
  return null;
}
