import { AIVisionResult, PriorityLevel, VisualFeatures, ImageSimilarityResult } from '../types/database.types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const CIVIC_CATEGORIES = [
  'Road Damage / Pothole',
  'Water Leakage / Pipeline',
  'Garbage / Waste',
  'Drainage / Sewage',
  'Streetlight / Electrical',
  'Traffic Infrastructure',
  'Public Infrastructure Damage',
  'Other Civic Issue'
] as const;

export type CivicCategory = typeof CIVIC_CATEGORIES[number];

export const VALID_TAXONOMY_MAP: Record<CivicCategory, { department: string; defaultTitle: string; defaultPriority: PriorityLevel }> = {
  'Road Damage / Pothole': {
    department: 'Public Works Department (PWD)',
    defaultTitle: 'Asphalt Pothole / Road Surface Crater',
    defaultPriority: 'High'
  },
  'Water Leakage / Pipeline': {
    department: 'Water Supply & Sewerage',
    defaultTitle: 'Municipal Water Pipeline Leakage',
    defaultPriority: 'High'
  },
  'Garbage / Waste': {
    department: 'Sanitation & Waste Management',
    defaultTitle: 'Uncollected Solid Waste Accumulation',
    defaultPriority: 'Medium'
  },
  'Drainage / Sewage': {
    department: 'Drainage & Sewage Department',
    defaultTitle: 'Blocked Stormwater Drain & Sewage Overflow',
    defaultPriority: 'Critical'
  },
  'Streetlight / Electrical': {
    department: 'Electrical & Street Lighting',
    defaultTitle: 'Damaged / Inoperative Streetlight Fixture',
    defaultPriority: 'Medium'
  },
  'Traffic Infrastructure': {
    department: 'Traffic Management Department',
    defaultTitle: 'Malfunctioning / Damaged Traffic Signal',
    defaultPriority: 'High'
  },
  'Public Infrastructure Damage': {
    department: 'Public Works Department (PWD)',
    defaultTitle: 'Damaged Public Footpath / Railing',
    defaultPriority: 'High'
  },
  'Other Civic Issue': {
    department: 'Public Works Department (PWD)',
    defaultTitle: 'General Civic Defect / Public Grievance',
    defaultPriority: 'Medium'
  }
};

const AI_ANALYSIS_CACHE_KEY = 'nagarsetu_gemini_analysis_cache_v2';

function getAnalysisCache(): Record<string, AIVisionResult> {
  try {
    const raw = localStorage.getItem(AI_ANALYSIS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setAnalysisCache(key: string, result: AIVisionResult) {
  try {
    const cache = getAnalysisCache();
    cache[key] = result;
    localStorage.setItem(AI_ANALYSIS_CACHE_KEY, JSON.stringify(cache));
  } catch (e) { }
}

export async function computeImageHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
}

/**
 * Real Gemini Health Check Endpoint
 * GET /api/ai/health
 */
export async function checkAiHealth(): Promise<{ configured: boolean; model: string; reachable: boolean; reply?: string; error?: string }> {
  try {
    const res = await fetch('/api/ai/health');
    if (res.ok) {
      return await res.json();
    } else {
      const errText = await res.text();
      return { configured: true, model: 'gemini-3.6-flash', reachable: false, error: `Backend returned status ${res.status}: ${errText}` };
    }
  } catch (err: any) {
    try {
      const directRes = await fetch('http://localhost:5000/api/ai/health');
      if (directRes.ok) return await directRes.json();
    } catch (e) {}
    return {
      configured: false,
      model: 'gemini-3.6-flash',
      reachable: false,
      error: `Express Backend server on port 5000 is not reachable (${err.message}).`
    };
  }
}

/**
 * Loads an image from URL or File into an HTMLImageElement
 */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for visual analysis: ' + e));

    if (source instanceof File) {
      img.src = URL.createObjectURL(source);
    } else {
      img.src = source;
    }
  });
}

/**
 * Converts File or image URL to Base64 string for API payloads
 */
