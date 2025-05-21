// deploy.js - Run this script to register slash commands
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Get configuration from environment variables
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// Guard clause to check for required environment variables
if (!token) {
  console.error('[Config] BOT_TOKEN is not set. Please add BOT_TOKEN to your .env');
  process.exit(1);
}

if (!clientId) {
  console.error('[Config] CLIENT_ID is not set. Please add CLIENT_ID to your .env');
  process.exit(1);
}

if (!guildId) {
  console.error('[Config] GUILD_ID is not set. Please add GUILD_ID to your .env');
  process.exit(1);
}

// Register the commands
(async () => {
  console.log('Starting slash command registration...');

  const commands = [];
  // Grab all the command files from the commands directory
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js') && file !== 'deploy.js');

  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }

  // Construct and prepare an instance of the REST module
  const rest = new REST().setToken(token);

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    process.exit(1);
  }
})();
