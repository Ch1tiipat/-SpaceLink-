import { generateEventSlug } from './event-slug.util';

describe('generateEventSlug', () => {
  it('creates a readable lowercase slug for an English event name', () => {
    expect(generateEventSlug('Future Tech Expo 2026')).toMatch(
      /^future-tech-expo-2026-[0-9a-f]{6}$/,
    );
  });

  it('keeps meaningful ASCII digits from a Thai event name', () => {
    expect(generateEventSlug('งานเกษตร มทส. 2569')).toMatch(
      /^2569-[0-9a-f]{6}$/,
    );
  });

  it('uses the event fallback for a Thai-only event name', () => {
    expect(generateEventSlug('ลานจัดงานเกษตร')).toMatch(/^event-[0-9a-f]{6}$/);
  });

  it('collapses whitespace and hyphens and limits the base to 60 characters', () => {
    const slug = generateEventSlug(`  ${'A'.repeat(70)} --- Expo  `);
    const [base, suffix] = splitSuffix(slug);

    expect(base).toHaveLength(60);
    expect(base).toBe('a'.repeat(60));
    expect(suffix).toMatch(/^[0-9a-f]{6}$/);
  });
});

function splitSuffix(slug: string): [string, string] {
  const separator = slug.lastIndexOf('-');
  return [slug.slice(0, separator), slug.slice(separator + 1)];
}
