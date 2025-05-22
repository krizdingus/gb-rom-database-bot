// handlers/buttons.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Constants: { InteractionResponseFlags },
} = require('discord.js');
const { extractBaseTitle } = require('../loadRomData');
const { activeSearches, collectors, updateResultsPage, createRomEmbed } = require('./search');

/**
 * Handle button interactions
 * @param {Object} interaction - Discord button interaction
 */
async function handleButtonInteraction(interaction) {
  const userId = interaction.user.id;
  const search = activeSearches.get(userId);

  // Reset timestamp on any interaction before checking expiration
  if (search) {
    search.timestamp = Date.now();
  } else {
    await interaction.reply({
      content: 'Your search has expired. Please start a new search.',
      ephemeral: true,
    });
    return;
  }

  const buttonId = interaction.customId;

  // Handle share button
  if (buttonId === 'share_to_channel') {
    try {
      // Get the content of the message with the embed
      const embed = interaction.message.embeds[0];
      const gameTitle = embed.title;

      // First, get a reference to the channel where we want to share
      const channelToShareTo = interaction.channel;

      if (!channelToShareTo) {
        // Can't access the channel
        await interaction.reply({
          content: 'Error: Cannot access channel to share.',
          ephemeral: true,
        });
        return;
      }

      // Send the message to the channel first (using the channel reference)
      await channelToShareTo.send({
        content: `${interaction.user} shared Game Boy game information:`,
        embeds: [embed],
      });

      // Then update the original message (this consumes the interaction)
      await interaction.update({
        content: `You shared **${gameTitle}** to the channel!`,
        embeds: [embed],
        components: [], // Remove the share button
      });
    } catch (error) {
      console.error('Error in share button handler:', error);
      try {
        // If we haven't used up the interaction yet, we can reply
        await interaction.reply({
          content: 'Error sharing to channel. Please ensure I have permissions to send messages.',
          ephemeral: true,
        });
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
    return;
  }

  // Handle navigation buttons
  if (buttonId === 'prev_page' || buttonId === 'next_page') {
    search.currentPage += buttonId === 'next_page' ? 1 : -1;
    await updateResultsPage(interaction, search, search.query);
    return;
  }

  // Handle cancel button
  if (buttonId === 'cancel') {
    const collector = collectors.get(userId);
    if (collector) {
      collector.stop('cancelled');
      collectors.delete(userId);
    }
    activeSearches.delete(userId);
    await interaction.update({ content: 'Search cancelled.', components: [] });
    return;
  }

  // Handle back to results button
  if (buttonId === 'back_to_results') {
    await updateResultsPage(interaction, search, search.query);
    return;
  }

  // Handle game selection
  if (buttonId.startsWith('select_')) {
    const index = parseInt(buttonId.split('_')[1]) - 1;
    const startIdx = (search.currentPage - 1) * 4;
    const selectedRom = search.results[startIdx + index];

    if (selectedRom) {
      const embed = await createRomEmbed(selectedRom);

      // Ensure embed has at least one base field
      if (
        !embed.data.title &&
        !embed.data.description &&
        (!embed.data.fields || embed.data.fields.length === 0)
      ) {
        embed.setDescription('\u200B');
      }

      // Create a row with both Share and Back buttons
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('share_to_channel')
          .setLabel('Share to Channel')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('back_to_results')
          .setLabel('Back to Results')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({
        embeds: [embed],
        components: [buttonRow],
      });
    }
  }
}

module.exports = {
  handleButtonInteraction,
};
