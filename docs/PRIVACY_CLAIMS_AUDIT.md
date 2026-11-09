# Privacy claims audit (2026-11-02)

Scope: user-facing privacy, terms, KVKK and security statements in
`src/i18n/locales/{en,tr}.json` (`privacy.*`, `terms.s8Body`). EN and TR were
changed identically; no i18n keys were renamed or added. Paths below are relative
to the sibling repos (`biometric-processor`, `identity-core-api`, `FIVUCSAS`).

| # | Claim | Old text (EN) | Evidence | New text (EN, summary) |
|---|---|---|---|---|
| 1 | Encryption at rest | "AES-256 encryption" (s2Body, s8Body) | `biometric-processor/app/infrastructure/security/embedding_cipher.py:27,39` (Fernet = AES-128-CBC + HMAC-SHA256); `pgvector_embedding_repository.py:31-36` (search column `embedding` is plaintext, `embedding_ciphertext` is Fernet) | Encrypted copy kept (Fernet: AES-128-CBC + HMAC-SHA256); the search vector is not encrypted at column level; DB internal-only and access-controlled |
| 2 | TLS version | "TLS 1.3" (s2Body, s8Body) | `FIVUCSAS/infra/traefik/config/traefik.yml:39-40`, `dynamic.yml` (Let's Encrypt `tls:` blocks, no `minVersion`/TLS options pinned) | "TLS" |
| 3 | Row-level security | "PostgreSQL row-level security defined as defense-in-depth" (s8Body) | RLS policies exist (`identity-core-api/.../V25__add_row_level_security.sql:9-41`) but `identity-core-api/docker-compose.prod.yml:27` connects as `postgres` (superuser bypasses RLS) and FORCE RLS is not enabled (identity-core-api#231) | Tenant isolation enforced in the application layer (Hibernate tenant filter) and covered by automated CI tests; RLS not mentioned |
| 4 | fail2ban / security audits | "rate limiting and fail2ban", "regular security audits" (s8Body) | Traefik `rate-limit@file` middleware (`traefik.yml`); fail2ban only in the unused `scripts/deploy-ubuntu-coolify.sh:127`; no audit/pentest record found | "rate limiting and account lockout"; audits and fail2ban removed. Added: biometric service not public + API key (bio CLAUDE.md "Security") |
| 5 | VERBİS | "We maintain a data processing inventory (VERBiS registration)" (s4Body) | No legal entity / VERBİS registration evidence in any repo | Removed (not replaced) |
| 6 | Deletion on account deletion / consent withdrawal | "all biometric templates and personal data are permanently and irreversibly erased within 30 days" (s3Body); "all biometric enrollment data will be permanently deleted within 30 days" (terms.s8Body) | `identity-core-api/.../ManageUserService.java:372-411` (`deleteUser` soft-deletes only, no biometric-processor call); `SoftDeletePurgeJob.java:29-45,67` (flag default false, cascades only identity DB tables, never calls bio); `docker-compose.prod.yml:67` `${APP_PURGE_SOFT_DELETE_ENABLED:-false}`. Per-method deletion DOES call bio: `ManageEnrollmentService.java:373-383` (`deleteFace`/`deleteVoice`) | Per-method deletion via Settings also requests bio template deletion; account deletion now requests face+voice template deletion automatically (identity-core-api #279: durable outbox, retried until bio confirms); other personal data is deactivated and permanently erased on request (`SoftDeletePurgeJob` stays off by default). No time bound is promised. **Takes effect only once identity-core-api ≥ #279 is deployed** |
| 7 | Audit log retention | "minimum of 2 years as required by Turkish regulations" (s3Body) | `identity-core-api/.../V57__audit_logs_pg_partman.sql:32-33,268` (24 months; fail-soft if pg_partman absent) | "configured to be retained for 24 months"; no legal attribution |
| 8 | Raw image / "never reversible" | "cannot be reverse-engineered into original biometric samples" (s2Body) | Client-side face embedding is the prod default (`APP_AUTH_CLIENT_SIDE_EMBEDDING=true`, identity-core-api CLAUDE.md; `FaceEnrollmentDialog.tsx:59-62`, `MfaStepRenderer.tsx:197`); voice audio, document scans, legacy paths still upload media (bio CLAUDE.md) | Face login/enrollment send only a 512-d vector, image not transmitted; voice, document scans and some fallback paths still upload media. Irreversibility claim dropped |
| 9 | Hosting / cross-border transfer | (not stated) | Owner decision 2026-11-09: production runs on mordecai, a server in Turkey, and stays there. Verified read-only on 2026-11-09: `app.fivucsas.com` and `api.fivucsas.com` resolve to 95.70.201.79 (mordecai); the containers `fivucsas-app`, `identity-core-api`, `biometric-api` and `shared-postgres` (databases `identity_core`, `biometric_db`) run there. The earlier Hetzner Germany text came from `FIVUCSAS/CLAUDE.md` and a poster brief and is outdated (Hetzner deploy workflows were removed: web-app #263, identity-core-api #282) | Application servers and databases are located in Turkey (s2Body, s4Body). The KVKK art. 9 sentence about a transfer to Germany is removed; s4Body points to s7Body for the providers outside Turkey |
| 10 | Third-party sharing | "Biometric data is never shared with ... third parties" (s7Body) | SMS: `SMS_PROVIDER=twilio-verify` in the running `identity-core-api` container. Email: `MAIL_HOST=smtp.hostinger.com` in the same container. Backups: `/etc/cron.d/mordecai` runs `mordecai-backup.sh` (pg_dump of `identity_core` and `biometric_db` into a borg repository) and `mordecai-offsite.sh` (`rclone sync /data/borg gdrive:mordecai-backup/borg`, i.e. Google Drive). Browser downloads: `index.html:25-42`, `src/config/cdn.ts:24` (jsDelivr), `src/lib/biometric-engine/core/FaceDetector.ts:42`, `src/lib/ml/BlazeFaceDetector.ts:89` (storage.googleapis.com). Google Fonts and api.qrserver.com appear only in CSP allow-lists, nothing loads from them | Not sold / not used for ads or profiling. Providers outside Turkey named with the data they receive: Twilio (phone number, code), Hostinger email (email address, message), Google Drive (encrypted database backups), jsDelivr and Google storage (IP address and browser details of the model and library downloads; no biometric data) |
| 11 | Fingerprint "templates" | "fingerprint templates (WebAuthn public key credentials)" (s1Biometric) | Fingerprint is WebAuthn-only (`ManageEnrollmentService.java:384-389`, identity CLAUDE.md P1.4) | Only a WebAuthn public key credential is stored; the fingerprint stays on the device |
| 12 | Data Protection Officer | "contact our Data Protection Officer" (s9Title/s9Body) | No DPO appointment evidence | Section renamed "Contact"; same address and 30-day KVKK response kept |
| 13 | Last updated | "April 2026" | n/a | "November 2026" |

Kept unchanged (verified or non-technical): JWT refresh-token rotation (identity V50 `family_id`),
KVKK art. 6 special-category / explicit consent, rights list (s6), GDPR section (s5), data export
(`UserDataExportController.java:49`). Code comments saying "the raw image never leaves the device"
are not user-facing and were left as is.

## Open points found while re-checking (2026-11-09, not changed in the text)

- **Soft-delete purge is on in production.** The running `identity-core-api` container has
  `APP_PURGE_SOFT_DELETE_ENABLED=true`, and `application-prod.yml` describes the job as a daily
  hard purge of users soft-deleted more than 30 days ago. Row 6 and `s3Body` say the purge stays
  off by default and that permanent erasure happens on request; that matches the
  `docker-compose.prod.yml` default (`false`) but not the production environment. The owner
  should decide whether `s3Body` should describe the 30-day purge.
- **Not verified:** the encryption mode of the borg repository (only the script comment and the
  passphrase-based `borg check` cron line were read; `borg info` needs root), whether the
  off-site sync currently succeeds (`/data/offsite.log` is not readable as `developer`), and the
  countries where Hostinger's mail servers and Google Drive store data. The text therefore says
  only that these providers are outside Turkey.
