# Client-Side ONNX Models

Model files are **fetched at build time** from a Hostinger static bucket. They are NOT committed to git.

## Required Files

| File | Size | Purpose |
|------|------|---------|
| mobilefacenet.onnx | ~4.9 MB | Face embedding (128-dim) — **log-only** per D2 (client never decides verdicts) |
| yolo-card-nano.onnx | ~6.2 MB | Card detection overlay — crop sent to server for OCR/MRZ |
| silero-vad.onnx | ~1.8 MB | Voice activity detection — skip upload on silent captures |

## Delivery Mechanism (D3)

1. `manifest.json` in this directory lists the three files with `sha256` hashes.
2. `npm run build` triggers `prebuild` → `scripts/fetch-models.mjs`.
3. The script downloads each file from `${MODELS_BASE_URL || manifest.base_url_default}/<name>` and verifies the SHA256.
4. On verification failure: **fatal** (build aborts).
5. If `sha256` is `null` in the manifest (initial state), the script warns but does not enforce.

## One-Time Setup (User Action)

1. Generate / download the three models locally:
   ```bash
   # Card model from training checkpoint:
   cd biometric-processor/app/core/card_type_model
   python -c "from ultralytics import YOLO; m=YOLO('best.pt'); m.export(format='onnx', imgsz=640, half=False, simplify=True)"
   # mv best.onnx /tmp/yolo-card-nano.onnx

   # MobileFaceNet (InsightFace, INT8): download from official releases
   # Silero VAD: https://github.com/snakers4/silero-vad (export or pre-built ONNX)
   ```

2. Upload to Hostinger bucket:
   ```bash
   scp -P 65002 /tmp/mobilefacenet.onnx /tmp/yolo-card-nano.onnx /tmp/silero-vad.onnx \
     u349700627@46.202.158.52:~/domains/app.fivucsas.com/public_html/models/
   ```

3. Compute SHA256 hashes:
   ```bash
   sha256sum /tmp/mobilefacenet.onnx /tmp/yolo-card-nano.onnx /tmp/silero-vad.onnx
   ```

4. Paste the hashes into `manifest.json` (replace each `"sha256": null`), commit the manifest, and push.

5. Verify: fresh clone → `npm install && npm run build` → see `dist/models/*.onnx` with correct hashes. Tamper with the manifest → build fails loudly.

## Env Overrides

- `MODELS_BASE_URL` — override the bucket URL (useful for staging/local CDN).
- `SKIP_MODEL_FETCH=1` — skip downloads entirely (leaves the dir empty; client falls back to server inference).

## Why Log-Only?

Per D1-D2 decisions (2026-04-14): the server has no GPU; client pre-filtering helps latency and upload bandwidth, but auth verdicts stay server-side. MobileFaceNet 128-dim embeddings cannot be directly compared to server ArcFace 512-dim — we log them for offline divergence analysis, not to gate authentication. See `docs/plans/CLIENT_SIDE_ML_PLAN.md` v2.0.
