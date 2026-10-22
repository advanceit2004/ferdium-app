import type { BrowserWindow } from 'electron';

import { protocolClients } from '../environment-remote';
import { stripDeepLinkPrefix } from '../helpers/deeplink-helpers';

const protocolPrefixes = protocolClients.map(scheme => `${scheme}://`);

export function getDeepLinkFromArgs(args: string[]): string | undefined {
  return args.find(
    arg => stripDeepLinkPrefix(arg, protocolPrefixes) !== undefined,
  );
}

export default function handleDeepLink(
  window: BrowserWindow,
  rawUrl: string,
): void {
  const url = stripDeepLinkPrefix(rawUrl, protocolPrefixes);

  if (!url) {
    return;
  }

  window.webContents.send('navigateFromDeepLink', { url });
}
