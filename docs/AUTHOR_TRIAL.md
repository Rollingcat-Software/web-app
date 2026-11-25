# Author trial runbook (Paper B, BPCER/APCER)

Status: authors-only trial mode, owner decision 2026-11-24. This document is the
operations runbook for the web lane. The binding cross-repo contract is
[`AUTHOR_TRIAL_CONTRACT.md`](../../fivucsas-identity-core-api/docs/AUTHOR_TRIAL_CONTRACT.md)
(in `fivucsas-identity-core-api/docs/`, also available in that repo on GitHub).
Every wire name, CSV column and behaviour is defined there; if this runbook and
the contract disagree, the contract wins.

## 1. Purpose and scope

The authors (pseudonymous codes `P1`..`P4`) run:

- **genuine** attempts on their own pre-enrolled accounts, and
- **attack** attempts as another consenting author's account using a live
  face-swap / deepfake-replay / virtual-camera instrument.

Each attempt runs the REAL Puzzle + face-identity verification path (a real MFA
session, the real PUZZLE step, the real server-side decision). The server records
the decision; the export feeds the ISO/IEC 30107-3 analysis (BPCER, APCER and
full-system rates).

Ethics and scope, non-negotiable:

- Only the authors participate. No external participants, no students, no
  colleagues, no third-party faces or voices.
- The only identifiers in the trial data are the pseudonymous codes. The
  code-to-person mapping is kept offline by the coordinator and is never written
  to the database, the exports or the logs.
- The attempt log stores no image, video, audio or biometric template. Only
  decisions, plan slots, device/environment scalars and version pins.
- The trial tenant, its four accounts, its biometric templates and its exports
  are deleted when the analysis is final (section 10).

## 2. Components

| Piece | Where |
|---|---|
| Public page | web-app `/author-trial` (no dashboard login) |
| API surface | identity-core-api `/api/v1/author-trial/*`, guarded by `X-Author-Trial-Key` |
| Listener/recorder | identity-core-api `PuzzleVerifyMfaStepHandler` + `VerifyMfaStepService.completeMfa` |
| Liveness + identity scoring | biometric-processor (Puzzle session v2, `/verify-embedding`) |
| Export + analysis | CSV/JSON from identity-core-api; `bench/pilot/analyze.py` in `fivucsas-papers` |

The page never talks to biometric-processor directly. Every attempt drives the
shared `PuzzleStep` through `MfaStepRenderer`; the verdict comes from
`POST /auth/mfa/step`. The page's `finish` call is technical metadata only and
can never turn a failure or a pending attempt into an accept.

## 3. Configuration

### 3.1 Trial tenant and accounts

1. Create one dedicated tenant (for example `Author trial (Paper B)`) in the
   dashboard. Record its UUID as `TRIAL_TENANT_ID`.
2. Create exactly four accounts in that tenant, one per author. Use
   pseudonymous display names (`P1`..`P4`) and non-routable placeholder emails
   (for example `p1@trial.invalid`). Do not use the authors' real names or real
   addresses. Record the four user UUIDs as `P1_USER_ID`..`P4_USER_ID`.
   Normal registration creates the accounts `ACTIVE`; the identifier-first trial
   path does not require email verification, so the non-routable addresses never
   need an inbox. If an account is not `ACTIVE` (status `INACTIVE`/`SUSPENDED`),
   the trial session start answers `TRIAL_LOGIN_BEGIN_FAILED` — reactivate it in
   the dashboard instead of editing the database.
3. Seed the mapping. Run this SQL as the coordinator (replace the UUIDs):

```sql
-- One row per author; enrolled_at stays NULL until the trial enroll endpoint runs.
INSERT INTO author_trial_participants (id, tenant_id, participant_code, user_id)
VALUES
  (gen_random_uuid(), :'tenant_id', 'P1', :'p1_user_id'),
  (gen_random_uuid(), :'tenant_id', 'P2', :'p2_user_id'),
  (gen_random_uuid(), :'tenant_id', 'P3', :'p3_user_id'),
  (gen_random_uuid(), :'tenant_id', 'P4', :'p4_user_id')
ON CONFLICT (tenant_id, participant_code) DO NOTHING;
```

or with `psql` variables:

