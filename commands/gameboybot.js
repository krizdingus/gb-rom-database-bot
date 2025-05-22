const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { handleGameBoyBotSearch, handleRandomGame } = require('../handlers/search');
const { version } = require('../package.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dmgdb')
    .setDescription('Search for Game Boy ROMs and get compatibility information')
    // Search subcommand
    .addSubcommand(sub =>
      sub
        .setName('search')
        .setDescription('Search for a Game Boy ROM')
        .addStringOption(option =>
          option.setName('query').setDescription('The game to search for').setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('region')
            .setDescription('Filter by region')
            .addChoices(
              { name: 'Any', value: 'any' },
              { name: 'USA', value: 'usa' },
              { name: 'Europe', value: 'europe' },
              { name: 'Japan', value: 'japan' },
              { name: 'World', value: 'world' },
              { name: 'Unlicensed', value: 'unlicensed' },
              { name: 'Pirate', value: 'pirate' }
            )
        )
        .addStringOption(option =>
          option
            .setName('cgb')
            .setDescription('Filter by CGB support')
            .addChoices(
              { name: 'Any', value: 'any' },
              { name: 'GB Only', value: 'gb' },
              { name: 'CGB Only', value: 'cgb' },
              { name: 'GB/CGB', value: 'both' }
            )
        )
        .addBooleanOption(option => option.setName('sgb').setDescription('Filter by SGB support'))
        .addBooleanOption(option =>
          option.setName('battery').setDescription('Filter by battery backup')
        )
        .addBooleanOption(option => option.setName('timer').setDescription('Filter by timer'))
        .addBooleanOption(option => option.setName('rumble').setDescription('Filter by rumble'))
        .addStringOption(option =>
          option
            .setName('sort_by')
            .setDescription('Sort results by')
            .addChoices(
              { name: 'Relevance', value: 'relevance' },
              { name: 'Title', value: 'title' },
              { name: 'Year', value: 'year' },
              { name: 'Region', value: 'region' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('preserve_relevance')
            .setDescription('Keep relevance-based sorting when using other filters')
        )
        .addStringOption(opt =>
          opt
            .setName('mapper')
            .setDescription('Filter by cartridge mapper')
            .setRequired(false)
            .addChoices(
              { name: 'ROM Only', value: 'ROM Only' },
              { name: 'MBC1', value: 'MBC1' },
              { name: 'MBC2', value: 'MBC2' },
              { name: 'MBC3', value: 'MBC3' },
              { name: 'MBC5', value: 'MBC5' },
              { name: 'MBC6', value: 'MBC6' },
              { name: 'MBC7', value: 'MBC7' },
              { name: 'BANDAI TAMA5', value: 'BANDAI TAMA5' },
              { name: 'HuC1', value: 'HuC1' },
              { name: 'HuC3', value: 'HuC3' },
              { name: 'Pocket Camera', value: 'Pocket Camera' },
              { name: 'Unknown', value: 'Unknown' }
            )
        )
    )
    // Help subcommand
    .addSubcommand(sub => sub.setName('help').setDescription('Show help information'))
    // About subcommand
    .addSubcommand(sub => sub.setName('about').setDescription('Show information about the bot'))
    // Random subcommand
    .addSubcommand(sub =>
      sub
        .setName('random')
        .setDescription('Show a random ROM from the library')
        .addStringOption(option =>
          option
            .setName('region')
            .setDescription('Filter by region')
            .addChoices(
              { name: 'Any', value: 'any' },
              { name: 'USA', value: 'usa' },
              { name: 'Europe', value: 'europe' },
              { name: 'Japan', value: 'japan' },
              { name: 'World', value: 'world' },
              { name: 'Unlicensed', value: 'unlicensed' },
              { name: 'Pirate', value: 'pirate' }
            )
        )
        .addStringOption(option =>
          option
            .setName('cgb')
            .setDescription('Filter by CGB support')
            .addChoices(
              { name: 'Any', value: 'any' },
              { name: 'GB Only', value: 'gb' },
              { name: 'CGB Only', value: 'cgb' },
              { name: 'GB/CGB', value: 'both' }
            )
        )
        .addBooleanOption(option => option.setName('sgb').setDescription('Filter by SGB support'))
        .addBooleanOption(option =>
          option.setName('battery').setDescription('Filter by battery backup')
        )
        .addBooleanOption(option => option.setName('timer').setDescription('Filter by timer'))
        .addBooleanOption(option => option.setName('rumble').setDescription('Filter by rumble'))
        .addStringOption(opt =>
          opt
            .setName('mapper')
            .setDescription('Filter by cartridge mapper')
            .setRequired(false)
            .addChoices(
              { name: 'ROM Only', value: 'ROM Only' },
              { name: 'MBC1', value: 'MBC1' },
              { name: 'MBC2', value: 'MBC2' },
              { name: 'MBC3', value: 'MBC3' },
              { name: 'MBC5', value: 'MBC5' },
              { name: 'MBC6', value: 'MBC6' },
              { name: 'MBC7', value: 'MBC7' },
              { name: 'BANDAI TAMA5', value: 'BANDAI TAMA5' },
              { name: 'HuC1', value: 'HuC1' },
              { name: 'HuC3', value: 'HuC3' },
              { name: 'Pocket Camera', value: 'Pocket Camera' },
              { name: 'Unknown', value: 'Unknown' }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'search':
        await handleGameBoyBotSearch(interaction);
        break;

      case 'help':
        await interaction.reply({
          content:
            '**GB ROM Database Bot Help**\n\n' +
            '**Commands:**\n' +
            '`/dmgdb search <query>` - Search for a Game Boy ROM\n' +
            '`/dmgdb random` - Show a random ROM from the library\n' +
            '`/dmgdb help` - Show this help message\n' +
            '`/dmgdb about` - Show information about the bot\n\n' +
            '**Search & Random Options:**\n' +
            '• `query` - The game to search for (required for search)\n' +
            '• `region` - Filter by region (USA, Europe, Japan, etc.)\n' +
            '• `cgb` - Filter by CGB support (GB only, CGB only, or both)\n' +
            '• `sgb` - Filter by SGB support\n' +
            '• `battery` - Filter by battery backup\n' +
            '• `timer` - Filter by timer\n' +
            '• `rumble` - Filter by rumble\n' +
            '• `sort_by` - Sort results by relevance, title, year, or region (search only)\n' +
            '• `preserve_relevance` - Keep relevance-based sorting when using other filters (search only)\n' +
            '• `mapper` - Filter by cartridge mapper\n\n' +
            '**Features:**\n' +
            '• Automatic box art thumbnails from libretro-thumbnails\n' +
            ' — Game Boy: <https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy>; Game Boy Color: <https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy_Color>\n' +
            '• Smart title cleaning (removes region/SGB tags)\n' +
            '• Region emoji indicators\n' +
            '• Detailed ROM information (mapper, size, features)\n\n' +
            '**Examples:**\n' +
            '`/dmgdb search "Pokemon"` - Search for Pokemon games\n' +
            '`/dmgdb search "Zelda" region:usa` - Search for USA Zelda games\n' +
            '`/dmgdb search "Mario" cgb:both battery:true` - Search for CGB Mario games with battery backup\n' +
            '`/dmgdb random` - Get a random game\n' +
            '`/dmgdb random region:japan` - Get a random Japanese game\n' +
            '`/dmgdb random cgb:CGB Only sgb:true` - Get a random CGB Only game with SGB support (lol)',
          flags: MessageFlags.Ephemeral,
        });
        break;

      case 'about':
        await interaction.reply({
          content:
            '**GB ROM Database Bot**\n\n' +
            'A Discord bot for searching Game Boy ROM information.\n\n' +
            '**Features:**\n' +
            '• Search and filter Game Boy ROMs\n' +
            '• Get random games with filters\n' +
            '• View detailed ROM information\n' +
            '• Automatic box art thumbnails\n' +
            '• Smart title cleaning\n\n' +
            '**Data Sources:**\n' +
            '• ROM information source: <https://myrient.erista.me/>\n' +
            '• ROMs dumped by: No-Intro (<https://no-intro.org>)\n' +
            '• Box art from libretro-thumbnails:\n' +
            '  • Game Boy: <https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy>\n' +
            '  • Game Boy Color: <https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy_Color>\n\n' +
            `**Version:** ${version}\n` +
            '**Author:** krizdingus\n' +
            '**Website:** <https://krizdingus.com>\n' +
            '**GitHub:** <https://github.com/krizdingus/discord-gb-rom-bot>\n' +
            '**Instagram:** <https://www.instagram.com/krizdingus/>\n' +
            '**License:** MIT',
          flags: MessageFlags.Ephemeral,
        });
        break;

      case 'random':
        await handleRandomGame(interaction);
        break;
    }
  },
};
