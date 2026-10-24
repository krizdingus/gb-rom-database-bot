const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const zlib = require('node:zlib');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'scan_roms.py');
const roms = require('../rom-list.json');

/**
 * Build a Game Boy ROM with a given cartridge header. Everything outside the
 * header is zero, and both checksums are computed correctly, so a record read
 * back from this should report both as valid.
 */
function buildRom({
  title = 'TEST',
  cgb = 0x00,
  sgb = 0x00,
  cartridgeType = 0x00,
  romSize = 0x00,
  ramSize = 0x00,
  destination = 0x01,
  version = 0x00,
  bytes = 32 * 1024,
} = {}) {
  const rom = Buffer.alloc(bytes);
  rom.write(title.padEnd(11, '\0').slice(0, 11), 0x134, 'ascii');
  rom[0x143] = cgb;
  rom[0x146] = sgb;
  rom[0x147] = cartridgeType;
  rom[0x148] = romSize;
  rom[0x149] = ramSize;
  rom[0x14a] = destination;
  rom[0x14c] = version;

  let header = 0;
  for (let i = 0x134; i <= 0x14c; i++) header = (header - rom[i] - 1) & 0xff;
  rom[0x14d] = header;

  let global = 0;
  for (let i = 0; i < rom.length; i++) {
    if (i !== 0x14e && i !== 0x14f) global = (global + rom[i]) & 0xffff;
  }
  rom[0x14e] = (global >> 8) & 0xff;
  rom[0x14f] = global & 0xff;
  return rom;
}

