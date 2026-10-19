export type SourceCategory =
  | 'camera'
  | 'screenshots'
  | 'screen-recordings'
  | 'whatsapp'
  | 'snapchat'
  | 'downloads'
  | 'other';

export type MediaKind = 'photo' | 'video';

export type MediaRecord = {
  id: string;
  uri: string;
  filename: string;
  mimeType: string | null;
  mediaType: MediaKind;
  fileSize: number | null;
  width: number;
  height: number;
  duration: number;
  creationTime: number;
  dateAdded: number;
  modificationTime: number;
  sourceAlbum: string | null;
  sourceCategory: SourceCategory;
  isFavorite: number;
};

export type AlbumSummary = {
  id: string;
  name: string;
  description: string;
  coverMediaId: string | null;
  coverUri: string | null;
  createdAt: number;
  updatedAt: number;
  isFavorite: number;
  sortOrder: number;
  mediaCount: number;
};

export type AlbumMediaRecord = MediaRecord & {
  albumAddedAt: number;
  albumSortOrder: number;
};

export type AlbumSort = 'date-taken' | 'date-added' | 'name';

export type ScanProgress = {
  processed: number;
  total: number;
};

export type TimelineRow =
  | { type: 'month'; key: string; label: string }
  | { type: 'day'; key: string; label: string }
  | { type: 'media'; key: string; items: MediaRecord[] };
