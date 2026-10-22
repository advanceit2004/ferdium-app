/**
 * Build the list of deeplink schemes this build answers to.
 *
 * The brand scheme comes first, then the upstream schemes, so links created
 * before a rebrand keep opening the app. Development builds use a `<scheme>-dev`
 * suffix, matching upstream behaviour.
 */
export const deepLinkSchemes = (
  brandScheme: string,
  legacySchemes: readonly string[],
  isDevMode: boolean,
): string[] => {
  const suffix = isDevMode ? '-dev' : '';
  const schemes = [brandScheme];

  for (const scheme of legacySchemes) {
    if (scheme && !schemes.includes(scheme)) {
      schemes.push(scheme);
    }
  }

  return schemes.map(scheme => `${scheme}${suffix}`);
};

/**
 * Strip a known deeplink prefix from a URL. Returns `undefined` when the URL
 * does not use one of the given schemes.
 */
export const stripDeepLinkPrefix = (
  rawUrl: string,
  prefixes: readonly string[],
): string | undefined => {
  const prefix = prefixes.find(candidate => rawUrl.startsWith(candidate));

  return prefix === undefined ? undefined : rawUrl.slice(prefix.length);
};
