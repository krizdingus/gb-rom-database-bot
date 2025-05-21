// utils/regions.js
/**
 * Constants for region detection
 */
const countryList = ['usa', 'europe', 'spain', 'france', 'germany', 'australia', 'japan', 'taiwan'];

const europeanRegions = [
  'europe',
  'spain',
  'france',
  'germany',
  'italy',
  'uk',
  'netherlands',
  'belgium',
  'sweden',
];

const flagMap = {
  usa: '🇺🇸',
  europe: '🇪🇺',
  spain: '🇪🇸',
  france: '🇫🇷',
  germany: '🇩🇪',
  australia: '🇦🇺',
  japan: '🇯🇵',
  taiwan: '🇹🇼',
  world: '🌎',
  unlicensed: '🚩',
  pirate: '🏴‍☠️',
};

/**
 * Chooses the correct emoji for a ROM filename and region.
 * @param {string} filename - The ROM filename
 * @param {string} region - The ROM region
 * @returns {string} Emoji representing the region
 */
function pickRegionEmoji(filename, region) {
  // Default to empty string if filename is undefined
  const fn = filename || '';
  const regionLower = (region || '').toLowerCase();

  // Check for unlicensed or pirate games first (priority)
  if (fn.includes('(Unl)') || regionLower === 'unlicensed') return flagMap.unlicensed;
  if (fn.includes('(Pirate)') || regionLower === 'pirate') return flagMap.pirate;

  // Handle world/multi-region releases
  if (
    regionLower === 'world' ||
    fn.includes('(World)') ||
    fn.includes('(USA, Europe)') ||
    fn.includes('(Europe, USA)')
  ) {
    return flagMap.world;
  }

  // Check for specific region matches
  if (flagMap[regionLower]) {
    return flagMap[regionLower];
  }

  // Check for region in filename tags
  const tokens = (fn.match(/\(([^)]+)\)/g) || []).map(t => t.slice(1, -1).trim().toLowerCase());

  // Filter to only our country list
  const matches = tokens.filter(t => countryList.includes(t));

  // If all matches are European regions, use EU flag
  if (matches.length > 1 && matches.every(t => europeanRegions.includes(t))) {
    return flagMap.europe;
  }

  // Exactly one match → that country's flag; else → globe
  if (matches.length === 1 && flagMap[matches[0]]) {
    return flagMap[matches[0]];
  }

  // Default to globe emoji for multi-region or unknown
  return flagMap.world;
}

module.exports = {
  pickRegionEmoji,
  countryList,
  flagMap,
  europeanRegions,
};
