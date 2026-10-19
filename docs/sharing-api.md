# Family-sharing API

The API runs separately from the Android gallery. It does not scan or upload device media automatically; a client must explicitly send a file to an authorized album. The service requires PostgreSQL for all sharing operations.

## Local setup

1. Install PostgreSQL and create an empty database for PhotoVault.
2. Copy `.env.example` to `.env` in the workspace root and set `DATABASE_URL` to the local database connection string. Keep `.env` private; it is git-ignored.
3. Run `pnpm --filter @workspace/db migrate` from the workspace root.
4. Run `pnpm --filter @workspace/api-server dev`. The service listens on port `5000` by default.

`SHARED_MEDIA_DIR` selects the local upload directory; its default is `artifacts/api-server/data/shared-media`. `MAX_SHARED_MEDIA_BYTES` defaults to 50 MiB and may be set from 1 byte through 250 MiB. The directory must be on persistent storage with restrictive OS permissions and must not be exposed by a static web server.

The health endpoint (`GET /api/healthz`) does not require a database connection. Other routes return a service-unavailable response if PostgreSQL cannot be reached.

## Authentication and invitation use

- Register with `POST /api/auth/register` using a valid email and a password of 12–128 characters. Passwords are stored using Node.js scrypt.
- Log in at `POST /api/auth/login`. The opaque bearer token is returned once; send it as `Authorization: Bearer <token>`. The server stores only its hash. Sessions expire after 30 days; `POST /api/auth/logout` revokes the current token.
- Create a room, then create an invitation as its owner or admin. The response contains a one-time bearer token that expires after seven days. Deliver it privately yourself; the server has no email service.
- The invitation email field is intentionally not supported: account emails are not verified. Anyone who obtains the invitation token can accept it with an authenticated account. Treat the token like a password.

## Routes

All routes below are under `/api`. Unless marked public, they require a bearer session. Access to room content and media requires current room membership.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/healthz` | Health check; public |
| `POST` | `/auth/register` | Create a password account |
| `POST` | `/auth/login` | Create an expiring bearer session |
| `POST` | `/auth/logout` | Revoke current session |
| `GET` | `/auth/me` | Return current account |
| `POST` | `/invitations/accept` | Accept `{ "token": "..." }` |
| `GET`, `POST` | `/rooms` | List rooms; create `{ "name": "..." }` |
| `DELETE` | `/rooms/{roomId}` | Owner deletes room and its shared media |
| `GET` | `/rooms/{roomId}/members` | List room members |
| `PATCH`, `DELETE` | `/rooms/{roomId}/members/{userId}` | Owner changes role; owner/admin removes eligible member |
| `DELETE` | `/rooms/{roomId}/members/me` | Leave a room; owner must delete the room first |
| `GET`, `POST` | `/rooms/{roomId}/invitations` | List invitations; owner/admin creates one |
| `DELETE` | `/rooms/{roomId}/invitations/{invitationId}` | Revoke an active invitation |
| `GET`, `POST` | `/rooms/{roomId}/albums` | List or create shared albums |
| `PATCH`, `DELETE` | `/albums/{albumId}` | Owner/admin edits or deletes album |
| `GET`, `POST` | `/albums/{albumId}/media` | List media; upload multipart field `file` |
| `DELETE` | `/media/{mediaId}` | Delete media record and stored file |
| `GET` | `/media/{mediaId}/content` | Stream media after membership check |
| `GET`, `POST` | `/media/{mediaId}/comments` | List comments; add `{ "body": "..." }` |
| `GET`, `PUT` | `/media/{mediaId}/reactions` | List or set a reaction (`like`, `love`, `laugh`, `wow`) |
| `DELETE` | `/media/{mediaId}/reactions/{reaction}` | Remove the current user's reaction |

Room creation assigns the owner role. Owners may grant or revoke the admin role; admins can manage invitations and remove ordinary members. Album creators can set `membersCanAdd: false`, which restricts uploads to room owners/admins. Only the uploader or a room owner/admin can delete uploaded media.

## Current limitations

- The Android client has no family-sharing screens or API integration.
- Uploads are stored on the API host's local filesystem. S3-compatible storage, at-rest encryption, backups, email verification/delivery, password recovery, and invitation delivery are not implemented.
- Rate limiting is process-local. There is no coordinated limit store for multiple instances.
- Configure TLS, firewall restrictions, secrets, persistent storage, backups, and operational limits before deployment. This service has not been tested against a provisioned PostgreSQL instance and is not production-certified.