```bash
psql "$DATABASE_URL" \
  -v tenant_id="$TRIAL_TENANT_ID" \
  -v p1_user_id="$P1_USER_ID" -v p2_user_id="$P2_USER_ID" \
  -v p3_user_id="$P3_USER_ID" -v p4_user_id="$P4_USER_ID" \
  -c "INSERT INTO author_trial_participants (id, tenant_id, participant_code, user_id) VALUES \
      (gen_random_uuid(), :'tenant_id', 'P1', :'p1_user_id'), \
      (gen_random_uuid(), :'tenant_id', 'P2', :'p2_user_id'), \
      (gen_random_uuid(), :'tenant_id', 'P3', :'p3_user_id'), \
      (gen_random_uuid(), :'tenant_id', 'P4', :'p4_user_id') \
      ON CONFLICT (tenant_id, participant_code) DO NOTHING;"
```

The V90 migration creates the three `author_trial_*` tables. No row may exist for
anyone who is not an author; the page lists only the configured codes.

### 3.2 Trial flow

In `Auth Flows`, give the trial tenant a default `APP_LOGIN` flow whose step 1
is **PUZZLE only**:

- allowed challenges: web-renderable bio action names, for example
  `blink`, `smile`, `turn_left`, `turn_right`, `open_mouth`,
  `raise_eyebrows`, `close_left_eye`, `close_right_eye`, `look_up`,
  `look_down`, `raise_left_brow`, `raise_right_brow`, `nod`, `shake_head`,
  `finger_count`, `wave`, `hand_flip`, `finger_tap`, `pinch`, `peek_a_boo`,
  `math`.
- `alsoMatchFaceIdentity = true` (identity binding is part of the measurement).
- `count = 1`, `difficulty = easy`: the API overrides these per trial session
  anyway, so every attempt covers exactly one challenge from a shuffled round.

The trial session creation goes through identity's identifier-first path
(`beginIdentifierLogin`), which requires config-driven login to be ON for this
tenant and a default `APP_LOGIN` flow whose step 1 is PUZZLE. If either is
missing the API answers `409 TRIAL_FLOW_NOT_CONFIGURED`.

### 3.3 Service flags (exact values)

identity-core-api (`docker-compose.prod.yml` environment block):

| env | trial value | note |
|---|---|---|
| `AUTHOR_TRIAL_ENABLED` | `true` | OFF -> every trial endpoint answers 404 |
| `AUTHOR_TRIAL_ACCESS_CODE` | a long random shared code | wrong code -> 401 |
| `AUTHOR_TRIAL_TENANT_IDS` | `TRIAL_TENANT_ID` | EXACTLY one tenant; more than one disables the whole surface |
| `APP_AUTH_CONFIG_DRIVEN_LOGIN_TENANTS` | `TRIAL_TENANT_ID` | identifier-first path |
| `APP_AUTH_PUZZLE_LAYER_TENANTS` | `TRIAL_TENANT_ID` | PUZZLE as a flow layer |
| `APP_AUTH_CLIENT_SIDE_EMBEDDING_TENANTS` | `TRIAL_TENANT_ID` | embedding-only path; the global `APP_AUTH_CLIENT_SIDE_EMBEDDING` may stay `false` |
| `APP_AUTH_FACE_EMBEDDING_LIVENESS_MODE` | `AUDIT` (default) or `OFF` | keeps enrollment image-free; leave `APP_AUTH_FACE_EMBEDDING_LIVENESS_ENFORCE_TENANTS` empty. Record the mode: it is exported |
| attested binding (`app.auth.attested-binding*`) | OFF | no browser can attest |

**Important:** the identity service uses an explicit compose `environment:`
block, not `env_file:`. A variable present only in `.env.prod` is silently
dropped. Put every flag above in the compose environment block.

biometric-processor:

| env | trial value | note |
|---|---|---|
| `PUZZLE_TRACE_V2_ENABLED` | `true` | contract v2: bio re-scores the landmark trace |

web-app build:

| env | trial value | note |
|---|---|---|
| `VITE_CLIENT_SIDE_EMBEDDING` | `true` | enrollment and identity binding compute Facenet512 in the browser |
| `VITE_APP_VERSION` | release tag or commit | sent as `webVersion`, exported in `deployment_commits` |

Flag ordering:

1. Turn ON identity `app.auth.client-side-embedding` for the trial tenant.
2. Build/deploy the web app with `VITE_CLIENT_SIDE_EMBEDDING=true`.
3. Turn ON the identity trial flags and the bio v2 flag.
4. Only then run attempts.

Reversing the order (web ON, identity OFF) breaks FACE verification. Attested
binding stays OFF.

