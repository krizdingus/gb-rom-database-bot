# rom-list.json

The database. 4,469 entries, one per ROM file, built from the No-Intro Game Boy
and Game Boy Color sets plus both Private sets. Every field except `filename` and
`rom_filename` is decoded from the cartridge header, which lives in the first
0x150 bytes of the ROM itself — not from the filename, and not from any external
catalogue.

Reference: [Pan Docs, The Cartridge Header](https://gbdev.io/pandocs/The_Cartridge_Header.html).

Rebuild it from ROMs you have with `python3 scripts/scan_roms.py /path/to/roms`.

## Fields

| Field                                              | Header byte     | What it is                                                    |
| -------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| `filename`                                         | —               | The ROM's filename with its extension removed                 |
| `rom_filename`                                     | —               | The ROM's filename as it is on disk. Box art is keyed on this |
| `title`                                            | `0x134`–`0x13E` | The 11-byte title the cartridge reports, e.g. `TWINE CGB`     |
| `cgbFlag`                                          | `0x143`         | Game Boy Color support                                        |
| `sgbFlag`                                          | `0x146`         | Super Game Boy support                                        |
| `region`                                           | `0x14A`         | The destination code. **Not a region** — see below            |
| `version`                                          | `0x14C`         | Revision number, usually 0                                    |
| `romSize`                                          | `0x148`         | ROM size the header declares                                  |
| `ramSize`                                          | `0x149`         | Save RAM size the header declares                             |
| `mapper`                                           | `0x147`         | Memory bank controller, base name only                        |
| `hasRam` / `hasBattery` / `hasTimer` / `hasRumble` | `0x147`         | Derived from the cartridge type                               |
| `headerChecksum`                                   | `0x14D`         | The stored checksum                                           |
| `globalChecksum`                                   | `0x14E`–`0x14F` | The stored 16-bit sum of the whole ROM                        |
| `headerChecksumValid` / `globalChecksumValid`      | —               | Whether the stored values match a recalculation               |

## Value tables

### `cgbFlag` — byte `0x143`

| Byte   | Value      |
| ------ | ---------- |
| `0x00` | `DMG`      |
| `0x80` | `DMG+CGB`  |
| `0xC0` | `CGB Only` |

Anything else is reported as `Unknown (0x..)`. 367 entries land here, and it is
not corruption: on cartridges predating the Game Boy Color this byte is still the
last character of the title. `Unknown (0x45)` is the letter `E`.

### `sgbFlag` — byte `0x146`

`0x00` is `No`, `0x03` is `Yes`.

### `region` — byte `0x14A`

| Byte   | Value          |
| ------ | -------------- |
| `0x00` | `Japanese`     |
| `0x01` | `non-japanese` |

This is the destination code and nothing finer. `0x00` does not mean "Japanese":
the spec is **Japan, and possibly overseas**, against `0x01` for overseas only. A
`(World)` release setting `0x00` is therefore correct hardware, not a bad dump.

982 entries set `0x00` while their filename names somewhere else — `Tetris
(World) (Rev 1)`, the Taiwanese unlicensed carts, and most homebrew. The bot
reports the No-Intro filename tags, which describe the actual release, and only
falls back to this byte for the 10 entries whose filename gives no region. When
it does fall back it says so: `Unknown (header: Japan)`.

### `romSize` — byte `0x148`

| Byte   | Value   |     | Byte   | Value              |
| ------ | ------- | --- | ------ | ------------------ |
| `0x00` | 32 KiB  |     | `0x06` | 2 MiB              |
| `0x01` | 64 KiB  |     | `0x07` | 4 MiB              |
| `0x02` | 128 KiB |     | `0x08` | 8 MiB              |
| `0x03` | 256 KiB |     | `0x52` | 1.1 MiB (72 banks) |
| `0x04` | 512 KiB |     | `0x53` | 1.2 MiB (80 banks) |
| `0x05` | 1 MiB   |     | `0x54` | 1.5 MiB (96 banks) |

The last three are 72, 80 and 96 banks of 16 KiB, which come out to clean 9, 10
and 12 Mbit. Multiplying the rounded byte figure gives the wrong answer, so they
are always looked up rather than calculated.

### `ramSize` — byte `0x149`

| Byte   | Value   | In bits  |
| ------ | ------- | -------- |
| `0x00` | `None`  | —        |
| `0x01` | 2 KiB   | 16 Kbit  |
| `0x02` | 8 KiB   | 64 Kbit  |
| `0x03` | 32 KiB  | 256 Kbit |
| `0x04` | 128 KiB | 1 Mbit   |
| `0x05` | 64 KiB  | 512 Kbit |

`0x05` being 64 KiB, out of order after 128 KiB, is correct and not a typo.
Flash cartridge hardware is labelled in bits, which is why the embed shows both.

### `mapper` — byte `0x147`

The byte names a cartridge type, not just a mapper: `0x10` is
`MBC3+Timer+RAM+Battery`. `mapper` stores the part before the first `+`, and the
feature booleans come from the rest.

| Byte   | Cartridge type         |     | Byte   | Cartridge type                 |
| ------ | ---------------------- | --- | ------ | ------------------------------ |
| `0x00` | ROM Only               |     | `0x19` | MBC5                           |
| `0x01` | MBC1                   |     | `0x1A` | MBC5+RAM                       |
| `0x02` | MBC1+RAM               |     | `0x1B` | MBC5+RAM+Battery               |
| `0x03` | MBC1+RAM+Battery       |     | `0x1C` | MBC5+Rumble                    |
| `0x05` | MBC2                   |     | `0x1D` | MBC5+Rumble+RAM                |
| `0x06` | MBC2+Battery           |     | `0x1E` | MBC5+Rumble+RAM+Battery        |
| `0x08` | ROM+RAM                |     | `0x20` | MBC6                           |
| `0x09` | ROM+RAM+Battery        |     | `0x22` | MBC7+Sensor+Rumble+RAM+Battery |
| `0x0B` | MMM01                  |     | `0xFC` | Pocket Camera                  |
| `0x0C` | MMM01+RAM              |     | `0xFD` | BANDAI TAMA5                   |
| `0x0D` | MMM01+RAM+Battery      |     | `0xFE` | HuC3                           |
| `0x0F` | MBC3+Timer+Battery     |     | `0xFF` | HuC1+RAM+Battery               |
| `0x10` | MBC3+Timer+RAM+Battery |     |        |                                |
| `0x11` | MBC3                   |     |        |                                |
| `0x12` | MBC3+RAM               |     |        |                                |
| `0x13` | MBC3+RAM+Battery       |     |        |                                |

MBC2 is the exception to `hasRam`: its 512×4 bits of save memory are inside the
mapper chip, so `0x05` and `0x06` report `hasRam: true` with no separate RAM size.

## Checksums

The header checksum is `x = x - byte - 1` across `0x134`–`0x14C`. The boot ROM
checks it and refuses to run the cartridge if it is wrong.

The global checksum is the 16-bit sum of every byte in the ROM except the two
checksum bytes themselves. Nothing on real hardware verifies it.

`headerChecksumValid` and `globalChecksumValid` record whether the stored values
survive a recalculation, so a bad dump is visible rather than silent.

## Known oddities in this data

These are properties of the cartridges, not mistakes in the scan:

- **367 entries report an undocumented `cgbFlag`** — that byte is part of the
  title on pre-Color cartridges.
- **982 entries set the Japan destination byte with a non-Japanese filename** —
  the byte means "Japan, and possibly overseas", so this is correct for a World
  release rather than an error.
- **28 entries report undocumented `romSize` or `ramSize` bytes**, mostly
  unlicensed and pirate carts that never followed the spec.
- **9 MBC1 entries declare a ROM/RAM combination the MBC1 cannot address** —
  1 MiB with 32 KiB. Four _Art School Pocket_ homebrew builds and the four
  _Pocket Monsters Gin/Kin_ Spaceworld 1997 demos.
- **The list is frozen at May 2025.** Nothing new gets in, because the source it
  was built from is offline.
