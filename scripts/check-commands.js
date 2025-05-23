require('dotenv').config();
const { REST, Routes } = require('discord.js');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error('Error: BOT_TOKEN and CLIENT_ID must be set in .env file');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('[START] Checking registered commands...\n');

    // Get all guilds
    console.log('[FETCH] Fetching guilds...');
    const guilds = await rest.get(Routes.userGuilds());
    console.log(`[INFO] Found ${guilds.length} guilds\n`);

    // Check global commands
    console.log('[CHECK] Checking global commands...');
    const globalCommands = await rest.get(Routes.applicationCommands(clientId));
    console.log('[GLOBAL] Currently registered global commands:');
    if (globalCommands.length === 0) {
      console.log('  None');
    } else {
      globalCommands.forEach(cmd => {
        console.log(`  - ${cmd.name} (${cmd.id})`);
      });
    }
    console.log('');

    // Check guild-specific commands
    console.log('[CHECK] Checking guild-specific commands...');
    for (const guild of guilds) {
      console.log(`\n[GUILD] ${guild.name} (${guild.id}):`);
      const guildCommands = await rest.get(Routes.applicationGuildCommands(clientId, guild.id));
      if (guildCommands.length === 0) {
        console.log('  No guild-specific commands');
      } else {
        guildCommands.forEach(cmd => {
          console.log(`  - ${cmd.name} (${cmd.id})`);
        });
      }
    }

  } catch (error) {
    console.error('\n[ERROR] Failed to check commands:', error.message);
    process.exit(1);
  }
})(); 