// handlers/search.js
const {
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { extractBaseTitle, prepareQuery, loadRomData } = require('../loadRomData');
// Import the regions module
const { pickRegionEmoji } = require('../utils/regions');
const { formatSize } = require('../utils/sizes');

// Constants for box art URLs
const GB_SHA = '9db991096041e2c3476556cb6bd0810cdf1b5a93';
const GBC_SHA = '2c54e12ed7d9acd3124497bf5a9b107ab69d0d41';
const GB_BASE_URL = `https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Game_Boy/${GB_SHA}/Named_Boxarts`;
const GBC_BASE_URL = `https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Game_Boy_Color/${GBC_SHA}/Named_Boxarts`;

// Configuration constants
const SEARCH_EXPIRATION_TIME = 70000; // 70 seconds
const GAMES_PER_PAGE = 4; // Maximum games per page (Discord allows max 5 action rows)
const CLEANUP_INTERVAL = 90000; // Run cleanup every 90 seconds
const DEBUG = process.env.DEBUG === 'true'; // Set DEBUG=true in .env to enable debug logging

// Global collections for search state
const activeSearches = new Collection();
const collectors = new Collection();

// Whether a box art URL exists, keyed by URL. The thumbnail repos are pinned to
// fixed commits, so an answer never changes and never needs expiring - this saves
// a HEAD request to GitHub on every single lookup.
const boxArtCache = new Map();

// Initialize ROM data
let roms = [];
let fuseIndex = null;

// Region tokens for parsing
const REGION_TOKENS = [
  'usa',
  'europe',
  'japan',
  'australia',
  'spain',
  'france',
  'germany',
  'uk',
  'italy',
  'taiwan',
  'korea',
  'china',
  'brazil',
  'sweden',
  'netherlands',
  'belgium',
  'denmark',
  'finland',
  'norway',
  'portugal',
  'russia',
  'poland',
  'czech',
  'hungary',
  'greece',
  'turkey',
  'israel',
  'south africa',
  'mexico',
  'canada',
  'world',
];

// SGB tokens for parsing
const SGB_TOKENS = ['sgb enhanced', 'super game boy', 'sgb'];

// Allowed parenthetical content patterns
const ALLOWED_PARENS = [
  /^rev\b/i, // e.g. "Rev 2" or "Revision 2"
  /^v\d+(\.\d+)*$/i, // e.g. "v1.1", "v2"
  /^prototype$/i,
  /^beta$/i, // if desired
];

// Truncate labels to Discord's 80-char limit
function truncateLabel(label) {
  if (label.length > 80) return label.slice(0, 77) + '...';
  return label;
}

/**
 * Extract region tokens from a filename
 * @param {string} filename - The filename to parse
 * @returns {string[]} Array of region tokens found
 */
function extractRegionTokens(filename) {
  const matches = filename.match(/\(([^)]+)\)/g) || [];
  return matches
    .map(match => match.slice(1, -1).toLowerCase())
    .flatMap(region => region.split(/[,/]/).map(r => r.trim()))
    .filter(token => REGION_TOKENS.includes(token));
}

/**
 * Clean title by removing region, SGB, and other non-essential tags
 * @param {string} title - The title to clean
 * @returns {string} Cleaned title
 */
function cleanTitle(title) {
  // Find all parenthetical expressions
  const matches = title.match(/\(([^)]+)\)/g) || [];

  // Filter out region-only and SGB-only parentheses
  const nonRemovableMatches = matches.filter(match => {
    const content = match.slice(1, -1).toLowerCase().trim();
    const tokens = content.split(/[,/]/).map(t => t.trim());

    // Keep if it's not a region-only tag
    const isRegionOnly = tokens.every(token => REGION_TOKENS.includes(token));
    if (!isRegionOnly) {
      // Keep if it's not an SGB tag
      const isSGBTag = SGB_TOKENS.includes(content);
      if (!isSGBTag) {
        return true;
      }
    }
    return false;
  });

  // Replace removable parentheses with empty string
  let cleaned = title;
  matches.forEach(match => {
    if (!nonRemovableMatches.includes(match)) {
      cleaned = cleaned.replace(match, '').trim();
    }
  });

  // Strip any remaining trailing non-essential parentheses
  let t = cleaned;
  while (/\s*\(([^)]+)\)\s*$/.test(t)) {
    const inside = t.match(/\s*\(([^)]+)\)\s*$/)[1].trim();
    if (ALLOWED_PARENS.some(rx => rx.test(inside))) break;
    t = t.replace(/\s*\(([^)]+)\)\s*$/, '').trim();
  }
  cleaned = t;

  // Removing a tag from the middle of a name leaves the gap behind, e.g.
  // "Adulting! (World) (v2.0) (Aftermarket) (Unl)" -> "Adulting!  (v2.0)"
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Check whether a box art thumbnail exists, remembering the answer
 * @param {string} url - Thumbnail URL
 * @returns {Promise<boolean>} Whether the thumbnail can be used
 */
