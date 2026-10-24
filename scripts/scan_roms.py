#!/usr/bin/env python3
"""Scan a directory of Game Boy ROMs and write rom-list.json.

This replaces the original fetch_gb_roms.py, which scraped the Myrient archive.
Myrient shut down on 2026-03-31 and the scraper was written against its specific
HTML, so it could not be repointed at another source. The part worth keeping was
never the downloading - it was the cartridge header decoding, which is all here.

Point it at a folder of .gb/.gbc files, or of .zip archives containing them:

    python3 scripts/scan_roms.py ~/roms/gb --output rom-list.json

Files are named the way No-Intro names them, and the `filename` field is the ROM
filename with its extension removed. Nothing is downloaded and nothing is written
unless at least one ROM was read, so a mistyped path cannot empty your database.

Cartridge header layout: https://gbdev.io/pandocs/The_Cartridge_Header.html
"""

import argparse
import hashlib
import json
import logging
import os
import sys
import zipfile

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

HEADER_END = 0x150
ROM_EXTENSIONS = (".gb", ".gbc")

CGB_FLAGS = {
    0x00: "DMG",                # No CGB functionality
    0x80: "DMG+CGB",            # Supports both CGB and DMG
    0xC0: "CGB Only"            # CGB only
}

SGB_FLAGS = {
    0x00: "No",                 # No SGB functionality
    0x03: "Yes"                 # SGB functionality
}

CARTRIDGE_TYPES = {
    0x00: "ROM Only",
    0x01: "MBC1",
    0x02: "MBC1+RAM",
    0x03: "MBC1+RAM+Battery",
    0x05: "MBC2",
    0x06: "MBC2+Battery",
    0x08: "ROM+RAM",
    0x09: "ROM+RAM+Battery",
    0x0B: "MMM01",
    0x0C: "MMM01+RAM",
    0x0D: "MMM01+RAM+Battery",
    0x0F: "MBC3+Timer+Battery",
    0x10: "MBC3+Timer+RAM+Battery",
    0x11: "MBC3",
    0x12: "MBC3+RAM",
    0x13: "MBC3+RAM+Battery",
    0x19: "MBC5",
    0x1A: "MBC5+RAM",
    0x1B: "MBC5+RAM+Battery",
    0x1C: "MBC5+Rumble",
    0x1D: "MBC5+Rumble+RAM",
    0x1E: "MBC5+Rumble+RAM+Battery",
    0x20: "MBC6",
    0x22: "MBC7+Sensor+Rumble+RAM+Battery",
    0xFC: "Pocket Camera",
    0xFD: "BANDAI TAMA5",
    0xFE: "HuC3",
    0xFF: "HuC1+RAM+Battery"
}

# Byte 0x148. These are the sizes the header can express, not the file's length.
ROM_SIZES = {
    0x00: "32 KiB",
    0x01: "64 KiB",
    0x02: "128 KiB",
    0x03: "256 KiB",
    0x04: "512 KiB",
    0x05: "1 MiB",
    0x06: "2 MiB",
    0x07: "4 MiB",
    0x08: "8 MiB",
    0x52: "1.1 MiB",           # 72 banks of 16 KiB
    0x53: "1.2 MiB",           # 80 banks
    0x54: "1.5 MiB"            # 96 banks
}

# Byte 0x149. Note 0x05 is 64 KiB, which sorts out of order - that is correct.
RAM_SIZES = {
    0x00: "None",
    0x01: "2 KiB",
    0x02: "8 KiB",
    0x03: "32 KiB",
    0x04: "128 KiB",
    0x05: "64 KiB"
}

# Byte 0x14A. This is the destination code, not a region: plenty of cartridges
# whose filenames say USA or Europe still report 0x01, and some "(World)"
# releases report 0x00.
DESTINATION_CODES = {
    0x00: "Japanese",
    0x01: "non-japanese"
}


def calculate_header_checksum(header_bytes):
    """Checksum over 0x134-0x14C, the value the boot ROM verifies"""
    checksum = 0
    for i in range(0x134, 0x14D):
        checksum = (checksum - header_bytes[i] - 1) & 0xFF
    return checksum


def calculate_global_checksum(rom_data):
    """16-bit sum of every byte except the two checksum bytes themselves"""
    checksum = 0
    for i in range(len(rom_data)):
        if i != 0x14E and i != 0x14F:
            checksum = (checksum + rom_data[i]) & 0xFFFF
    return checksum


