// Default generated brand config. Recreate with `pnpm brand:apply <brand-folder>` for client builds.

export const BRAND = {
  appName: 'Ferdium',
  appSlug: 'ferdium',
  appId: 'org.ferdium.ferdium-app',
  protocol: 'ferdium',
  description: 'Messaging app for WhatsApp, Slack, Telegram, Hangouts and many many more.',
  website: 'https://ferdium.org',
  supportEmail: 'hello@ferdium.org',
  privacyUrl: 'https://ferdium.org/privacy',
  termsUrl: 'https://ferdium.org/terms',
  accentColor: '#7367F0',
  translationUrl: 'https://crowdin.com/project/ferdium-app',
  api: {
    defaultServerUrl: 'https://api.ferdium.org',
    debugUrl: 'https://debug.ferdium.org',
    translatorUrl: 'https://translator.ferdium.org/translate',
  },
  github: {
    owner: 'ferdium',
    repo: 'ferdium-app',
  },
  features: {
    accounts: true,
    todos: true,
    workspaces: true,
    autoUpdates: true,
    sentry: true,
  },
} as const;

export type BrandConfig = typeof BRAND;
