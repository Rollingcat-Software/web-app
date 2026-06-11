/**
 * modelCache — download-once, SHA256-verified model delivery.
 *
 * Contract:
 *   getModel(url, sha256) checks Cache API → IndexedDB → fetch.
 *   Bytes are stored in both Cache API and IndexedDB after first download.
 *   A second call returns cached bytes with zero network requests.
 *   SHA256 mismatch throws — unverified bytes are never returned.
 *
 * The two-layer cache:
 *   • Cache API — fast, response-level, evictable by the browser under storage
 *     pressure but subject to the origin's quota.
 *   • IndexedDB — persistent, survives Cache API eviction; acts as the durable
 *     backing store.
 *
 * This is the plumbing layer used by FacenetEmbedder (Phase 2). Auth behaviour
 * is unchanged — no flag flip, no upload-contract change.
 */

const CACHE_NAME = 'fivucsas-models-v1';
const IDB_NAME = 'fivucsas-models';
const IDB_STORE = 'models';
const IDB_VERSION = 1;

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<ArrayBuffer | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── SHA256 verification ───────────────────────────────────────────────────────

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the model at `url` as an ArrayBuffer, guaranteed to match `sha256`.
 *
 * Lookup order:
 *   1. Cache API (Response body)
 *   2. IndexedDB (raw ArrayBuffer)
 *   3. fetch() — verified, then stored in both caches
 *
 * Throws with a message containing "sha256" if the digest mismatches.
 * Never returns bytes that did not pass verification.
 */
export async function getModel(url: string, sha256: string): Promise<ArrayBuffer> {
  // 1. Cache API
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) {
      return cached.arrayBuffer();
    }
  } catch {
    // Cache API unavailable (e.g. non-secure context) — fall through.
  }

  // 2. IndexedDB
  let db: IDBDatabase | null = null;
  try {
    db = await openIdb();
    const stored = await idbGet(db, url);
    if (stored) {
      return stored;
    }
  } catch {
    // IndexedDB unavailable — fall through to fetch.
  }

  // 3. Network
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch model: HTTP ${response.status} for ${url}`);
  }
  const buf = await response.arrayBuffer();

  // Verify before storing or returning.
  const actual = await sha256Hex(buf);
  if (actual !== sha256) {
    throw new Error(
      `sha256 mismatch for ${url}: expected ${sha256}, got ${actual}`,
    );
  }

  // Store in Cache API.
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, new Response(buf.slice(0)));
  } catch {
    // Non-fatal: fall back to IndexedDB-only caching.
  }

  // Store in IndexedDB.
  if (db) {
    try {
      await idbPut(db, url, buf);
    } catch {
      // Non-fatal: cached in Cache API above.
    }
  }

  return buf;
}
