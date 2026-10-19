import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Router, type Request, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { fileTypeFromFile } from "file-type";
import { pool } from "@workspace/db";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const storageRoot = path.resolve(
  process.env.SHARED_MEDIA_DIR ?? path.join(process.cwd(), "data", "shared-media"),
);
const stagingRoot = path.join(storageRoot, ".staging");
const configuredUploadLimit = Number(process.env.MAX_SHARED_MEDIA_BYTES ?? 50 * 1024 * 1024);
if (!Number.isSafeInteger(configuredUploadLimit) || configuredUploadLimit < 1 || configuredUploadLimit > 250 * 1024 * 1024) {
  throw new Error("MAX_SHARED_MEDIA_BYTES must be an integer between 1 and 262144000.");
}

type AuthUser = { id: string; email: string };
type RoomRole = "owner" | "admin" | "member";
type RoomRow = { id: string; name: string; role: RoomRole; owner_id: string; created_at: Date };
type AlbumRow = {
  id: string;
  room_id: string;
  name: string;
  description: string;
  members_can_add: boolean;
  role: RoomRole;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      familyRoom?: RoomRow;
      sharedAlbum?: AlbumRow;
    }
  }
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const registrationSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});
const roomSchema = z.object({ name: z.string().trim().min(1).max(80) });
const memberRoleSchema = z.object({ role: z.enum(["admin", "member"]) });
const albumSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  membersCanAdd: z.boolean().optional(),
});
const invitationSchema = z.object({}).strict();
const acceptInvitationSchema = z.object({ token: z.string().min(32).max(128) });
const commentSchema = z.object({ body: z.string().trim().min(1).max(1000) });
const reactionSchema = z.object({ reaction: z.enum(["like", "love", "laugh", "wow"]) });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const upload = multer({
  storage: multer.diskStorage({
    destination(_request, _file, callback) {
      void mkdir(stagingRoot, { recursive: true }).then(
        () => callback(null, stagingRoot),
        (error: Error) => callback(error, stagingRoot),
      );
    },
    filename(_request, _file, callback) {
      callback(null, randomUUID());
    },
  }),
  limits: { fileSize: configuredUploadLimit, files: 1, fields: 5, parts: 8 },
});

const allowedMimeTypes = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function getUser(request: Request): AuthUser {
  if (!request.authUser) throw new ApiError(401, "UNAUTHENTICATED", "Sign in is required.");
  return request.authUser;
}

function parseBody<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, "INVALID_INPUT", "The request body is invalid.");
  }
  return result.data;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function makeToken(): string {
  return randomBytes(32).toString("base64url");
}

async function removeStoredFiles(storageKeys: string[], subjectId: string): Promise<void> {
  for (const storageKey of storageKeys) {
    const filePath = path.resolve(storageRoot, storageKey);
    if (!filePath.startsWith(`${storageRoot}${path.sep}`)) {
      throw new Error("Stored media key escaped the configured storage directory.");
    }
    try {
      await unlink(filePath);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        continue;
      }
      logger.error({ err: error, subjectId }, "Failed to remove stored media after deleting its database record");
      throw new ApiError(500, "MEDIA_CLEANUP_FAILED", "The database records were deleted, but stored files need administrator cleanup.");
    }
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const N = 32768;
  const key = await derivePasswordKey(password, salt, 64, N);
  return `scrypt$${N}$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

function derivePasswordKey(password: string, salt: Buffer, length: number, N: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      length,
      { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolve(key),
    );
  });
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, rawN, rawR, rawP, saltHex, hashHex] = stored.split("$");
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (
    algorithm !== "scrypt" ||
    !Number.isSafeInteger(N) ||
    N < 16384 ||
    N > 65536 ||
    r !== 8 ||
    p !== 1 ||
    !saltHex ||
    !hashHex ||
    !/^[a-f0-9]{32}$/.test(saltHex) ||
    !/^[a-f0-9]{128}$/.test(hashHex)
  ) {
    throw new Error("Stored password hash has an unsupported format.");
  }
  const expected = Buffer.from(hashHex, "hex");
  const actual = await derivePasswordKey(password, Buffer.from(saltHex, "hex"), expected.length, N);
  return timingSafeEqual(expected, actual);
}

const authenticate: RequestHandler = async (request, _response, next) => {
  try {
    const header = request.header("authorization");
    const match = header?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
    if (!match) throw new ApiError(401, "UNAUTHENTICATED", "A valid bearer session is required.");
    const { rows } = await pool.query<AuthUser>(
      `SELECT users.id, users.email
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
      [tokenHash(match[1])],
    );
    if (!rows[0]) throw new ApiError(401, "SESSION_EXPIRED", "The session is invalid or expired.");
    request.authUser = rows[0];
    next();
  } catch (error) {
    next(error);
  }
};

