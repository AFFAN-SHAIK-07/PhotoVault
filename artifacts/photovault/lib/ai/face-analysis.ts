export const MODEL_VERSION = 'opencv-sface-2021dec-int8bq';

export type FaceEmbeddings = {
  embeddings: number[][];
  ignoredFaces: number;
};

export async function analyzePhoto(_localMediaUri: string): Promise<FaceEmbeddings> {
  throw new Error('On-device face grouping is available in the Android app, not in this preview.');
}
