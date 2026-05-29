/**
 * Copies the repository root LICENSE into a package directory so it is included
 * in the published npm tarball (the package.json "files" field lists "LICENSE",
 * but the file itself lives at the repo root). Run as the last step of each
 * `build:pkg:*` script.
 *
 * Usage: node scripts/copy-license.mjs <package-dir-name>
 *   e.g. node scripts/copy-license.mjs auth-js
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const pkgName = process.argv[2];
if (!pkgName) {
    console.error('copy-license: missing package directory name argument');
    process.exit(1);
}

const src = resolve(repoRoot, 'LICENSE');
const destDir = resolve(repoRoot, 'packages', pkgName);
const dest = resolve(destDir, 'LICENSE');

if (!existsSync(src)) {
    console.error(`copy-license: source LICENSE not found at ${src}`);
    process.exit(1);
}
if (!existsSync(destDir)) {
    console.error(`copy-license: package directory not found at ${destDir}`);
    process.exit(1);
}

copyFileSync(src, dest);
console.log(`copy-license: ${src} -> ${dest}`);
