#!/usr/bin/env python3

import urllib.request
import html.parser
import io
import zipfile
import json
import concurrent.futures
import tempfile
import logging
import argparse
import time
import hashlib
import os
import re
from urllib.parse import urljoin
from urllib.error import URLError, HTTPError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('gb_rom_parser')

# Lookup dictionaries for human-readable values
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
    0x52: "1.1 MiB",
    0x53: "1.2 MiB",
    0x54: "1.5 MiB"
}

RAM_SIZES = {
    0x00: "None",
    0x01: "2 KiB",
    0x02: "8 KiB",
    0x03: "32 KiB",
    0x04: "128 KiB",
    0x05: "64 KiB"
}

DESTINATION_CODES = {
    0x00: "Japanese",
    0x01: "non-japanese"
}


class DirectoryParser(html.parser.HTMLParser):
    """HTML Parser for directory listings"""
    
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.zip_files = []
        self.in_table = False
        self.in_link_td = False
        self.skip_row = False
        self.current_link = None
        self.current_link_text = ""
        self.skip_bios = True
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        if tag == 'table' and attrs_dict.get('id') == 'list':
            self.in_table = True
            return
            
        if not self.in_table:
            return
            
        if tag == 'tr':
            # Start with clean state for this row
            self.skip_row = False
            return
            
        if tag == 'th':
            # Mark this row to be skipped (it's a header row)
            self.skip_row = True
            return
            
        if tag == 'td' and attrs_dict.get('class') == 'link':
            self.in_link_td = True
            return
            
        if tag == 'a' and self.in_link_td and not self.skip_row:
            href = attrs_dict.get('href', '')
            if href.endswith('.zip'):
                self.current_link = {
                    'href': href,
                    'title': attrs_dict.get('title', '')
                }
                self.current_link_text = ""  # Reset link text
    
    def handle_data(self, data):
        # Capture link text as fallback for title
        if self.current_link is not None:
            self.current_link_text += data
    
    def handle_endtag(self, tag):
        if tag == 'table' and self.in_table:
            self.in_table = False
            
        if tag == 'tr':
            self.skip_row = False
            
        if tag == 'td' and self.in_link_td:
            self.in_link_td = False
            
        if tag == 'a' and self.current_link:
            # Use link text as fallback if title attribute is missing
            if not self.current_link['title'] and self.current_link_text:
                self.current_link['title'] = self.current_link_text.strip()
            
            # Clean up the title (remove file extension)
            title = self.current_link['title']
            title = os.path.splitext(title)[0]  # Remove .zip extension
            
            # Skip BIOS files if option is enabled
            if self.skip_bios and "[BIOS]" in title:
                logger.debug(f"Skipping BIOS file: {title}")
                self.current_link = None
                self.current_link_text = ""
                return
            
            self.current_link['title'] = title
            full_url = urljoin(self.base_url, self.current_link['href'])
            self.zip_files.append({
                'url': full_url,
                'filename': self.current_link['title']
            })
            self.current_link = None
            self.current_link_text = ""


def fetch_directory_listings(urls, skip_bios=True):
    """Fetch and parse the directory listings for each URL"""
    all_zip_files = []
    
    for url in urls:
        try:
            # Fetch the directory page
            with urllib.request.urlopen(url) as response:
                html_content = response.read().decode('utf-8')
            
            # Parse the HTML to extract ZIP files
            parser = DirectoryParser(url)
            parser.skip_bios = skip_bios
            parser.feed(html_content)
            parser.close()  # Good practice to close the parser
            
            # Add the found ZIP files to our list
            all_zip_files.extend(parser.zip_files)
            logger.info(f"Found {len(parser.zip_files)} ZIP files at {url}")
            
        except HTTPError as e:
            logger.error(f"HTTP Error fetching directory {url}: {e.code} {e.reason}")
        except URLError as e:
            logger.error(f"URL Error fetching directory {url}: {e.reason}")
        except Exception as e:
            logger.error(f"Error fetching directory {url}: {e}")
    
    return all_zip_files


