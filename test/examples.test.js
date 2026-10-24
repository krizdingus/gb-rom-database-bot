const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const command = require('../commands/gameboybot');
const search = require('../handlers/search');
const roms = require('../rom-list.json');

test.before(() => search.startCleanupInterval());
test.after(() => search.stopCleanupInterval());

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

/** Every choice value a subcommand option accepts, e.g. cgb -> [any, gb, cgb, both] */
function choiceValues(subcommand, option) {
  const sub = command.data.options.find(o => o.name === subcommand);
  const opt = sub.options.find(o => o.name === option);
  return opt.choices.map(c => c.value);
}

/** Pull `option:value` pairs out of a documented example line */
function optionsIn(text) {
  const found = [];
  const pattern = /\b(region|cgb|mapper|sort_by|sgb|battery|timer|rumble):([^\s`]+)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) found.push([match[1], match[2]]);
  return found;
}

/** The README's roadmap proposes subcommands that do not exist yet, on purpose,
 * so these checks read only the parts that document current behaviour. */
function readmeWithoutRoadmap() {
  const text = read('README.md');
  const start = text.indexOf('## Development Roadmap');
  const end = text.indexOf('## Data Sources');
  return start === -1 || end === -1 ? text : text.slice(0, start) + text.slice(end);
}

const SOURCES = {
  '/dmgdb help': JSON.stringify(command),
  'HELP.md': read('HELP.md'),
  'README.md': readmeWithoutRoadmap(),
};

test('every documented option value is one the command accepts', () => {
  const choiceOptions = ['region', 'cgb', 'mapper', 'sort_by'];
  const booleanOptions = ['sgb', 'battery', 'timer', 'rumble'];

  for (const [source, text] of Object.entries(SOURCES)) {
    for (const [option, value] of optionsIn(text)) {
      if (booleanOptions.includes(option)) {
        assert.ok(
          ['true', 'false'].includes(value),
          `${source}: ${option}:${value} is not a boolean`
        );
        continue;
      }
      if (!choiceOptions.includes(option)) continue;

      // search and random offer the same choices for these
      const sub = option === 'sort_by' ? 'search' : 'random';
      const valid = choiceValues(sub, option);
      assert.ok(
        valid.includes(value),
        `${source}: ${option}:${value} is not a valid value. Valid: ${valid.join(', ')}`
      );
    }
  }
});

test('no example uses a choice label where a value is required', () => {
  // "cgb:CGB Only" and "cgb:GB/CGB" are labels from the dropdown, not values,
  // and neither could be typed - "CGB Only" has a space in it.
  for (const [source, text] of Object.entries(SOURCES)) {
    assert.ok(!/cgb:CGB Only/.test(text), `${source} uses the label "CGB Only" rather than "cgb"`);
    assert.ok(!/cgb:GB\/CGB/.test(text), `${source} uses the label "GB/CGB" rather than "both"`);
    assert.ok(!/cgb:GB\/CBG/.test(text), `${source} has the GB/CBG typo`);
  }
});

test('the Color-only plus Super Game Boy example is still true', async () => {
  // The joke only works because the combination is real. If the data ever
  // changes, the help text claiming 37 should fail rather than quietly lie.
  const contradictory = roms.filter(r => r.cgbFlag === 'CGB Only' && r.sgbFlag === 'Yes');
  assert.equal(contradictory.length, 37);
  assert.ok(
    contradictory.every(r => /Aftermarket|\(Unl\)/.test(r.filename)),
    'the example says homebrew; every match should be homebrew or unlicensed'
  );

  for (const [source, text] of Object.entries(SOURCES)) {
    if (!/Color-only game with Super Game Boy/.test(text)) continue;
    assert.match(text, /37 homebrew carts/, `${source} should state the real count`);
  }
});

test('the documented filter combinations all return something', async () => {
  const cases = [
    ['search', { query: 'Pokemon' }],
    ['search', { query: 'Zelda', region: 'usa' }],
    ['search', { query: 'Mario', cgb: 'both', battery: true }],
    ['search', { query: 'Pokemon', region: 'europe', mapper: 'MBC3', battery: true }],
    ['random', {}],
    ['random', { region: 'japan' }],
    ['random', { cgb: 'cgb', sgb: true }],
    ['random', { cgb: 'both', sgb: false }],
  ];

  for (const [kind, options] of cases) {
    const captured = {};
    const interaction = {
      user: { id: 'ex' },
      replied: false,
      deferred: false,
      isButton: () => false,
      options: {
        getString: name => (name in options ? options[name] : null),
        getBoolean: name => (name in options ? options[name] : null),
      },
      reply: async payload => (captured.payload = payload),
      update: async payload => (captured.payload = payload),
    };

    if (kind === 'search') await search.handleGameBoyBotSearch(interaction);
    else await search.handleRandomGame(interaction);

    const label = `/dmgdb ${kind} ${JSON.stringify(options)}`;
    const content = captured.payload.content || '';
    assert.ok(!content.startsWith('An error occurred'), `${label} errored`);
    assert.ok(!/^No matches/.test(content), `${label} returned no matches`);
    assert.ok(!/No games match those filters/.test(content), `${label} matched no games`);
    search.activeSearches.delete('ex');
  }
});

test('the help text only names subcommands that exist', () => {
  const real = command.data.options.map(o => o.name);
  for (const [source, text] of Object.entries(SOURCES)) {
    const used = [...text.matchAll(/\/dmgdb (\w+)/g)].map(m => m[1]);
    for (const name of used) {
      assert.ok(real.includes(name), `${source} refers to /dmgdb ${name}, which does not exist`);
    }
  }
});
