require('dotenv').config();
const client = require('./bot');
const { loadRomData } = require('./loadRomData');

// Validate required environment variables
if (!process.env.BOT_TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is required');
  process.exit(2);
}

if (!process.env.CLIENT_ID) {
  console.error('Error: CLIENT_ID environment variable is required');
  process.exit(2);
}

// Load ROM data before starting the bot
const result = loadRomData();
if (!result.success) {
  console.error('Fatal error: Unable to load ROM data. Exiting.');
  process.exit(1);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

// Login to Discord
client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('Login error:', error);
  process.exit(4);
});

async function updateResultsPage(interaction, responseText, actionRows) {
  if (typeof interaction.update === 'function') {
    await interaction.update({ content: responseText, components: actionRows });
  } else {
    await interaction.editReply({ content: responseText, components: actionRows });
  }
}
