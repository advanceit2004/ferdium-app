# White-label GitHub Actions

This fork includes `.github/workflows/white-label-build.yml`.

## What it does

Manual workflow for validating or building a selected client brand package.

Inputs:

- `brand_repo`: repo containing brand packages, default `advanceit2004/whitelabel-branding`
- `brand_ref`: branch/tag/SHA, default `main`
- `brand_path`: brand folder inside branding repo, default `brands/example`
- `mode`: `validate` or `build`
- `platform`: `linux`, `windows`, or `macos` when building
- `publish`: `never` or `always`

## Required secret for private branding repo

Because `whitelabel-branding` is private, add a repository secret to `advanceit2004/ferdium-app`:

```text
WHITELABEL_BRANDING_TOKEN
```

Use a fine-grained GitHub token with read-only Contents access to `advanceit2004/whitelabel-branding`.

If this secret is missing, the workflow can still read public branding repos, but not private ones.

## Cost/resources

Use `mode=validate` first. It is cheap and only checks brand generation. Use `mode=build` only when needed because Electron builds can consume GitHub Actions minutes, especially macOS.

## Publishing/signing

Publishing and signed builds require the existing release/signing secrets:

- `FERDIUM_PUBLISH_TOKEN`
- `APPLEID`
- `APPLEID_PASSWORD`
- `APPLE_TEAM_ID`
- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`
