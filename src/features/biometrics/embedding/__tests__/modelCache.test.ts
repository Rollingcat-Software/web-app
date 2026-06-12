/**
 * Unit tests for modelCache — download-once, SHA-verified model cache.
 *
 * Strategy: stub Cache API + IndexedDB + crypto.subtle.digest + fetch so the
 * 47 MB model binary never touches the test runner. The contract under test is
 * pure plumbing:
 *   - first call: fetch fires, bytes are stored in Cache API + IndexedDB
 *   - second call: cache hit, zero fetches
 *   - SHA mismatch: throws, never stores unverified bytes
 */

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { getModel } from '../modelCache';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MODEL_URL = '/models/facenet512-1ad91552.fp16.onnx';
const VALID_SHA = 'aabbcc';
const MODEL_BYTES = new Uint8Array([1, 2, 3, 4]).buffer;

// Encode VALID_SHA as bytes so hex conversion in modelCache produces that string.
const VALID_SHA_BYTES = new Uint8Array(
  VALID_SHA.match(/../g)!.map((h) => parseInt(h, 16)),
).buffer;

// ── IDB stub factory ──────────────────────────────────────────────────────────

function makeIdbStub(initial: Map<string, ArrayBuffer> = new Map()) {
  const store = new Map<string, ArrayBuffer>(initial);

  function request<T>(value: T): IDBRequest<T> {
    const req = { result: value, error: null } as Partial<IDBRequest<T>>;
    // Fire onsuccess after callers have attached handlers.
    queueMicrotask(() => req.onsuccess?.({ target: req } as unknown as Event));
    return req as IDBRequest<T>;
  }

  const objStore = {
    get: vi.fn((key: string) => request(store.get(key))),
    put: vi.fn((value: ArrayBuffer, key: string) => {
      store.set(key, value);
      return request<IDBValidKey>(key);
    }),
    delete: vi.fn((key: string) => {
      store.delete(key);
      return request<undefined>(undefined);
    }),
  };

  const tx = {
    objectStore: vi.fn(() => objStore),
  } as unknown as IDBTransaction;

  const db = {
    transaction: vi.fn(() => tx),
    createObjectStore: vi.fn(),
  } as unknown as IDBDatabase;

  const openReq = {
    result: db,
    error: null,
    onupgradeneeded: null as ((ev: IDBVersionChangeEvent) => void) | null,
    onsuccess: null as ((ev: Event) => void) | null,
    onerror: null as ((ev: Event) => void) | null,
  };

  const idbOpen = vi.fn(() => {
    queueMicrotask(() =>
      openReq.onsuccess?.({ target: openReq } as unknown as Event),
    );
    return openReq as unknown as IDBOpenDBRequest;
  });

  return { idbOpen, db, objStore, store };
}

// ── Cache API stub factory ────────────────────────────────────────────────────

