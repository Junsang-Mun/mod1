/**
 * Parser for .mod1 files containing 3D coordinate data
 */

/**
 * Parses mod1 file content and returns structured data
 * @param {string} content - The content of the mod1 file
 * @param {string} filename - The name of the file
 * @returns {Object} Structured data containing points and metadata
 */
export function parseMod1Content(content, filename) {
  const lines = content.trim().split('\n')
  
  const result = {
    points: [],
    metadata: {
      filename,
      totalPoints: 0
    }
  }

  lines.forEach((line, lineIndex) => {
    // Split line by spaces to get individual coordinate groups
    const coordinateGroups = line.trim().split(' ')
    
    coordinateGroups.forEach((group) => {
      // Remove parentheses and split by comma
      const [x, y, z] = group
        .replace(/[()]/g, '')
        .split(',')
        .map(Number)

      result.points.push({
        x,
        y,
        z,
        lineIndex: lineIndex + 1
      })
    })
  })

  result.metadata.totalPoints = result.points.length
  return result
}

/**
 * Normalizes the parsed data coordinates to [0, 1] range
 * @param {Object} parsedData - The parsed data containing points and metadata
 * @returns {Object} Normalized data with bounds information
 */
function normalizeContent(parsedData) {
  const bounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  }

  // First pass: find bounds
  parsedData.points.forEach(point => {
    bounds.min.x = Math.min(bounds.min.x, point.x)
    bounds.min.y = Math.min(bounds.min.y, point.y)
    bounds.min.z = Math.min(bounds.min.z, point.z)
    bounds.max.x = Math.max(bounds.max.x, point.x)
    bounds.max.y = Math.max(bounds.max.y, point.y)
    bounds.max.z = Math.max(bounds.max.z, point.z)
  })

  // Second pass: normalize coordinates
  const normalizedPoints = parsedData.points.map(point => {
    const normalizedX = (point.x - bounds.min.x) / (bounds.max.x - bounds.min.x)
    const normalizedY = (point.y - bounds.min.y) / (bounds.max.y - bounds.min.y)
    const normalizedZ = (point.z - bounds.min.z) / (bounds.max.z - bounds.min.z)

    return {
      x: normalizedX,
      y: normalizedY,
      z: normalizedZ,
      originalX: point.x,
      originalY: point.y,
      originalZ: point.z,
      lineIndex: point.lineIndex
    }
  })

  return {
    points: normalizedPoints,
    metadata: {
      ...parsedData.metadata,
      bounds
    }
  }
}

/**
 * Converts mod1 file content to structured data
 * @param {string} content - The content of the mod1 file
 * @param {string} filename - The name of the file
 * @returns {Object} Structured data containing points and metadata
 */
export function loadMod1ToJson(content, filename) {
  try {
    const parsedData = parseMod1Content(content, filename)
    console.log('parsedData', parsedData)
    return normalizeContent(parsedData)
  } catch (error) {
    throw new Error(`Error converting mod1 to JSON: ${error.message}`)
  }
}