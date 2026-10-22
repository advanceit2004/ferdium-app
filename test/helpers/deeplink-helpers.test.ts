import {
  deepLinkSchemes,
  stripDeepLinkPrefix,
} from '../../src/helpers/deeplink-helpers';

describe('deeplink-helpers', () => {
  it('puts the brand scheme first and keeps the upstream scheme', () => {
    expect(deepLinkSchemes('officewebaccess', ['ferdium'], false)).toEqual([
      'officewebaccess',
      'ferdium',
    ]);
  });

  it('suffixes every scheme in development builds', () => {
    expect(deepLinkSchemes('officewebaccess', ['ferdium'], true)).toEqual([
      'officewebaccess-dev',
      'ferdium-dev',
    ]);
  });

  it('deduplicates when the legacy scheme matches the brand', () => {
    expect(deepLinkSchemes('ferdium', ['ferdium', ''], false)).toEqual([
      'ferdium',
    ]);
  });

  it('strips either prefix', () => {
    const prefixes = deepLinkSchemes('officewebaccess', ['ferdium'], false).map(
      scheme => `${scheme}://`,
    );

    expect(stripDeepLinkPrefix('officewebaccess://service/1', prefixes)).toBe(
      'service/1',
    );
    expect(stripDeepLinkPrefix('ferdium://service/1', prefixes)).toBe(
      'service/1',
    );
  });

  it('ignores unrelated schemes', () => {
    const prefixes = ['officewebaccess://', 'ferdium://'];

    expect(
      stripDeepLinkPrefix('https://example.com', prefixes),
    ).toBeUndefined();
    expect(stripDeepLinkPrefix('ferdi://service/1', prefixes)).toBeUndefined();
  });

  it('returns an empty payload for a bare deeplink', () => {
    expect(stripDeepLinkPrefix('ferdium://', ['ferdium://'])).toBe('');
  });
});
