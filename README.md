# PhotoVault

PhotoVault is an Android-first, local-first photo gallery built with Expo, React Native, TypeScript, SQLite, and Android's permitted media-library APIs. The app does not upload a gallery automatically.

## Run locally

Requirements:

- Node.js 22.12 or newer (Node 24 is recommended by the workspace configuration).
- pnpm 12.
- Android Studio and an Android SDK for an emulator/device build.

From the workspace root:

```powershell
pnpm install
pnpm dev
```

## Install PhotoVault on an Android phone

Each version tag builds a signed Android APK and attaches it to a GitHub Release. You can also run the **Android APK** workflow from the repository's Actions page; its APK is available as a temporary workflow artifact.

```powershell
git tag v1.0.2
git push origin v1.0.2
```

Before the first build, generate one Android release signing key in PowerShell:

```powershell
keytool -genkeypair -v -keystore "$env:USERPROFILE\photovault-release.keystore" -alias photovault -keyalg RSA -keysize 2048 -validity 10000
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\photovault-release.keystore")) | Set-Clipboard
```

Keep the keystore and passwords in a secure backup; never commit them or send them in chat. In the repository's **Settings → Secrets and variables → Actions**, add `ANDROID_SIGNING_KEY_BASE64` (paste the clipboard contents) and `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`photovault`), and `ANDROID_KEY_PASSWORD` using the values you entered during key generation. Use that same signing key for every release so Android accepts each APK as an update to the previous install.

After the workflow succeeds, download the APK from the GitHub Release on the Android phone and install it. Android may ask you to allow installation from that browser. GitHub provides the new APK for each release; Android does not silently install the update. The APK is a native Android app with phone media access; the web preview cannot access phone media.

## In-app update prompts

Settings includes a **Check for updates** action. APK update checks default to the public `AFFAN-SHAIK-07/PhotoVault` repository; set `EXPO_PUBLIC_GITHUB_REPOSITORY` to another public `owner/repository` before building if needed. The app checks the latest release and opens its APK download when a newer version is available; Android asks the user to install it. A public GitHub repository with a published APK release is required for this free release-checking option.

For JavaScript and asset updates without an APK download, create a free Expo account/project, set `EXPO_PUBLIC_EAS_PROJECT_ID` to its project ID in the build/publish environment, and build/install the `preview` profile. The app checks that channel for compatible OTA updates. The automatic update prompt is inactive until the project is configured and the installed APK was built for that same EAS project.

OTA updates cannot change native code, Android permissions, or the launcher icon. Those changes still require a newly signed APK from the GitHub Release workflow, installed by the user over the previous version using the same signing key.

Expo starts Metro and prints the available device/emulator options. For a native Android development build, install/configure the Android SDK and run:

```powershell
pnpm --filter @workspace/photovault exec expo run:android
```

To preview the screens in a desktop browser, run `pnpm --filter @workspace/photovault exec expo start --web` and open the URL Metro prints. The web preview is for layout/navigation only; photo-library access, SQLite-backed albums, and device actions require Android.

Grant photo/video access on the device. Android may provide full or selected-media access; the app indexes only what the operating system exposes. To run the project-wide checks:

```powershell
pnpm typecheck
pnpm --filter @workspace/photovault test
pnpm --filter @workspace/photovault build
```

The current export target is Android. Web export is not enabled because the installed `expo-sqlite` web worker requires a WebAssembly asset that is not present in the current dependency package. iOS is not currently a verified target.

## Project map

- `artifacts/photovault/app/` — Expo Router screens and navigation.
- `artifacts/photovault/context/LibraryContext.tsx` — Android media permissions, indexing, and local-library state.
- `artifacts/photovault/lib/database.ts` — SQLite schema and album/media queries.
- `artifacts/photovault/lib/library-utils.ts` — local filtering, source categorization, and date timeline helpers.
- `artifacts/photovault/lib/ai/` — consent-gated on-device face detection and SFace embedding inference.
- `artifacts/api-server/` — Express API service with account, room, album, upload, and sharing routes.
- `lib/db/` — PostgreSQL Drizzle schema and SQL migration runner.
- `lib/api-spec/openapi.yaml` — API contract.
- `docs/sharing-api.md` — API setup, route list, and sharing limitations.
- `docs/privacy-security.md` — current data flow, threat boundaries, and release blockers.

## Feature status

