# GB ROM Database Bot

## Introduction

Welcome to GB ROM Database Bot. Inspired by Catskull’s GB Rom Database, I wanted to improve on its UI, but by the time I got around to doing it I found that like 39 other people had already done so, including Catskull himself. So I figured I had better try something different. This bot brings the ROM database into Discord with intuitive slash commands, fuzzy title matching, rich embeds, and filters for region, mapper type, color/SGB support, battery/timer/rumble features, and more—so you can get the details you need instantly, right where you chat.

## History & Development

1. **Data Sourcing**: I started by pulling the No-Intro naming conventions from the Myrient archive using a Python script (`fetch_gb_roms.py`). That script generates `rom-list.json` with all 4,469 entries.
2. **Indexing & Fuzzy Search**: I integrated Fuse.js to allow fuzzy matching—typos, partial titles, or “zelda” vs “dr mario” all just work.
3. **Flag & Feature Logic**: Handling region tags, unlicensed/pirate labels, multi-region titles, and inserting zero-width spaces after periods required some sneaky regex and utility functions in `utils/regions.js`.
4. **Modular Architecture**: The codebase splits responsibilities cleanly:

   - `loadRomData.js` handles file loading, validation, and auto-generation if the JSON is missing.
   - `commands/gameboybot.js` (formerly `deploy.js`) defines the slash commands and options.
   - `handlers/search.js` and `handlers/buttons.js` process interactions, pagination, and back-navigation.
   - `scripts/update-roms.js` wraps the Python fetch script for manual `npm run update-roms` updates and hot-reloads the index.

5. **Iterative Refinement**: Over many rounds, we added filters for mapper types, CGB/SGB support, battery/timer/rumble flags, sorting options, and improved title normalization (reordering “`, The`” conventions).

## Features

- **Search** by title or filename with fuzzy matching
- **Random** ROM selection with the same filter options
- **Filters** for region, CGB/SGB support, battery, timer, rumble, mapper, and sorting
- **Rich embeds** showing hardware requirements, part footprints, and project links
- **Automatic** ROM database generation on first run
- **Hot-reload** of updated data via `npm run update-roms`
- **Graceful error handling**, caching, and pagination

## Commands

- `/dmgdb search` — Search for ROMs with optional filters
- `/dmgdb random` — Get a random ROM matching filters
- `/dmgdb help` — Show usage details
- `/dmgdb about` — Bot and author information

## Project Structure

- **index.js** — Entry point, loads data and starts the bot
- **bot.js** — Discord client setup and event wiring
- **commands/** — Slash-command definitions
- **handlers/** — Interaction logic for search, random, buttons
- **utils/regions.js** — Region and flag detection
- **loadRomData.js** — Data loading, validation, and auto-generation
- **scripts/** — Utility scripts:

  - `fetch_gb_roms.py` — Python script to produce the ROM list
  - `update-roms.js` — Node wrapper to rerun Python script and reload data

## Prerequisites

- Node.js v16.9.0+ and npm
- Python 3.x for ROM list generation
- A Discord bot token with `applications.commands` scope

## Installation & Setup

1. Clone this repository.
2. Run `npm install`.
3. Create a `.env` with `BOT_TOKEN`, `CLIENT_ID`, and optional `GUILD_ID`.
4. Run `npm run deploy` to register commands (or let the bot auto-deploy on startup).
5. Start the bot with `npm start`.

On first run, if `rom-list.json` is missing, the bot will auto-generate it. If generation fails, the process exits to avoid running without data.

## Manual Database Updates

To fetch and reload the latest ROM list anytime:

```bash
npm run update-roms
```

This wraps `fetch_gb_roms.py`, updates `rom-list.json`, and hot-reloads the in-memory index.

## Usage Examples

```bash
/dmgdb search query:Pokemon region:Europe mapper:MBC3 battery:true
/dmgdb random cgb:GB/CBG sgb:false
```

## Data Sources

- ROM dumps: No-Intro (via Myrient archives)
- Box art: libretro-thumbnails

## Contributing

Pull requests welcome! Run `npm run lint` and `npm run format` before submitting.

---

\*Created by krizdingus (Kris Williams) — GitHub: [https://github.com/krizdingus](https://github.com/krizdingus) | Website: [https://krizdingus.com](https://krizdingus.com) | Instagram: [https://www.instagram.com/krizdingus/](https://www.instagram.com/krizdingus/)
