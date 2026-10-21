import { join } from 'node:path';
import { BRAND } from './brand.generated';
import {
  DEV_API_FRANZ_WEBSITE,
  DEV_FRANZ_API,
  DEV_WS_API,
  LIVE_API_FERDIUM_WEBSITE,
  LIVE_FERDIUM_API,
  LIVE_WS_API,
  LOCAL_API,
  LOCAL_API_WEBSITE,
  LOCAL_WS_API,
} from './config';
import { api as electronApi } from './electron-util';
import { isWindows } from './environment';
import { resolveProfileDirName } from './helpers/profile-dir-helpers';

export const { app } = electronApi;
export const ferdiumVersion: string = app.getVersion();
export const ferdiumLocale: string = app.getLocale();

/**
 * Profile directory names of the upstream app, kept so that a rebranded build
 * adopts an existing installation instead of starting from an empty profile.
 * The brand directory always wins when both exist, and a fresh install is
 * created under the brand name.
 */
const legacyDataDirNames: readonly string[] = BRAND.legacy?.names ?? [];

const resolveDataDirName = (baseDir: string, suffix = ''): string =>
  resolveProfileDirName(baseDir, app.name, legacyDataDirNames, suffix);

// Set app directory before loading user modules
if (process.env.FERDIUM_APPDATA_DIR != null) {
  app.setPath('appData', process.env.FERDIUM_APPDATA_DIR);
  app.setPath('userData', app.getPath('appData'));
} else if (process.env.PORTABLE_EXECUTABLE_DIR != null) {
  const dataDirName = resolveDataDirName(
    process.env.PORTABLE_EXECUTABLE_DIR,
    'AppData',
  );
  app.setPath(
    'appData',
    join(process.env.PORTABLE_EXECUTABLE_DIR, dataDirName),
  );
  app.setPath('userData', join(app.getPath('appData'), dataDirName));
} else if (isWindows && process.env.APPDATA != null) {
  app.setPath('appData', process.env.APPDATA);
  app.setPath(
    'userData',
    join(app.getPath('appData'), resolveDataDirName(app.getPath('appData'))),
  );
} else {
  const dataDirName = resolveDataDirName(app.getPath('appData'));
  if (dataDirName !== app.name) {
    app.setPath('userData', join(app.getPath('appData'), dataDirName));
  }
}

export const isDevMode: boolean =
  process.env.ELECTRON_IS_DEV === undefined
    ? !app.isPackaged
    : Number.parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;
if (isDevMode) {
  app.setPath(
    'userData',
    join(
      app.getPath('appData'),
      resolveDataDirName(app.getPath('appData'), 'Dev'),
    ),
  );
}

export const userDataPath = (...segments: string[]): string => {
  return join(app.getPath('userData'), ...[segments].flat());
};

export const userDataRecipesPath = (...segments: string[]): string => {
  return userDataPath('recipes', ...[segments].flat());
};

export const userDataCertsPath = (...segments: string[]): string => {
  return userDataPath('certs', ...[segments].flat());
};

const useLocalAPI = process.env.USE_LOCAL_API;
export const useLiveAPI = process.env.USE_LIVE_API;

let api: string;
let wsApi: string;
let web: string;
if (!isDevMode || (isDevMode && useLiveAPI)) {
  api = LIVE_FERDIUM_API;
  wsApi = LIVE_WS_API;
  web = LIVE_API_FERDIUM_WEBSITE;
} else if (isDevMode && useLocalAPI) {
  api = LOCAL_API;
  wsApi = LOCAL_WS_API;
  web = LOCAL_API_WEBSITE;
} else {
  api = DEV_FRANZ_API;
  wsApi = DEV_WS_API;
  web = DEV_API_FRANZ_WEBSITE;
}

export const API: string = api;
export const API_VERSION: string = 'v1';
export const WS_API: string = wsApi;
export const WEBSITE: string = web;
// For deeplink protocol: the brand protocol, or `<protocol>-dev` during development
export const protocolClient = isDevMode
  ? `${BRAND.protocol}-dev`
  : BRAND.protocol;
