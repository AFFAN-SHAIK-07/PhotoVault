import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import FaceDetection from '@react-native-ml-kit/face-detection';
import { toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';
import * as ort from 'onnxruntime-react-native';
import sfaceModel from '../../assets/models/sface-int8bq.onnx';
import {
  createAlignedSFaceTensor,
  normalizedEmbedding,
  type FaceLandmarks,
} from '../face-utils';

import type { FaceEmbeddings } from './face-analysis';

export const MODEL_VERSION = 'opencv-sface-2021dec-int8bq';
const MODEL_SIZE = 112;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const asset = Asset.fromModule(sfaceModel);
      await asset.downloadAsync();
      if (!asset.localUri) {
        throw new Error('The bundled on-device face model could not be opened.');
      }
      return ort.InferenceSession.create(asset.localUri);
    })();
  }
  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    throw error;
  }
}

function faceLandmarks(face: {
  landmarks?: Record<string, { position: { x: number; y: number } }>;
}): FaceLandmarks | null {
  const landmarks = face.landmarks;
  if (
    !landmarks?.leftEye ||
    !landmarks.rightEye ||
    !landmarks.noseBase ||
    !landmarks.mouthLeft ||
    !landmarks.mouthRight
  ) {
    return null;
  }
  return {
    leftEye: landmarks.leftEye.position,
    rightEye: landmarks.rightEye.position,
    nose: landmarks.noseBase.position,
    leftMouth: landmarks.mouthLeft.position,
    rightMouth: landmarks.mouthRight.position,
  };
}

async function embedFace(
  session: ort.InferenceSession,
  input: Float32Array,
): Promise<number[]> {
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) {
    throw new Error('The bundled face model has an unsupported input or output format.');
  }
  const image = new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
  const outputs = await session.run({ [inputName]: image });
  const output = outputs[outputName];
  if (!output || !('data' in output) || !(output.data instanceof Float32Array)) {
    throw new Error('The bundled face model returned no embedding.');
  }
  return normalizedEmbedding(output.data);
}

export async function analyzePhoto(localMediaUri: string): Promise<FaceEmbeddings> {
  const prepared = await ImageManipulator.manipulateAsync(
    localMediaUri,
    [{ resize: { width: 512 } }],
    { base64: true, compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );

  try {
    if (!prepared.base64) {
      throw new Error('PhotoVault could not prepare a local image for face analysis.');
    }
    const detectedFaces = await FaceDetection.detect(prepared.uri, {
      landmarkMode: 'all',
      performanceMode: 'accurate',
      minFaceSize: 0.06,
    });
    if (detectedFaces.length === 0) return { embeddings: [], ignoredFaces: 0 };

    const decoded = jpeg.decode(toByteArray(prepared.base64), { useTArray: true });
    const session = await getSession();
    const embeddings: number[][] = [];
    let ignoredFaces = 0;
    for (const face of detectedFaces) {
      const landmarks = faceLandmarks(face);
      if (!landmarks) {
        ignoredFaces += 1;
        continue;
      }
      const input = createAlignedSFaceTensor(decoded.data, decoded.width, decoded.height, landmarks);
      embeddings.push(await embedFace(session, input));
    }
    return { embeddings, ignoredFaces };
  } finally {
    await FileSystem.deleteAsync(prepared.uri, { idempotent: true });
  }
}
