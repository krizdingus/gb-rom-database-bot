const test = require('node:test');
const assert = require('node:assert');

const search = require('../handlers/search');
const { displayRegion } = search;
const roms = require('../rom-list.json');

test.before(() => search.startCleanupInterval());
test.after(() => search.stopCleanupInterval());

function game(filename) {
  const rom = roms.find(r => r.filename === filename);
  assert.ok(rom, `fixture missing from rom-list.json: ${filename}`);
  return rom;
}

/** Run a search and return the matched results */
async function results(userId, options) {
  const interaction = {
    user: { id: userId },
    replied: false,
    deferred: false,
    isButton: () => false,
    options: {
      getString: name => (name in options ? options[name] : null),
      getBoolean: name => (name in options ? options[name] : null),
    },
    reply: async () => {},
    update: async () => {},
  };
  await search.handleGameBoyBotSearch(interaction);
  const state = search.activeSearches.get(userId);
  return state ? state.results : [];
}

test('a World release is not reported as Japanese', () => {
  // Byte 0x14A is a destination code, not a region: 0x00 means "Japan, and
  // possibly overseas". Tetris (World) sets it, and used to display "Japanese".
  const tetris = game('Tetris (World) (Rev 1)');
  assert.equal(tetris.region, 'Japanese', 'fixture should still have the Japanese byte');
  assert.equal(displayRegion(tetris), 'WORLD');
});

test('an actual Japanese release still reads Japan', () => {
  assert.equal(displayRegion(game('Tetris (Japan) (En)')), 'JAPAN');
});

test('multi-region releases list every region', () => {
  assert.equal(
    displayRegion(game('Pokemon - Red Version (USA, Europe) (SGB Enhanced)')),
    'USA, EUROPE'
  );
});

test('regions the token list was missing now resolve', () => {
  // These spellings exist in No-Intro names and used to fall through to the byte
  assert.equal(
    displayRegion(game('Barbie - Ocean Discovery (United Kingdom) (GB Compatible)')),
    'UNITED KINGDOM'
  );
  assert.equal(
    displayRegion(game('Pokemon - Red Version (Hong Kong) (SGB Enhanced) (Pirate)')),
    'HONG KONG'
  );
});

test('with no region in the filename, the header is used and labelled as such', () => {
  const rom = game('Calculator (Unknown) (Proto)');
  assert.equal(displayRegion(rom), 'Unknown (header: Japan)');
});

test('no entry anywhere still shows a raw destination code', () => {
  const raw = roms.filter(r => {
    const shown = displayRegion(r);
    return shown === 'Japanese' || shown === 'non-japanese';
  });
  assert.equal(raw.length, 0, `${raw.length} entries still show the raw header value`);
});

test('every entry gets a non-empty region', () => {
  for (const rom of roms) {
    const shown = displayRegion(rom);
    assert.ok(shown && shown.length > 0, `${rom.filename}: empty region`);
  }
});

test('only genuinely region-less entries fall back to the header', () => {
  const fallback = roms.filter(r => /^Unknown \(header/.test(displayRegion(r)));
  assert.equal(fallback.length, 10);
  // all of them are tagged (Unknown) in the filename, so the fallback is honest
  for (const rom of fallback) {
    assert.match(rom.filename, /\(Unknown\)/, `${rom.filename} should not need the fallback`);
  }
});

test('the World filter no longer matches any two parenthetical tags', async () => {
  // "(USA) (Proto)" used to count as World because the filter split every tag,
  // not just region tags. It matched 3,064 of 4,469 entries.
  const proto = game('10-Pin Bowling (USA) (Proto)');
  assert.equal(displayRegion(proto), 'USA');

  const matched = await results('r1', { query: '10-pin bowling', region: 'world' });
  assert.ok(
    !matched.some(r => r.filename === proto.filename),
    'a (USA) (Proto) release must not match region:world'
  );
});

test('an explicit World tag and a multi-region release both match World', async () => {
  const matched = await results('r2', { query: 'tetris', region: 'world' });
  assert.ok(
    matched.some(r => r.filename === 'Tetris (World) (Rev 1)'),
    'an explicit (World) release should match'
  );
  for (const rom of matched) {
    const tags = displayRegion(rom);
    assert.ok(
      tags.includes('WORLD') || tags.includes(','),
      `${rom.filename} matched World but shows ${tags}`
    );
  }
});

test('UK releases match region:europe', async () => {
  const matched = await results('r3', { query: 'barbie ocean discovery', region: 'europe' });
  assert.ok(
    matched.some(r => r.filename === 'Barbie - Ocean Discovery (United Kingdom) (GB Compatible)'),
    'a United Kingdom release should match region:europe'
  );
});

test('region sorting groups by what is displayed, not by the header byte', async () => {
  const matched = await results('r4', { query: 'pokemon', sort_by: 'region' });
  const shown = matched.map(displayRegion);
  assert.deepEqual(
    shown,
    [...shown].sort((a, b) => a.localeCompare(b))
  );
  // and it is finer than the two values the header can hold
  assert.ok(new Set(shown).size > 2, 'expected more than Japanese/non-japanese');
});