| Feature | Status |
| --- | --- |
| Android gallery of existing phone photos, videos, and screenshots, date grouping, thumbnails, and video playback | Implemented; original files are not duplicated; device verification still required |
| Permission handling and selected-photo access | Implemented through Expo Media Library; varies by Android version |
| Local SQLite media index and albums | Implemented |
| Album create/edit/delete, cover, ordering, and media membership | Implemented |
| Local search by indexed filename, date, type, and source metadata | Implemented; no visual/semantic AI |
| Favorites, selected-media album actions, single-item native sharing, and explicit original deletion | Implemented; deletion requires explicit confirmation and OS permission |
| Local-only default and privacy status | Implemented; gallery browsing does not upload media |
| People face grouping | Implemented as an opt-in, foreground Android scan; face embeddings stay in local SQLite and can be paused or deleted |
| Encrypted private vault, passcode/biometric lock, and secure-key recovery | Not implemented; do not store sensitive media in this app as a vault |
| Optional Google account memory | OAuth flow implemented; Google OAuth client IDs must be configured; only account profile is stored locally, never media |
| Sharing selected media with other phone apps | Implemented through Android's native share sheet; receiving apps and transfer behavior are controlled by Android/user |
| Cloud family sharing and remote uploads | Not connected to the mobile app; not required for local photo-library browsing |
| Configurable object storage, optional encrypted backup, restore, and remote deletion | Not implemented |
| Native background indexing/work scheduling and reliable background processing | Not implemented; indexing currently runs while the app is active |
| Editing, duplicate detection, location controls, EXIF removal, folder picker, and SAF integration | Not implemented |
| Automated tests | Unit tests cover local search, source classification, timeline grouping, and formatters; native/device flows need manual verification |

Do not treat a screen or a feature row marked "implemented" as proof of security certification or release readiness. Review permissions and test destructive actions on supported Android versions before distributing a build.

## Privacy and data boundaries

- Media and album metadata are kept in the device's SQLite database.
- Media is read from the device library only after the user grants operating-system permission.
- The app does not silently move or delete originals. Deleting originals is a separate, confirmed action.
- Album deletion removes only the virtual album and its membership records.
- The native share sheet sends only the item the user explicitly chooses to share.
- Multi-item native sharing is not implemented; the share action is enabled for one selected item.
- People grouping is off until the user explicitly agrees. The bundled SFace model and ML Kit detector run on-device; no photos or embeddings are uploaded.
- Face embeddings are sensitive biometric data stored unencrypted in the local SQLite database. The app provides pause and delete controls, and Android app-data backup is disabled; this does not make PhotoVault an encrypted vault.
- Face analysis only processes photos currently visible to PhotoVault and runs while the People screen is active. It can be stopped and resumed; video face analysis and background scans are not implemented.
- The Android app does not connect to family-sharing routes or upload media. The separate API accepts explicitly submitted uploads after PostgreSQL is configured.
- Private app folders are not accessed. Source categories are inferred from visible album/folder names and may be unknown or incorrect.
- Clearing the local index removes local metadata and album membership records but does not remove originals.

## Backend status and required setup

The Android app uses only the phone's existing photo/video library; it does not connect to the separate optional API backend. Google sign-in is optional and remembers the verified account profile only on this device. To enable it, copy the workspace `.env.example` to `artifacts/photovault/.env`, configure `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` with your Google OAuth client IDs, then restart Expo. The Android OAuth client must use package ID `com.photovault.mobile` and the signing certificate SHA-1 for your build. Google sign-in contacts Google to get the account profile; it never uploads photos or videos.

The separate self-hosted API is not used by the mobile app. Its health endpoint works without PostgreSQL, but room/sharing API routes require a PostgreSQL instance and the included migration. To run that optional server, copy `.env.example` to `.env`, set `DATABASE_URL`, then run:

```powershell
pnpm --filter @workspace/db migrate
pnpm --filter @workspace/api-server dev
```

The service defaults to port 5000. This optional API stores uploaded files on the server host, not on the phone. See [docs/sharing-api.md](./docs/sharing-api.md) for limitations.

## Android verification checklist

1. Test fresh install with permission denied, then granted, including Android 14+ selected-photo access.
2. Rescan with a large library, cancel midway, revoke permission, and reopen the app.
3. Verify media that is removed or moved by another app disappears after a completed scan.
4. Create/edit/delete albums; confirm deleting an album never deletes media.
5. Share one selected item and verify the receiving app gets the expected file.
6. Delete a selected original only after confirmation and verify cancellation preserves it.
7. Test offline browsing/search, low storage, missing media, app background/foreground, and database upgrade on a real device.
8. On Android, test first-time face-analysis consent, offline processing, pause/resume, selected-photo access, interruption, and deletion; confirm logs and backups do not expose face embeddings.

## Roadmap to the full specification

1. Add automated SQLite migration/indexing tests and native permission/share/delete device tests.
2. Build incremental Android indexing and thumbnail/background work with a native module or a documented Expo-compatible alternative.
3. Implement encrypted vault storage only after choosing a maintained authenticated-encryption library, Android Keystore integration, backup exclusion, recovery policy, and security tests.
4. Improve People grouping with merge/split/correction controls, review model quality on representative devices, and add a resumable native background scan only after device testing.
5. Connect a reviewed sharing UI to the API; add verified email delivery, password recovery, production storage, operational rate limiting, audit/retention controls, and PostgreSQL integration tests.
6. Add restore/backup, editing/export, duplicate suggestions, SAF folder access, and privacy/retention controls.