export async function fileToBase64(file: File | string): Promise<string> {
  if (typeof file === 'string') {
    if (file.startsWith('data:')) {
      return file;
    }
    const response = await fetch(file);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts visual features for similarity check
 */
export async function extractVisualFeatures(imageInput: File | string): Promise<VisualFeatures> {
  try {
    const img = await loadImage(imageInput);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    canvas.width = 9;
    canvas.height = 8;
    ctx.drawImage(img, 0, 0, 9, 8);
    const hashData = ctx.getImageData(0, 0, 9, 8).data;

    let dHashBits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idxLeft = (row * 9 + col) * 4;
        const idxRight = (row * 9 + col + 1) * 4;
        const lumLeft = (hashData[idxLeft] * 299 + hashData[idxLeft + 1] * 587 + hashData[idxLeft + 2] * 114) / 1000;
        const lumRight = (hashData[idxRight] * 299 + hashData[idxRight + 1] * 587 + hashData[idxRight + 2] * 114) / 1000;
        dHashBits += lumLeft > lumRight ? '1' : '0';
      }
    }
    let dHash = '';
    for (let i = 0; i < 64; i += 4) {
      dHash += parseInt(dHashBits.substring(i, i + 4), 2).toString(16);
    }

    canvas.width = 32;
    canvas.height = 32;
    ctx.drawImage(img, 0, 0, 32, 32);
    const sample = ctx.getImageData(0, 0, 32, 32).data;
    const totalPixels = 32 * 32;

    let totalLuminance = 0;
    let minLum = 255;
    let maxLum = 0;
    const rgbBins = new Array(32).fill(0);
    let edgeDiffSum = 0;

    for (let i = 0; i < sample.length; i += 4) {
      const r = sample[i];
      const g = sample[i + 1];
      const b = sample[i + 2];
      const lum = (r * 299 + g * 587 + b * 114) / 1000;

      totalLuminance += lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;

      rgbBins[Math.floor(r / 32)] += 1;
      rgbBins[8 + Math.floor(g / 32)] += 1;
      rgbBins[16 + Math.floor(b / 32)] += 1;
      rgbBins[24 + Math.floor(lum / 32)] += 1;
    }

    for (let y = 0; y < 31; y++) {
      for (let x = 0; x < 31; x++) {
        const curr = ((y * 32) + x) * 4;
        const right = ((y * 32) + (x + 1)) * 4;
        const down = (((y + 1) * 32) + x) * 4;
        const diffH = Math.abs(sample[curr] - sample[right]);
        const diffV = Math.abs(sample[curr] - sample[down]);
        edgeDiffSum += (diffH + diffV) / 2;
      }
    }

    const avgBrightness = Math.round(totalLuminance / totalPixels);
    const contrast = Math.round(((maxLum - minLum) / 255) * 100);
    const edgeDensity = Math.min(1, Math.round((edgeDiffSum / (totalPixels * 128)) * 100) / 100);
    const vector = rgbBins.map((val) => val / totalPixels);

    const dominantColors = [
      `#${sample[0].toString(16).padStart(2, '0')}${sample[1].toString(16).padStart(2, '0')}${sample[2].toString(16).padStart(2, '0')}`,
      `#${sample[2048].toString(16).padStart(2, '0')}${sample[2049].toString(16).padStart(2, '0')}${sample[2050].toString(16).padStart(2, '0')}`
    ];

    return {
      dHash,
      brightness: avgBrightness,
      contrast,
      dominantColors,
      edgeDensity,
      vector
    };
  } catch (err) {
    const mockHash = typeof imageInput === 'string' ? imageInput.substring(0, 16) : 'a1b2c3d4e5f60718';
    return {
      dHash: mockHash,
      brightness: 120,
      contrast: 65,
      dominantColors: ['#475569', '#059669'],
      edgeDensity: 0.45,
      vector: new Array(32).fill(1 / 32)
    };
  }
}

export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

export function compareImageSimilarity(
  featuresA: VisualFeatures,
  featuresB: VisualFeatures,
  distanceMeters?: number
): ImageSimilarityResult {
  if (featuresA.dHash && featuresB.dHash && featuresA.dHash === featuresB.dHash) {
    return {
      isExactDuplicate: true,
      similarityScore: 1.0,
      confidenceLevel: 'High',
      relation: 'exact_duplicate',
      reason: 'Exact identical photo detected via 64-bit difference hash.'
    };
  }

  const cosSim = calculateCosineSimilarity(featuresA.vector, featuresB.vector);
  const isNearby = distanceMeters == null || distanceMeters <= 150;

  if (cosSim >= 0.82 && isNearby) {
    return {
      isExactDuplicate: false,
      similarityScore: Math.round(cosSim * 100) / 100,
      confidenceLevel: 'High',
      relation: 'same_issue_different_angle',
      reason: `Matching visual defect pattern (${Math.round(cosSim * 100)}% visual match) in the same geographic radius. Recommended as additional angle evidence.`
    };
  }

  return {
    isExactDuplicate: false,
    similarityScore: Math.round(cosSim * 100) / 100,
    confidenceLevel: 'Low',
    relation: 'different_issue',
    reason: `Distinct visual patterns detected (${Math.round(cosSim * 100)}% similarity).`
  };
}