def calculate_header_checksum(header_bytes):
    """Calculate the header checksum for validation"""
    checksum = 0
    for i in range(0x134, 0x14D):
        checksum = (checksum - header_bytes[i] - 1) & 0xFF
    return checksum


def calculate_global_checksum(rom_data):
    """Calculate the global checksum for validation"""
    # The global checksum is the 16-bit sum of all bytes except the 2 checksum bytes
    checksum = 0
    for i in range(len(rom_data)):
        # Skip the two global checksum bytes at 0x14E-0x14F
        if i != 0x14E and i != 0x14F:
            checksum = (checksum + rom_data[i]) & 0xFFFF
    return checksum


def calculate_md5(data):
    """Calculate MD5 hash for data"""
    return hashlib.md5(data).hexdigest()


def process_zip_file(zip_info, retry_count=2, calculate_checksum=True, calculate_md5=False, process_all_roms=False):
    """Download a ZIP file, extract ROM header data, and return a JSON object"""
    url = zip_info['url']
    filename = zip_info['filename']
    
    retries = 0
    while retries <= retry_count:
        try:
            # Use a temporary file to avoid loading the entire ZIP into memory
            with tempfile.TemporaryFile() as temp_file:
                # Stream the ZIP file to the temporary file
                with urllib.request.urlopen(url) as response:
                    chunk_size = 8192  # 8 KB chunks
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        temp_file.write(chunk)
                
                # Reset file pointer to beginning
                temp_file.seek(0)
                
                # Open the ZIP file from the temporary file
                try:
                    with zipfile.ZipFile(temp_file) as zip_file:
                        # Find all .gb or .gbc files in the ZIP
                        rom_files = [
                            file_info for file_info in zip_file.infolist() 
                            if file_info.filename.lower().endswith(('.gb', '.gbc'))
                        ]
                        
                        if not rom_files:
                            logger.warning(f"No ROM files found in {filename}")
                            return None
                        
                        # Check if we have multiple ROMs and log accordingly
                        if len(rom_files) > 1 and not process_all_roms:
                            logger.warning(f"Multiple ROM files found in {filename}, using only the first one")
                            rom_files = rom_files[:1]
                        
                        results = []
                        for rom_file in rom_files:
                            # Read the ROM data
                            with zip_file.open(rom_file) as f:
                                rom_data = f.read()
                                header_bytes = rom_data[0:0x150]
                            
                            # Extract header data
                            title_bytes = header_bytes[0x134:0x13F]
                            title = title_bytes.decode('ascii', errors='replace').strip('\x00')
                            
                            cgb_flag = header_bytes[0x143]
                            sgb_flag = header_bytes[0x146]
                            cartridge_type = header_bytes[0x147]
                            rom_size = header_bytes[0x148]
                            ram_size = header_bytes[0x149]
                            destination_code = header_bytes[0x14A]
                            old_licensee = header_bytes[0x14B]
                            version = header_bytes[0x14C]
                            header_checksum = header_bytes[0x14D]
                            global_checksum = (header_bytes[0x14E] << 8) | header_bytes[0x14F]
                            
                            # Calculate checksums if requested
                            header_checksum_valid = None
                            global_checksum_valid = None
                            if calculate_checksum:
                                calculated_header_checksum = calculate_header_checksum(header_bytes)
                                header_checksum_valid = calculated_header_checksum == header_checksum
                                
                                calculated_global_checksum = calculate_global_checksum(rom_data)
                                global_checksum_valid = calculated_global_checksum == global_checksum
                            
                            # Calculate MD5 hash if requested
                            md5_hash = None
                            if calculate_md5:
                                md5_hash = calculate_md5(rom_data)
                            
                            # Extract mapper information
                            mapper_type = CARTRIDGE_TYPES.get(cartridge_type, f"Unknown (0x{cartridge_type:02X})")
                            # Parse the mapper string to extract the base mapper name (MBC1, MBC2, etc.)
                            mapper_base = mapper_type.split('+')[0].strip()
                            
                            # Determine features from cartridge type
                            has_ram = "RAM" in mapper_type or cartridge_type == 0x05 or cartridge_type == 0x06  # MBC2 has internal RAM
                            has_battery = "Battery" in mapper_type
                            has_timer = "Timer" in mapper_type or cartridge_type in [0x0F, 0x10]
                            has_rumble = "Rumble" in mapper_type or cartridge_type in [0x1C, 0x1D, 0x1E, 0x22]
                            
                            # Build JSON object in the required format
                            result = {
                                "filename": os.path.splitext(filename)[0],  # Remove .zip extension
                                "rom_filename": rom_file.filename,
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
                            
                            # Add validation info if checksums were calculated
                            if header_checksum_valid is not None:
                                result["headerChecksumValid"] = header_checksum_valid
                            if global_checksum_valid is not None:
                                result["globalChecksumValid"] = global_checksum_valid
                            
                            # Add MD5 hash if calculated
                            if md5_hash:
                                result["md5"] = md5_hash
                            
                            results.append(result)
                        
                        # Return the single result or list of results
                        if process_all_roms:
                            return results
                        else:
                            return results[0] if results else None
                
                except zipfile.BadZipFile:
                    logger.warning(f"Bad ZIP file: {filename}")
                    return None
            
        except HTTPError as e:
            retries += 1
            if retries <= retry_count:
                logger.warning(f"HTTP Error downloading {filename}: {e.code} {e.reason}, retrying ({retries}/{retry_count})")
                time.sleep(1 * retries)  # Exponential backoff
            else:
                logger.error(f"HTTP Error downloading {filename}: {e.code} {e.reason}, giving up after {retry_count} retries")
                return None
                
        except URLError as e:
            retries += 1
            if retries <= retry_count:
                logger.warning(f"URL Error downloading {filename}: {e.reason}, retrying ({retries}/{retry_count})")
                time.sleep(1 * retries)  # Exponential backoff
            else:
                logger.error(f"URL Error downloading {filename}: {e.reason}, giving up after {retry_count} retries")
                return None
                
        except Exception as e:
            logger.error(f"Error processing {filename}: {e}")
            return None


def process_files_with_progress(zip_files, max_workers=8, calculate_checksums=True, 
                                calculate_md5=False, process_all_roms=False):
    """Process ZIP files in parallel with progress reporting"""
    results = []
    total_files = len(zip_files)
    completed = 0
    
    # Print initial message with cancel instructions
    logger.info(f"Starting to process {total_files} files. Press Ctrl+C to cancel at any time.")
    print(f"\n{'='*70}")
    print(f" Processing {total_files} ROM files. Press Ctrl+C at any time to cancel.")
    print(f"{'='*70}\n")
    
    start_time = time.time()
    last_update_time = start_time
    update_interval = 2  # Update progress every 2 seconds
    
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks and collect futures
            future_to_zip = {
                executor.submit(
                    process_zip_file, 
                    zip_info, 
                    calculate_checksum=calculate_checksums,
                    calculate_md5=calculate_md5,
                    process_all_roms=process_all_roms
                ): zip_info 
                for zip_info in zip_files
            }
            
            # Process results as they complete
            for future in concurrent.futures.as_completed(future_to_zip):
                zip_info = future_to_zip[future]
                try:
                    result = future.result()
                    completed += 1
                    
                    # Report progress more frequently based on time rather than just count
                    current_time = time.time()
                    if (current_time - last_update_time >= update_interval) or (completed == total_files):
                        last_update_time = current_time
                        elapsed = current_time - start_time
                        percent = completed / total_files * 100
                        
                        # Calculate ETA
                        if completed > 0:
                            avg_time_per_file = elapsed / completed
                            eta = avg_time_per_file * (total_files - completed)
                            eta_str = f"ETA: {int(eta // 60):02d}:{int(eta % 60):02d}"
                        else:
                            eta_str = "ETA: calculating..."
                        
                        # Format progress bar
                        bar_length = 40
                        filled_length = int(bar_length * completed // total_files)
                        bar = '█' * filled_length + '░' * (bar_length - filled_length)
                        
                        # Print progress on a new line
                        print(f"\r[{bar}] {completed}/{total_files} ({percent:.1f}%) - {eta_str}", end='', flush=True)
                    
                    if result:
                        if isinstance(result, list):
                            results.extend(result)
                        else:
                            results.append(result)
                            
                except Exception as e:
                    logger.error(f"\nError processing {zip_info['filename']}: {e}")
                    completed += 1
    
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user! Writing partial results...")
        logger.warning("\nInterrupted by user. Writing partial results...")
        return results
    
    # Print final newline to ensure next log message starts on a new line
    print("\n")
    
    return results


def load_config(config_file):
    """Load configuration from a JSON file"""
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading config file {config_file}: {e}")
        return None


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Fetch and parse Game Boy ROM headers from No-Intro archives')
    
    parser.add_argument('--output', '-o', type=str, default='rom-list.json',
                        help='Output JSON file (default: rom-list.json)')
    
    parser.add_argument('--threads', '-t', type=int, default=8,
                        help='Number of concurrent download threads (default: 8)')
    
    parser.add_argument('--no-checksums', action='store_true',
                        help='Skip header checksum verification')
    
    parser.add_argument('--calculate-md5', action='store_true',
                        help='Calculate MD5 hashes for each ROM (increases processing time)')
    
    parser.add_argument('--process-all-roms', action='store_true',
                        help='Process all ROMs in multi-ROM ZIP files (not just the first one)')
    
    parser.add_argument('--include-bios', action='store_true',
                        help='Include BIOS files in processing')
    
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose logging')
    
    parser.add_argument('--no-private', action='store_true',
                        help='Skip private collections')
    
    parser.add_argument('--config', '-c', type=str,
                        help='Path to config JSON file with custom URLs')
    
    return parser.parse_args()


def main():
    """Main function to coordinate the fetching and processing of ROM data"""
    # Parse command line arguments
    args = parse_arguments()
    
    # Set logging level based on verbosity
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # Print banner
    print("\n================================")
    print("  GB ROM Database Builder")
    print("================================\n")
    
    # Define URLs to fetch based on arguments or config file
    if args.config:
        config = load_config(args.config)
        if config and 'urls' in config:
            urls = config['urls']
            logger.info(f"Loaded {len(urls)} URLs from config file")
        else:
            logger.error("Invalid config file or missing 'urls' key")
            return
    else:
        # Default URLs
        base_urls = [
            "https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Game%20Boy/",
            "https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Game%20Boy%20Color/"
        ]
        
        private_urls = [
            "https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Game%20Boy%20(Private)/",
            "https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Game%20Boy%20Color%20(Private)/"
        ]
        
        urls = base_urls if args.no_private else base_urls + private_urls
    
    try:
        # Fetch directory listings
        print("\nFetching directory listings... (This may take a minute)")
        zip_files = fetch_directory_listings(urls, skip_bios=not args.include_bios)
        print(f"\nFound {len(zip_files)} total ZIP files\n")
        
        # Set up a handler for clean cancellation
        import signal
        def signal_handler(sig, frame):
            print("\n\nProcess interrupted by user. Writing partial results...")
            sys.exit(1)
        
        signal.signal(signal.SIGINT, signal_handler)
        
        # Process ZIP files in parallel with progress reporting
        print("Processing ZIP files (press Ctrl+C at any time to cancel and save partial results)...")
        results = process_files_with_progress(
            zip_files, 
            max_workers=args.threads,
            calculate_checksums=not args.no_checksums,
            calculate_md5=args.calculate_md5,
            process_all_roms=args.process_all_roms
        )
        
        # Sort results by filename for deterministic output
        results.sort(key=lambda x: x["filename"])
        
        # Write results to JSON file
        print(f"\nWriting {len(results)} records to {args.output}")
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"\nDone! ROM data written to {args.output}")
        
        # Print some stats
        rom_types = {}
        for rom in results:
            ext = os.path.splitext(rom.get("rom_filename", ""))[1].lower()
            rom_types[ext] = rom_types.get(ext, 0) + 1
        
        print("\nDatabase Statistics:")
        print(f"  Total ROMs: {len(results)}")
        for ext, count in rom_types.items():
            print(f"  {ext} files: {count}")
    
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
        # Results will be written from the process_files_with_progress function
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        print(f"\nError: {e}")


if __name__ == "__main__":
    # Import additional modules
    import sys
    main()