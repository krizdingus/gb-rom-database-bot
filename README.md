# GB ROM Database Bot

## Introduction

Welcome to GB ROM Database Bot. Inspired by Catskull's GB Rom Database, I wanted to improve on its UI, but by the time I got around to doing it I found that like 39 other people had already done so, including Catskull himself. So I figured I had better try something different. This bot brings the ROM database into Discord with intuitive slash commands, fuzzy title matching, rich embeds, and filters for region, mapper type, color/SGB support, battery/timer/rumble features, and more—so you can get the details you need instantly, right where you chat.

## Table of Contents

- [History & Development](#history--development)
- [Features](#features)
- [Commands](#commands)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Manual Database Updates](#manual-database-updates)
- [Usage Examples](#usage-examples)
- [Test Server](#test-server)
- [Development Roadmap](#development-roadmap)
- [Data Sources](#data-sources)
- [Contributing](#contributing)

## History & Development

1. **Data Sourcing**: I started by scanning the No-Intro Game Boy game dump headers from the Myrient archive using a Python script (fetch_gb_roms.py). That script generates rom-list.json.
2. **Indexing & Fuzzy Search**: I integrated Fuse.js to allow fuzzy matching—typos, partial titles, or "zelda" vs "dr mario" all just work.
3. **Flag & Feature Logic**: Handling region tags, unlicensed/pirate labels, multi-region titles, and inserting zero-width spaces after periods required some sneaky regex and utility functions in `utils/regions.js`.
4. **Modular Architecture**: The codebase splits responsibilities cleanly:

   - `loadRomData.js` handles file loading, validation, and auto-generation if the JSON is missing.
   - `commands/gameboybot.js` (formerly `deploy.js`) defines the slash commands and options.
   - `handlers/search.js` and `handlers/buttons.js` process interactions, pagination, and back-navigation.
   - `scripts/update-roms.js` wraps the Python fetch script for manual `npm run update-roms` updates and hot-reloads the index.

5. **Iterative Refinement**: Over many rounds, I added filters for mapper types, CGB/SGB support, battery/timer/rumble flags, sorting options, and improved title normalization (reordering "`, The`" conventions).

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

### Deployment Modes

- **With `GUILD_ID` set**: Commands are registered instantly in that specific server, which is ideal for testing and development.
- **Without `GUILD_ID`**: Commands are registered globally, making them available on any server where the bot is invited. Note that global command registration may take up to an hour to propagate across Discord's servers.

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

## Test Server

Want to try before you roll it out? Join my GB ROM Database Bot test server:

**Invite link:** https://discord.gg/qT8AqnMHDF  
**Server name:** GB ROM Database Test Server

In there you can run any `/dmgdb` commands, experiment with filters, and see all the features in action without touching your main community. Feel free to break things—this is a playground!

## Development Roadmap

Below is a roughly sketched, wildly optimistic roadmap because who the hell knows when I'll get around to doing it?

### 1. Double-down on Chat-First Magic

- **Natural-Language Queries**  
  I'll make the bot understand "Hey, show me all Color-only Zelda games" without forcing people to remember flags and colons.
- **Interactive Filter Prompts**  
  After `/dmgdb query Mario`, I'll follow up with "Found 12 hits—wanna narrow by region, mapper, or features?" and let them click buttons instead of googling.
- **Saved Searches & Watchlists**
  - `/dmgdb save favorites` to stash your go-to filters.
  - `/dmgdb watch Pokémon` so the bot DM's you whenever something new sneaks into the database.

### 2. Ecosystem Extras (For the Brave)

- **Optional Web Companion**  
  I'll create a static site (React + the same JSON index) for people who think Discord is "that Skype thing my kid uses."
- **Analytics Dashboard**  
  I'll track which games trigger the most existential crises in slash-command land—hook it up to a simple Google Sheet or tiny Express app.
- **Auto-Updating Database**  
  I'll schedule the Python fetch script via GitHub Actions so your ROM list refreshes while you're busy watching DBZ AMVs.

### 3. UX Tweaks for Chat Bots

- **Ephemeral vs. Shared**  
  I'll keep lookups private by default—only humble-brag when people actually care.
- **Conversational, Not Form-Filling**  
  I'll break massive commands into bite-sized Q&A with buttons. Fewer flags, more fun.
- **On-Demand Help**  
  `/dmgdb help filters` should feel like having a patient friend explain all the nerdy options without rolling their eyes.

### 4. Polish & Power-User Goodies

- **Advanced Sorting**  
  I'll add `sort_by:release_date`, `sort_by:romSize`, or even "most absurd title length."
- **Localization**  
  I'll let people query in mangled English or Spanish—because why not?
- **Mapper-Only Mode**  
  I'll queue up lists of MBC3 games, lump all those cryptic "Unknown (0x…)" mappers into one "Unknown" bucket.

---

> Disclaimer: None of this is set in stone. If you're a millennial who logged into Discord once in 2018, feel free to ignore half of it.

## Data Sources

- ROM dumps: No-Intro (via Myrient archives)
- Box art: libretro-thumbnails

## Contributing

Pull requests welcome! Run `npm run lint` and `npm run format` before submitting.

---

Created by krizdingus (Kris Williams)

- GitHub: https://github.com/krizdingus
- Website: https://krizdingus.com
- Instagram: https://www.instagram.com/krizdingus/
