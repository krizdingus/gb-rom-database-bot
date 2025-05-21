# GB ROM Database Bot Help

## Commands

- `/dmgdb search <query>` - Search for a Game Boy ROM
- `/dmgdb random` - Show a random ROM from the library
- `/dmgdb help` - Show this help message
- `/dmgdb about` - Show information about the bot

## Search & Random Options

- `query` - The game to search for (required for search)
- `region` - Filter by region (USA, Europe, Japan, etc.)
- `cgb` - Filter by CGB support (GB only, CGB only, or both)
- `sgb` - Filter by SGB support
- `battery` - Filter by battery backup
- `timer` - Filter by timer
- `rumble` - Filter by rumble
- `sort_by` - Sort results by relevance, title, year, or region (search only)
- `preserve_relevance` - Keep relevance-based sorting when using other filters (search only)
- `mapper` - Filter by cartridge mapper

## Features

- Automatic box art thumbnails from libretro-thumbnails
  - Game Boy: [Nintendo\_-_Game_Boy](https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy)
  - Game Boy Color: [Nintendo\_-_Game_Boy_Color](https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy_Color)
- Smart title cleaning (removes region/SGB tags)
- Region emoji indicators
- Detailed ROM information (mapper, size, features)

## Examples

- `/dmgdb search "Pokemon"` - Search for Pokemon games
- `/dmgdb search "Zelda" region:usa` - Search for USA Zelda games
- `/dmgdb search "Mario" cgb:both battery:true` - Search for CGB Mario games with battery backup
- `/dmgdb random` - Get a random game
- `/dmgdb random region:japan` - Get a random Japanese game
- `/dmgdb random cgb:CGB Only sgb:true` - Get a random CGB Only game with SGB support
