// bot.js
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const { reloadRomData, startCleanupInterval, stopCleanupInterval } = require('./handlers/search');
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
    await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
  }
}

// Guilds is all this needs: it only ever handles interactions, and never reads
// messages. GuildMessages and the privileged MessageContent intent were being
// requested and never used.
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag} (GB ROM Database Bot)`);

  // Name the servers this token is connected to. Running a copy against the
  // wrong token would otherwise look identical at startup, and the first sign
  // of it would be someone else's server answering.
  const guilds = client.guilds.cache.map(guild => `${guild.name} (${guild.id})`);
  console.log(`Serving ${guilds.length} server(s): ${guilds.join(', ') || 'none'}`);

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

// Reload a replaced rom-list.json in place: kill -HUP $(pgrep -f 'node index.js')
process.on('SIGHUP', () => {
  console.log('SIGHUP received, reloading ROM data...');
  reloadRomData();
});

process.on('SIGINT', () => {
  console.log('Shutting down…');
  stopCleanupInterval();
  client.destroy();
  process.exit(0);
});

module.exports = client;
