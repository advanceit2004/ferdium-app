import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveProfileDirName } from '../../src/helpers/profile-dir-helpers';

const LEGACY = ['Ferdium'];
const BRAND = 'Office Web Access';

describe('profile-dir-helpers', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'profile-dir-'));
  });

  afterEach(() => {
    rmSync(baseDir, { force: true, recursive: true });
  });

  const makeDir = (name: string) => mkdirSync(join(baseDir, name));

  it('uses the brand directory for a fresh install', () => {
    expect(resolveProfileDirName(baseDir, BRAND, LEGACY)).toBe(BRAND);
  });

  it('adopts an existing upstream directory', () => {
    makeDir('Ferdium');

    expect(resolveProfileDirName(baseDir, BRAND, LEGACY)).toBe('Ferdium');
  });

  it('prefers the brand directory when both exist', () => {
    makeDir('Ferdium');
    makeDir(BRAND);

    expect(resolveProfileDirName(baseDir, BRAND, LEGACY)).toBe(BRAND);
  });

  it('resolves suffixed variants independently', () => {
    makeDir('FerdiumAppData');

    expect(resolveProfileDirName(baseDir, BRAND, LEGACY, 'AppData')).toBe(
      'FerdiumAppData',
    );
    expect(resolveProfileDirName(baseDir, BRAND, LEGACY)).toBe(BRAND);
    expect(resolveProfileDirName(baseDir, BRAND, LEGACY, 'Dev')).toBe(
      `${BRAND}Dev`,
    );
  });

  it('ignores a legacy name that matches the brand name', () => {
    makeDir('Ferdium');

    expect(resolveProfileDirName(baseDir, 'Ferdium', LEGACY)).toBe('Ferdium');
  });

  it('keeps the brand directory when no legacy names are configured', () => {
    makeDir('Ferdium');

    expect(resolveProfileDirName(baseDir, BRAND, [])).toBe(BRAND);
  });
});