/** Write ROMs into a fresh temp dir, scan it, return the parsed records */
function scan(files, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanroms-'));
  const out = path.join(dir, 'out.json');
  try {
    for (const [name, buffer] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), buffer);
    }
    execFileSync('python3', ['-I', SCRIPT, dir, '--output', out, ...args], { stdio: 'pipe' });
    return JSON.parse(fs.readFileSync(out, 'utf8'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A minimal stored zip containing one file, built without shelling out */
function zipOf(name, contents) {
  const nameBuf = Buffer.from(name, 'ascii');
  const crc = zlib.crc32 ? zlib.crc32(contents) : require('node:zlib').crc32(contents);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8); // stored, no compression
  local.writeUInt32LE(crc >>> 0, 14);
  local.writeUInt32LE(contents.length, 18);
  local.writeUInt32LE(contents.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(crc >>> 0, 16);
  central.writeUInt32LE(contents.length, 20);
  central.writeUInt32LE(contents.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);

  const localSize = local.length + nameBuf.length + contents.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBuf.length, 12);
  end.writeUInt32LE(localSize, 16);

  return Buffer.concat([local, nameBuf, contents, central, nameBuf, end]);
}

test('decodes a header the way the committed database was decoded', () => {
  // Reproduces Pokemon Red's stored record: MBC3+RAM+Battery, 1 MiB, 32 KiB,
  // SGB, DMG-only. If this drifts, the scanner and rom-list.json disagree.
  const records = scan({
    'Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb': buildRom({
      title: 'POKEMON RED',
      cgb: 0x00,
      sgb: 0x03,
      cartridgeType: 0x13,
      romSize: 0x05,
      ramSize: 0x03,
      destination: 0x01,
    }),
  });

  assert.equal(records.length, 1);
  const r = records[0];
  const real = roms.find(x => x.filename === 'Pokemon - Red Version (USA, Europe) (SGB Enhanced)');
  assert.ok(real, 'fixture missing from rom-list.json');

  for (const field of [
    'filename',
    'cgbFlag',
    'sgbFlag',
    'region',
    'romSize',
    'ramSize',
    'hasRam',
    'mapper',
    'hasTimer',
    'hasRumble',
    'hasBattery',
  ]) {
    assert.equal(r[field], real[field], `${field} does not match the committed record`);
  }
  assert.equal(r.rom_filename, 'Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb');
});

test('produces exactly the schema rom-list.json uses', () => {
  const records = scan({ 'Test (World).gb': buildRom() });
  assert.deepEqual(Object.keys(records[0]), Object.keys(roms[0]));
});

test('both checksums verify on a correctly built ROM', () => {
  const records = scan({ 'Test (World).gb': buildRom({ title: 'CHECKSUM' }) });
  assert.equal(records[0].headerChecksumValid, true);
  assert.equal(records[0].globalChecksumValid, true);
});

test('a corrupted header checksum is reported as invalid, not hidden', () => {
  const rom = buildRom({ title: 'BROKEN' });
  rom[0x14d] = (rom[0x14d] + 1) & 0xff;
  const records = scan({ 'Broken (World).gb': rom });
  assert.equal(records[0].headerChecksumValid, false);
});

test('filenames with periods keep everything after them', () => {
  // The original script ran splitext twice and cut 283 names at their last
  // period. These are the exact shapes that broke.
  const records = scan({
    'Dr. Mario (World).gb': buildRom({ title: 'DR.MARIO' }),
    'Armorines - Project S.W.A.R.M. (USA, Europe) (En,De).gbc': buildRom({ title: 'ARMORINES' }),
    'Adulting! (World) (v2.0) (Aftermarket) (Unl).gb': buildRom({ title: 'ADULTING' }),
  });

  const names = records.map(r => r.filename).sort();
  assert.deepEqual(names, [
    'Adulting! (World) (v2.0) (Aftermarket) (Unl)',
    'Armorines - Project S.W.A.R.M. (USA, Europe) (En,De)',
    'Dr. Mario (World)',
  ]);
});

test('reads ROMs out of zip archives, like a No-Intro set', () => {
  const records = scan({
    'Dr. Mario (World).zip': zipOf('Dr. Mario (World).gb', buildRom({ title: 'DR.MARIO' })),
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].filename, 'Dr. Mario (World)');
  assert.equal(records[0].rom_filename, 'Dr. Mario (World).gb');
});

test('every cartridge type decodes to the right mapper and features', () => {
  const cases = [
    [0x00, 'ROM Only', { hasRam: false, hasBattery: false, hasTimer: false, hasRumble: false }],
    [0x03, 'MBC1', { hasRam: true, hasBattery: true, hasTimer: false, hasRumble: false }],
    [0x06, 'MBC2', { hasRam: true, hasBattery: true, hasTimer: false, hasRumble: false }],
    [0x10, 'MBC3', { hasRam: true, hasBattery: true, hasTimer: true, hasRumble: false }],
    [0x1b, 'MBC5', { hasRam: true, hasBattery: true, hasTimer: false, hasRumble: false }],
    [0x1e, 'MBC5', { hasRam: true, hasBattery: true, hasTimer: false, hasRumble: true }],
    [
      0xfc,
      'Pocket Camera',
      { hasRam: false, hasBattery: false, hasTimer: false, hasRumble: false },
    ],
    [0xff, 'HuC1', { hasRam: true, hasBattery: true, hasTimer: false, hasRumble: false }],
  ];

  const files = {};
  for (const [type] of cases) files[`Type ${type} (World).gb`] = buildRom({ cartridgeType: type });
  const records = scan(files);

  for (const [type, mapper, features] of cases) {
    const r = records.find(x => x.filename === `Type ${type} (World)`);
    assert.ok(r, `no record for cartridge type 0x${type.toString(16)}`);
    assert.equal(r.mapper, mapper, `cartridge type 0x${type.toString(16)} mapper`);
    for (const [key, want] of Object.entries(features)) {
      assert.equal(r[key], want, `cartridge type 0x${type.toString(16)} ${key}`);
    }
  }
});

test('undocumented header bytes are reported, not guessed at', () => {
  const records = scan({
    'Weird (World).gb': buildRom({ cartridgeType: 0x99, romSize: 0xc8, ramSize: 0x32, cgb: 0x45 }),
  });
  const r = records[0];
  assert.equal(r.mapper, 'Unknown (0x99)');
  assert.equal(r.romSize, 'Unknown (0xC8)');
  assert.equal(r.ramSize, 'Unknown (0x32)');
  // 0x45 is "E" - on older carts this byte is still part of the title
  assert.equal(r.cgbFlag, 'Unknown (0x45)');
  // every one of these shapes appears in the committed database
  assert.ok(roms.some(x => x.romSize === 'Unknown (0xC8)'));
  assert.ok(roms.some(x => x.cgbFlag === 'Unknown (0x45)'));
});

test('a file too short to hold a header is skipped, not crashed on', () => {
  const records = scan({
    'Stub (World).gb': Buffer.alloc(64),
    'Good (World).gb': buildRom(),
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].filename, 'Good (World)');
});

test('an empty directory writes nothing and exits non-zero', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanroms-'));
  const out = path.join(dir, 'out.json');
  fs.writeFileSync(out, '[{"filename":"existing"}]');
  try {
    assert.throws(
      () => execFileSync('python3', ['-I', SCRIPT, dir, '--output', out], { stdio: 'pipe' }),
      /Command failed/
    );
    // the existing file must be untouched, not emptied
    assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), [{ filename: 'existing' }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('output is sorted by filename, like the committed database', () => {
  const records = scan({
    'Zelda (World).gb': buildRom(),
    'Alleyway (World).gb': buildRom(),
    'Mario (World).gb': buildRom(),
  });
  const names = records.map(r => r.filename);
  assert.deepEqual(names, [...names].sort());
});
