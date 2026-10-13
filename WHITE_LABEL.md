# White-label strategy for this Ferdium app fork

This repository is the desktop app fork. Keep it close to upstream and put client-specific branding in generated/overlay files rather than manual one-off edits.

## Upstream sync workflow

```bash
git remote add upstream https://github.com/ferdium/ferdium-app.git # first time only
git fetch upstream
git checkout develop
git merge upstream/develop
# then re-apply generated branding files/assets
```

## Companion repositories

- App fork: https://github.com/advanceit2004/ferdium-app
- Recipes fork: https://github.com/advanceit2004/ferdium-recipes
- Branding/private configs: https://github.com/advanceit2004/whitelabel-branding
- Future API/backend: https://github.com/advanceit2004/whitelabel-api
- Future website/download/docs: https://github.com/advanceit2004/whitelabel-website

## Future branding automation target

A future `brand:apply` script should read a brand package from `whitelabel-branding` and generate/patch:

- `package.json`: name, productName, appId, desktopName, author, homepage, repository
- `electron-builder.yml`: appId, protocols, icon paths, Linux executable name, publish owner/repo
- `src/config.ts`: API URLs, website URLs, support URLs, accent colors, translator/debug endpoints
- `src/environment-remote.ts`: deeplink protocol and production API defaults
- `src/index.html`: app title
- `src/dev-app-update.yml`: GitHub update owner/repo
- `build-helpers/images/*`: macOS/Windows/Linux icons and installer graphics
- docs/readme links where appropriate

## Recommended rule

Do not manually edit many files for each client. Add or update a brand package, run the apply script, build, test, and release.

## Starter script added

This fork includes a starter script:

```bash
pnpm brand:apply ../whitelabel-branding/brands/example
```

The script currently patches core metadata and copies optional assets. Over time, extend it to replace all remaining Ferdium-specific source constants with imports from `src/brand.generated.ts`.

Useful check:

```bash
pnpm brand:check
```
