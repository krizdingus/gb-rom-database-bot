const test = require('node:test');
const assert = require('node:assert');

const search = require('../handlers/search');
const { handleButtonInteraction } = require('../handlers/buttons');

const EPHEMERAL = 64;

test.before(() => search.startCleanupInterval());
test.after(() => search.stopCleanupInterval());

/** A stubbed button interaction that records what the handler did */
function button(id, userId) {
  const captured = {};
  return {
    captured,
    customId: id,
    user: { id: userId, toString: () => `<@${userId}>` },
    replied: false,
    deferred: false,
    isButton: () => true,
    message: { embeds: [{ title: 'placeholder' }] },
    channel: { send: async payload => (captured.sent = payload) },
    reply: async payload => (captured.reply = payload),
    update: async function (payload) {
      captured.update = payload;
      this.replied = true;
    },
    followUp: async payload => (captured.followUp = payload),
  };
}

/** Run a search as a command, leaving its state in place for button tests */
async function runSearch(userId, query) {
  const interaction = {
    user: { id: userId },
    replied: false,
    deferred: false,
    isButton: () => false,
    options: {
      getString: name => (name === 'query' ? query : null),
      getBoolean: () => null,
    },
    reply: async () => {},
    update: async () => {},
  };
  await search.handleGameBoyBotSearch(interaction);
  return search.activeSearches.get(userId);
}

const buttonIds = payload => payload.components[0].components.map(c => c.data.custom_id);

test('picking a game offers Share and a way back to the results', async () => {
  await runSearch('b1', 'pokemon red');
  const pick = button('select_1', 'b1');
  await handleButtonInteraction(pick);
  assert.deepEqual(buttonIds(pick.captured.update), ['share_to_channel', 'back_to_results']);
  assert.ok(pick.captured.update.embeds[0].data.fields.some(f => f.name === 'Mapper'));
});

test('paging moves through the results and back', async () => {
  await runSearch('b2', 'mario');
  const next = button('next_page', 'b2');
  await handleButtonInteraction(next);
  assert.match(next.captured.update.content, /Page 2\//);

  const prev = button('prev_page', 'b2');
  await handleButtonInteraction(prev);
  assert.match(prev.captured.update.content, /Page 1\//);
});

test('Back to Results returns to the list after picking a game', async () => {
  await runSearch('b3', 'zelda');
  await handleButtonInteraction(button('select_1', 'b3'));
  const back = button('back_to_results', 'b3');
  await handleButtonInteraction(back);
  assert.match(back.captured.update.content, /Found \d+ matches/);
});

test('a random game gets Share but no Back to Results, and stays private', async () => {
  const interaction = {
    user: { id: 'b4' },
    replied: false,
    deferred: false,
    isButton: () => false,
    options: { getString: () => null, getBoolean: () => null },
    reply: async payload => (interaction.payload = payload),
  };
  await search.handleRandomGame(interaction);
  assert.deepEqual(buttonIds(interaction.payload), ['share_to_channel']);
  assert.equal(interaction.payload.flags, EPHEMERAL);
});

test('sharing posts through the interaction webhook, not channel.send', async () => {
  await runSearch('b5', 'pokemon red');
  await handleButtonInteraction(button('select_1', 'b5'));

  const share = button('share_to_channel', 'b5');
  await handleButtonInteraction(share);
  assert.ok(share.captured.followUp, 'should post publicly via the interaction webhook');
  assert.ok(!share.captured.sent, 'should not have needed channel.send');
  assert.match(share.captured.update.content, /You shared/);
});

test('cancel clears the search state', async () => {
  await runSearch('b6', 'tetris');
  const cancel = button('cancel', 'b6');
  await handleButtonInteraction(cancel);
  assert.match(cancel.captured.update.content, /cancelled/i);
  assert.ok(!search.activeSearches.has('b6'));
});

test('a button on an expired search is told to search again', async () => {
  search.activeSearches.delete('b7');
  const stale = button('next_page', 'b7');
  await handleButtonInteraction(stale);
  assert.match(stale.captured.reply.content, /expired/);
  assert.equal(stale.captured.reply.flags, EPHEMERAL);
});
