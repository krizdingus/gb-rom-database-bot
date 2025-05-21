// loadRomData.js
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');
const { execSync } = require('child_process');

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
  const commaArticlePattern = /^(.*),\s*(The|A|An)\s*(?:-\s*(.*))?$/i;
  const m = base.match(commaArticlePattern);
  if (m) {
    // If there's a subtitle (after the dash), include it
    if (m[3]) {
      return `${m[2]} ${m[1]} - ${m[3]}`;
    }
    // Otherwise just reorder the article
    return `${m[2]} ${m[1]}`;
  }

  // 4) Trim whitespace
  return base.trim();
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

    // Check if the file exists and generate if missing
    if (!fs.existsSync(romListPath)) {
      console.log('rom-list.json not found. Generating via fetch_gb_roms.py...');
      try {
        const scriptPath = path.join(__dirname, 'scripts', 'fetch_gb_roms.py');
        execSync(`python3 "${scriptPath}"`, {
          stdio: 'inherit',
          cwd: __dirname, // Run from project root to ensure correct paths
        });
        console.log('Generation complete.');
      } catch (error) {
        console.error('Failed to generate rom-list.json:', error.message);
        return { success: false };
      }
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
      minMatchCharLength: 2, // Allow shorter matches
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
  normalizeGameTitle,
};