function requireRoom(allowMembers = true): RequestHandler {
  return async (request, _response, next) => {
    try {
      const roomId = z.string().uuid().safeParse(request.params.roomId);
      if (!roomId.success) throw new ApiError(400, "INVALID_ROOM_ID", "A valid room ID is required.");
      const { rows } = await pool.query<RoomRow>(
        `SELECT r.id, r.name, r.owner_id, r.created_at, m.role
         FROM family_rooms r
         JOIN family_memberships m ON m.room_id = r.id
         WHERE r.id = $1 AND m.user_id = $2`,
        [roomId.data, getUser(request).id],
      );
      if (!rows[0]) throw new ApiError(404, "ROOM_NOT_FOUND", "The room was not found.");
      if (!allowMembers && rows[0].role === "member") {
        throw new ApiError(403, "FORBIDDEN", "Room owner or admin permission is required.");
      }
      request.familyRoom = rows[0];
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireAlbum(writable = false): RequestHandler {
  return async (request, _response, next) => {
    try {
      const albumId = z.string().uuid().safeParse(request.params.albumId);
      if (!albumId.success) throw new ApiError(400, "INVALID_ALBUM_ID", "A valid album ID is required.");
      const { rows } = await pool.query<AlbumRow>(
        `SELECT a.id, a.room_id, a.name, a.description, a.members_can_add, m.role
         FROM shared_albums a
         JOIN family_memberships m ON m.room_id = a.room_id
         WHERE a.id = $1 AND m.user_id = $2`,
        [albumId.data, getUser(request).id],
      );
      if (!rows[0]) throw new ApiError(404, "ALBUM_NOT_FOUND", "The album was not found.");
      if (writable && rows[0].role === "member" && !rows[0].members_can_add) {
        throw new ApiError(403, "FORBIDDEN", "This shared album does not allow member uploads.");
      }
      request.sharedAlbum = rows[0];
      next();
    } catch (error) {
      next(error);
    }
  };
}

router.post("/auth/register", authLimiter, async (request, response) => {
  const input = parseBody(registrationSchema, request.body);
  const email = input.email.toLowerCase();
  const id = randomUUID();
  try {
    const passwordHash = await hashPassword(input.password);
    await pool.query(
      "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
      [id, email, passwordHash],
    );
    response.status(201).json({ id, email });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new ApiError(409, "EMAIL_IN_USE", "An account with this email already exists.");
    }
    throw error;
  }
});

router.post("/auth/login", authLimiter, async (request, response) => {
  const input = parseBody(loginSchema, request.body);
  const { rows } = await pool.query<{ id: string; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [input.email.toLowerCase()],
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(input.password, user.password_hash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  const token = makeToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await pool.query(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), user.id, tokenHash(token), expiresAt],
  );
  response.json({ token, expiresAt, user: { id: user.id, email: user.email } });
});

router.post("/auth/logout", authenticate, async (request, response) => {
  const header = request.header("authorization");
  const token = header?.slice("Bearer ".length);
  if (token) {
    await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  }
  response.status(204).end();
});

router.get("/auth/me", authenticate, (request, response) => {
  response.json({ user: getUser(request) });
});

router.post("/invitations/accept", authenticate, async (request, response) => {
  const { token } = parseBody(acceptInvitationSchema, request.body);
  const user = getUser(request);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const invitationResult = await client.query<{ id: string; room_id: string }>(
      `SELECT id, room_id FROM family_invitations
       WHERE token_hash = $1 AND expires_at > now()
         AND accepted_at IS NULL AND revoked_at IS NULL FOR UPDATE`,
      [tokenHash(token)],
    );
    const invitation = invitationResult.rows[0];
    if (!invitation) throw new ApiError(404, "INVITATION_INVALID", "The invitation is invalid or expired.");
    await client.query(
      `INSERT INTO family_memberships (room_id, user_id, role)
       VALUES ($1, $2, 'member') ON CONFLICT (room_id, user_id) DO NOTHING`,
      [invitation.room_id, user.id],
    );
    await client.query(
      "UPDATE family_invitations SET accepted_at = now() WHERE id = $1",
      [invitation.id],
    );
    await client.query("COMMIT");
    response.status(200).json({ roomId: invitation.room_id, joined: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/rooms", authenticate, async (request, response) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.name, r.owner_id AS "ownerId", r.created_at AS "createdAt", m.role,
       (SELECT count(*)::int FROM family_memberships members WHERE members.room_id = r.id) AS "memberCount"
     FROM family_rooms r
     JOIN family_memberships m ON m.room_id = r.id
     WHERE m.user_id = $1
     ORDER BY r.created_at DESC`,
    [getUser(request).id],
  );
  response.json({ rooms: rows });
});

router.post("/rooms", authenticate, async (request, response) => {
  const { name } = parseBody(roomSchema, request.body);
  const user = getUser(request);
  const roomId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO family_rooms (id, name, owner_id) VALUES ($1, $2, $3)",
      [roomId, name, user.id],
    );
    await client.query(
      "INSERT INTO family_memberships (room_id, user_id, role) VALUES ($1, $2, 'owner')",
      [roomId, user.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.status(201).json({ id: roomId, name, role: "owner" });
});

router.get("/rooms/:roomId/members", authenticate, requireRoom(), async (request, response) => {
  const room = request.familyRoom!;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, m.role, m.joined_at AS "joinedAt"
     FROM family_memberships m JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $1 ORDER BY m.joined_at`,
    [room.id],
  );
  response.json({ members: rows });
});

router.patch(
  "/rooms/:roomId/members/:userId",
  authenticate,
  requireRoom(false),
  async (request, response) => {
    const room = request.familyRoom!;
    if (room.role !== "owner") throw new ApiError(403, "FORBIDDEN", "Only the room owner can manage roles.");
    const userId = z.string().uuid().safeParse(request.params.userId);
    if (!userId.success) throw new ApiError(400, "INVALID_USER_ID", "A valid user ID is required.");
    const { role } = parseBody(memberRoleSchema, request.body);
    const { rows } = await pool.query(
      `UPDATE family_memberships SET role = $1
       WHERE room_id = $2 AND user_id = $3 AND role <> 'owner'
       RETURNING room_id AS "roomId", user_id AS "userId", role`,
      [role, room.id, userId.data],
    );
    if (!rows[0]) throw new ApiError(404, "MEMBER_NOT_FOUND", "The room member was not found.");
    response.json(rows[0]);
  },
);

router.delete("/rooms/:roomId/members/me", authenticate, requireRoom(), async (request, response) => {
  const room = request.familyRoom!;
  if (room.role === "owner") {
    throw new ApiError(409, "OWNER_CANNOT_LEAVE", "Transfer ownership or delete the room before leaving.");
  }
  await pool.query(
    "DELETE FROM family_memberships WHERE room_id = $1 AND user_id = $2",
    [room.id, getUser(request).id],
  );
  response.status(204).end();
});

router.delete(
  "/rooms/:roomId/members/:userId",
  authenticate,
  requireRoom(false),
  async (request, response) => {
    const room = request.familyRoom!;
    const userId = z.string().uuid().safeParse(request.params.userId);
    if (!userId.success) throw new ApiError(400, "INVALID_USER_ID", "A valid user ID is required.");
    const { rows } = await pool.query<{ role: RoomRole }>(
      "SELECT role FROM family_memberships WHERE room_id = $1 AND user_id = $2",
      [room.id, userId.data],
    );
    const target = rows[0];
    if (!target || target.role === "owner") {
      throw new ApiError(404, "MEMBER_NOT_FOUND", "The room member was not found.");
    }
    if (room.role === "admin" && target.role !== "member") {
      throw new ApiError(403, "FORBIDDEN", "Admins can remove members but not other admins.");
    }
    await pool.query(
      "DELETE FROM family_memberships WHERE room_id = $1 AND user_id = $2",
      [room.id, userId.data],
    );
    response.status(204).end();
  },
);

router.delete("/rooms/:roomId", authenticate, requireRoom(false), async (request, response) => {
  const room = request.familyRoom!;
  if (room.role !== "owner") throw new ApiError(403, "FORBIDDEN", "Only the room owner can delete a room.");
  const { rows: media } = await pool.query<{ storage_key: string }>(
    `SELECT m.storage_key FROM shared_media m
     JOIN shared_albums a ON a.id = m.album_id WHERE a.room_id = $1`,
    [room.id],
  );
  await pool.query("DELETE FROM family_rooms WHERE id = $1", [room.id]);
  await removeStoredFiles(media.map((item) => item.storage_key), room.id);
  response.status(204).end();
});

router.post("/rooms/:roomId/invitations", authenticate, requireRoom(false), async (request, response) => {
  parseBody(invitationSchema, request.body);
  const room = request.familyRoom!;
  const token = makeToken();
  const expiresAt = new Date(Date.now() + INVITATION_DURATION_MS);
  await pool.query(
    `INSERT INTO family_invitations (id, room_id, invited_by, invited_email, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), room.id, getUser(request).id, null, tokenHash(token), expiresAt],
  );
  response.status(201).json({
    token,
    expiresAt,
    acceptEndpoint: "/api/invitations/accept",
    delivery: "Copy and share this one-time invitation token privately. Email delivery is not configured.",
  });
});

router.get("/rooms/:roomId/invitations", authenticate, requireRoom(false), async (request, response) => {
  const { rows } = await pool.query(
    `SELECT id, expires_at AS "expiresAt", accepted_at AS "acceptedAt",
       revoked_at AS "revokedAt", created_at AS "createdAt"
     FROM family_invitations WHERE room_id = $1 ORDER BY created_at DESC`,
    [request.familyRoom!.id],
  );
  response.json({ invitations: rows });
});

router.delete(
  "/rooms/:roomId/invitations/:invitationId",
  authenticate,
  requireRoom(false),
  async (request, response) => {
    const invitationId = z.string().uuid().safeParse(request.params.invitationId);
    if (!invitationId.success) throw new ApiError(400, "INVALID_INVITATION_ID", "A valid invitation ID is required.");
    const { rowCount } = await pool.query(
      `UPDATE family_invitations SET revoked_at = now()
       WHERE id = $1 AND room_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [invitationId.data, request.familyRoom!.id],
    );
    if (!rowCount) throw new ApiError(404, "INVITATION_NOT_FOUND", "The active invitation was not found.");
    response.status(204).end();
  },
);

router.get("/rooms/:roomId/albums", authenticate, requireRoom(), async (request, response) => {
  const room = request.familyRoom!;
  const { rows } = await pool.query(
    `SELECT a.id, a.name, a.description, a.members_can_add AS "membersCanAdd",
       a.created_at AS "createdAt", a.updated_at AS "updatedAt", u.email AS "createdBy",
       (SELECT count(*)::int FROM shared_media m WHERE m.album_id = a.id) AS "mediaCount"
     FROM shared_albums a JOIN users u ON u.id = a.created_by
     WHERE a.room_id = $1 ORDER BY a.updated_at DESC`,
    [room.id],
  );
  response.json({ albums: rows });
});

router.post("/rooms/:roomId/albums", authenticate, requireRoom(), async (request, response) => {
  const input = parseBody(albumSchema, request.body);
  const room = request.familyRoom!;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO shared_albums
       (id, room_id, name, description, created_by, members_can_add)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, room.id, input.name, input.description ?? "", getUser(request).id, input.membersCanAdd ?? true],
  );
  response.status(201).json({
    id,
    roomId: room.id,
    name: input.name,
    description: input.description ?? "",
    membersCanAdd: input.membersCanAdd ?? true,
  });
});

router.patch("/albums/:albumId", authenticate, requireAlbum(), async (request, response) => {
  const input = parseBody(albumSchema, request.body);
  const album = request.sharedAlbum!;
  if (album.role === "member") throw new ApiError(403, "FORBIDDEN", "Room owner or admin permission is required.");
  const { rows } = await pool.query(
    `UPDATE shared_albums
     SET name = $1, description = $2, members_can_add = $3, updated_at = now()
     WHERE id = $4
     RETURNING id, room_id AS "roomId", name, description,
       members_can_add AS "membersCanAdd", updated_at AS "updatedAt"`,
    [
      input.name,
      input.description ?? album.description,
      input.membersCanAdd ?? album.members_can_add,
      album.id,
    ],
  );
  response.json(rows[0]);
});

router.delete("/albums/:albumId", authenticate, requireAlbum(), async (request, response) => {
  const album = request.sharedAlbum!;
  if (album.role === "member") throw new ApiError(403, "FORBIDDEN", "Room owner or admin permission is required.");
  const { rows: media } = await pool.query<{ storage_key: string }>(
    "SELECT storage_key FROM shared_media WHERE album_id = $1",
    [album.id],
  );
  await pool.query("DELETE FROM shared_albums WHERE id = $1", [album.id]);
  await removeStoredFiles(media.map((item) => item.storage_key), album.id);
  response.status(204).end();
});

router.get("/albums/:albumId/media", authenticate, requireAlbum(), async (request, response) => {
  const album = request.sharedAlbum!;
  const { rows } = await pool.query(
    `SELECT m.id, m.original_filename AS "filename", m.mime_type AS "mimeType",
       m.byte_size AS "byteSize", m.created_at AS "createdAt", u.email AS "uploadedBy"
     FROM shared_media m JOIN users u ON u.id = m.uploaded_by
     WHERE m.album_id = $1 ORDER BY m.created_at DESC`,
    [album.id],
  );
  response.json({
    media: rows.map((row) => ({ ...row, downloadUrl: `/api/media/${row.id}/content` })),
  });
});

router.post(
  "/albums/:albumId/media",
  authenticate,
  requireAlbum(true),
  uploadLimiter,
  upload.single("file"),
  async (request, response) => {
    const album = request.sharedAlbum!;
    const file = request.file;
    if (!file) throw new ApiError(400, "FILE_REQUIRED", "Provide one media file in the 'file' field.");
    let destination: string | undefined;
    try {
      const type = await fileTypeFromFile(file.path);
      if (!type || !allowedMimeTypes.has(type.mime) || !/^[a-z0-9]{1,10}$/.test(type.ext)) {
        throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Only supported photo and video file formats can be uploaded.");
      }
      const id = randomUUID();
      const storageKey = `${randomUUID()}.${type.ext}`;
      destination = path.join(storageRoot, storageKey);
      await rename(file.path, destination);
      const rawName = path.win32.basename(path.basename(file.originalname));
      const filename = rawName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255) || `upload.${type.ext}`;
      const { rows } = await pool.query(
        `INSERT INTO shared_media
           (id, album_id, uploaded_by, original_filename, mime_type, byte_size, storage_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, original_filename AS "filename", mime_type AS "mimeType",
           byte_size AS "byteSize", created_at AS "createdAt"`,
        [id, album.id, getUser(request).id, filename, type.mime, file.size, storageKey],
      );
      response.status(201).json({ ...rows[0], downloadUrl: `/api/media/${id}/content` });
    } catch (error) {
      if (destination) await unlink(destination).catch((cleanupError: NodeJS.ErrnoException) => {
        if (cleanupError.code !== "ENOENT") throw cleanupError;
      });
      throw error;
    } finally {
      await unlink(file.path).catch((cleanupError: NodeJS.ErrnoException) => {
        if (cleanupError.code !== "ENOENT") throw cleanupError;
      });
    }
  },
);

