import { randomUUID } from 'crypto';

export function generateEventSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');

  const suffix = randomUUID().replace(/-/g, '').slice(0, 6);

  return base ? `${base}-${suffix}` : `event-${suffix}`;
}