## 4. Enable and open the page

The page is a public route (no dashboard login): `https://app.fivucsas.com/author-trial`.

1. Confirm the web build has `VITE_CLIENT_SIDE_EMBEDDING=true`.
2. Confirm `AUTHOR_TRIAL_ENABLED=true`, the tenant is in
   `AUTHOR_TRIAL_TENANT_IDS`, and the access code is non-empty.
3. Open `/author-trial` in Chrome on the capture machine.
4. Enter the access code. It is kept only in this tab's `sessionStorage`; it is
   never logged and never sent as data (the API receives it only as the
   `X-Author-Trial-Key` header).
5. The page detects the device and camera; edit any field that is wrong. Save
   the setup as a device profile (localStorage) so later sessions pre-fill it.

Operational rule: make sure no proxy or ingress access log records the
`X-Author-Trial-Key` header. If header logging is enabled, exclude that header
before the trial.

## 5. Enroll each participant (one time)

1. Select the participant code under "Ben kimim" (`Who am I`).
2. A `Needs enrollment` chip means the account has no trial template yet.
   Press **Enroll face**.
3. Capture the face with the normal enrollment flow. The browser computes the
   Facenet512 embedding locally and posts only the 512-number vector to
   `/author-trial/enroll`; the raw image never leaves the device.
4. The server calls biometric `/enroll-embedding`, completes the FACE and
   PUZZLE enrollments and sets `author_trial_participants.enrolled_at`. The chip
   becomes `Enrolled`.
5. If the API answers `409 TRIAL_ENROLL_IMAGE_REQUIRED`, the tenant's
   face-embedding liveness mode is ENFORCE. Set it to AUDIT or OFF (section
   3.3), then retry.
6. If a re-enroll is ever needed (wrong capture, changed setup), clear the flag
   for that code — `UPDATE author_trial_participants SET enrolled_at = NULL
   WHERE tenant_id = '<uuid>' AND participant_code = 'P2';` — and reload the
   page; the endpoint is idempotent and replaces the template.

Do not enroll through the normal dashboard enrollment page: the trial
enrollment endpoint performs the FACE/PUZZLE bookkeeping the analysis expects.

## 6. Run attempts

### Genuine

1. Select your own code.
2. Mode **Genuine**.
3. Press **Start trial loop**.
4. Perform the challenge shown (blink, turn, hand gesture, ...).
5. The loop records the server's decision, pauses briefly and starts the next
   attempt. Press **Stop** when the planned number of genuine attempts is
   reached. Stop finishes an in-flight attempt as `abandoned`.

### Attack

1. Select your own code as the operator.
2. Mode **Attack**, target the other author's code.
3. Pick the instrument preset (`live_face_swap`, `deepfake_replay`,
   `virtual_camera`, `other`) and type the exact instrument name/version.
4. Start the instrument, then **Start trial loop**.
5. Each attempt is a real login attempt against the target's template. The
   server's liveness/identity verdict is authoritative.

Notes:

- One attempt = one challenge from the round plan. The round/position ring and
  the challenge badge show the slot the server assigned.
- A per-attempt timeout (default 120 s) records `error` / `attempt_timeout`.
  `?attemptTimeoutMs=<ms>` overrides it for test runs only (the e2e uses 3000).
- Never retry inside a failed attempt: the API allows one bio session per
  attempt (`409 TRIAL_SESSION_ALREADY_CREATED`); start a new attempt instead.
- The live statistics and feed are convenience only. The export is the record.

## 7. Export

Press **Download CSV** or **Download JSON** on the page. The file comes from
`GET /author-trial/export`, is server-generated and `Cache-Control: no-store`.

- CSV: the old `sessions.csv` header in its original order, then the documented
  extension columns (`attempt_id`, `mode`, `round`, `position`, `challenge`,
  device/env scalars, verdicts, versions, ...). See contract §3.7 for every
  column and mapping.
- `excluded=yes` marks pending/error/abandoned rows; the analysis counts and
  skips them.
- `outcome=accept/reject` is the server decision. A client `accepted` without a
  server completion is stored as `reject` (fail closed).

Move the export to the papers repository's private data location (or an
encrypted volume) at once. Never commit an export; the participant codes,
timings and device fingerprints are pseudonymous but still trial data.

## 8. Analysis

In the papers repository (`fivucsas-papers`, `paper-B-puzzle-pad`):

