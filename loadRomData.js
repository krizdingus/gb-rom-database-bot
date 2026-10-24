// loadRomData.js
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

// Function to normalize strings for better search and caching
function normalizeString(str) {
  if (!str) return '';

  // Lowercase, trim, and normalize (NFD = canonical decomposition)
  return (
    str
      .toLowerCase()
      .trim()
      // Normalize to decomposed form
      .normalize('NFD')
      // Remove diacritics/accents (marks that are unicode category "Mn" = Mark, Nonspacing)
      .replace(/[\u0300-\u036f]/g, '')
      // Replace multiple spaces with a single space
      .replace(/\s+/g, ' ')
  );
}

// Function to extract the base title from a No-Intro formatted filename
function extractBaseTitle(filename) {
  if (!filename) return 'Unknown Game';

  // 1) Remove extension: strip the last ".gb", ".gbc", etc.
  let base = filename.replace(/\.[gG][bBcCxX]?$/, '');

  // 2) Remove trailing parentheses groups
  base = base.replace(/\s*\([^)]*\)\s*$/, '');

  // 3) Handle comma-article patterns
  return reorderArticle(base).trim();
}

/**
 * Move a trailing article to the front: "Pacifist, The" -> "The Pacifist".
 * Whatever follows the article is kept in place, so this works whether the name
 * ends there, carries a subtitle ("Legend of Zelda, The - Link's Awakening"), or
 * still has No-Intro tags on it ("Pacifist, The (World) (Unl)").
 * @param {string} title - Title that may have a trailing article
 * @returns {string} Title with the article moved to the front
 */
function reorderArticle(title) {
  if (!title) return '';

  // \b after the article stops this matching ", Theme Park" or ", Antarctica"
  const m = title.match(/^(.*?),\s*(The|A|An)\b(.*)$/i);
  if (!m) return title;

  return `${m[2]} ${m[1]}${m[3]}`;
}

// Fuse's minimum matchable term length. With useExtendedSearch on, spaces mean
// AND, so any term shorter than this makes the whole query match nothing.
const MIN_MATCH_CHAR_LENGTH = 2;

/**
 * Prepare a user's query for the index. With extended search enabled a space
 * separates AND terms, and a term below the minimum length fails, taking the
 * whole query with it - so "a bug's life" and "bug s life" both found nothing
 * while "bugs life" worked. Short terms are dropped from plain queries rather
 * than being allowed to zero out the result.
 *
 * Queries using Fuse's extended-search operators are passed through untouched.
 * @param {string} raw - The query as typed
 * @returns {string} Query to hand to Fuse
 */
function prepareQuery(raw) {
  if (!raw) return '';

  const terms = raw.trim().split(/\s+/);

  // ' ! ^ = lead a term and $ ends one; | is the OR separator. An apostrophe
  // inside a word is not an operator, so "a bug's life" is still a plain query.
  const isOperator = term => /^['!^=]/.test(term) || term.endsWith('$') || term === '|';
  if (terms.some(isOperator)) return raw;

  const usable = terms.filter(term => term.length >= MIN_MATCH_CHAR_LENGTH);

  // If every term is short the query is all we have, so send it as typed
  return usable.length > 0 ? usable.join(' ') : raw;
}

// Function to normalize game titles for better matching
function normalizeGameTitle(title) {
  if (!title) return '';

  return (
    title
      .toLowerCase()
      // Preserve periods in common abbreviations
      .replace(/\b(dr|mr|mrs|ms|prof|inc|ltd|co|corp|llc)\./g, '$1')
      // Replace other punctuation with spaces
      .replace(/[^a-z0-9. ]/g, ' ')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// Load ROM data and create search index
function loadRomData() {
  try {
    console.log('Loading ROM data...');

    const romListPath = path.join(__dirname, 'rom-list.json');

    // rom-list.json is the database and ships with the repo. It used to be
    // regenerated here from the Myrient archive, which no longer exists; build a
    // replacement from a folder of ROMs with scripts/scan_roms.py instead.
    if (!fs.existsSync(romListPath)) {
      console.error('Error: rom-list.json is missing.');
      console.error('It ships with the repo. To build one from a folder of ROMs:');
      console.error('  python3 scripts/scan_roms.py /path/to/roms --output rom-list.json');
      return { success: false };
    }

    // Read ROM list from JSON file
    const rawData = fs.readFileSync(romListPath);

    let roms;
    try {
      roms = JSON.parse(rawData);
    } catch (parseError) {
      console.error('Error parsing ROM data JSON:', parseError);
      return { success: false };
    }

    if (!Array.isArray(roms)) {
      console.error('Error: ROM data is not an array');
      return { success: false };
    }

    // An empty list used to count as a successful load, which meant a failed fetch
    // could leave the bot running with nothing to search
    if (roms.length === 0) {
      console.error('Error: ROM data is empty');
      return { success: false };
    }

    console.log(`Successfully loaded ${roms.length} ROM entries`);

    // Configure Fuse.js for fuzzy searching
    const fuseOptions = {
      keys: [
        { name: 'normalizedTitle', weight: 0.8 },
        { name: 'filename', weight: 0.5 },
        { name: 'title', weight: 0.2 },
        { name: 'region', weight: 0.1 },
        { name: 'cgbFlag', weight: 0.05 },
        { name: 'sgbFlag', weight: 0.05 },
        { name: 'hasTimer', weight: 0.025 },
        { name: 'hasRumble', weight: 0.025 },
        { name: 'hasBattery', weight: 0.025 },
      ],
      threshold: 0.4, // More permissive fuzzy matching
      ignoreLocation: true, // Match anywhere in the string
      minMatchCharLength: MIN_MATCH_CHAR_LENGTH, // Allow shorter matches
      includeScore: true,
      useExtendedSearch: true, // Enable =exact searches
    };

    // Create normalized titles for each ROM
    roms.forEach(rom => {
      // Extract and normalize the base title
      const baseTitle = extractBaseTitle(rom.filename);
      rom.normalizedTitle = normalizeGameTitle(baseTitle);
    });

    // Create Fuse index
    const fuseIndex = new Fuse(roms, fuseOptions);

    console.log('ROM indexing complete! Search engine is ready.');
    return { success: true, roms, fuseIndex };
  } catch (error) {
    console.error('Error loading ROM data:', error);
    return { success: false };
  }
}

module.exports = {
  loadRomData,
  normalizeString,
  extractBaseTitle,
  reorderArticle,
  prepareQuery,
  normalizeGameTitle,
};