def read_header(rom_data, filename, calculate_checksums=True, calculate_md5=False):
    """Decode one ROM's cartridge header into a rom-list.json record.

    `filename` is the name the record is labelled with, extension already removed.
    Returns None if the data is too short to contain a header.
    """
    if len(rom_data) < HEADER_END:
        logger.warning("Skipping %s: only %d bytes, too short for a header", filename, len(rom_data))
        return None

    header_bytes = rom_data[0:HEADER_END]

    title = header_bytes[0x134:0x13F].decode("ascii", errors="replace").strip("\x00")
    cgb_flag = header_bytes[0x143]
    sgb_flag = header_bytes[0x146]
    cartridge_type = header_bytes[0x147]
    rom_size = header_bytes[0x148]
    ram_size = header_bytes[0x149]
    destination_code = header_bytes[0x14A]
    version = header_bytes[0x14C]
    header_checksum = header_bytes[0x14D]
    global_checksum = (header_bytes[0x14E] << 8) | header_bytes[0x14F]

    mapper_type = CARTRIDGE_TYPES.get(cartridge_type, f"Unknown (0x{cartridge_type:02X})")
    mapper_base = mapper_type.split('+')[0].strip()

    # Features come from the cartridge type, not from separate header bytes
    has_ram = "RAM" in mapper_type or cartridge_type == 0x05 or cartridge_type == 0x06  # MBC2 has internal RAM
    has_battery = "Battery" in mapper_type
    has_timer = "Timer" in mapper_type or cartridge_type in [0x0F, 0x10]
    has_rumble = "Rumble" in mapper_type or cartridge_type in [0x1C, 0x1D, 0x1E, 0x22]

    result = {
        "filename": filename,
        "rom_filename": None,  # filled in by the caller, which knows the real name
        "title": title,
        "cgbFlag": CGB_FLAGS.get(cgb_flag, f"Unknown (0x{cgb_flag:02X})"),
        "sgbFlag": SGB_FLAGS.get(sgb_flag, f"Unknown (0x{sgb_flag:02X})"),
        "region": DESTINATION_CODES.get(destination_code, f"Unknown (0x{destination_code:02X})"),
        "version": version,
        "romSize": ROM_SIZES.get(rom_size, f"Unknown (0x{rom_size:02X})"),
        "ramSize": RAM_SIZES.get(ram_size, f"Unknown (0x{ram_size:02X})"),
        "hasRam": has_ram,
        "mapper": mapper_base,
        "hasTimer": has_timer,
        "hasRumble": has_rumble,
        "hasBattery": has_battery,
        "headerChecksum": header_checksum,
        "globalChecksum": global_checksum
    }

    if calculate_checksums:
        result["headerChecksumValid"] = calculate_header_checksum(header_bytes) == header_checksum
        result["globalChecksumValid"] = calculate_global_checksum(rom_data) == global_checksum

    if calculate_md5:
        result["md5"] = hashlib.md5(rom_data).hexdigest()

    return result


def strip_extension(name):
    """Drop a single ROM extension. Deliberately not os.path.splitext, which cuts
    a name like 'Dr. Mario (World)' at its last period."""
    for ext in ROM_EXTENSIONS:
        if name.lower().endswith(ext):
            return name[: -len(ext)]
    return name


def scan_directory(root, calculate_checksums=True, calculate_md5=False, all_roms_in_zip=False):
    """Walk a directory for ROMs, including ones inside .zip archives"""
    records = []

    for dirpath, _dirnames, filenames in os.walk(root):
        for name in sorted(filenames):
            path = os.path.join(dirpath, name)
            lower = name.lower()

            if lower.endswith(ROM_EXTENSIONS):
                try:
                    with open(path, "rb") as handle:
                        data = handle.read()
                except OSError as err:
                    logger.error("Could not read %s: %s", path, err)
                    continue
                record = read_header(data, strip_extension(name), calculate_checksums, calculate_md5)
                if record:
                    record["rom_filename"] = name
                    records.append(record)

            elif lower.endswith(".zip"):
                try:
                    with zipfile.ZipFile(path) as archive:
                        members = [m for m in archive.infolist()
                                   if m.filename.lower().endswith(ROM_EXTENSIONS)]
                        if not members:
                            logger.warning("Skipping %s: no ROM inside", name)
                            continue
                        if not all_roms_in_zip:
                            members = members[:1]
                        for member in members:
                            data = archive.read(member)
                            rom_name = os.path.basename(member.filename)
                            record = read_header(
                                data, strip_extension(rom_name), calculate_checksums, calculate_md5
                            )
                            if record:
                                record["rom_filename"] = rom_name
                                records.append(record)
                except (zipfile.BadZipFile, OSError) as err:
                    logger.error("Could not read %s: %s", path, err)

    return records


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Scan a directory of Game Boy ROMs and write rom-list.json"
    )
    parser.add_argument("directory", help="Folder of .gb/.gbc files or .zip archives")
    parser.add_argument("--output", "-o", default="rom-list.json",
                        help="Output JSON file (default: rom-list.json)")
    parser.add_argument("--no-checksums", action="store_true",
                        help="Skip checksum verification, which reads every byte")
    parser.add_argument("--calculate-md5", action="store_true",
                        help="Add an md5 of each ROM")
    parser.add_argument("--all-roms-in-zip", action="store_true",
                        help="Read every ROM in a multi-ROM archive, not just the first")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    return parser.parse_args()


def main():
    args = parse_arguments()
    if args.verbose:
        logger.setLevel(logging.DEBUG)

    if not os.path.isdir(args.directory):
        logger.error("Not a directory: %s", args.directory)
        return 1

    logger.info("Scanning %s ...", args.directory)
    records = scan_directory(
        args.directory,
        calculate_checksums=not args.no_checksums,
        calculate_md5=args.calculate_md5,
        all_roms_in_zip=args.all_roms_in_zip,
    )

    # Never write an empty list over an existing database - a wrong path should
    # cost you nothing. This is the mistake the old fetch script could make.
    if not records:
        logger.error("No ROMs found in %s. %s was left alone.", args.directory, args.output)
        return 1

    records.sort(key=lambda r: r["filename"])

    with open(args.output, "w") as handle:
        json.dump(records, handle, indent=2)
        handle.write("\n")

    logger.info("Wrote %d records to %s", len(records), args.output)

    mappers = {}
    for record in records:
        mappers[record["mapper"]] = mappers.get(record["mapper"], 0) + 1
    logger.info("Mappers: %s", ", ".join(f"{k} {v}" for k, v in sorted(mappers.items())))

    return 0


if __name__ == "__main__":
    sys.exit(main())
