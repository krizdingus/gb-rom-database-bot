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

if (!process.env.GUILD_ID) {
  console.error('[Config] GUILD_ID is not set. Please add GUILD_ID to your .env');
  process.exit(1);
}

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

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();
