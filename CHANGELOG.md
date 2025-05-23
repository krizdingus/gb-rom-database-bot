# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2024-03-19

### Fixed

- Fixed share button not working for random games by properly storing search state
- Fixed search state cleanup for random game results

## [1.0.4] - 2024-03-19

### Fixed

- Fixed slash commands not appearing in new servers
- Added command cleanup and verification scripts
- Improved command registration process
- Removed emojis from logging for better compatibility

### Added

- New `fix-commands.js` script for cleaning up guild-specific commands
- New `check-commands.js` script for verifying command registration status

## [1.0.3] - 2024-03-19

### Fixed

- Fixed intermittent "search expired" error when sharing results immediately after search
- Improved search state management and expiration handling
- Standardized share button IDs and interaction timestamps

## [1.0.2] - 2024-03-19

### Changed

- Updated README to use first person singular pronouns
- Removed emojis from documentation

## [1.0.1] - 2024-03-19

### Changed

- Code cleanup and formatting improvements
- Removed unused `updateResultsPage` function from `index.js`
- Removed redundant `gb-rom-database-bot.git` directory
- Added `.DS_Store` to `.gitignore` (was already there but file was tracked)

## [1.0.0] - 2024-03-19

### Added

- Initial release
- Discord bot for Game Boy ROM database lookup
- Fuzzy search functionality
- Region and feature filtering
- Rich embeds for ROM information
- Automatic ROM database generation
- Hot-reload capability for database updates