async function boxArtExists(url) {
  if (boxArtCache.has(url)) {
    return boxArtCache.get(url);
  }

  let exists = false;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    exists = res.ok;
  } catch (err) {
    // silent fail—no thumbnail. Not cached, so a network blip can be retried.
    return false;
  }

  boxArtCache.set(url, exists);
  return exists;
}

/**
 * Build the title shown to the user: the filename with its region and SGB tags removed
 * @param {Object} rom - The ROM object
 * @returns {string} Display title
 */
function displayTitle(rom) {
  return cleanTitle(extractBaseTitle(rom.filename));
}

/**
 * Build the region shown to the user. The stored region is the header's destination
 * code, which is only ever "Japanese" or "non-japanese", so the filename's region
 * tags are used instead whenever they're available.
 * @param {Object} rom - The ROM object
 * @returns {string} Display region
 */
function displayRegion(rom) {
  const region = rom.region || '';
  if (region.toLowerCase() === 'non-japanese') {
    const tokens = extractRegionTokens(rom.filename);
    if (tokens.length > 0) {
      return tokens.join(', ').toUpperCase();
    }
  }
  return region;
}

/**
 * Create a rich embed for a ROM entry
 * @param {Object} rom - The ROM object
 * @returns {Promise<EmbedBuilder>} Discord embed with ROM details
 */
async function createRomEmbed(rom) {
  const cleanedTitle = displayTitle(rom);

  // Use the pickRegionEmoji function
  const regionEmoji = pickRegionEmoji(rom.filename, rom.region);

  // Create the title with emoji and ensure periods are followed by zero-width spaces
  const titleWithEmoji = `${regionEmoji}   ${cleanedTitle.replace(/\./g, '.' + String.fromCharCode(8203))}`;

  const embed = new EmbedBuilder()
    .setColor(0xa7396a)
    .setTitle(titleWithEmoji)
    .setDescription(`ROM Title: ${rom.title || 'Unknown'}\nFilename: ${rom.filename || 'Unknown'}`)
    .setTimestamp();

  // Add thumbnail if available
  if (rom.rom_filename) {
    const isCGB = /cgb/i.test(rom.cgbFlag);
    const baseURL = isCGB ? GBC_BASE_URL : GB_BASE_URL;
    const pngName = rom.rom_filename.replace(/\.(gb|gbc)$/i, '.png');
    const thumbURL = `${baseURL}/${encodeURIComponent(pngName)}`;

    if (await boxArtExists(thumbURL)) {
      embed.setThumbnail(thumbURL);
    }
  }

  // Add ROM details in specified order
  const region = displayRegion(rom);
  if (region) {
    embed.addFields({ name: 'Region', value: region, inline: true });
  }

  if (rom.cgbFlag) {
    embed.addFields({ name: 'CGB Support', value: rom.cgbFlag, inline: true });
  }

  if (rom.sgbFlag) {
    embed.addFields({ name: 'SGB Support', value: rom.sgbFlag, inline: true });
  }

  if (rom.mapper) {
    embed.addFields({ name: 'Mapper', value: rom.mapper, inline: true });
  }

  if (rom.romSize) {
    embed.addFields({ name: 'ROM Size', value: formatSize(rom.romSize), inline: true });
  }

  if (rom.ramSize) {
    embed.addFields({ name: 'RAM Size', value: formatSize(rom.ramSize), inline: true });
  }

  // Combine features into a single field
  const features = [];
  if (rom.hasBattery) features.push('Battery');
  if (rom.hasTimer) features.push('Timer');
  if (rom.hasRumble) features.push('Rumble');
  if (features.length > 0) {
    embed.addFields({ name: 'Features', value: features.join(', '), inline: true });
  }

  return embed;
}

/**
 * Update the results page for a paginated search
 * @param {Object} interaction - Discord interaction
 * @param {Object} search - Search state object
 * @param {string} query - Original search query
 */
