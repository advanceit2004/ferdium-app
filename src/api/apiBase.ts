import {
  DEV_API_FRANZ_WEBSITE,
  LIVE_FERDIUM_API,
  LIVE_FRANZ_API,
  LOCAL_HOSTNAME,
  LOCAL_SERVER,
  SERVER_NOT_LOADED,
} from '../config';
/**
 * Get API base URL from store
 */
import { API_VERSION } from '../environment-remote';
import { BRAND } from '../brand.generated';

// Sentinels written into settings by older releases. `LOCAL_SERVER` is the
// current spelling of the same concept, so all of them mean the same thing:
// "this install talks to a bundled/local server rather than a remote one".
// They must be kept verbatim for existing settings files to keep resolving.
const LEGACY_NO_SERVER_SENTINELS = [
  'You are using Ferdi without a server',
  'You are using Ferdium without a server',
];

const isNoServerSentinel = (serverType: string): boolean =>
  serverType === LOCAL_SERVER || LEGACY_NO_SERVER_SENTINELS.includes(serverType);
import { fixUrl } from '../helpers/url-helpers';

// Note: This cannot be used from the internal-server since we are not running within the context of a browser window
export default function apiBase(withVersion = true) {
  if (!(window as any).ferdium?.stores.settings?.all?.app.server) {
    // Stores have not yet been loaded - return SERVER_NOT_LOADED to force a retry when stores are loaded
    return SERVER_NOT_LOADED;
  }

  const url =
    (window as any).ferdium.stores.settings.all.app.server === LOCAL_SERVER
      ? `http://${LOCAL_HOSTNAME}:${
          (window as any).ferdium.stores.requests.localServerPort
        }`
      : (window as any).ferdium.stores.settings.all.app.server;

  return fixUrl(withVersion ? `${url}/${API_VERSION}` : url);
}

export const needsToken = (): boolean => {
  return (
    (window as any).ferdium.stores.settings.all.app.server === LOCAL_SERVER
  );
};

export const localServerToken = (): string | undefined => {
  return needsToken()
    ? (window as any).ferdium.stores.requests.localServerToken
    : undefined;
};

export const importExportURL = () => {
  const base = apiBase(false);
  return needsToken() ? `${base}/token/${localServerToken()}` : base;
};

export const serverBase = () => {
  const serverType = (window as any).ferdium.stores.settings.all.app.server;

  if (serverType === LIVE_FRANZ_API) return fixUrl(DEV_API_FRANZ_WEBSITE);
  if (isNoServerSentinel(serverType)) return fixUrl(LIVE_FERDIUM_API);
  return fixUrl(serverType);
};

export const serverName = (): string => {
  const serverType = (window as any).ferdium.stores.settings.all.app.server;

  if (serverType === LIVE_FRANZ_API) return 'Franz';
  if (serverType === LIVE_FERDIUM_API) return BRAND.appName;
  if (isNoServerSentinel(serverType)) return 'No';
  return 'Custom';
};