```bash
cd paper-B-puzzle-pad/bench/pilot
python analyze.py /path/to/author_trial_sessions.csv
python analyze.py /path/to/author_trial_sessions.csv --bootstrap-resamples 20000 --bootstrap-seed 7
python -m unittest discover -s tests -v
```

The analyzer detects the trial schema by the presence of both `attempt_id` and
`mode`. It prints BPCER per subject/challenge/condition and pooled, APCER per
subject/instrument and pooled, full-system rates separately, Wilson and exact
Clopper-Pearson 95% intervals, and a subject-level bootstrap. Every rate names
its operating configuration (binding, k, difficulty, face-embedding liveness
mode). Rows with `excluded=yes` are counted and skipped. The synthetic fixture
under `tests/` is invented data and must never be cited.

## 9. Data, privacy and retention

| Stored where | Content |
|---|---|
| `author_trial_attempts` | plan slot, operator/target codes, mode/instrument, device/env scalars, verdicts, scores, latency, version pins, failure reason |
| `author_trial_plan_entries` | server-side shuffled round slots |
| `author_trial_participants` | code -> bound account, `enrolled_at` |
| biometric-processor | the bound accounts' face/voice templates (normal encrypted storage) |
| browser | access code in `sessionStorage`; device profiles in `localStorage`; no images |
| exports | CSV/JSON copies outside the database; coordinator-owned |

Not stored: raw images, video, audio, frames, templates or the code-to-person
mapping. The browser draws each camera frame to an offscreen canvas for
brightness/exposure statistics and discards it. Enrollment sends only the
derived embedding. Puzzle attempts send landmark traces (no frames).

Retention: keep the database rows until the analysis is final and the paper
artifact is frozen; then run the deletion command once (section 10). Delete
local exports and any working copies at the same time. The deletion command does
not touch files outside the database, so the coordinator must remove exports
separately.

## 10. Deletion — the ONE documented command

Run this only when the coordinator decides the trial is over. It is idempotent
and runs in one transaction: it enqueues FACE+VOICE template deletion, soft
deletes the four bound accounts (never hard deletes them), and deletes the three
`author_trial_*` tables for the tenant.

```bash
psql "$DATABASE_URL" -v tenant_id='<trial-tenant-uuid>' \
  -f scripts/author-trial-purge.sql
```

The script is
`fivucsas-identity-core-api/scripts/author-trial-purge.sql` (branch carrying the
author-trial work). Check afterwards:

```sql
SELECT COUNT(*) FROM author_trial_participants WHERE tenant_id = '<uuid>';
SELECT COUNT(*) FROM author_trial_attempts     WHERE tenant_id = '<uuid>';
SELECT COUNT(*) FROM author_trial_plan_entries WHERE tenant_id = '<uuid>';
SELECT method, completed_at, attempts, last_error
  FROM biometric_deletion_outbox WHERE tenant_id = '<uuid>';
```

