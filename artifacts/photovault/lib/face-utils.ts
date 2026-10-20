export type FacePoint = { x: number; y: number };

export type FaceLandmarks = {
  leftEye: FacePoint;
  rightEye: FacePoint;
  nose: FacePoint;
  leftMouth: FacePoint;
  rightMouth: FacePoint;
};

export type FaceCluster = {
  id: string;
  embeddings: number[][];
  centroid?: number[];
};

const MODEL_SIZE = 112;
const MODEL_LANDMARKS: FacePoint[] = [
  { x: 38.2946, y: 51.6963 },
  { x: 73.5318, y: 51.5014 },
  { x: 56.0252, y: 71.7366 },
  { x: 41.5493, y: 92.3655 },
  { x: 70.7299, y: 92.2041 },
];

function isValidPoint(point: FacePoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function createAlignedSFaceTensor(
  rgba: Uint8Array,
  width: number,
  height: number,
  landmarks: FaceLandmarks,
): Float32Array {
  if (rgba.length !== width * height * 4 || width < 2 || height < 2) {
    throw new Error('The prepared photo has invalid pixel dimensions.');
  }
  const source = [
    landmarks.rightEye,
    landmarks.leftEye,
    landmarks.nose,
    landmarks.rightMouth,
    landmarks.leftMouth,
  ];
  if (!source.every(isValidPoint)) {
    throw new Error('The face detector returned invalid face landmarks.');
  }

  const sourceCenter = source.reduce(
    (center, point) => ({ x: center.x + point.x / source.length, y: center.y + point.y / source.length }),
    { x: 0, y: 0 },
  );
  const targetCenter = MODEL_LANDMARKS.reduce(
    (center, point) => ({
      x: center.x + point.x / MODEL_LANDMARKS.length,
      y: center.y + point.y / MODEL_LANDMARKS.length,
    }),
    { x: 0, y: 0 },
  );

  let denominator = 0;
  let real = 0;
  let imaginary = 0;
  source.forEach((point, index) => {
    const x = point.x - sourceCenter.x;
    const y = point.y - sourceCenter.y;
    const u = MODEL_LANDMARKS[index].x - targetCenter.x;
    const v = MODEL_LANDMARKS[index].y - targetCenter.y;
    denominator += x * x + y * y;
    real += x * u + y * v;
    imaginary += x * v - y * u;
  });
  if (denominator < 1) {
    throw new Error('The detected face is too small to align reliably.');
  }

  const a = real / denominator;
  const b = imaginary / denominator;
  const translateX = targetCenter.x - a * sourceCenter.x + b * sourceCenter.y;
  const translateY = targetCenter.y - b * sourceCenter.x - a * sourceCenter.y;
  const scaleSquared = a * a + b * b;
  if (!Number.isFinite(scaleSquared) || scaleSquared < 1e-8) {
    throw new Error('The detected face could not be aligned.');
  }

  const tensor = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);
  for (let y = 0; y < MODEL_SIZE; y++) {
    for (let x = 0; x < MODEL_SIZE; x++) {
      const targetX = x - translateX;
      const targetY = y - translateY;
      const sourceX = (a * targetX + b * targetY) / scaleSquared;
      const sourceY = (-b * targetX + a * targetY) / scaleSquared;
      const pixel = sampleRgbaBilinear(rgba, width, height, sourceX, sourceY);
      const offset = y * MODEL_SIZE + x;
      tensor[offset] = (pixel[0] - 127.5) / 128;
      tensor[MODEL_SIZE * MODEL_SIZE + offset] = (pixel[1] - 127.5) / 128;
      tensor[2 * MODEL_SIZE * MODEL_SIZE + offset] = (pixel[2] - 127.5) / 128;
    }
  }
  return tensor;
}

function sampleRgbaBilinear(
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number] {
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));
  const left = Math.floor(clampedX);
  const top = Math.floor(clampedY);
  const right = Math.min(width - 1, left + 1);
  const bottom = Math.min(height - 1, top + 1);
  const xWeight = clampedX - left;
  const yWeight = clampedY - top;
  const result: [number, number, number] = [0, 0, 0];

  for (let channel = 0; channel < 3; channel++) {
    const topLeft = rgba[(top * width + left) * 4 + channel];
    const topRight = rgba[(top * width + right) * 4 + channel];
    const bottomLeft = rgba[(bottom * width + left) * 4 + channel];
    const bottomRight = rgba[(bottom * width + right) * 4 + channel];
    const topValue = topLeft + (topRight - topLeft) * xWeight;
    const bottomValue = bottomLeft + (bottomRight - bottomLeft) * xWeight;
    result[channel] = topValue + (bottomValue - topValue) * yWeight;
  }
  return result;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    throw new Error('Face embeddings have incompatible dimensions.');
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index++) {
    const a = left[index];
    const b = right[index];
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error('A face embedding contains invalid values.');
    }
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  const denominator = Math.sqrt(leftMagnitude * rightMagnitude);
  return denominator > 0 ? dot / denominator : 0;
}

export function normalizedEmbedding(values: ArrayLike<number>): number[] {
  const magnitude = Math.sqrt(
    Array.from(values).reduce((sum, value) => sum + value * value, 0),
  );
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error('The face model returned an invalid embedding.');
  }
  return Array.from(values, (value) => value / magnitude);
}

export function bestMatchingPerson(
  embedding: number[],
  groups: FaceCluster[],
  threshold = 0.42,
): string | null {
  let bestId: string | null = null;
  let bestScore = threshold;
  for (const group of groups) {
    if (group.embeddings.length === 0) continue;
    let centroid = group.centroid;
    if (!centroid) {
      centroid = new Array<number>(embedding.length).fill(0);
      for (const existing of group.embeddings) {
        if (existing.length !== embedding.length) {
          throw new Error('Stored face embeddings use incompatible model versions.');
        }
        existing.forEach((value, index) => {
          centroid![index] += value / group.embeddings.length;
        });
      }
    } else if (centroid.length !== embedding.length) {
      throw new Error('Stored face embeddings use incompatible model versions.');
    }
    const score = cosineSimilarity(embedding, centroid);
    if (score > bestScore) {
      bestId = group.id;
      bestScore = score;
    }
  }
  return bestId;
}