function makeCacheStub(initial: Map<string, ArrayBuffer> = new Map()) {
  const store = new Map<string, ArrayBuffer>(initial);
  const cache = {
    match: vi.fn(async (url: string) => {
      const buf = store.get(url);
      if (buf == null) return undefined;
      return new Response(buf.slice(0));
    }),
    put: vi.fn(async (url: string, res: Response) => {
      store.set(url, await res.arrayBuffer());
    }),
    delete: vi.fn(async (url: string) => store.delete(url)),
    _store: store,
  };
  const caches = { open: vi.fn(async () => cache) };
  return { caches, cache };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('getModel — download-once SHA-verified model cache', () => {
  let fetchSpy: MockInstance;
  let digestSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();

    // fetch
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MODEL_BYTES.slice(0), { status: 200 }),
    );

    // crypto.subtle.digest — returns bytes whose hex equals VALID_SHA
    digestSpy = vi
      .spyOn(globalThis.crypto.subtle, 'digest')
      .mockResolvedValue(VALID_SHA_BYTES);
  });

  it('fetches the model on first call and stores it in Cache API + IndexedDB', async () => {
    const { caches, cache } = makeCacheStub();
    Object.defineProperty(globalThis, 'caches', {
      value: caches,
      writable: true,
      configurable: true,
    });
    const { idbOpen, objStore } = makeIdbStub();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: { open: idbOpen },
      writable: true,
      configurable: true,
    });

    const buf = await getModel(MODEL_URL, VALID_SHA);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(MODEL_URL);
    expect(digestSpy).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
    expect(objStore.put).toHaveBeenCalledOnce();
    expect(buf).toBeInstanceOf(ArrayBuffer);
  });

  it('returns cached bytes on second call with zero fetches (Cache API hit)', async () => {
    const { caches } = makeCacheStub(new Map([[MODEL_URL, MODEL_BYTES]]));
    Object.defineProperty(globalThis, 'caches', {
      value: caches,
      writable: true,
      configurable: true,
    });
    const { idbOpen } = makeIdbStub();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: { open: idbOpen },
      writable: true,
      configurable: true,
    });

    const buf = await getModel(MODEL_URL, VALID_SHA);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(buf).toBeInstanceOf(ArrayBuffer);
  });

  it('returns IndexedDB bytes on a Cache API miss, with zero fetches', async () => {
    // Cache API empty → match() resolves undefined.
    const { caches } = makeCacheStub();
    Object.defineProperty(globalThis, 'caches', {
      value: caches,
      writable: true,
      configurable: true,
    });
    // IndexedDB pre-populated with the model.
    const { idbOpen, objStore } = makeIdbStub(new Map([[MODEL_URL, MODEL_BYTES]]));
    Object.defineProperty(globalThis, 'indexedDB', {
      value: { open: idbOpen },
      writable: true,
      configurable: true,
    });

    const buf = await getModel(MODEL_URL, VALID_SHA);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(objStore.get).toHaveBeenCalledWith(MODEL_URL);
    expect(buf).toBeInstanceOf(ArrayBuffer);
  });

  it('evicts a poisoned Cache API entry and re-fetches a verified copy', async () => {
    // Cache API holds WRONG bytes under the model URL.
    const { caches, cache } = makeCacheStub(new Map([[MODEL_URL, MODEL_BYTES]]));
    Object.defineProperty(globalThis, 'caches', {
      value: caches,
      writable: true,
      configurable: true,
    });
    const { idbOpen } = makeIdbStub();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: { open: idbOpen },
      writable: true,
      configurable: true,
    });

    // First digest (the cached-read verification) returns a NON-matching hash,
    // forcing eviction + fall-through; the post-fetch digest then matches.
    const badHashBytes = new Uint8Array([0xde, 0xad]).buffer;
    digestSpy
      .mockResolvedValueOnce(badHashBytes) // cache-read verify → mismatch
      .mockResolvedValue(VALID_SHA_BYTES); // post-fetch verify → match

    const buf = await getModel(MODEL_URL, VALID_SHA);

    // Poisoned entry must be evicted, then a fresh verified copy fetched.
    expect(cache.delete).toHaveBeenCalledWith(MODEL_URL);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(MODEL_URL);
    expect(buf).toBeInstanceOf(ArrayBuffer);
  });

  it('throws when the SHA256 digest does not match', async () => {
    const badHashBytes = new Uint8Array([0xde, 0xad]).buffer;
    digestSpy.mockResolvedValue(badHashBytes);

    const { caches, cache } = makeCacheStub();
    Object.defineProperty(globalThis, 'caches', {
      value: caches,
      writable: true,
      configurable: true,
    });
    const { idbOpen, objStore } = makeIdbStub();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: { open: idbOpen },
      writable: true,
      configurable: true,
    });

    await expect(getModel(MODEL_URL, VALID_SHA)).rejects.toThrow(/sha256/i);
    // Must NOT store unverified bytes
    expect(cache.put).not.toHaveBeenCalled();
    expect(objStore.put).not.toHaveBeenCalled();
  });
});
