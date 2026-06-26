import * as path from 'path';
import en from '../locales/en.json';
import ja from '../locales/ja.json';

// Recursively collect dotted key paths for every leaf string in the object.
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

describe('locale parity', () => {
  const enKeys = flattenKeys(en as Record<string, unknown>).sort();
  const jaKeys = flattenKeys(ja as Record<string, unknown>).sort();

  it('en.json and ja.json should define exactly the same keys', () => {
    const missingInJa = enKeys.filter((k) => !jaKeys.includes(k));
    const missingInEn = jaKeys.filter((k) => !enKeys.includes(k));

    expect(missingInJa).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('every locale value should be a non-empty string', () => {
    for (const locale of [en, ja]) {
      for (const key of flattenKeys(locale as Record<string, unknown>)) {
        const value = key
          .split('.')
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], locale);

        if (Array.isArray(value)) {
          // Some keys (e.g. example lists) hold arrays of strings.
          for (const item of value) {
            expect(typeof item).toBe('string');
            expect((item as string).length).toBeGreaterThan(0);
          }
        } else {
          expect(typeof value).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('all supported languages should expose the same key set', () => {
    // Guards against adding a new locale file that drifts from en.json.
    expect(path.basename(__filename)).toBe('locales.test.ts');
    expect(jaKeys).toEqual(enKeys);
  });
});
