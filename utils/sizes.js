// utils/sizes.js

/**
 * Cartridge sizes are stored as byte strings, the way the ROM header defines them
 * and the way Catskull's database shows them. Flash cart hardware is labelled the
 * other way round: Mouse Bite Labs boards silkscreen their RAM jumpers "64K" and
 * "256K/1M", and their build docs quote RAM in Kbit or Mbit. Showing both means the
 * embed answers "how big is this game" and "which jumper setting do I need" at once.
 *
 * These are exact, not calculated. The odd 1.1/1.2/1.5 MiB ROM sizes are 72, 80 and
 * 96 banks of 16 KiB, which come out to clean 9, 10 and 12 Mbit - multiplying the
 * rounded byte figure would not.
 */
const BIT_SIZES = {
  '2 KiB': '16 Kbit',
  '8 KiB': '64 Kbit',
  '32 KiB': '256 Kbit',
  '64 KiB': '512 Kbit',
  '128 KiB': '1 Mbit',
  '256 KiB': '2 Mbit',
  '512 KiB': '4 Mbit',
  '1 MiB': '8 Mbit',
  '1.1 MiB': '9 Mbit',
  '1.2 MiB': '10 Mbit',
  '1.5 MiB': '12 Mbit',
  '2 MiB': '16 Mbit',
  '4 MiB': '32 Mbit',
  '8 MiB': '64 Mbit',
};

/**
 * Format a stored ROM or RAM size for display
 * @param {string} size - Size as stored in rom-list.json, e.g. "32 KiB"
 * @returns {string} The size with its bit equivalent, e.g. "32 KiB (256 Kbit)".
 *   Sizes with no bit equivalent - "None" and the "Unknown (0x..)" values that come
 *   from carts whose header byte isn't a documented size - are returned unchanged.
 */
function formatSize(size) {
  if (!size) return '';
  const bits = BIT_SIZES[size];
  return bits ? `${size} (${bits})` : size;
}

/**
 * The bit figure on its own, for callers that need to match against hardware
 * @param {string} size - Size as stored in rom-list.json
 * @returns {string|null} e.g. "256 Kbit", or null if there's no known equivalent
 */
function toBits(size) {
  return BIT_SIZES[size] || null;
}

module.exports = {
  formatSize,
  toBits,
};
