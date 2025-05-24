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
 * Converts mod1 file content to structured data
 * @param {string} content - The content of the mod1 file
 * @param {string} filename - The name of the file
 * @returns {Object} Structured data containing points and metadata
 */
export function loadMod1ToJson(content, filename) {
  try {
    return parseMod1Content(content, filename)
  } catch (error) {
    throw new Error(`Error converting mod1 to JSON: ${error.message}`)
  }
}