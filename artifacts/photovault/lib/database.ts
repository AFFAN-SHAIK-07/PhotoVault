import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  AlbumMediaRecord,
  AlbumSort,
  AlbumSummary,
  MediaRecord,
} from './types';

const SCHEMA_VERSION = 1;

export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) return;

  await database.withTransactionAsync(async () => {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY NOT NULL,
        uri TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT,
        media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
        file_size INTEGER,
        width INTEGER NOT NULL DEFAULT 0,
        height INTEGER NOT NULL DEFAULT 0,
        duration REAL NOT NULL DEFAULT 0,
        creation_time INTEGER NOT NULL,
        date_added INTEGER NOT NULL,
        modification_time INTEGER NOT NULL,
        source_album TEXT,
        source_category TEXT NOT NULL DEFAULT 'other',
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
        last_seen_scan_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS album_media (
        album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
        added_at INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (album_id, media_id)
      );

      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_media_creation_time
        ON media (creation_time DESC);
      CREATE INDEX IF NOT EXISTS idx_media_type
        ON media (media_type, creation_time DESC);
      CREATE INDEX IF NOT EXISTS idx_media_source
        ON media (source_category, creation_time DESC);
      CREATE INDEX IF NOT EXISTS idx_album_media_album
        ON album_media (album_id, sort_order, added_at DESC);
      CREATE INDEX IF NOT EXISTS idx_albums_order
        ON albums (sort_order, updated_at DESC);
    `);
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });
}

export async function upsertMediaPage(
  database: SQLiteDatabase,
  media: MediaRecord[],
  scanId: string,
): Promise<void> {
  if (media.length === 0) return;

  await database.withTransactionAsync(async () => {
    for (const item of media) {
      await database.runAsync(
        `INSERT INTO media (
          id, uri, filename, mime_type, media_type, file_size, width, height,
          duration, creation_time, date_added, modification_time, source_album,
          source_category, is_favorite, last_seen_scan_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
          uri = excluded.uri,
          filename = excluded.filename,
          mime_type = excluded.mime_type,
          media_type = excluded.media_type,
          file_size = excluded.file_size,
          width = excluded.width,
          height = excluded.height,
          duration = excluded.duration,
          creation_time = excluded.creation_time,
          modification_time = excluded.modification_time,
          source_album = excluded.source_album,
          source_category = excluded.source_category,
          last_seen_scan_id = excluded.last_seen_scan_id`,
        item.id,
        item.uri,
        item.filename,
        item.mimeType,
        item.mediaType,
        item.fileSize,
        item.width,
        item.height,
        item.duration,
        item.creationTime,
        item.dateAdded,
        item.modificationTime,
        item.sourceAlbum,
        item.sourceCategory,
        scanId,
      );
    }
  });
}

export async function removeMediaNotSeenInScan(
  database: SQLiteDatabase,
  scanId: string,
): Promise<void> {
  await database.runAsync('DELETE FROM media WHERE last_seen_scan_id <> ?', scanId);
}

export async function removeMediaByIds(
  database: SQLiteDatabase,
  mediaIds: string[],
): Promise<void> {
  if (mediaIds.length === 0) return;
  await database.withTransactionAsync(async () => {
    for (const mediaId of mediaIds) {
      await database.runAsync('DELETE FROM media WHERE id = ?', mediaId);
    }
  });
}

export async function saveScanMetadata(
  database: SQLiteDatabase,
  count: number,
  completedAt: number,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO app_meta (key, value) VALUES ('last_scan_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    String(completedAt),
  );
  await database.runAsync(
    `INSERT INTO app_meta (key, value) VALUES ('last_scan_count', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    String(count),
  );
}

export async function getScanMetadata(
  database: SQLiteDatabase,
): Promise<{ lastScannedAt: number | null; indexedCount: number }> {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM app_meta WHERE key IN ('last_scan_at', 'last_scan_count')",
  );
  const metadata = new Map(rows.map((row) => [row.key, row.value]));
  const scanTime = Number(metadata.get('last_scan_at'));
  const indexedCount = Number(metadata.get('last_scan_count'));
  return {
    lastScannedAt: Number.isFinite(scanTime) && scanTime > 0 ? scanTime : null,
    indexedCount: Number.isFinite(indexedCount) ? indexedCount : 0,
  };
}

const MEDIA_COLUMNS = `
  m.id, m.uri, m.filename, m.mime_type AS mimeType, m.media_type AS mediaType,
  m.file_size AS fileSize, m.width, m.height, m.duration,
  m.creation_time AS creationTime, m.date_added AS dateAdded,
  m.modification_time AS modificationTime, m.source_album AS sourceAlbum,
  m.source_category AS sourceCategory, m.is_favorite AS isFavorite
`;

export async function getAllMedia(database: SQLiteDatabase): Promise<MediaRecord[]> {
  return database.getAllAsync<MediaRecord>(
    `SELECT ${MEDIA_COLUMNS} FROM media m ORDER BY m.creation_time DESC, m.id DESC`,
  );
}

export async function getMediaById(
  database: SQLiteDatabase,
  id: string,
): Promise<MediaRecord | null> {
  const row = await database.getFirstAsync<MediaRecord>(
    `SELECT ${MEDIA_COLUMNS} FROM media m WHERE m.id = ?`,
    id,
  );
  return row ?? null;
}

export async function getAlbums(database: SQLiteDatabase): Promise<AlbumSummary[]> {
  return database.getAllAsync<AlbumSummary>(`
    SELECT
      a.id,
      a.name,
      a.description,
      a.cover_media_id AS coverMediaId,
      cover.uri AS coverUri,
      a.created_at AS createdAt,
      a.updated_at AS updatedAt,
      a.is_favorite AS isFavorite,
      a.sort_order AS sortOrder,
      COUNT(am.media_id) AS mediaCount
    FROM albums a
    LEFT JOIN media cover ON cover.id = a.cover_media_id
    LEFT JOIN album_media am ON am.album_id = a.id
    GROUP BY a.id
    ORDER BY a.sort_order ASC, a.updated_at DESC, a.name COLLATE NOCASE ASC
  `);
}

export async function getAlbumById(
  database: SQLiteDatabase,
  id: string,
): Promise<AlbumSummary | null> {
  const rows = await getAlbums(database);
  return rows.find((album) => album.id === id) ?? null;
}

export async function getAlbumMedia(
  database: SQLiteDatabase,
  albumId: string,
  sort: AlbumSort = 'date-taken',
): Promise<AlbumMediaRecord[]> {
  const orderBy = {
    'date-taken': 'm.creation_time DESC',
    'date-added': 'am.added_at DESC',
    name: 'm.filename COLLATE NOCASE ASC',
  }[sort];

  return database.getAllAsync<AlbumMediaRecord>(
    `SELECT ${MEDIA_COLUMNS}, am.added_at AS albumAddedAt, am.sort_order AS albumSortOrder
     FROM album_media am
     JOIN media m ON m.id = am.media_id
     WHERE am.album_id = ?
     ORDER BY ${orderBy}, m.id DESC`,
    albumId,
  );
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createAlbum(
  database: SQLiteDatabase,
  name: string,
  description: string,
): Promise<string> {
  const timestamp = Date.now();
  const nextOrder = await database.getFirstAsync<{ nextOrder: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM albums',
  );
  const id = makeId('album');
  await database.runAsync(
    `INSERT INTO albums (id, name, description, created_at, updated_at, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    name.trim(),
    description.trim(),
    timestamp,
    timestamp,
    nextOrder?.nextOrder ?? 0,
  );
  return id;
}

export async function updateAlbum(
  database: SQLiteDatabase,
  id: string,
  name: string,
  description: string,
): Promise<void> {
  await database.runAsync(
    'UPDATE albums SET name = ?, description = ?, updated_at = ? WHERE id = ?',
    name.trim(),
    description.trim(),
    Date.now(),
    id,
  );
}

export async function deleteAlbum(database: SQLiteDatabase, id: string): Promise<void> {
  await database.runAsync('DELETE FROM albums WHERE id = ?', id);
}

export async function addMediaToAlbum(
  database: SQLiteDatabase,
  albumId: string,
  mediaIds: string[],
): Promise<void> {
  const timestamp = Date.now();
  await database.withTransactionAsync(async () => {
    for (const [sortOrder, mediaId] of mediaIds.entries()) {
      await database.runAsync(
        `INSERT OR IGNORE INTO album_media (album_id, media_id, added_at, sort_order)
         VALUES (?, ?, ?, ?)`,
        albumId,
        mediaId,
        timestamp,
        sortOrder,
      );
    }
    await database.runAsync(
      'UPDATE albums SET updated_at = ? WHERE id = ?',
      timestamp,
      albumId,
    );
  });
}

export async function removeMediaFromAlbum(
  database: SQLiteDatabase,
  albumId: string,
  mediaId: string,
): Promise<void> {
  await database.runAsync(
    'DELETE FROM album_media WHERE album_id = ? AND media_id = ?',
    albumId,
    mediaId,
  );
  await database.runAsync('UPDATE albums SET updated_at = ? WHERE id = ?', Date.now(), albumId);
}

export async function removeMediaFromAlbumMany(
  database: SQLiteDatabase,
  albumId: string,
  mediaIds: string[],
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (let index = 0; index < mediaIds.length; index += 400) {
      const batch = mediaIds.slice(index, index + 400);
      if (batch.length === 0) continue;
      const placeholders = batch.map(() => '?').join(', ');
      await database.runAsync(
        `DELETE FROM album_media WHERE album_id = ? AND media_id IN (${placeholders})`,
        albumId,
        ...batch,
      );
    }
    await database.runAsync(
      'UPDATE albums SET updated_at = ? WHERE id = ?',
      Date.now(),
      albumId,
    );
    await database.runAsync(
      `UPDATE albums SET cover_media_id = (
         SELECT media_id FROM album_media
         WHERE album_id = ? ORDER BY sort_order ASC, added_at DESC LIMIT 1
       ) WHERE id = ? AND cover_media_id NOT IN (
         SELECT media_id FROM album_media WHERE album_id = ?
       )`,
      albumId,
      albumId,
      albumId,
    );
  });
}

export async function setAlbumCover(
  database: SQLiteDatabase,
  albumId: string,
  mediaId: string,
): Promise<void> {
  await database.runAsync(
    `UPDATE albums
     SET cover_media_id = ?, updated_at = ?
     WHERE id = ? AND EXISTS (
       SELECT 1 FROM album_media WHERE album_id = ? AND media_id = ?
     )`,
    mediaId,
    Date.now(),
    albumId,
    albumId,
    mediaId,
  );
}

export async function toggleAlbumFavorite(
  database: SQLiteDatabase,
  albumId: string,
): Promise<void> {
  await database.runAsync(
    `UPDATE albums
     SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END,
         updated_at = ?
     WHERE id = ?`,
    Date.now(),
    albumId,
  );
}

export async function toggleMediaFavorite(
  database: SQLiteDatabase,
  mediaId: string,
): Promise<void> {
  await database.runAsync(
    'UPDATE media SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?',
    mediaId,
  );
}

export async function setMediaFavorite(
  database: SQLiteDatabase,
  mediaId: string,
  isFavorite: boolean,
): Promise<void> {
  await database.runAsync(
    'UPDATE media SET is_favorite = ? WHERE id = ?',
    isFavorite ? 1 : 0,
    mediaId,
  );
}

export async function setMediaFavorites(
  database: SQLiteDatabase,
  mediaIds: string[],
  isFavorite: boolean,
): Promise<void> {
  const value = isFavorite ? 1 : 0;
  await database.withTransactionAsync(async () => {
    for (let index = 0; index < mediaIds.length; index += 400) {
      const batch = mediaIds.slice(index, index + 400);
      if (batch.length === 0) continue;
      const placeholders = batch.map(() => '?').join(', ');
      await database.runAsync(
        `UPDATE media SET is_favorite = ? WHERE id IN (${placeholders})`,
        value,
        ...batch,
      );
    }
  });
}

export async function moveAlbum(
  database: SQLiteDatabase,
  albumId: string,
  direction: -1 | 1,
): Promise<void> {
  const albums = await getAlbums(database);
  const currentIndex = albums.findIndex((album) => album.id === albumId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= albums.length) return;

  const current = albums[currentIndex];
  const target = albums[targetIndex];
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE albums SET sort_order = ? WHERE id = ?',
      target.sortOrder,
      current.id,
    );
    await database.runAsync(
      'UPDATE albums SET sort_order = ? WHERE id = ?',
      current.sortOrder,
      target.id,
    );
  });
}

export async function clearLocalIndex(database: SQLiteDatabase): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM media');
    await database.runAsync("DELETE FROM app_meta WHERE key IN ('last_scan_at', 'last_scan_count')");
  });
}
