import { desc, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
}, (table) => [unique("users_email_unique").on(table.email)]);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expiry_idx").on(table.expiresAt),
    unique("sessions_token_hash_unique").on(table.tokenHash),
  ],
);

export const familyRooms = pgTable(
  "family_rooms",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [check("family_rooms_name_length", sql`length(${table.name}) BETWEEN 1 AND 80`)],
);

export const familyMemberships = pgTable(
  "family_memberships",
  {
    roomId: uuid("room_id").notNull().references(() => familyRooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.userId] }),
    check("family_memberships_role", sql`${table.role} IN ('owner', 'admin', 'member')`),
    index("family_memberships_user_idx").on(table.userId),
  ],
);

export const familyInvitations = pgTable(
  "family_invitations",
  {
    id: uuid("id").primaryKey(),
    roomId: uuid("room_id").notNull().references(() => familyRooms.id, { onDelete: "cascade" }),
    invitedBy: uuid("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email"),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("family_invitations_room_idx").on(table.roomId),
    unique("family_invitations_token_hash_unique").on(table.tokenHash),
  ],
);

export const sharedAlbums = pgTable(
  "shared_albums",
  {
    id: uuid("id").primaryKey(),
    roomId: uuid("room_id").notNull().references(() => familyRooms.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    membersCanAdd: boolean("members_can_add").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("shared_albums_name_length", sql`length(${table.name}) BETWEEN 1 AND 80`),
    check("shared_albums_description_length", sql`length(${table.description}) <= 500`),
    index("shared_albums_room_idx").on(table.roomId, desc(table.updatedAt)),
  ],
);

export const sharedMedia = pgTable(
  "shared_media",
  {
    id: uuid("id").primaryKey(),
    albumId: uuid("album_id").notNull().references(() => sharedAlbums.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("shared_media_filename_length", sql`length(${table.originalFilename}) BETWEEN 1 AND 255`),
    check("shared_media_byte_size_positive", sql`${table.byteSize} > 0`),
    index("shared_media_album_idx").on(table.albumId, desc(table.createdAt)),
    unique("shared_media_storage_key_unique").on(table.storageKey),
  ],
);

export const sharedComments = pgTable(
  "shared_comments",
  {
    id: uuid("id").primaryKey(),
    mediaId: uuid("media_id").notNull().references(() => sharedMedia.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("shared_comments_body_length", sql`length(${table.body}) BETWEEN 1 AND 1000`),
    index("shared_comments_media_idx").on(table.mediaId, table.createdAt),
  ],
);

export const sharedReactions = pgTable(
  "shared_reactions",
  {
    mediaId: uuid("media_id").notNull().references(() => sharedMedia.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reaction: text("reaction").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.mediaId, table.userId, table.reaction] }),
    check("shared_reactions_type", sql`${table.reaction} IN ('like', 'love', 'laugh', 'wow')`),
  ],
);
