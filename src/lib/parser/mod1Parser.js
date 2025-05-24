/**
 * Parser for .mod1 files containing 3D coordinate data
 */
import { readFileSync } from 'fs'

/**
 * Parses a single mod1 file and returns structured data
 * @param {string} filePath - The path to the mod1 file
 * @returns {Object} Structured data containing points and metadata
 */
export function parseMod1Content(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const filename = filePath.split('/').pop()
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
 * Converts mod1 file to JSON format
 * @param {string} filePath - The path to the mod1 file
 * @returns {string} JSON string representation of the parsed data
 */
export function loadMod1ToJson(filePath) {
  try {
    return parseMod1Content(filePath)
  } catch (error) {
    throw new Error(`Error converting mod1 to JSON: ${error.message}`)
  }
}