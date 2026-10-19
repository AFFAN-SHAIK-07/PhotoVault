import type { MediaRecord, SourceCategory, TimelineRow } from './types';

export function classifySourceAlbum(albumTitle: string | null | undefined): SourceCategory {
  const title = (albumTitle ?? '').trim().toLocaleLowerCase();
  if (!title) return 'other';

  if (title.includes('whatsapp')) return 'whatsapp';
  if (title.includes('snapchat')) return 'snapchat';
  if (title.includes('screen recording') || title.includes('screenrecording')) {
    return 'screen-recordings';
  }
  if (title.includes('screenshot') || title.includes('screen_shot')) {
    return 'screenshots';
  }
  if (title.includes('download')) return 'downloads';
  if (title === 'camera' || title === 'dcim' || title.includes('/camera')) {
    return 'camera';
  }
  return 'other';
}

export type MediaFilter = 'all' | 'photos' | 'videos' | 'favorites' | SourceCategory;

export function filterMedia(
  media: MediaRecord[],
  query: string,
  filter: MediaFilter = 'all',
): MediaRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const dateQuery = /^\d{4}(-\d{1,2})?(-\d{1,2})?$/.test(normalizedQuery)
    ? normalizedQuery
    : null;

  return media.filter((item) => {
    if (filter === 'photos' && item.mediaType !== 'photo') return false;
    if (filter === 'videos' && item.mediaType !== 'video') return false;
    if (filter === 'favorites' && item.isFavorite !== 1) return false;
    if (
      filter !== 'all' &&
      filter !== 'photos' &&
      filter !== 'videos' &&
      filter !== 'favorites' &&
      item.sourceCategory !== filter
    ) {
      return false;
    }
    if (!normalizedQuery) return true;

    const date = new Date(item.creationTime);
    const localDate = [
      date.getFullYear().toString().padStart(4, '0'),
      (date.getMonth() + 1).toString().padStart(2, '0'),
      date.getDate().toString().padStart(2, '0'),
    ].join('-');
    const searchable = [
      item.filename,
      item.sourceAlbum ?? '',
      item.sourceCategory,
      item.mediaType,
      localDate,
    ]
      .join(' ')
      .toLocaleLowerCase();

    return dateQuery ? localDate.startsWith(dateQuery) : searchable.includes(normalizedQuery);
  });
}

function dateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function monthKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function dayLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateKey(timestamp) === dateKey(today.getTime())) return 'Today';
  if (dateKey(timestamp) === dateKey(yesterday.getTime())) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function buildTimelineRows(media: MediaRecord[], columns = 3): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let currentMonth = '';
  let index = 0;

  while (index < media.length) {
    const current = media[index];
    const currentDayKey = dateKey(current.creationTime);
    const currentMonthKey = monthKey(current.creationTime);

    if (currentMonth !== currentMonthKey) {
      currentMonth = currentMonthKey;
      rows.push({
        type: 'month',
        key: `month-${currentMonthKey}`,
        label: monthLabel(current.creationTime),
      });
    }

    rows.push({
      type: 'day',
      key: `day-${currentDayKey}`,
      label: dayLabel(current.creationTime),
    });

    const dayItems: MediaRecord[] = [];
    while (index < media.length && dateKey(media[index].creationTime) === currentDayKey) {
      dayItems.push(media[index]);
      index++;
    }

    for (let offset = 0; offset < dayItems.length; offset += columns) {
      const items = dayItems.slice(offset, offset + columns);
      rows.push({
        type: 'media',
        key: `media-${items[0]?.id ?? index}`,
        items,
      });
    }
  }

  return rows;
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDimensions(width: number, height: number): string {
  if (!width || !height) return 'Dimensions unavailable';
  return `${width.toLocaleString()} × ${height.toLocaleString()}`;
}
