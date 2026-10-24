# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2026-10-23

### Fixed

- Restored 283 filenames that had been cut off at their last period, rebuilt from
  `rom_filename`. Dr. Mario and Dr. Franken were stored as "Dr", Mr. Do! and
  Mr. Driller as "Mr", E.T. as "E.T", and homebrew releases ended mid-tag like
  "Adulting! (World) (v2". The fetch script stripped the file extension twice;
  it no longer does
- `mapper:` on `/dmgdb search` replied "An error occurred while processing the
  command" for any query that had matches. It read the field off the wrong object,
  and had done since the first commit
- A search with no matches said "Found 0 matches. Did you mean:" above an empty
  "Page 1/0" with the Next button still clickable
- `sort_by:title` sorted on the 11-byte header title, so 007 sorted under
  "TWINE CGB"; `sort_by:region` sorted on the header destination code, which is
  only ever Japanese or non-japanese. Both now sort on what the embed shows
- A search matching exactly one game posted its embed publicly while every other
  reply stayed private
- `npm run update-roms` would have written an empty `rom-list.json` over a good
  one now that its source is offline, and an empty list counted as a successful
  load. It aborts and leaves the existing file alone
- `npm run update-roms` claimed to hot-reload the running bot's index and never
  could, being a separate process

### Added

- ROM and RAM sizes now show their bit equivalent: "32 KiB (256 Kbit)". Flash cart
  boards are labelled in bits, so this is the figure you need when setting RAM
  jumpers
- Reload `rom-list.json` in place by sending the bot SIGHUP, no restart needed
- `scripts/scan_roms.py`, which builds `rom-list.json` from a folder of ROMs or
  zip archives instead of from a website. It keeps the cartridge-header decoding
  the original scraper held and drops the downloading, which had nothing left to
  download. It will not write an empty list over a good one
- `docs/DATA.md`, documenting every field in `rom-list.json`, which header byte
  it comes from, the full value tables, and the known oddities in the data
- Links to the Mouse Bite Labs cartridge repos, which are what this is for

### Changed

- `DEBUG` is now off unless you set `DEBUG=true`. It was hardcoded on, printing
  about 13,400 lines for a single `/dmgdb random` with a `cgb` filter
- Dependencies are down to discord.js, dotenv and fuse.js. `node-fetch` is
  replaced by the built-in `fetch`, whose result is now cached; `@discordjs/rest`,
  `discord-api-types` and `eslint-plugin-react` were never used
- Requires Node 18+, which is what discord.js 14.16+ already required

### Removed

- `scripts/fetch_gb_roms.py` and `scripts/update-roms.js`, along with
  `npm run update-roms`. The scraper was written against Myrient's specific HTML
  and that archive is gone, so it could not be pointed at another source without
  being rewritten. `rom-list.json` is the database and ships with the repo
- The auto-generate-if-missing path in `loadRomData`, which could only have
  called the dead scraper. A missing `rom-list.json` now says so plainly
- `sort_by:year`, which sorted nothing: no entry has ever had a year field. The
  dead Year embed field went with it
- `commands/deploy.js`, a broken duplicate of the root `deploy.js`

## [1.0.5] - 2025-05-23

### Fixed

- Fixed share button not working for random games by properly storing search state
- Fixed search state cleanup for random game results

## [1.0.4] - 2025-05-23

### Fixed

- Fixed slash commands not appearing in new servers
- Added command cleanup and verification scripts
- Improved command registration process
- Removed emojis from logging for better compatibility

### Added

- New `fix-commands.js` script for cleaning up guild-specific commands
- New `check-commands.js` script for verifying command registration status

## [1.0.3] - 2025-05-22

### Fixed

- Fixed intermittent "search expired" error when sharing results immediately after search
- Improved search state management and expiration handling
- Standardized share button IDs and interaction timestamps

## [1.0.2] - 2025-05-21

### Changed

- Updated README to use first person singular pronouns
- Removed emojis from documentation

## [1.0.1] - 2025-05-21

### Changed

- Code cleanup and formatting improvements
- Removed unused `updateResultsPage` function from `index.js`
- Removed redundant `gb-rom-database-bot.git` directory
- Added `.DS_Store` to `.gitignore` (was already there but file was tracked)

## [1.0.0] - 2025-05-21

### Added

- Initial release
- Discord bot for Game Boy ROM database lookup
- Fuzzy search functionality
- Region and feature filtering
- Rich embeds for ROM information
- Automatic ROM database generation
