import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTimelineRows,
  classifySourceAlbum,
  filterMedia,
  formatDimensions,
  formatDuration,
} from './library-utils.ts';
import {
  bestMatchingPerson,
  cosineSimilarity,
  createAlignedSFaceTensor,
  normalizedEmbedding,
} from './face-utils.ts';

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
  assert.deepEqual(filterMedia(items, '', 'photos').map((item) => item.id), ['photo-1']);
  assert.deepEqual(filterMedia(items, '', 'videos').map((item) => item.id), ['video-1']);
  assert.deepEqual(filterMedia(items, '', 'favorites').map((item) => item.id), ['video-1']);
  assert.deepEqual(filterMedia(items, '', 'camera').map((item) => item.id), ['photo-1']);
  assert.deepEqual(filterMedia(items, '2025').map((item) => item.id), []);
});

test('classifySourceAlbum only labels folder names that match known sources', () => {
  assert.equal(classifySourceAlbum('WhatsApp Images'), 'whatsapp');
  assert.equal(classifySourceAlbum('WhatsApp Video'), 'whatsapp');
  assert.equal(classifySourceAlbum('com.snapchat.android'), 'snapchat');
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

  const fourColumnRows = buildTimelineRows(items, 4);
  assert.deepEqual(
    fourColumnRows.filter((row) => row.type === 'media').map((row) => row.items.length),
    [4, 1],
  );
});

test('formatters handle unavailable dimensions and clamp negative durations', () => {
  assert.equal(formatDimensions(0, 100), 'Dimensions unavailable');
  assert.equal(formatDimensions(1920, 1080).replaceAll(',', ''), '1920 × 1080');
  assert.equal(formatDuration(-3), '0:00');
  assert.equal(formatDuration(125), '2:05');
});

test('SFace alignment maps a matching landmark layout into RGB model input', () => {
  const width = 112;
  const height = 112;
  const rgba = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = 80;
    rgba[offset + 1] = 90;
    rgba[offset + 2] = 100;
    rgba[offset + 3] = 255;
  }

  const tensor = createAlignedSFaceTensor(rgba, width, height, {
    rightEye: { x: 38.2946, y: 51.6963 },
    leftEye: { x: 73.5318, y: 51.5014 },
    nose: { x: 56.0252, y: 71.7366 },
    rightMouth: { x: 41.5493, y: 92.3655 },
    leftMouth: { x: 70.7299, y: 92.2041 },
  });
  const center = 56 * width + 56;
  assert.equal(tensor.length, 3 * width * height);
  assert.ok(Math.abs(tensor[center] - (80 - 127.5) / 128) < 0.001);
  assert.ok(Math.abs(tensor[width * height + center] - (90 - 127.5) / 128) < 0.001);
  assert.ok(Math.abs(tensor[2 * width * height + center] - (100 - 127.5) / 128) < 0.001);
});

test('face embeddings normalize, compare, and avoid matches below threshold', () => {
  const personA = normalizedEmbedding([3, 4]);
  const personB = normalizedEmbedding([0, 5]);
  const differentPerson = normalizedEmbedding([-1, 0]);
  assert.ok(Math.abs(cosineSimilarity(personA, personB) - 0.8) < 0.0001);
  assert.equal(
    bestMatchingPerson(personB, [{ id: 'person-a', embeddings: [personA] }]),
    'person-a',
  );
  assert.equal(
    bestMatchingPerson(differentPerson, [{ id: 'person-a', embeddings: [personA] }]),
    null,
  );
});
