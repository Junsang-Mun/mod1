import type { Mod1Point, Mod1Data, Point3D } from '../types/index.js';

/**
 * Parser for .mod1 files containing 3D coordinate data
 */

interface ParsedMod1Data {
  points: (Mod1Point & { lineIndex: number })[];
  metadata: {
    filename: string;
    totalPoints: number;
  };
}

interface NormalizedMod1Data {
  points: (Mod1Point & { 
    originalX: number; 
    originalY: number; 
    originalZ: number; 
    lineIndex: number; 
  })[];
  metadata: {
    filename: string;
    totalPoints: number;
    bounds: {
      min: Point3D;
      max: Point3D;
    };
    maxRange: number;
  };
}

interface Bounds {
  min: Point3D;
  max: Point3D;
}

/**
 * Parses mod1 file content and returns structured data
 * @param content - The content of the mod1 file
 * @param filename - The name of the file
 * @returns Structured data containing points and metadata
 */
function parseMod1Content(content: string, filename: string): ParsedMod1Data {
  const lines = content.trim().split('\n');
  
  const result: ParsedMod1Data = {
    points: [],
    metadata: {
      filename,
      totalPoints: 0
    }
  };

  lines.forEach((line, lineIndex) => {
    // Split line by spaces to get individual coordinate groups
    const coordinateGroups = line.trim().split(' ');
    
    coordinateGroups.forEach((group) => {
      // Remove parentheses and split by comma
      const [x, y, z] = group
        .replace(/[()]/g, '')
        .split(',')
        .map(Number);

      result.points.push({
        x,
        y,
        z,
        lineIndex: lineIndex + 1
      });
    });
  });

  result.metadata.totalPoints = result.points.length;
  return result;
}

/**
 * Normalizes the parsed data coordinates to -1~1 range using a unified maximum value
 * @param parsedData - The parsed data containing points and metadata
 * @returns Normalized data with bounds information
 */
function normalizeContent(parsedData: ParsedMod1Data): NormalizedMod1Data {
  const bounds: Bounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };

  // First pass: find bounds
  parsedData.points.forEach(point => {
    bounds.min.x = Math.min(bounds.min.x, point.x);
    bounds.min.y = Math.min(bounds.min.y, point.y);
    bounds.min.z = Math.min(bounds.min.z, point.z);
    bounds.max.x = Math.max(bounds.max.x, point.x);
    bounds.max.y = Math.max(bounds.max.y, point.y);
    bounds.max.z = Math.max(bounds.max.z, point.z);
  });

  // Calculate unified range
  const rangeX = bounds.max.x - bounds.min.x;
  const rangeY = bounds.max.y - bounds.min.y;
  const rangeZ = bounds.max.z - bounds.min.z;
  const maxRange = Math.max(rangeX, rangeY, rangeZ);

  // Second pass: normalize coordinates to -1~1 range using unified range
  const normalizedPoints = parsedData.points.map(point => {
    const normalizedX = maxRange === 0 ? 0 : ((point.x - bounds.min.x) / maxRange) * 2 - 1;
    const normalizedY = maxRange === 0 ? 0 : ((point.y - bounds.min.y) / maxRange) * 2 - 1;
    const normalizedZ = maxRange === 0 ? 0 : ((point.z - bounds.min.z) / maxRange) * 2 - 1;

    return {
      x: normalizedX,
      y: normalizedY,
      z: normalizedZ,
      originalX: point.x,
      originalY: point.y,
      originalZ: point.z,
      lineIndex: point.lineIndex
    };
  });

  return {
    points: normalizedPoints,
    metadata: {
      ...parsedData.metadata,
      bounds,
      maxRange
    }
  };
}

/**
 * Converts mod1 file content to structured data
 * @param content - The content of the mod1 file
 * @param filename - The name of the file
 * @returns Structured data containing points and metadata
 */
export function loadMod1ToJson(content: string, filename: string): NormalizedMod1Data {
  try {
    const parsedData = parseMod1Content(content, filename);
    return normalizeContent(parsedData);
  } catch (error) {
    throw new Error(`Error converting mod1 to JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 