/**
 * Calls Python AI Microservice (port 8000) directly with actual image File bytes
 */
async function callPythonAiServiceDirect(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const res = await fetch('http://localhost:8000/analyze', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`Python AI service returned ${res.status}`);
  }

  return await res.json();
}

/**
 * Calls Supabase Edge Function directly with base64 image data
 */
async function callGeminiVisionEdgeFunction(file: File): Promise<any> {
  if (!isSupabaseConfigured()) return null;

  const base64Data = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke('analyze-civic-image', {
    body: {
      image_base64: base64Data,
      mime_type: file.type || 'image/jpeg'
    }
  });

  if (error || !data || !data.success || !data.data) {
    return null;
  }

  return data.data;
}

/**
 * Main Civic Image Classifier executing real Gemini Vision API via microservice or edge function
 */
export async function detectCivicIssue(file: File): Promise<AIVisionResult> {
  const startTime = performance.now();
  const imageHash = await computeImageHash(file);

  // Check local cache by exact image hash
  const cache = getAnalysisCache();
  if (cache[imageHash]) {
    return cache[imageHash];
  }

  const visualFeatures = await extractVisualFeatures(file);

  let rawRes: any = null;

  // 1. Try Python FastAPI microservice (port 8000)
  try {
    rawRes = await callPythonAiServiceDirect(file);
  } catch (err) {
    console.log('[NAGARSETU AI] Python service unavailable, trying Supabase Edge Function...', err);
  }

  // 2. Try Supabase Edge Function
  if (!rawRes) {
    try {
      rawRes = await callGeminiVisionEdgeFunction(file);
    } catch (err) {
      console.log('[NAGARSETU AI] Supabase Edge Function unavailable...', err);
    }
  }

  const endTime = performance.now();

  // If real Gemini response obtained:
  if (rawRes && rawRes.category) {
    const rawCategory = rawRes.category as CivicCategory;
    const category: CivicCategory = (CIVIC_CATEGORIES as readonly string[]).includes(rawCategory)
      ? rawCategory
      : 'Other Civic Issue';

    const meta = VALID_TAXONOMY_MAP[category] || VALID_TAXONOMY_MAP['Other Civic Issue'];
    const confidence = typeof rawRes.confidence === 'number' ? rawRes.confidence : 0.94;
    const confidenceLevel: 'High' | 'Medium' | 'Low' =
      confidence >= 0.85 ? 'High' : confidence >= 0.60 ? 'Medium' : 'Low';

    const result: AIVisionResult = {
      mode: 'production',
      analysis_id: rawRes.analysis_id || crypto.randomUUID(),
      image_hash: imageHash,
      category,
      issue_type: rawRes.title || meta.defaultTitle,
      confidence: Math.round(confidence * 100) / 100,
      confidence_level: confidenceLevel,
      priority: (rawRes.priority as PriorityLevel) || meta.defaultPriority,
      department: rawRes.recommended_department || meta.department,
      title: rawRes.title || meta.defaultTitle,
      description: rawRes.description || `Civic issue detected visually by Gemini Vision.`,
      visual_features: visualFeatures,
      detected_objects: rawRes.detected_features || [],
      quality_check: {
        isUsable: true,
        brightness: visualFeatures.brightness,
        contrast: visualFeatures.contrast
      },
      analysis_time_ms: Math.round(endTime - startTime)
    };

    setAnalysisCache(imageHash, result);
    return result;
  }

  // If AI is offline or unreachable: Return explicit manual entry request (no fake Pothole defaults!)
  const fallbackResult: AIVisionResult = {
    mode: 'production',
    analysis_id: crypto.randomUUID(),
    image_hash: imageHash,
    category: 'Other Civic Issue',
    issue_type: 'AI Vision Analysis Unavailable',
    confidence: 0.0,
    confidence_level: 'Low',
    priority: 'Medium',
    department: 'Public Works Department (PWD)',
    title: 'AI Analysis Unavailable',
    description: 'AI Vision is unreachable. Please review the photo and select category & details manually.',
    visual_features: visualFeatures,
    detected_objects: [],
    quality_check: {
      isUsable: true,
      warning: 'AI service offline. Please fill complaint details manually.',
      brightness: visualFeatures.brightness,
      contrast: visualFeatures.contrast
    },
    analysis_time_ms: Math.round(endTime - startTime)
  };

  return fallbackResult;
}