router.get("/media/:mediaId/content", authenticate, async (request, response) => {
  const mediaId = z.string().uuid().safeParse(request.params.mediaId);
  if (!mediaId.success) throw new ApiError(400, "INVALID_MEDIA_ID", "A valid media ID is required.");
  const { rows } = await pool.query<{ storage_key: string; mime_type: string; original_filename: string }>(
    `SELECT m.storage_key, m.mime_type, m.original_filename
     FROM shared_media m
     JOIN shared_albums a ON a.id = m.album_id
     JOIN family_memberships fm ON fm.room_id = a.room_id
     WHERE m.id = $1 AND fm.user_id = $2`,
    [mediaId.data, getUser(request).id],
  );
  const media = rows[0];
  if (!media) throw new ApiError(404, "MEDIA_NOT_FOUND", "The media item was not found.");
  const filePath = path.resolve(storageRoot, media.storage_key);
  if (!filePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Stored media key escaped the configured storage directory.");
  }
  response.type(media.mime_type);
  response.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(media.original_filename)}`);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.sendFile(filePath, (error) => {
    if (error) {
      logger.error({ err: error, mediaId: mediaId.data }, "Failed to stream stored media");
      if (response.headersSent) {
        response.destroy(error);
      } else {
        response.status(500).json({ error: { code: "MEDIA_READ_FAILED", message: "The media file could not be read." } });
      }
    }
  });
});

router.delete("/media/:mediaId", authenticate, async (request, response) => {
  const mediaId = z.string().uuid().safeParse(request.params.mediaId);
  if (!mediaId.success) throw new ApiError(400, "INVALID_MEDIA_ID", "A valid media ID is required.");
  const user = getUser(request);
  const { rows } = await pool.query<{ storage_key: string; role: RoomRole; uploaded_by: string }>(
    `SELECT m.storage_key, m.uploaded_by, fm.role
     FROM shared_media m
     JOIN shared_albums a ON a.id = m.album_id
     JOIN family_memberships fm ON fm.room_id = a.room_id
     WHERE m.id = $1 AND fm.user_id = $2`,
    [mediaId.data, user.id],
  );
  const media = rows[0];
  if (!media) throw new ApiError(404, "MEDIA_NOT_FOUND", "The media item was not found.");
  if (media.uploaded_by !== user.id && media.role === "member") {
    throw new ApiError(403, "FORBIDDEN", "Only the uploader or a room owner/admin can delete this item.");
  }
  await pool.query("DELETE FROM shared_media WHERE id = $1", [mediaId.data]);
  await removeStoredFiles([media.storage_key], mediaId.data);
  response.status(204).end();
});

router.get("/media/:mediaId/comments", authenticate, async (request, response) => {
  const mediaId = z.string().uuid().safeParse(request.params.mediaId);
  if (!mediaId.success) throw new ApiError(400, "INVALID_MEDIA_ID", "A valid media ID is required.");
  const { rows } = await pool.query(
    `SELECT c.id, c.body, c.created_at AS "createdAt", u.id AS "userId", u.email
     FROM shared_comments c
     JOIN shared_media m ON m.id = c.media_id
     JOIN shared_albums a ON a.id = m.album_id
     JOIN family_memberships fm ON fm.room_id = a.room_id
     JOIN users u ON u.id = c.user_id
     WHERE c.media_id = $1 AND fm.user_id = $2
     ORDER BY c.created_at`,
    [mediaId.data, getUser(request).id],
  );
  response.json({ comments: rows });
});

router.post("/media/:mediaId/comments", authenticate, async (request, response) => {
  const mediaId = z.string().uuid().safeParse(request.params.mediaId);
  if (!mediaId.success) throw new ApiError(400, "INVALID_MEDIA_ID", "A valid media ID is required.");
  const { body } = parseBody(commentSchema, request.body);
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO shared_comments (id, media_id, user_id, body)
     SELECT $1, m.id, $3, $4 FROM shared_media m
     JOIN shared_albums a ON a.id = m.album_id
     JOIN family_memberships fm ON fm.room_id = a.room_id
     WHERE m.id = $2 AND fm.user_id = $3
     RETURNING id, media_id AS "mediaId", body, created_at AS "createdAt"`,
    [id, mediaId.data, getUser(request).id, body],
  );
  if (!rows[0]) throw new ApiError(404, "MEDIA_NOT_FOUND", "The media item was not found.");
  response.status(201).json(rows[0]);
});

