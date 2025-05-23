// deploy.js - Run this script to register slash commands
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Get configuration from environment variables
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// Debug logging
console.log('Environment variables:');
console.log('CLIENT_ID:', clientId);
console.log('GUILD_ID:', guildId || 'Not set (will register globally)');
console.log('BOT_TOKEN:', token ? 'Present' : 'Missing');

// Guard clause to check for required environment variables
if (!token) {
  console.error('[Config] BOT_TOKEN is not set. Please add BOT_TOKEN to your .env');
  process.exit(1);
}

if (!clientId) {
  console.error('[Config] CLIENT_ID is not set. Please add CLIENT_ID to your .env');
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

  console.log('Found command files:', commandFiles);

  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`Loaded command: ${command.data.name}`);
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
    console.log('Commands to register:', JSON.stringify(commands, null, 2));

    // Register commands based on whether GUILD_ID is set
    if (guildId) {
      console.log(`Registering commands to guild ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`Successfully registered commands to guild ${guildId}`);
    } else {
      console.log('Registering commands globally...');
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Successfully registered commands globally');
    }

    console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      method: error.method,
      url: error.url,
    });
    process.exit(1);
  }
})();