async function updateResultsPage(interaction, search, query) {
  // Reset the timestamp on any interaction
  search.timestamp = Date.now();

  // Recalculate total pages, then clamp the current page into range so the
  // navigation buttons can never point past the end of the results
  const totalPages = Math.max(1, Math.ceil(search.results.length / GAMES_PER_PAGE));
  search.currentPage = Math.min(Math.max(search.currentPage, 1), totalPages);

  // Calculate the start and end indices for the current page
  const startIdx = (search.currentPage - 1) * GAMES_PER_PAGE;
  const endIdx = Math.min(startIdx + GAMES_PER_PAGE, search.results.length);
  const pageResults = search.results.slice(startIdx, endIdx);

  // Format the list header
  let responseText = `Found ${search.results.length} matches for "${query}". Did you mean:\n\n`;

  // Add page information
  responseText += `Page ${search.currentPage}/${totalPages}`;

  // Create action rows (max 5 allowed by Discord)
  const actionRows = [];

  // Create a separate row for each game button (up to 4)
  pageResults.forEach((result, index) => {
    const rom = result;
    // Use the full filename for the button label
    const fullFilename = rom.filename || 'Unknown Game';
    const buttonLabel = truncateLabel(fullFilename);

    // Create a new action row for this game
    const gameRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`select_${index + 1}`)
        .setLabel(buttonLabel)
        .setStyle(ButtonStyle.Secondary) // Secondary style looks more link-like
    );

    actionRows.push(gameRow);
  });

  // Navigation row (this will be the 5th row)
  const navigationRow = new ActionRowBuilder();

  // Add Cancel button
  navigationRow.addComponents(
    new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
  );

  // Add navigation buttons
  navigationRow.addComponents(
    new ButtonBuilder()
      .setCustomId('prev_page')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(search.currentPage === 1) // Disable if first page
  );

  navigationRow.addComponents(
    new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(search.currentPage === totalPages) // Disable if last page
  );

  actionRows.push(navigationRow);

  try {
    // when updating via button, use interaction.update; otherwise editReply
    if (interaction.isButton() || interaction.replied || interaction.deferred) {
      await interaction.update({ content: responseText, components: actionRows });
    } else {
      await interaction.reply({
        content: responseText,
        components: actionRows,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Update the stored search with new total pages calculation
    search.totalPages = totalPages;
    activeSearches.set(interaction.user.id, search);
  } catch (error) {
    console.error('Error updating results page:', error);
  }
}

/**
 * Function to clean up expired searches and cache entries
 */
function cleanupExpired() {
  const now = Date.now();

  // Clean up expired searches
  activeSearches.forEach((search, userId) => {
    if (now - search.timestamp > SEARCH_EXPIRATION_TIME) {
      // Stop and delete any associated collector
      const collector = collectors.get(userId);
      if (collector) {
        collector.stop('cleanup');
        collectors.delete(userId);
      }

      // Delete the search
      activeSearches.delete(userId);
    }
  });
}

/**
 * Handle the gameboybot search subcommand
 */
async function handleGameBoyBotSearch(interaction) {
  try {
    // Get search query and options
    const rawQuery = interaction.options.getString('query');
    const region = interaction.options.getString('region') || 'any';

    // Get other options
    const cgb = interaction.options.getString('cgb') || 'any';
    const sgb = interaction.options.getBoolean('sgb');
    const battery = interaction.options.getBoolean('battery');
    const timer = interaction.options.getBoolean('timer');
    const rumble = interaction.options.getBoolean('rumble');
    const sortBy = interaction.options.getString('sort_by') || 'relevance';
    const preserveRelevance = interaction.options.getBoolean('preserve_relevance') ?? true;

    // Get results from Fuse.js
    let results = fuseIndex.search(prepareQuery(rawQuery)).map(result => ({
      ...result.item,
      score: result.score, // Preserve the relevance score
    }));

    // Apply region filter if specified
    if (region !== 'any') {
      results = results.filter(r => {
        const romRegion = r.region.toLowerCase();
        const filename = r.filename.toLowerCase();

        // Extract and normalize all region tokens from filename
        const tokens = (filename.match(/\(([^)]+)\)/g) || [])
          .map(t => t.slice(1, -1).trim().toLowerCase())
          .flatMap(t => t.split(/[,/]/).map(s => s.trim()))
          .filter(t => t.length > 0);

        // Special cases first
        if (region === 'unlicensed') {
          return romRegion === 'unlicensed' || filename.includes('(unl)');
        }
        if (region === 'pirate') {
          return romRegion === 'pirate' || filename.includes('(pirate)');
        }
        if (region === 'world') {
          // Match if it has multiple tokens or explicit world tag
          return tokens.length > 1 || tokens.includes('world');
        }

        // Check if any token matches the region
        if (tokens.includes(region)) {
          return true;
        }

        // Special handling for European regions
        if (region === 'europe') {
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
          return tokens.some(t => europeanRegions.includes(t));
        }

        // Direct region match as fallback
        return romRegion === region;
      });
    }

    // Apply filters
    // CGB filter
    if (cgb !== 'any') {
      results = results.filter(r => {
        const flag = r.cgbFlag || '';
        if (DEBUG) {
          console.log(`Filtering ROM: ${r.filename}`);
          console.log(`CGB Flag: ${flag}`);
          console.log(`Filter Type: ${cgb}`);
        }
        if (cgb === 'gb') return flag === 'DMG';
        if (cgb === 'cgb') return flag === 'CGB Only';
        if (cgb === 'both') return flag === 'DMG+CGB'; // Only show games that work on both GB and CGB
        return false;
      });
    }

    // Boolean filters with type checking
    if (typeof sgb === 'boolean') {
      results = results.filter(r => Boolean(r.sgbFlag === 'Yes') === sgb);
    }
    if (typeof battery === 'boolean') {
      results = results.filter(r => Boolean(r.hasBattery) === battery);
    }
    if (typeof timer === 'boolean') {
      results = results.filter(r => Boolean(r.hasTimer) === timer);
    }
    if (typeof rumble === 'boolean') {
      results = results.filter(r => Boolean(r.hasRumble) === rumble);
    }

    // Apply mapper filter if specified
    const mapperFilter = interaction.options.getString('mapper');
    if (mapperFilter) {
      results = results.filter(r => {
        const m = r.mapper || '';
        return mapperFilter === 'Unknown' ? m.startsWith('Unknown') : m === mapperFilter;
      });
    }

    // Sorting. Title and region sort on what the embed actually shows, not on the
    // raw fields - 'title' is the 11-byte header title ("TWINE CGB") and 'region'
    // is only ever "Japanese" or "non-japanese".
    if (sortBy === 'relevance') {
      results.sort((a, b) => a.score - b.score);
    } else {
      const sortKey = sortBy === 'region' ? displayRegion : displayTitle;
      results.sort((a, b) => {
        const compared = sortKey(a).localeCompare(sortKey(b));
        // preserve_relevance breaks ties by Fuse's score instead of leaving them
        // in whatever order the filters happened to produce
        if (compared !== 0) return compared;
        return preserveRelevance ? a.score - b.score : 0;
      });
    }

    // Nothing matched: say so and stop. Falling through to the paginated list
    // produced "Found 0 matches. Did you mean:" above an empty "Page 1/0".
    if (results.length === 0) {
      await interaction.reply({
        content: `No matches for "${rawQuery}". Try fewer filters or a shorter query.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // If we have exactly one result, show it directly
    if (results.length === 1) {
      const embed = await createRomEmbed(results[0]);

      // Create a row with both Share and Back buttons
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('share_to_channel')
          .setLabel('Share to Channel')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('back_to_results')
          .setLabel('Back to Results')
          .setStyle(ButtonStyle.Secondary)
      );

      // Store the search state even for single results
      const search = {
        results,
        currentPage: 1,
        query: rawQuery,
        timestamp: Date.now(),
      };
      activeSearches.set(interaction.user.id, search);

      await interaction.reply({
        embeds: [embed],
        components: [buttonRow],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Create search state for multiple results
    const search = {
      results,
      currentPage: 1,
      timestamp: Date.now(),
      query: rawQuery,
    };

    // Store the search state by user ID
    activeSearches.set(interaction.user.id, search);

    // Update the results page
    await updateResultsPage(interaction, search, rawQuery);
  } catch (error) {
    console.error('Error handling gameboygame command:', error);
    await interaction.reply({
      content: 'An error occurred while processing the command. Please try again later.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle the random game subcommand
 * @param {Object} interaction - Discord interaction
 */
async function handleRandomGame(interaction) {
  try {
    // Read options
    const region = interaction.options.getString('region') || 'any';
    const cgb = interaction.options.getString('cgb') || 'any';
    const sgb = interaction.options.getBoolean('sgb');
    const battery = interaction.options.getBoolean('battery');
    const timer = interaction.options.getBoolean('timer');
    const rumble = interaction.options.getBoolean('rumble');

    if (!roms || roms.length === 0) {
      console.error('ROM data not initialized or empty');
      await interaction.reply({
        content: 'Error: ROM data not available. Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Filter roms using the same logic as handleGameBoyBotSearch
    let filtered = roms.slice();
    // Region filter
    if (region !== 'any') {
      filtered = filtered.filter(r => {
        const romRegion = r.region.toLowerCase();
        const filename = r.filename.toLowerCase();
        const tokens = (filename.match(/\(([^)]+)\)/g) || [])
          .map(t => t.slice(1, -1).trim().toLowerCase())
          .flatMap(t => t.split(/[,/]/).map(s => s.trim()))
          .filter(t => t.length > 0);
        if (region === 'unlicensed') {
          return romRegion === 'unlicensed' || filename.includes('(unl)');
        }
        if (region === 'pirate') {
          return romRegion === 'pirate' || filename.includes('(pirate)');
        }
        if (region === 'world') {
          return tokens.length > 1 || tokens.includes('world');
        }
        if (tokens.includes(region)) {
          return true;
        }
        if (region === 'europe') {
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
          return tokens.some(t => europeanRegions.includes(t));
        }
        return romRegion === region;
      });
    }
    // CGB filter
    if (cgb !== 'any') {
      filtered = filtered.filter(r => {
        const flag = r.cgbFlag || '';
        if (DEBUG) {
          console.log(`Filtering ROM: ${r.filename}`);
          console.log(`CGB Flag: ${flag}`);
          console.log(`Filter Type: ${cgb}`);
        }
        if (cgb === 'gb') return flag === 'DMG';
        if (cgb === 'cgb') return flag === 'CGB Only';
        if (cgb === 'both') return flag === 'DMG+CGB'; // Only show games that work on both GB and CGB
        return false;
      });
    }
    // Boolean filters
    if (typeof sgb === 'boolean') {
      filtered = filtered.filter(r => Boolean(r.sgbFlag === 'Yes') === sgb);
    }
    if (typeof battery === 'boolean') {
      filtered = filtered.filter(r => Boolean(r.hasBattery) === battery);
    }
    if (typeof timer === 'boolean') {
      filtered = filtered.filter(r => Boolean(r.hasTimer) === timer);
    }
    if (typeof rumble === 'boolean') {
      filtered = filtered.filter(r => Boolean(r.hasRumble) === rumble);
    }

    // Apply mapper filter if specified
    const mapperFilter = interaction.options.getString('mapper');
    if (mapperFilter) {
      filtered = filtered.filter(r => {
        const m = r.mapper || '';
        return mapperFilter === 'Unknown' ? m.startsWith('Unknown') : m === mapperFilter;
      });
    }

    if (filtered.length === 0) {
      await interaction.reply({
        content: 'No games match those filters!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // pick one at random
    const randomRom = filtered[Math.floor(Math.random() * filtered.length)];
    const embed = await createRomEmbed(randomRom);

    // Create the share button
    const shareButton = new ButtonBuilder()
      .setCustomId('share_to_channel')
      .setLabel('Share to Channel')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(shareButton);

    // Store search state for random game
    const search = {
      results: [randomRom],
      currentPage: 1,
      query: 'random',
      timestamp: Date.now(),
    };
    activeSearches.set(interaction.user.id, search);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error('Error in handleRandomGame:', error);
    await interaction.reply({
      content: 'An error occurred while getting a random game. Please try again later.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Read rom-list.json from disk and swap in the new data and search index.
 * On failure the previous data is kept, so a bad list can't take the bot down.
 * @returns {boolean} Whether the reload succeeded
 */
function reloadRomData() {
  const result = loadRomData();
  if (!result.success) {
    console.error('Failed to load ROM data. Keeping the previously loaded list.');
    return false;
  }

  roms = result.roms;
  fuseIndex = result.fuseIndex;
  console.log(`Game Boy ROM data loaded successfully! (${roms.length} entries)`);
  return true;
}

// Setup cleanup interval
let cleanupIntervalId = null;
function startCleanupInterval() {
  if (cleanupIntervalId === null) {
    cleanupIntervalId = setInterval(cleanupExpired, CLEANUP_INTERVAL);
    console.log('Started cleanup interval');

    // Initialize ROM data when starting
    reloadRomData();
  }
}

function stopCleanupInterval() {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('Stopped cleanup interval');
  }
}

module.exports = {
  activeSearches,
  collectors,
  createRomEmbed,
  updateResultsPage,
  cleanupExpired,
  handleGameBoyBotSearch,
  handleRandomGame,
  reloadRomData,
  startCleanupInterval,
  stopCleanupInterval,
};