router.put("/media/:mediaId/reactions", authenticate, async (request, response) => {
  const mediaId = z.string().uuid().safeParse(request.params.mediaId);
  if (!mediaId.success) throw new ApiError(400, "INVALID_MEDIA_ID", "A valid media ID is required.");
  const { reaction } = parseBody(reactionSchema, request.body);
  const userId = getUser(request).id;
  const { rows } = await pool.query(
    `INSERT INTO shared_reactions (media_id, user_id, reaction)
     SELECT m.id, $2, $3 FROM shared_media m
     JOIN shared_albums a ON a.id = m.album_id
     JOIN family_memberships fm ON fm.room_id = a.room_id AND fm.user_id = $2
     WHERE m.id = $1
     ON CONFLICT (media_id, user_id, reaction) DO UPDATE SET reaction = EXCLUDED.reaction
     RETURNING media_id AS "mediaId", reaction`,
    [mediaId.data, userId, reaction],
  );
  if (!rows[0]) throw new ApiError(404, "MEDIA_NOT_FOUND", "The media item was not found.");
  response.json(rows[0]);
});

router.get("/media/:mediaId/reactions", authenticate, async (request, response) => {
  const mediaId = z.string().uuid().safeParse(request.params.mediaId);
  if (!mediaId.success) throw new ApiError(400, "INVALID_MEDIA_ID", "A valid media ID is required.");
  const { rows } = await pool.query(
    `SELECT r.reaction, count(*)::int AS count,
       json_agg(json_build_object('userId', u.id, 'email', u.email)) AS users
     FROM shared_reactions r
     JOIN shared_media m ON m.id = r.media_id
     JOIN shared_albums a ON a.id = m.album_id
     JOIN family_memberships fm ON fm.room_id = a.room_id
     JOIN users u ON u.id = r.user_id
     WHERE r.media_id = $1 AND fm.user_id = $2
     GROUP BY r.reaction`,
    [mediaId.data, getUser(request).id],
  );
  response.json({ reactions: rows });
});

router.delete("/media/:mediaId/reactions/:reaction", authenticate, async (request, response) => {
  const mediaId = z.string().uuid().safeParse(request.params.mediaId);
  const reaction = z.enum(["like", "love", "laugh", "wow"]).safeParse(request.params.reaction);
  if (!mediaId.success || !reaction.success) {
    throw new ApiError(400, "INVALID_REACTION", "A valid media ID and reaction are required.");
  }
  await pool.query(
    `DELETE FROM shared_reactions r USING shared_media m, shared_albums a, family_memberships fm
     WHERE r.media_id = m.id AND m.album_id = a.id AND fm.room_id = a.room_id
       AND fm.user_id = $1 AND r.media_id = $2 AND r.user_id = $1 AND r.reaction = $3`,
    [getUser(request).id, mediaId.data, reaction.data],
  );
  response.status(204).end();
});

router.use((_request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", "The requested API endpoint was not found."));
});

export { ApiError };
export default router;
