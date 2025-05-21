// bot.js
const { Client, GatewayIntentBits, Events } = require('discord.js');
const {
  handleGameBoyBotSearch,
  startCleanupInterval,
  stopCleanupInterval,
} = require('./handlers/search');
const { handleButtonInteraction } = require('./handlers/buttons');
const { execute } = require('./commands/gameboybot');

/**
 * Safely handle errors in interaction handlers
 * @param {Interaction} interaction - The Discord interaction
 * @param {Error} err - The error that occurred
 * @param {string} label - Label for error logging
 */
async function safeReplyError(interaction, err, label) {
  console.error(`${label} error:`, err);
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: 'An error occurred.', ephemeral: true });
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag} (GB ROM Database Bot)`);
  startCleanupInterval();
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    try {
      return await handleButtonInteraction(interaction);
    } catch (err) {
      return safeReplyError(interaction, err, 'Button handler');
    }
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'dmgdb') {
    try {
      return await execute(interaction);
    } catch (err) {
      return safeReplyError(interaction, err, 'Command handler');
    }
  }
});

process.on('SIGINT', () => {
  console.log('Shutting down…');
  stopCleanupInterval();
  client.destroy();
  process.exit(0);
});

module.exports = client;
