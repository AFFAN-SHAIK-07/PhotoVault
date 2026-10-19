CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL CONSTRAINT users_email_unique UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL CONSTRAINT sessions_token_hash_unique UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS family_rooms (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_memberships (
  room_id UUID NOT NULL REFERENCES family_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS family_memberships_user_idx ON family_memberships(user_id);

CREATE TABLE IF NOT EXISTS family_invitations (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES family_rooms(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email TEXT,
  token_hash CHAR(64) NOT NULL CONSTRAINT family_invitations_token_hash_unique UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_invitations_room_idx ON family_invitations(room_id);

CREATE TABLE IF NOT EXISTS shared_albums (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES family_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  members_can_add BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_albums_room_idx ON shared_albums(room_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS shared_media (
  id UUID PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES shared_albums(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 255),
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  storage_key TEXT NOT NULL CONSTRAINT shared_media_storage_key_unique UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_media_album_idx ON shared_media(album_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shared_comments (
  id UUID PRIMARY KEY,
  media_id UUID NOT NULL REFERENCES shared_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_comments_media_idx ON shared_comments(media_id, created_at);

CREATE TABLE IF NOT EXISTS shared_reactions (
  media_id UUID NOT NULL REFERENCES shared_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'love', 'laugh', 'wow')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (media_id, user_id, reaction)
);
