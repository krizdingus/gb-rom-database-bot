require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Configuration
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

// Validation
if (!token || !clientId) {
  console.error('Error: BOT_TOKEN and CLIENT_ID must be set in .env file');
  process.exit(1);
}

// Initialize REST client with rate limit handling
const rest = new REST({ 
  version: '10',
  timeout: 15000, // 15 second timeout
}).setToken(token);

// Utility function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Load commands from files
function loadCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js') && file !== 'deploy.js');

  for (const file of commandFiles) {
    try {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[LOAD] Loaded command: ${command.data.name}`);
      } else {
        console.warn(`[WARN] Skipping ${file}: Missing required properties`);
      }
    } catch (error) {
      console.error(`[ERROR] Error loading command ${file}:`, error.message);
    }
  }
  return commands;
}

// Main execution
(async () => {
  console.log('[START] Starting command cleanup and global registration...');
  console.log('[INFO] This process may take a few minutes...\n');

  try {
    // Step 1: Get all guilds
    console.log('[FETCH] Fetching guilds...');
    const guilds = await rest.get(Routes.userGuilds());
    console.log(`[SUCCESS] Found ${guilds.length} guilds\n`);

    // Step 2: Clear commands from all guilds
    console.log('[CLEANUP] Clearing guild-specific commands...');
    for (const guild of guilds) {
      try {
        console.log(`[PROCESS] Processing guild: ${guild.name} (${guild.id})`);
        await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: [] });
        console.log(`[SUCCESS] Cleared commands from ${guild.name}`);
        
        // Add small delay to respect rate limits
        await delay(1000);
      } catch (error) {
        console.error(`[ERROR] Error clearing commands from ${guild.name}:`, error.message);
        // Continue with other guilds even if one fails
      }
    }
    console.log('\n[SUCCESS] Finished clearing guild commands\n');

    // Step 3: Load and register global commands
    console.log('[LOAD] Loading command files...');
    const commands = loadCommands();
    console.log(`[SUCCESS] Loaded ${commands.length} commands\n`);

    console.log('[REGISTER] Registering commands globally...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('[SUCCESS] Successfully registered global commands\n');

    // Final success message
    console.log('[SUCCESS] Command cleanup and registration complete!');
    console.log('\n[INFO] Important Notes:');
    console.log('1. Global commands may take up to 1 HOUR to appear in all servers');
    console.log('2. Your bot should now work in all current and future servers');
    console.log('3. If commands don\'t appear immediately, please wait for Discord\'s propagation');
    console.log('\n[VERIFY] To verify:');
    console.log('1. Wait at least 1 hour');
    console.log('2. Try adding the bot to a new server');
    console.log('3. Check if commands appear in the new server');

  } catch (error) {
    console.error('\n[FATAL] Error:', error.message);
    if (error.code === 429) {
      console.error('\n[WARN] Rate limit hit! Please wait a few minutes and try again.');
    }
    process.exit(1);
  }
})(); 