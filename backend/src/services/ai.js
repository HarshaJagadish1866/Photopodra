const path = require('path');
const { 
  AutoTokenizer, 
  AutoProcessor, 
  CLIPVisionModelWithProjection, 
  CLIPTextModelWithProjection, 
  RawImage 
} = require('@xenova/transformers');

const MODEL_NAME = 'Xenova/clip-vit-base-patch32';
const EMBEDDING_DIM = 512;

// Singleton cache for models and processors
let tokenizerPromise = null;
let textModelPromise = null;
let processorPromise = null;
let visionModelPromise = null;

async function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = AutoTokenizer.from_pretrained(MODEL_NAME);
  }
  return tokenizerPromise;
}

async function getTextModel() {
  if (!textModelPromise) {
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(MODEL_NAME);
  }
  return textModelPromise;
}

async function getProcessor() {
  if (!processorPromise) {
    processorPromise = AutoProcessor.from_pretrained(MODEL_NAME);
  }
  return processorPromise;
}

async function getVisionModel() {
  if (!visionModelPromise) {
    visionModelPromise = CLIPVisionModelWithProjection.from_pretrained(MODEL_NAME);
  }
  return visionModelPromise;
}

/**
 * Normalizes a vector to unit length (L2 norm) so dot product equals cosine similarity.
 * @param {Float32Array|Array<number>} v
 * @returns {Float32Array}
 */
function normalizeVector(v) {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);
  const out = new Float32Array(v.length);
  if (norm === 0) return out;
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] / norm;
  }
  return out;
}

/**
 * Generates a 512-dim normalized vector embedding for an image.
 * @param {string} imagePath - Absolute path to image file
 * @returns {Promise<{ vector: Float32Array, buffer: Buffer, dimensions: number, model: string }>}
 */
async function generateImageEmbedding(imagePath) {
  try {
    const [processor, visionModel] = await Promise.all([getProcessor(), getVisionModel()]);

    const image = await RawImage.read(imagePath);
    const imageInputs = await processor(image);
    const { image_embeds } = await visionModel(imageInputs);

    const rawData = image_embeds.data;
    const normalized = normalizeVector(rawData);
    const buffer = Buffer.from(normalized.buffer, normalized.byteOffset, normalized.byteLength);

    return {
      vector: normalized,
      buffer,
      dimensions: normalized.length,
      model: MODEL_NAME
    };
  } catch (err) {
    console.error(`[AI Service] Error generating image embedding for ${imagePath}:`, err.message);
    throw err;
  }
}

/**
 * Generates a 512-dim normalized vector embedding for a text search query.
 * @param {string} text - Search prompt
 * @returns {Promise<{ vector: Float32Array, buffer: Buffer, dimensions: number, model: string }>}
 */
async function generateTextEmbedding(text) {
  try {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('Query text cannot be empty');
    }

    const [tokenizer, textModel] = await Promise.all([getTokenizer(), getTextModel()]);

    const textInputs = tokenizer([cleanText], { padding: true, truncation: true });
    const { text_embeds } = await textModel(textInputs);

    const rawData = text_embeds.data;
    const normalized = normalizeVector(rawData);
    const buffer = Buffer.from(normalized.buffer, normalized.byteOffset, normalized.byteLength);

    return {
      vector: normalized,
      buffer,
      dimensions: normalized.length,
      model: MODEL_NAME
    };
  } catch (err) {
    console.error(`[AI Service] Error generating text embedding for "${text}":`, err.message);
    throw err;
  }
}

module.exports = {
  MODEL_NAME,
  EMBEDDING_DIM,
  generateImageEmbedding,
  generateTextEmbedding,
  normalizeVector
};