The outbox worker drains the template deletions through biometric-processor
within about a minute. Do not run any other ad-hoc delete.

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401` on every call | Wrong access code. The code is compared constant-time; there is no per-user account. |
| `404` on every call | `AUTHOR_TRIAL_ENABLED=false`, empty `AUTHOR_TRIAL_ACCESS_CODE`, or the tenant is not in `AUTHOR_TRIAL_TENANT_IDS`. |
| `409 TRIAL_FLOW_NOT_CONFIGURED` | Config-driven login is off for the tenant, or its default `APP_LOGIN` flow's step 1 is not PUZZLE. |
| `409 TRIAL_SESSION_ALREADY_CREATED` | The attempt already created its one bio session. Stop and start a new attempt. |
| `409 TRIAL_ENROLL_IMAGE_REQUIRED` | Face-embedding liveness mode is ENFORCE. Set the trial tenant to AUDIT/OFF for enrollment. |
| Enroll button missing | The code is already enrolled; re-enroll is intentionally hidden once `enrolled=true`. |
| Camera prompt denied / no video | Check the browser permission, the OS camera lock, and that no other app holds the camera. Production and dev allow `camera=(self)`; the page must be on HTTPS or localhost. |
| Puzzle never completes | The challenge needs a clear frontal view and enough light; model WASM loads from jsdelivr/storage.googleapis. Check the network and CSP, and keep the face in frame. |
| Attempts end as `error` quickly | Per-attempt timeout or a network/proxy failure. The feed shows `attempt_timeout`, `transport_error` or an `http_<status>` reason. |
| Export is empty | There are no attempts yet. Only actual attempt rows are exported; pending/error rows are marked `excluded=yes`. |
| Face login broken elsewhere | Client-side embedding ordering: identity flag first, then the web build flag. |
| Stale page after deploy | The PWA app shell is network-first; reload once. |
| Identity score tile shows `—` | The live step response carries no score; the authoritative value is server-side in the export. |
| Proxy logs contain the access code | Exclude `X-Author-Trial-Key` from access logs before running the trial. |

## 12. Local end-to-end test (no server, no internet)

The web repo ships an isolated Playwright project and a local stub backend:

```bash
npx playwright test --config=playwright.author-trial.config.ts
# or: npm run test:e2e:author-trial
```

It launches a real installed Chrome with
`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream
--use-file-for-fake-video-capture=<generated Y4M>`, serves the page from a local
Vite dev server whose `/api` proxy points at `e2e/author-trial/stub-server.mjs`,
runs one attempt with `?attemptTimeoutMs=3000`, asserts the stub recorded the
session row and the page's finish call, and asserts the CSV downloaded by the
page contains that attempt id. All state is local; nothing external is contacted.
If Chrome is not installed, set `AUTHOR_TRIAL_BROWSER_CHANNEL=` and install
Playwright Chromium (`node node_modules/playwright/cli.js install chromium`).

## 13. Deployment

Do not deploy as part of this runbook review. The commands below are copied
from each repository's deploy documentation. Production deploys are normally
pulled by the `fivucsas-deployer` container on mordecai: it fast-forwards the
checkout to the newest `main` commit whose CI push run succeeded, rebuilds,
health-checks and rolls back on failure. Manual commands, if a deploy must be
forced:

### identity-core-api

```bash
cd /opt/projects/fivucsas/identity-core-api
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache identity-core-api
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d identity-core-api
```

Flyway applies `V90__author_trial.sql` on startup. Add the trial env values to
the compose `environment:` block (section 3.3), not only `.env.prod`. Swagger:
`/swagger-ui.html`. Runs on port 8080.

### biometric-processor

```bash
cd /opt/projects/fivucsas/biometric-processor
docker compose -f docker-compose.prod.yml --env-file .env.prod build biometric-api
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d biometric-api
```

`PUZZLE_TRACE_V2_ENABLED` is forwarded from `.env.prod` in the compose
`environment:` block; set it to `true` for the trial.

### web-app

`app.fivucsas.com` is the `fivucsas-app` nginx container (Dockerfile,
nginx.conf, docker-compose.prod.yml) on mordecai behind Traefik. The image
packages a `dist/` built on the host from the checkout's `.env.production`:

```bash
cd /opt/projects/fivucsas/web-app
npm ci && npm run build                      # node:22 helper container
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
curl -sk -o /dev/null -w '%{http_code}' --resolve app.fivucsas.com:443:127.0.0.1 https://app.fivucsas.com/
```

`.env.production` must contain `VITE_API_BASE_URL=https://api.fivucsas.com/api/v1`,
`VITE_CLIENT_SIDE_EMBEDDING=true` for the trial build, and a meaningful
`VITE_APP_VERSION`.

### Deployer pauses (if needed)

```bash
# pause/resume one service (mordecai)
docker exec fivucsas-deployer touch /state/PAUSED.identity-core-api
docker exec fivucsas-deployer rm /state/PAUSED.identity-core-api
# same pattern: PAUSED.biometric-processor, PAUSED.web-app
```

See `FIVUCSAS/infra/deployer/README.md` for the deployer's full behaviour.

## 14. Verification checklist before the first real attempt

- [ ] V90 applied (identity startup healthy).
- [ ] Four rows in `author_trial_participants`, codes `P1`..`P4`, no other rows.
- [ ] Trial flow: default APP_LOGIN, step 1 PUZZLE only, binding ON.
- [ ] identity trial flags set and the tenant allow-listed.
- [ ] identity client-side embedding ON; web built with `VITE_CLIENT_SIDE_EMBEDDING=true`.
- [ ] bio `PUZZLE_TRACE_V2_ENABLED=true`.
- [ ] All four participants show `Enrolled` after one-time enrollment.
- [ ] A genuine attempt reaches `AUTHENTICATED` and exports `outcome=accept`.
- [ ] An attack attempt with a broken instrument exports `outcome=reject` (proves the path is live, not auto-accepting).
- [ ] Exports stored outside git, access code not present in any log.