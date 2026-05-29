# Client-Side ONNX Models

> **MobileFaceNet deprecated 2026-04-18** — landmark-geometry (MediaPipe, 512-dim) is the sole client embedding path. `mobilefacenet.onnx` is no longer fetched, no longer bundled, and no longer referenced by the app. See `docs/plans/CLIENT_SIDE_ML_PLAN.md` D2.

Model files are **fetched at build time** from a Hostinger static bucket. They are NOT committed to git.

## Required Files

| File | Size | Purpose |
|------|------|---------|
| yolo-card-nano.onnx | ~12.3 MB (true YOLOv8n, opset 12) | Card detection overlay — runs in-browser only (onnxruntime-web); no server round-trip |
| silero-vad.onnx | ~2.2 MB | Voice activity detection — skip upload on silent captures |
| labels.json | <1 KB | Canonical class index → name mapping for `yolo-card-nano.onnx` (committed; loaded at runtime) |

Client face embedding is produced by `EmbeddingComputer.geometryEmbedding()` from MediaPipe landmarks; no ONNX model required.

## YOLO Card Class Labels (READ BEFORE TOUCHING)

The `yolo-card-nano.onnx` (true YOLOv8n, 12.3 MB, opset 12) was trained with a NON-alphabetical class order. The canonical mapping is embedded in the model's `metadata_props.names` field and mirrored on disk in `labels.json`:

| Index | Slug | EN | TR |
|------:|------|----|----|
| 0 | `ehliyet`           | Driver's License        | Sürücü Belgesi (Ehliyet) |
| 1 | `pasaport`          | Passport                | Pasaport |
| 2 | `ogrenci_karti`     | Student Card            | Öğrenci Kartı |
| 3 | `tc_kimlik`         | Turkish Republic ID     | T.C. Kimlik Kartı |
| 4 | `akademisyen_karti` | Academic Staff Card     | Akademisyen Kartı |

`CardDetector.ts` loads `labels.json` at `initialize()` time. The fallback array `FALLBACK_CLASS_NAMES` in `CardDetector.ts` and the `classes` array in `labels.json` are both pinned to this order by `CardDetector.test.ts`. If you re-export the ONNX with a different class order, you MUST regenerate both files (re-run the extraction below) — otherwise every detection will be off-by-N.

### Re-extracting the canonical class order from the ONNX model

```bash
# Python env with onnx installed:
python -c "
import onnx
m = onnx.load('public/models/yolo-card-nano.onnx')
for p in m.metadata_props:
    if p.key == 'names':
        print(p.value)
"
```

Or, without onnx installed, grep the raw bytes — Ultralytics writes the names dict as a flat protobuf string at the tail of the file:

```bash
strings -n 8 public/models/yolo-card-nano.onnx | grep -E "names" | head
```

Then update `labels.json` and `FALLBACK_CLASS_NAMES` and run `npm run test -- CardDetector` to verify the pinning tests still pass.

## Delivery Mechanism (D3)

1. `manifest.json` in this directory lists the files with `sha256` hashes.
2. `npm run build` triggers `prebuild` → `scripts/fetch-models.mjs`.
3. The script downloads each file from `${MODELS_BASE_URL || manifest.base_url_default}/<name>` and verifies the SHA256.
4. On verification failure: **fatal** (build aborts).
5. If `sha256` is `null` in the manifest (initial state), the script warns but does not enforce.

## One-Time Setup (User Action)

1. Generate / download the models locally:
   ```bash
   # Card model: Ayşenur's true YOLOv8n best.onnx is now committed in-repo at
   # biometric-processor/app/core/card_type_model/best.onnx (best.pt was dropped, bio #116).
   # Copy it directly; do NOT re-export from best.pt:
   cp biometric-processor/app/core/card_type_model/best.onnx /tmp/yolo-card-nano.onnx

   # Silero VAD: https://github.com/snakers4/silero-vad (export or pre-built ONNX)
   ```

2. Upload to Hostinger bucket:
   ```bash
   scp -P 65002 /tmp/yolo-card-nano.onnx /tmp/silero-vad.onnx \
     u349700627@46.202.158.52:~/domains/app.fivucsas.com/public_html/models/
   ```

3. Compute SHA256 hashes:
   ```bash
   sha256sum /tmp/yolo-card-nano.onnx /tmp/silero-vad.onnx
   ```

4. Paste the hashes into `manifest.json` (replace each `"sha256": null`), commit the manifest, and push.

5. Verify: fresh clone → `npm install && npm run build` → see `dist/models/*.onnx` with correct hashes. Tamper with the manifest → build fails loudly.

## Env Overrides

- `MODELS_BASE_URL` — override the bucket URL (useful for staging/local CDN).
- `SKIP_MODEL_FETCH=1` — skip downloads entirely (leaves the dir empty; card detection then has no model and is unavailable — there is no server fallback as of web-app #111).

## Why Log-Only?

Per D1-D2 decisions (2026-04-14, reaffirmed 2026-04-18): the server has no GPU; client pre-filtering helps latency and upload bandwidth, but face/voice auth verdicts stay server-side. (Card-type detection is the exception — it is now fully client-side with no server path, per web-app #111.) The client landmark-geometry embedding cannot be directly compared to server DeepFace Facenet512 — we log it for offline divergence analysis, not to gate authentication. See `docs/plans/CLIENT_SIDE_ML_PLAN.md` v2.0.
