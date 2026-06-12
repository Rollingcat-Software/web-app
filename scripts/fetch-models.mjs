#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MODELS_DIR = join(ROOT, 'public', 'models');
const MANIFEST_PATH = join(MODELS_DIR, 'manifest.json');

const color = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m',
};

function log(msg) { console.log(`[fetch-models] ${msg}`); }
function warn(msg) { console.warn(`${color.yellow}[fetch-models] WARN:${color.reset} ${msg}`); }
function fail(msg) { console.error(`${color.red}[fetch-models] FATAL:${color.reset} ${msg}`); process.exit(1); }

// Resilience knobs (overridable via env for testing / slow links).
// Defaults are deliberately generous: a 12 MB model on a slow CI runner needs
// far more than the ~10s the bare `fetch` default allowed (which hard-failed
// the whole prod deploy on a single transient — 2026-06-12).
const MAX_ATTEMPTS = Number(process.env.FETCH_MODELS_RETRIES) || 3;
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_MODELS_TIMEOUT_MS) || 120_000;
const RETRY_BASE_DELAY_MS = Number(process.env.FETCH_MODELS_RETRY_DELAY_MS) || 2_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sha256OfFile(path) {
  const hash = createHash('sha256');
  const buf = readFileSync(path);
  hash.update(buf);
  return hash.digest('hex');
}

// Single download attempt with an explicit per-attempt timeout. The timeout
// covers BOTH the connect/headers phase and the body stream — an AbortController
// aborts the fetch (and thus the streaming pipeline) if the whole transfer
// hasn't completed within FETCH_TIMEOUT_MS, so a stalled mid-stream socket can't
// hang forever.
async function downloadAttempt(url, dest) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const tmp = `${dest}.download`;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    await mkdir(dirname(dest), { recursive: true });
    await pipeline(res.body, createWriteStream(tmp));
    const { rename } = await import('node:fs/promises');
    await rename(tmp, dest);
  } catch (e) {
    // Clean up any partial temp file so the next attempt / a later run starts fresh.
    try { await unlink(tmp); } catch { /* tmp may not exist */ }
    if (e.name === 'AbortError') {
      throw new Error(`timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Download with retries + exponential backoff. Only throws (fatal to the
// caller) once ALL attempts are exhausted — a slow or transient model download
// can no longer break the prod deploy on the first hiccup.
async function downloadTo(url, dest) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await downloadAttempt(url, dest);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        warn(`attempt ${attempt}/${MAX_ATTEMPTS} failed for ${url}: ${e.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw new Error(`${lastErr.message} (after ${MAX_ATTEMPTS} attempts)`);
}

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    fail(`manifest missing: ${MANIFEST_PATH}`);
  }
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const baseUrl = process.env.MODELS_BASE_URL || manifest.base_url_default;
  const skipFetch = process.env.SKIP_MODEL_FETCH === '1';

  if (!baseUrl) fail('no base_url configured (manifest.base_url_default or MODELS_BASE_URL env)');

  log(`${color.cyan}Base URL:${color.reset} ${baseUrl}`);
  log(`Manifest version: ${manifest.version}`);

  let fetched = 0, cached = 0, skipped = 0, failed = 0;

  for (const file of manifest.files) {
    const localPath = join(MODELS_DIR, file.name);
    const url = `${baseUrl}/${file.name}`;
    const present = existsSync(localPath);

    if (file.sha256 === null || file.sha256 === undefined) {
      if (present) {
        warn(`${file.name}: no sha256 in manifest; file present locally, leaving as-is (update manifest to enable verification)`);
      } else {
        warn(`${file.name}: no sha256 in manifest and file absent — NOT downloading (fill sha256 to enable). Client will fall back to server inference for this capability.`);
      }
      skipped++;
      continue;
    }

    if (present) {
      const localHash = await sha256OfFile(localPath);
      if (localHash === file.sha256) {
        log(`  ${color.green}OK${color.reset} ${file.name} (${statSync(localPath).size} bytes, sha256 match)`);
        cached++;
        continue;
      }
      warn(`${file.name}: local hash mismatch (got ${localHash.slice(0, 12)}..., expected ${file.sha256.slice(0, 12)}...). Re-downloading.`);
      await unlink(localPath);
    }

    if (skipFetch) {
      warn(`${file.name}: SKIP_MODEL_FETCH=1, not downloading (build may ship without model)`);
      skipped++;
      continue;
    }

    try {
      log(`  downloading ${url}`);
      await downloadTo(url, localPath);
      const gotHash = await sha256OfFile(localPath);
      if (gotHash !== file.sha256) {
        await unlink(localPath);
        fail(`${file.name}: sha256 mismatch after download. Expected ${file.sha256}, got ${gotHash}`);
      }
      log(`  ${color.green}OK${color.reset} ${file.name} (verified)`);
      fetched++;
    } catch (e) {
      fail(`${file.name}: ${e.message}`);
    }
  }

  log(`${color.cyan}Summary:${color.reset} fetched=${fetched} cached=${cached} skipped=${skipped} failed=${failed}`);
  if (failed > 0) warn(`${failed} file(s) could not be fetched — client will use server fallback paths`);
}

main().catch(e => fail(e.stack || e.message));
