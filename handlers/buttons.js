// handlers/buttons.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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
      flags: MessageFlags.Ephemeral,
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

      const shared = {
        content: `${interaction.user} shared Game Boy game information:`,
        embeds: [embed],
      };

      // Acknowledge the button first, which also consumes the interaction
      await interaction.update({
        content: `You shared **${gameTitle}** to the channel!`,
        embeds: [embed],
        components: [], // Remove the share button
      });

      // Post publicly through the interaction's own webhook rather than
      // channel.send(). Interaction follow-ups don't need the bot to hold Send
      // Messages in the channel, which is what used to make Share fail with
      // "Error sharing to channel" on servers where the role is locked down.
      try {
        await interaction.followUp(shared);
      } catch (followUpError) {
        console.error('Follow-up share failed, falling back to channel.send:', followUpError);
        if (!interaction.channel) throw followUpError;
        await interaction.channel.send(shared);
      }
    } catch (error) {
      console.error('Error in share button handler:', error);
      const notice = {
        content: 'Error sharing to channel. Please ensure I have permissions to send messages.',
        flags: MessageFlags.Ephemeral,
      };
      try {
        // The interaction may already have been consumed by the update above
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(notice);
        } else {
          await interaction.reply(notice);
        }
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
