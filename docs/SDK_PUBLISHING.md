# Publishing the FIVUCSAS auth SDK to npm

This repo ships the FIVUCSAS auth SDK both as a CDN script-tag bundle (served
from `verify.fivucsas.com`) **and** as npm packages. This document covers the
npm side.

## Packages

| Package | Source entry | What it is |
| --- | --- | --- |
| [`@fivucsas/auth-js`](../packages/auth-js) | `src/verify-app/sdk/core.ts` | Vanilla, zero-dependency core SDK (`FivucsasAuth`, `loginRedirect`, `verify`, OIDC helpers). Tree-shakeable, `sideEffects: false`. |
| [`@fivucsas/auth-elements`](../packages/auth-elements) | `src/verify-app/sdk/elements.ts` | The `<fivucsas-verify>` Web Component (self-registers on import). Bundles the core inline. |

Both are built from the **single canonical SDK source** in
`src/verify-app/sdk/` — there is no duplicated source. The npm build adds no app
code (no React, MUI, Inversify, etc.); the bundles are self-contained.

## Layout

```
packages/
  auth-js/
    package.json        # committed
    README.md           # committed
    LICENSE             # generated at build (copied from repo root, gitignored)
    dist/               # generated at build (gitignored)
  auth-elements/
    package.json
    README.md
    LICENSE             # generated
    dist/               # generated
vite.package.auth-js.config.ts          # ESM + CJS bundle
vite.package.auth-elements.config.ts    # ESM + CJS + IIFE bundle
tsconfig.package.auth-js.json           # .d.ts emit
tsconfig.package.auth-elements.json     # .d.ts emit
scripts/copy-license.mjs                # copies LICENSE into each package
.github/workflows/publish-sdk.yml       # tag-gated publish
```

## Build locally

```bash
npm ci
npm run build:pkgs        # builds both packages (ESM + CJS + .d.ts [+ IIFE for elements])
# or individually:
npm run build:pkg:auth-js
npm run build:pkg:auth-elements
```

Verify the tarball contents without publishing:

```bash
npm pack --dry-run ./packages/auth-js
npm pack --dry-run ./packages/auth-elements
```

Each tarball must contain only `dist/`, `README.md`, `LICENSE`, and
`package.json` — never `src/` or app code.

## Versioning

Both packages start at **0.1.0** and follow semver. Bump the `version` field in
**both** `packages/*/package.json` together (keep them in lockstep for now),
commit, then tag.

## How to actually publish (operator)

Publishing is gated on a `secrets.NPM_TOKEN` Actions secret and a git tag —
there is intentionally **no npm token in this repo**.

**One-time setup:**

1. **Create the npm scope/org.** Sign in to npmjs.com and create the
   `@fivucsas` organization (this is the package scope). Without it, publishing
   a `@fivucsas/*` name fails.
2. **Create an npm token.** Generate a *Granular Access* (or Automation) token
   with **publish** permission on the `@fivucsas` scope.
3. **Add the token to GitHub.** In this repo: Settings → Secrets and variables →
   Actions → New repository secret, name it `NPM_TOKEN`, paste the token.
   (Provenance via `--provenance` needs no extra secret — the workflow already
   grants `id-token: write`.)

**Each release:**

```bash
# 1. bump version in BOTH packages/*/package.json
# 2. commit
git commit -am "release: sdk v0.1.0"
# 3. tag and push the tag
git tag sdk-v0.1.0
git push origin sdk-v0.1.0
```

The `Publish SDK` workflow (`.github/workflows/publish-sdk.yml`) then runs
`npm ci → npm run build:pkgs → npm pack --dry-run` (sanity) →
`npm publish --provenance --access public` for each package.

You can also trigger the workflow manually from the Actions tab with
**Run workflow → dry_run: true** to build + verify tarballs without publishing.

## Notes

- `@fivucsas/auth-react` (a thin React hook/component wrapper) is **not yet
  implemented**. When added, give it its own `packages/auth-react/` directory,
  a matching `build:pkg:auth-react` script, and a publish step in the workflow.
- The CDN bundles (`npm run build:sdk` / `build:elements` → `dist-sdk/` /
  `dist-elements/`) are a **separate** delivery path and are unaffected by the
  npm packaging.
