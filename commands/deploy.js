// commands/deploy.js
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Guard clause to check for required environment variables
if (!process.env.BOT_TOKEN) {
  console.error('[Config] BOT_TOKEN is not set. Please add BOT_TOKEN to your .env');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('[Config] CLIENT_ID is not set. Please add CLIENT_ID to your .env');
  process.exit(1);
}

// Register the commands
(async () => {
  console.log('Starting slash command registration...');

  const commands = [];
  // Grab all the command files from the commands directory
  const commandsPath = path.join(__dirname);
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
  const rest = new REST().setToken(process.env.BOT_TOKEN);

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Register commands based on whether GUILD_ID is set
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`Registered commands to guild ${process.env.GUILD_ID}`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('Registered commands globally');
    }

    console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    process.exit(1);
  }
})();
