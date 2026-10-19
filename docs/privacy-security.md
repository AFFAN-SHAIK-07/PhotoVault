# PhotoVault privacy and security status

## Current data flow

- On Android, the app requests read access to photos and videos using the system media-library permission API. Photos, videos, and screenshots already in the phone's media library are indexed only after permission is granted; source files are not copied.
- The app stores filenames, content URIs, basic dimensions, capture/modified times, source-folder labels, favorites, and album membership in a local SQLite database.
- Photo/video bytes are rendered from their local media URIs. There is no background or automatic upload path.
- A user can explicitly invoke the native share sheet for one selected asset. The receiving app and any subsequent network transfer are controlled by the user and Android.
- Original media deletion is an explicit action with confirmation and delegates to the operating-system media API. Album deletion and membership removal affect only PhotoVault metadata.
- Family sharing is a separate API and stores only media explicitly uploaded by an authenticated user. The Android gallery is not connected to that API.

## Threat boundaries and controls in this build

- Permission scope is restricted to photo/video access and can be revoked by the user. The app rechecks permission when returning to the foreground.
- Source-app discovery relies on visible album names and is best-effort; private app data is not read.
- Sharing API SQL uses bound parameters. Passwords use Node scrypt; session and invitation bearer tokens are stored as SHA-256 hashes. Sessions expire after 30 days and invitations after seven days.
- Every room, album, media, comment, reaction, and download read checks the current user's room membership. Owner/admin/member roles gate administrative actions; album settings can prohibit member uploads.
- Uploads are size-limited, stored outside the web root, checked by file signature against a photo/video MIME allowlist, and served only through an authenticated route. The default maximum is 50 MiB, configurable up to 250 MiB.
- Shared media is stored on the API host's local filesystem, not encrypted by PhotoVault and not backed by an object-storage service.
- Logs should not include media bytes, URIs, filenames, location data, or face metadata. No face metadata or location index is currently implemented.
- Network services are not used by the local gallery, albums, or search. Optional Google sign-in contacts Google only to retrieve an account profile, which is stored on-device; it does not send media.
- Clearing the local index is not a media-file deletion operation.

## Explicitly not security-complete

- The app does not yet provide a private vault, encryption-at-rest for imported media, passcode/biometric gate, Android Keystore key lifecycle, screenshot blocking, or backup exclusion policy. SQLite metadata and source media are not a secure vault.
- Account email addresses are not verified; invitations are bearer tokens shared manually, not secure email invitations. Password reset and email delivery are not implemented.
- Rate limits are in-memory per process and do not coordinate across replicas. No persistent audit trail is implemented.
- No TLS endpoint, production deployment, object-storage provider, backup policy, or mobile sharing client is provisioned. Do not expose the API directly to the public internet or upload sensitive media until these controls and deployment-specific access restrictions are in place.
- Local shared media is stored unencrypted at rest. Protect the storage volume, PostgreSQL instance, environment file, backups, and host account. Deleting an album or room deletes database rows and attempts to remove stored files; a cleanup failure is returned and logged for administrator action.
- No on-device face/visual model is enabled. `artifacts/photovault/lib/ai/contracts.ts` defines the boundary and returns an explicit unavailable error.
- Native-device permission, deletion confirmation, backup/restore, and media cache behavior have not been verified on a physical device.

## Required security review before enabling vault or remote sharing

1. Select and document an authenticated-encryption implementation, KDF parameters, per-file nonces, integrity/tag validation, key rotation, recovery/reset behavior, and secure temporary-file cleanup.
2. Verify that all vault files, thumbnails, SQLite data, app logs, OS recents, crash reports, and device backups follow the vault policy.
3. Add email verification and account recovery, and use a durable shared rate-limit store before deploying multiple API instances.
4. Configure TLS, production secrets, firewall/network restrictions, encrypted persistent storage and backups, retention, and deletion procedures.
5. Add audit events without sensitive media data and verify object-level authorization, membership revocation, upload limits, MIME sniffing, path safety, and file cleanup against a real PostgreSQL instance.
6. Connect the mobile client only after API integration tests, Android permission/revocation tests, dependency scanning, and an independent security review.
