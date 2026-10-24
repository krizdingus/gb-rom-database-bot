# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-23

### Added

- **Build This Cart.** Look a game up and press the button: the embed swaps for a
  build sheet naming which Mouse Bite Labs board fits it, the smallest flash and
  SRAM chips it needs, the RAM jumper setting, and the parts to populate or omit.
  Back to Game returns. Works from `/dmgdb search` and `/dmgdb random`, and Share
  to Channel works on either view
- Games that cannot be built say so and why, rather than suggesting a board that
  won't work. 4,088 of 4,469 entries get a board; the rest are refused with a
  reason - 360 for mappers no board uses, 9 for unreadable headers, 9 for MBC1
  headers describing a cartridge the chip cannot address, 1 needing more save RAM
  than any MBC3 board provides, and 2 larger than every board
- `data/mbl-boards.json`, the board data, transcribed from the board READMEs
  rather than the index table in Game-Boy-Cartridges - that table's Max ROM column
  is the board's flash footprint, which for MBC1 and MBC3 is larger than the
  mapper can address
- `utils/cartridge.js`, the matching logic, with no discord.js dependency so the
  same rules can drive something other than a bot

### Fixed

- The Region field reported `Japanese` for 982 entries whose filename says
  somewhere else, `Tetris (World) (Rev 1)` among them. Byte 0x14A is a
  destination code, and `0x00` means "Japan, and possibly overseas" rather than
  "Japanese", so a World release setting it is correct hardware. The field now
  shows the No-Intro filename tags, which describe the actual release, and falls
  back to the byte only for the 10 entries with no region in their name - saying
  so when it does, as `Unknown (header: Japan)`
- `region:world` matched 3,064 of 4,469 entries, because the filter counted any
  two parenthetical tags: `(USA) (Proto)` qualified. It now counts region tags
  only, matching 1,214 - the 708 releases tagged `(World)` and 506 multi-region
  releases like `(USA, Europe)`
- `United Kingdom` and `Hong Kong` were missing from the region tokens, so seven
  releases fell back to the header byte for no reason. UK releases now also match
  `region:europe`
- `sort_by:region` sorts on the displayed region, so it groups by actual region
  rather than the two values the header byte can hold
- Documented examples used dropdown labels where a value is required:
  `cgb:CGB Only` has a space in it and `cgb:GB/CGB` is not a value either. Both
  are now `cgb:cgb` and `cgb:both`
- The README's headline example read `region:Europe`, which matched nothing
  because the choice value is lowercase. It returns 18 games as `region:europe`
- The `/dmgdb help` example pairing a Color-only game with Super Game Boy
  support no longer reads as a contradiction with a shrug. It still is one - and
  37 homebrew carts still claim both - so it now says that

### Notes

- MBC1's two jumper modes are exclusive: 2 MB of ROM with 64 Kbit of RAM, or
  512 KB with 256 Kbit. Boards carry both and the matcher picks the one that fits
- Two boards are deliberately left out: `GB-2DF4S-01A`, which the index table
  lists but which has no README or gerbers, and `GB-2KF4S-01A`, whose README
  opens with "DESIGN IS UNVERIFIED (but probably ok)". The MBC5 FRAM board is
  included but never recommended first and never offered for a Game Boy Color
  game, per its own README
- Boards rank newest first: Type A over Type B, single-game over multicart, SRAM
  over FRAM. Multicarts only report which slot size a game fits; the bot does not
  plan game combinations
- 37 rumble games are buildable but flagged, because no board drives the motor

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
