import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve the profile directory name to use for this build.
 *
 * A rebranded build must not lose the data of an existing installation, so an
 * upstream directory (`legacyNames`) is adopted when the brand directory does
 * not exist yet. Once a brand directory exists it always wins, which keeps a
 * fresh install branded and stops two brands from sharing a profile.
 *
 * `suffix` mirrors the upstream layout, e.g. `AppData` for portable builds and
 * `Dev` for development, so each variant resolves independently.
 */
export const resolveProfileDirName = (
  baseDir: string,
  brandName: string,
  legacyNames: readonly string[],
  suffix = '',
): string => {
  const brandDirName = `${brandName}${suffix}`;
  if (existsSync(join(baseDir, brandDirName))) {
    return brandDirName;
  }

  for (const legacyName of legacyNames) {
    const legacyDirName = `${legacyName}${suffix}`;
    if (
      legacyName !== brandName &&
      legacyDirName !== brandDirName &&
      existsSync(join(baseDir, legacyDirName))
    ) {
      return legacyDirName;
    }
  }

  return brandDirName;
};
