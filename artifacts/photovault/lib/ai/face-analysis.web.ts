import type { FaceEmbeddings } from './face-analysis';

export const MODEL_VERSION = 'opencv-sface-2021dec-int8bq';

export async function analyzePhoto(_localMediaUri: string): Promise<FaceEmbeddings> {
  throw new Error('On-device face grouping is available in the Android app, not in the web preview.');
}
