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
  recipes: {
    url: 'https://github.com/ferdium/ferdium-recipes',
    branch: 'main',
  },
  features: {
    accounts: true,
    todos: true,
    workspaces: true,
    autoUpdates: true,
    sentry: true,
  },
  // Tokens that upstream bakes into strings/locales and that the runtime brand
  // sanitizer must neutralize. Client brands override these via `brand.json`'s
  // optional `legacy` block. When the active brand *is* upstream, these collapse
  // to no-ops.
  legacy: {
    names: ['Ferdium'],
    domains: ['www.ferdium.org', 'ferdium.org'],
    githubOwners: ['ferdium'],
    tokens: {},
  },
} as const;

export type BrandConfig = typeof BRAND;
