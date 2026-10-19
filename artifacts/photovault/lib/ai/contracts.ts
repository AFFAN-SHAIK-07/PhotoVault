export type NormalizedBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DetectedFace = {
  bounds: NormalizedBoundingBox;
  embedding: Float32Array;
  confidence: number;
  modelVersion: string;
};

export type VisualLabel = {
  label: string;
  confidence: number;
  modelVersion: string;
};

export interface FaceAnalysisService {
  detectFaces(
    localMediaUri: string,
    options?: { signal?: AbortSignal },
  ): Promise<DetectedFace[]>;
}

export interface VisualRecognitionService {
  classifyImage(
    localMediaUri: string,
    options?: { signal?: AbortSignal },
  ): Promise<VisualLabel[]>;
}

export class OnDeviceAIUnavailableError extends Error {
  constructor(feature: 'face analysis' | 'visual recognition') {
    super(`On-device ${feature} is not configured in this build.`);
    this.name = 'OnDeviceAIUnavailableError';
  }
}

export const unavailableFaceAnalysis: FaceAnalysisService = {
  async detectFaces() {
    throw new OnDeviceAIUnavailableError('face analysis');
  },
};

export const unavailableVisualRecognition: VisualRecognitionService = {
  async classifyImage() {
    throw new OnDeviceAIUnavailableError('visual recognition');
  },
};
