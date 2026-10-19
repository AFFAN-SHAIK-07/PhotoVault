import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTimelineRows,
  classifySourceAlbum,
  filterMedia,
  formatDimensions,
  formatDuration,
} from './library-utils.ts';

function media(overrides = {}) {
  return {
    id: 'photo-1',
    uri: 'file:///photo.jpg',
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    mediaType: 'photo',
    fileSize: 512,
    width: 1200,
    height: 800,
    duration: 0,
    creationTime: new Date(2026, 5, 12, 12).getTime(),
    dateAdded: 1,
    modificationTime: 1,
    sourceAlbum: 'Camera',
    sourceCategory: 'camera',
    isFavorite: 0,
    ...overrides,
  };
}

test('filterMedia matches case-insensitive metadata and exact date prefixes', () => {
  const items = [
    media(),
    media({
      id: 'video-1',
      filename: 'VID_01.mp4',
      mediaType: 'video',
      sourceAlbum: 'Downloads',
      sourceCategory: 'downloads',
      creationTime: new Date(2026, 5, 13, 12).getTime(),
      isFavorite: 1,
    }),
  ];

  assert.deepEqual(filterMedia(items, 'vid_01').map((item) => item.id), ['video-1']);
  assert.deepEqual(filterMedia(items, '2026-06-13').map((item) => item.id), ['video-1']);
  assert.deepEqual(filterMedia(items, '', 'favorites').map((item) => item.id), ['video-1']);
  assert.deepEqual(filterMedia(items, '', 'camera').map((item) => item.id), ['photo-1']);
  assert.deepEqual(filterMedia(items, '2025').map((item) => item.id), []);
});

test('classifySourceAlbum only labels folder names that match known sources', () => {
  assert.equal(classifySourceAlbum('WhatsApp Images'), 'whatsapp');
  assert.equal(classifySourceAlbum('Screenshots'), 'screenshots');
  assert.equal(classifySourceAlbum('Camera'), 'camera');
  assert.equal(classifySourceAlbum('Private Messenger'), 'other');
  assert.equal(classifySourceAlbum(null), 'other');
});

test('buildTimelineRows splits months and groups each day into fixed-size rows', () => {
  const items = [
    media({ id: 'june-a', creationTime: new Date(2026, 5, 12, 14).getTime() }),
    media({ id: 'june-b', creationTime: new Date(2026, 5, 12, 13).getTime() }),
    media({ id: 'june-c', creationTime: new Date(2026, 5, 12, 12).getTime() }),
    media({ id: 'june-d', creationTime: new Date(2026, 5, 12, 11).getTime() }),
    media({ id: 'july-a', creationTime: new Date(2026, 6, 1, 12).getTime() }),
  ];

  const rows = buildTimelineRows(items, 3);
  assert.equal(rows.filter((row) => row.type === 'month').length, 2);
  assert.deepEqual(
    rows.filter((row) => row.type === 'media').map((row) => row.items.length),
    [3, 1, 1],
  );
});

test('formatters handle unavailable dimensions and clamp negative durations', () => {
  assert.equal(formatDimensions(0, 100), 'Dimensions unavailable');
  assert.equal(formatDimensions(1920, 1080).replaceAll(',', ''), '1920 × 1080');
  assert.equal(formatDuration(-3), '0:00');
  assert.equal(formatDuration(125), '2:05');
});
