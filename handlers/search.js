// handlers/search.js
const {
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { normalizeString, extractBaseTitle, loadRomData } = require('../loadRomData');
// Import the regions module
const { pickRegionEmoji } = require('../utils/regions');
const path = require('path');
const fetch = require('node-fetch');

// Constants for box art URLs
const GB_SHA = '9db991096041e2c3476556cb6bd0810cdf1b5a93';
const GBC_SHA = '2c54e12ed7d9acd3124497bf5a9b107ab69d0d41';
const GB_BASE_URL = `https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Game_Boy/${GB_SHA}/Named_Boxarts`;
const GBC_BASE_URL = `https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Game_Boy_Color/${GBC_SHA}/Named_Boxarts`;

// Configuration constants
const SEARCH_EXPIRATION_TIME = 60000; // 1 minute
const CACHE_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes
const GAMES_PER_PAGE = 4; // Maximum games per page (Discord allows max 5 action rows)
const CLEANUP_INTERVAL = 30000; // Run cleanup every 30 seconds
const DEBUG = true; // Set to true to enable debug logging

// Global collections for search state
const activeSearches = new Collection();
const collectors = new Collection();
const queryCache = new Map();

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

  return cleaned;
}

/**
 * Create a rich embed for a ROM entry
 * @param {Object} rom - The ROM object
 * @returns {Promise<EmbedBuilder>} Discord embed with ROM details
 */
async function createRomEmbed(rom) {
  // Extract the base title and clean it
  const baseTitle = extractBaseTitle(rom.filename);
  const cleanedTitle = cleanTitle(baseTitle);

  // Use the pickRegionEmoji function
  const regionEmoji = pickRegionEmoji(rom.filename, rom.region);

  // Create the title with emoji and ensure periods are followed by zero-width spaces
  const titleWithEmoji = `${regionEmoji}   ${cleanedTitle.replace(/\./g, '.' + String.fromCharCode(8203))}`;

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(titleWithEmoji)
    .setDescription(`ROM Title: ${rom.title || 'Unknown'}\nFilename: ${rom.filename || 'Unknown'}`)
    .setTimestamp();

  // Add thumbnail if available
  if (rom.rom_filename) {
    const isCGB = /cgb/i.test(rom.cgbFlag);
    const baseURL = isCGB ? GBC_BASE_URL : GB_BASE_URL;
    const pngName = rom.rom_filename.replace(/\.(gb|gbc)$/i, '.png');
    const thumbURL = `${baseURL}/${encodeURIComponent(pngName)}`;

    try {
      const res = await fetch(thumbURL, { method: 'HEAD' });
      if (res.ok) {
        embed.setThumbnail(thumbURL);
      }
    } catch (err) {
      // silent fail—no thumbnail
    }
  }

  // Handle region display
  let displayRegion = rom.region;
  if (rom.region.toLowerCase() === 'non-japanese') {
    const tokens = extractRegionTokens(rom.filename);
    if (tokens.length > 0) {
      displayRegion = tokens.join(', ').toUpperCase();
    }
  }

  // Add ROM details in specified order
  if (displayRegion) {
    embed.addFields({ name: 'Region', value: displayRegion, inline: true });
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
    embed.addFields({ name: 'ROM Size', value: rom.romSize, inline: true });
  }

  if (rom.ramSize) {
    embed.addFields({ name: 'RAM Size', value: rom.ramSize, inline: true });
  }

  // Combine features into a single field
  const features = [];
  if (rom.hasBattery) features.push('Battery');
  if (rom.hasTimer) features.push('Timer');
  if (rom.hasRumble) features.push('Rumble');
  if (features.length > 0) {
    embed.addFields({ name: 'Features', value: features.join(', '), inline: true });
  }

  if (rom.year) {
    embed.addFields({ name: 'Year', value: rom.year, inline: true });
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
  // Calculate the start and end indices for the current page
  const startIdx = (search.currentPage - 1) * GAMES_PER_PAGE;
  const endIdx = Math.min(startIdx + GAMES_PER_PAGE, search.results.length);
  const pageResults = search.results.slice(startIdx, endIdx);

  // Recalculate total pages
  const totalPages = Math.ceil(search.results.length / GAMES_PER_PAGE);

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

  // Clean up expired cache entries
  queryCache.forEach((entry, query) => {
    if (now - entry.timestamp > CACHE_EXPIRATION_TIME) {
      queryCache.delete(query);
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
    let results = fuseIndex.search(rawQuery).map(result => ({
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
        if (cgb === 'both') return flag === 'DMG+CGB';  // Only show games that work on both GB and CGB
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
        const m = r.item.mapper || '';
        return mapperFilter === 'Unknown' ? m.startsWith('Unknown') : m === mapperFilter;
      });
    }

    // Sorting
    if (sortBy === 'relevance' && preserveRelevance) {
      // Keep Fuse.js relevance sorting
      results.sort((a, b) => a.score - b.score);
    } else {
      // Apply alphabetical sorting
      results.sort((a, b) => String(a[sortBy] || '').localeCompare(String(b[sortBy] || '')));
    }

    // If only one result, show it directly
    if (results.length === 1) {
      const embed = await createRomEmbed(results[0]);

      // Store the search state with current timestamp
      const search = {
        results,
        currentPage: 1,
        timestamp: Date.now(),
        query: rawQuery,
        totalPages: 1,
      };
      activeSearches.set(interaction.user.id, search);

      await interaction.reply({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('share_to_channel')
              .setLabel('Share to Channel')
              .setStyle(ButtonStyle.Primary)
          ),
        ],
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
        if (cgb === 'both') return flag === 'DMG+CGB';  // Only show games that work on both GB and CGB
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
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Error in handleRandomGame:', error);
    await interaction.reply({
      content: 'An error occurred while getting a random game. Please try again later.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

// Setup cleanup interval
let cleanupIntervalId = null;
function startCleanupInterval() {
  if (cleanupIntervalId === null) {
    cleanupIntervalId = setInterval(cleanupExpired, CLEANUP_INTERVAL);
    console.log('Started cleanup interval');

    // Initialize ROM data when starting
    const result = loadRomData();
    if (result.success) {
      roms = result.roms;
      fuseIndex = result.fuseIndex;
      console.log('Game Boy ROM data loaded successfully!');
    } else {
      console.error('Failed to initialize ROM data. Search functionality will be limited.');
    }
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
  queryCache,
  createRomEmbed,
  updateResultsPage,
  cleanupExpired,
  handleGameBoyBotSearch,
  handleRandomGame,
  startCleanupInterval,
  stopCleanupInterval,
};
