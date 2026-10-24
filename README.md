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
- [The Database](#the-database)
- [Usage Examples](#usage-examples)
- [Development Roadmap](#development-roadmap)
- [Data Sources](#data-sources)
- [Flash Cartridges](#flash-cartridges)
- [Contributing](#contributing)

## History & Development

1. **Data Sourcing**: I started by scanning the cartridge headers of the No-Intro Game Boy and Game Boy Color sets from the Myrient archive. Myrient shut down on 31 March 2026, so `rom-list.json` is frozen at its May 2025 copy: 4,469 entries, including both No-Intro Private sets, prototypes, unlicensed and homebrew releases. The scraper that built it is gone; `scripts/scan_roms.py` reads the same headers from a folder of ROMs instead.
2. **Indexing & Fuzzy Search**: I integrated Fuse.js to allow fuzzy matching—typos, partial titles, or "zelda" vs "dr mario" all just work.
3. **Flag & Feature Logic**: Handling region tags, unlicensed/pirate labels, multi-region titles, and inserting zero-width spaces after periods required some sneaky regex and utility functions. `utils/regions.js` picks the flag emoji; the filename-to-title work is `extractBaseTitle` in `loadRomData.js` and `cleanTitle` in `handlers/search.js`.
4. **Modular Architecture**: The codebase splits responsibilities cleanly:

   - `loadRomData.js` handles file loading, validation, and auto-generation if the JSON is missing.
   - `commands/gameboybot.js` (formerly `deploy.js`) defines the slash commands and options.
   - `handlers/search.js` and `handlers/buttons.js` process interactions, pagination, and back-navigation.
   - `scripts/scan_roms.py` rebuilds `rom-list.json` from a folder of ROMs.

5. **Iterative Refinement**: Over many rounds, I added filters for mapper types, CGB/SGB support, battery/timer/rumble flags, sorting options, and improved title normalization (reordering "`, The`" conventions).

## Features

- **Search** by title or filename with fuzzy matching
- **Random** ROM selection with the same filter options
- **Filters** for region, CGB/SGB support, battery, timer, rumble, mapper, and sorting
- **Rich embeds** showing mapper, ROM and RAM size in both bytes and bits, region, CGB/SGB support, and battery/timer/rumble flags
- **Private by default** - results are only visible to you until you hit Share to Channel
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

  - `scan_roms.py` — Python script to build the ROM list from a folder of ROMs
  - `fix-commands.js` — Cleanup tool for guild-specific commands
  - `check-commands.js` — Verification tool for command registration status

### Command Management Scripts

The bot includes two utility scripts for managing Discord slash commands:

#### `scripts/fix-commands.js`

Use this script when:

- Commands only appear in one server but not others
- You've switched from guild-specific to global commands
- You need to clean up old guild-specific commands

Run it with:

```bash
node scripts/fix-commands.js
```

#### `scripts/check-commands.js`

Use this script to:

- Verify which commands are registered globally
- Check for any remaining guild-specific commands
- Debug command registration issues

Run it with:

```bash
node scripts/check-commands.js
```

Note: Global commands can take a while to appear across Discord's servers. Guild commands update immediately.

## Prerequisites

- Node.js v18+ and npm
- Python 3.x for ROM list generation
- A Discord bot token with `applications.commands` scope

## Installation & Setup

1. Clone this repository.
2. Run `npm install`.
3. Create a `.env` with `BOT_TOKEN`, `CLIENT_ID`, and optional `GUILD_ID`.
4. Run `npm run deploy` to register commands. The bot does not register them on startup.
5. Start the bot with `npm start`.

`rom-list.json` ships with the repo. If it is missing the bot exits rather than running with no data.

### Deployment Modes

- **With `GUILD_ID` set**: Commands are registered instantly in that specific server, which is ideal for testing and development.
- **Without `GUILD_ID`**: Commands are registered globally, making them available on every server the bot is in. Guild commands update immediately; global ones can take longer to appear.

## The Database

`rom-list.json` **is** the database. It ships with the repo, 4,469 entries, and the bot reads it at startup. There is nothing to fetch and nothing to update: it was built from the No-Intro sets on the Myrient archive, which shut down on 31 March 2026.

If you want to build your own from ROMs you already have:

```bash
python3 scripts/scan_roms.py /path/to/roms --output rom-list.json
```

It reads `.gb` and `.gbc` files, and ROMs inside `.zip` archives, decodes each cartridge header, and writes the same format the bot expects. Name the files the way No-Intro does and you will get the same `filename` values. It refuses to write an empty list, so a mistyped path costs you nothing.

See [docs/DATA.md](docs/DATA.md) for what each field means and which header byte it comes from.

The running bot keeps the list it loaded at startup. To pick up a replacement:

- self-hosted: `kill -HUP $(pgrep -f 'node index.js')`
- hosted: restart or redeploy the service

## Usage Examples

```bash
/dmgdb search query:Pokemon region:Europe mapper:MBC3 battery:true
/dmgdb random cgb:GB/CGB sgb:false
```

## Development Roadmap

Below is a roughly sketched, wildly optimistic roadmap because who the hell knows when I'll get around to doing it?

### 1. Double-down on Chat-First Magic

- **Natural-Language Queries**  
  I'll make the bot understand "Hey, show me all Color-only Zelda games" without forcing people to remember flags and colons.
- **Interactive Filter Prompts**  
  After `/dmgdb search Mario`, I'll follow up with "Found 12 hits—wanna narrow by region, mapper, or features?" and let them click buttons instead of googling.
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

- ROM dumps: No-Intro (via Myrient archives, offline since 31 March 2026)
- Box art: [libretro-thumbnails](https://github.com/libretro-thumbnails)
- Prior art: [Catskull's GB ROM Database](https://catskull.net/gb-rom-database/)

## Flash Cartridges

Sizes are shown in bytes and bits because flash cart hardware is labelled in bits. On Mouse Bite Labs boards the RAM jumpers are silkscreened "64K" and "256K/1M", so a game listed as `32 KiB (256 Kbit)` wants the 256K setting.

- [Game Boy Cartridges](https://github.com/MouseBiteLabs/Game-Boy-Cartridges) — all current board variants
- [MBC1](https://github.com/MouseBiteLabs/Game-Boy-MBC1-Cartridge) · [MBC3](https://github.com/MouseBiteLabs/Game-Boy-MBC3-Cartridge) · [MBC5](https://github.com/MouseBiteLabs/Game-Boy-MBC5-Cartridge)
- [MBC3 Multicart](https://github.com/MouseBiteLabs/Game-Boy-MBC3-Multicart) · [MBC5 Multicart](https://github.com/MouseBiteLabs/Game-Boy-MBC5-Multicart)

## Contributing

Pull requests welcome! Run `npm run lint` and `npm run format` before submitting.

---

Created by krizdingus (Kris Williams)

- GitHub: https://github.com/krizdingus
- Website: https://krizdingus.com
- Instagram: https://www.instagram.com/krizdingus/
