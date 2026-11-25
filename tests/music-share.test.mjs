import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const SCRIPTS = ['../assets/js/player.js', '../assets/js/music.js'].map((path) => require.resolve(path));
const ORIGIN = 'https://sadensmol.com';
const FIRST = { id: 'first', href: '/music/first.mp3', title: 'First song' };
const SECOND = { id: 'second', href: '/music/second.mp3', title: 'Second song' };
const SAVED = { src: FIRST.href, title: FIRST.title, time: 30, playing: true };
const FAKED_GLOBALS = ['window', 'document', 'sessionStorage', 'navigator', 'history'];

let originals;
let warn;

beforeEach(() => {
  originals = FAKED_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  warn = mock.method(console, 'warn', () => {});
  mock.timers.enable({ apis: ['setTimeout'] });
});

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

class FakeElement {
  listeners = [];
  attributes = new Map();
  classes = new Set();
  children = {};
  textContent = '';
  hidden = false;

  constructor(attributes = {}) {
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  get classList() {
    return { toggle: (name, on) => (on ? this.classes.add(name) : this.classes.delete(name)) };
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  querySelector(selector) {
    return this.children[selector] ?? null;
  }

  addEventListener(type, listener) {
    this.listeners.push({ type, listener });
  }

  click(how = {}) {
    let prevented = false;
    const event = {
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...how,
      preventDefault: () => {
        prevented = true;
      },
    };
    for (const { type, listener } of this.listeners) if (type === 'click') listener(event);
    return prevented;
  }
}

// Like a real audio element: the events come after the call that causes them.
class FakeAudio extends FakeElement {
  paused = true;
  currentTime = 0;
  refusesPlay = false;
  loaded = false;

  set src(value) {
    this.attributes.set('src', value);
    this.load();
  }

  fire(type) {
    this[`on${type}`]?.();
    for (const each of this.listeners) if (each.type === type) each.listener();
  }

  fireLater(type) {
    queueMicrotask(() => this.fire(type));
  }

  load() {
    if (this.loaded) this.fireLater('emptied');
    this.loaded = this.hasAttribute('src');
    this.paused = true;
    this.currentTime = 0;
  }

  play() {
    if (this.refusesPlay) return Promise.reject(new DOMException('refused', 'NotAllowedError'));
    if (this.paused) this.fireLater('play');
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    if (!this.paused) this.fireLater('pause');
    this.paused = true;
  }

  finish() {
    this.paused = true;
    this.fire('pause');
    this.fire('ended');
  }
}

function rowsOf(songs) {
  return songs.map((song) => {
    const row = new FakeElement({ 'data-track-id': song.id });
    const play = new FakeElement({ href: song.href });
    play.textContent = song.title;
    const share = new FakeElement({ href: `/music/?play=${song.id}` });
    share.textContent = 'Share';
    const toggle = new FakeElement({ 'aria-label': `Play ${song.title}` });
    toggle.hidden = true;
    row.children = { '.track-toggle': toggle, '.track-play': play, '.track-share': share };
    return row;
  });
}

function openPage({ query = '', listed = [FIRST, SECOND], saved = null, refusesPlay = false, navigator = {} } = {}) {
  const audio = new FakeAudio();
  audio.refusesPlay = refusesPlay;
  const title = new FakeElement();
  const player = new FakeElement();
  player.hidden = true;
  player.children = { '.player-title': title, audio, '.player-close': new FakeElement() };
  const rows = rowsOf(listed);
  const window = new FakeElement();
  window.location = new URL(`/music/${query}`, ORIGIN);
  const history = {
    state: { kept: true },
    replaced: [],
    replaceState(...args) {
      this.replaced.push(args);
    },
  };
  const lists = {};
  function list(found) {
    lists['.track'] = found;
    lists['.track-play'] = found.map((row) => row.children['.track-play']);
  }
  list(rows);
  const globals = {
    window,
    document: {
      getElementById: (id) => (id === 'player' ? player : null),
      querySelectorAll: (selector) => lists[selector] ?? [],
    },
    sessionStorage: { getItem: () => saved && JSON.stringify(saved), setItem() {}, removeItem() {} },
    navigator,
    history,
  };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, value });
  for (const script of SCRIPTS) {
    delete require.cache[script];
    require(script);
  }
  return {
    audio,
    title,
    player,
    history,
    rows,
    close: player.children['.player-close'],
    shares: rows.map((row) => row.children['.track-share']),
    show(found, nextQuery = '') {
      list(found);
      rows.splice(0, rows.length, ...found);
      window.location = new URL(`/music/${nextQuery}`, ORIGIN);
      for (const { type, listener } of window.listeners) if (type === 'page:load') listener();
      return found.map((row) => row.children['.track-share']);
    },
  };
}

function clipboard({ refusal = null } = {}) {
  const written = [];
  return {
    written,
    navigator: {
      clipboard: {
        writeText: async (text) => {
          if (refusal) throw refusal;
          written.push(text);
        },
      },
    },
  };
}

function warnings() {
  return warn.mock.calls.map(({ arguments: [message] }) => message);
}

function song({ audio, title, player }) {
  return { src: audio.getAttribute('src'), title: title.textContent, time: audio.currentTime, paused: audio.paused, hidden: player.hidden };
}

const NO_SONG = { src: null, title: '', time: 0, paused: true, hidden: true };
const SECOND_STARTED = { src: SECOND.href, title: SECOND.title, time: 0, paused: false, hidden: false };

test('D-j Share hands the title and the absolute link to the browser', async () => {
  const shared = [];
  const copy = clipboard();
  const page = openPage({
    navigator: {
      ...copy.navigator,
      share: async (data) => {
        shared.push(data);
      },
    },
  });

  assert.equal(page.shares[1].click(), true);
  await nextTurn();

  assert.deepEqual(shared, [{ title: SECOND.title, url: `${ORIGIN}/music/?play=second` }]);
  assert.deepEqual([copy.written, page.shares[1].textContent, warnings()], [[], 'Share', []]);
});

test('D-j a cancelled share is ignored', async () => {
  let calls = 0;
  const page = openPage({
    navigator: {
      share: async () => {
        calls++;
        throw new DOMException('cancelled', 'AbortError');
      },
    },
  });

  page.shares[0].click();
  await nextTurn();

  assert.deepEqual([calls, warnings(), page.shares[0].textContent], [1, [], 'Share']);
});

test('D-j a failed share is logged once', async () => {
  const page = openPage({
    navigator: {
      share: async () => {
        throw new DOMException('refused', 'NotAllowedError');
      },
    },
  });

  page.shares[0].click();
  await nextTurn();

  assert.equal(warnings().length, 1);
  assert.match(warnings()[0], /share/);
});

test('D-j Share copies the absolute link and says Copied! for two seconds', async () => {
  const { navigator, written } = clipboard();
  const page = openPage({ navigator });

  assert.equal(page.shares[0].click(), true);
  await nextTurn();

  assert.deepEqual(written, [`${ORIGIN}/music/?play=first`]);
  assert.deepEqual(page.shares.map((link) => link.textContent), ['Copied!', 'Share']);
  mock.timers.tick(1999);
  assert.equal(page.shares[0].textContent, 'Copied!');
  mock.timers.tick(1);
  assert.equal(page.shares[0].textContent, 'Share');
});

test('D-j a second copy shows Copied! for two seconds again', async () => {
  const page = openPage(clipboard());
  page.shares[0].click();
  await nextTurn();
  mock.timers.tick(1500);

  page.shares[0].click();
  await nextTurn();
  mock.timers.tick(1999);

  assert.equal(page.shares[0].textContent, 'Copied!');
  mock.timers.tick(1);
  assert.equal(page.shares[0].textContent, 'Share');
});

for (const [name, navigator] of [
  ['a refused copy', clipboard({ refusal: new DOMException('refused', 'NotAllowedError') }).navigator],
  ['a missing clipboard', {}],
]) {
  test(`D-j ${name} is logged once and does not say Copied!`, async () => {
    const page = openPage({ navigator });

    assert.equal(page.shares[0].click(), true);
    await nextTurn();

    assert.equal(page.shares[0].textContent, 'Share');
    assert.equal(warnings().length, 1);
    assert.match(warnings()[0], /copy/);
  });
}

for (const [name, how] of [
  ['Ctrl', { ctrlKey: true }],
  ['Cmd', { metaKey: true }],
  ['Shift', { shiftKey: true }],
  ['Alt', { altKey: true }],
  ['a non-primary button', { button: 1 }],
]) {
  test(`D-j a click on Share with ${name} keeps the normal link behaviour`, async () => {
    const { navigator, written } = clipboard();
    const page = openPage({ navigator });

    const prevented = page.shares[0].click(how);
    await nextTurn();

    assert.deepEqual([prevented, written, page.shares[0].textContent], [false, [], 'Share']);
  });
}

test('D-k a known id starts its song and removes the query', () => {
  const page = openPage({ query: '?play=second#top' });

  assert.deepEqual(song(page), SECOND_STARTED);
  assert.deepEqual(page.history.replaced, [[{ kept: true }, '', '/music/#top']]);
});

test('D-k a known id starts from the beginning over a saved song', () => {
  assert.deepEqual(song(openPage({ query: '?play=second', saved: SAVED })), SECOND_STARTED);
});

test('D-k a known id restarts the same saved song from the beginning', () => {
  const page = openPage({ query: '?play=first', saved: SAVED });

  assert.deepEqual(song(page), { src: FIRST.href, title: FIRST.title, time: 0, paused: false, hidden: false });
});

for (const [name, query] of [
  ['an unknown id', '?play=third'],
  ['an empty id', '?play='],
  ['no id', ''],
]) {
  test(`D-k ${name} starts no song and keeps the address`, () => {
    const page = openPage({ query });

    assert.deepEqual(song(page), NO_SONG);
    assert.deepEqual(page.history.replaced, []);
  });

  test(`D-k ${name} keeps the saved song`, () => {
    const page = openPage({ query, saved: SAVED });

    assert.deepEqual(song(page), { src: FIRST.href, title: FIRST.title, time: 30, paused: false, hidden: false });
  });
}

test('D-k a refused start keeps the shared song visible and paused', async () => {
  const page = openPage({ query: '?play=second', refusesPlay: true });

  await nextTurn();

  assert.deepEqual(song(page), { ...SECOND_STARTED, paused: true });
  assert.equal(page.history.replaced.length, 1);
  assert.equal(warnings().length, 1);
  assert.match(warnings()[0], /start/);
});

test('E-h a share link followed inside the site starts its song and removes the query', () => {
  const page = openPage({ listed: [], saved: SAVED });

  page.show(rowsOf([FIRST, SECOND]), '?play=second');

  assert.deepEqual(song(page), SECOND_STARTED);
  assert.deepEqual(page.history.replaced, [[{ kept: true }, '', '/music/']]);
});

test('E-h a Music page opened inside the site without an id keeps the song', () => {
  const page = openPage({ listed: [], saved: SAVED });

  page.show(rowsOf([FIRST, SECOND]));

  assert.deepEqual(song(page), { src: FIRST.href, title: FIRST.title, time: 30, paused: false, hidden: false });
  assert.deepEqual(page.history.replaced, []);
});

test('E-f Share copies once on a Music page opened inside the site', async () => {
  const { navigator, written } = clipboard();
  const page = openPage({ navigator });
  const shares = page.show(rowsOf([FIRST, SECOND]));

  assert.equal(shares[1].click(), true);
  await nextTurn();

  assert.deepEqual([written, shares[1].textContent], [[`${ORIGIN}/music/?play=second`], 'Copied!']);
});

async function openSettled(options) {
  const page = openPage(options);
  await nextTurn();
  return page;
}

function toggleOf(page, index) {
  return page.rows[index].children['.track-toggle'];
}

function drawn({ rows }) {
  return rows.map((row) => [row.children['.track-toggle'].getAttribute('aria-label'), row.classes.has('playing')]);
}

const PLAY_FIRST = [`Play ${FIRST.title}`, false];
const PLAY_SECOND = [`Play ${SECOND.title}`, false];
const PAUSE_FIRST = [`Pause ${FIRST.title}`, true];
const PAUSE_SECOND = [`Pause ${SECOND.title}`, true];
const NONE_PLAYS = [PLAY_FIRST, PLAY_SECOND];
const FIRST_PLAYS = [PAUSE_FIRST, PLAY_SECOND];
const SECOND_PLAYS = [PLAY_FIRST, PAUSE_SECOND];
const FIRST_AT_30 = { src: FIRST.href, title: FIRST.title, time: 30, paused: false, hidden: false };

test('G-b the script shows the toggle of each row', async () => {
  const page = await openSettled();

  assert.deepEqual(page.rows.map((_, index) => toggleOf(page, index).hidden), [false, false]);
  assert.deepEqual(drawn(page), NONE_PLAYS);
});

test('G-b the script shows the toggles of a Music page opened inside the site', async () => {
  const page = await openSettled({ listed: [] });

  page.show(rowsOf([FIRST, SECOND]));

  assert.deepEqual(page.rows.map((_, index) => toggleOf(page, index).hidden), [false, false]);
});

test('G-c only the row of the playing song says Pause', async () => {
  const page = await openSettled();

  page.rows[1].children['.track-play'].click();
  await nextTurn();

  assert.deepEqual(drawn(page), SECOND_PLAYS);
});

test('G-d a toggle of another song starts it from the beginning', async () => {
  const page = await openSettled({ saved: SAVED });

  toggleOf(page, 1).click();
  await nextTurn();

  assert.deepEqual(song(page), SECOND_STARTED);
  assert.deepEqual(drawn(page), SECOND_PLAYS);
});

test('G-d a toggle of the playing song pauses it at its position', async () => {
  const page = await openSettled({ saved: SAVED });

  toggleOf(page, 0).click();
  await nextTurn();

  assert.deepEqual(song(page), { ...FIRST_AT_30, paused: true });
  assert.deepEqual(drawn(page), NONE_PLAYS);
});

test('G-d a toggle of the paused song continues at its position', async () => {
  const page = await openSettled({ saved: { ...SAVED, playing: false } });

  toggleOf(page, 0).click();
  await nextTurn();

  assert.deepEqual(song(page), FIRST_AT_30);
  assert.deepEqual(drawn(page), FIRST_PLAYS);
});

test('G-d a refused continue is logged once and the row says Play', async () => {
  const page = await openSettled({ saved: { ...SAVED, playing: false }, refusesPlay: true });

  toggleOf(page, 0).click();
  await nextTurn();

  assert.deepEqual(drawn(page), NONE_PLAYS);
  assert.deepEqual(song(page), { ...FIRST_AT_30, paused: true });
  assert.equal(warnings().length, 1);
  assert.match(warnings()[0], /start/);
});

test('G-d a toggle after the close starts its song again', async () => {
  const page = await openSettled({ saved: SAVED });
  page.close.click();
  await nextTurn();

  toggleOf(page, 0).click();
  await nextTurn();

  assert.deepEqual(song(page), { ...FIRST_AT_30, time: 0 });
  assert.deepEqual(drawn(page), FIRST_PLAYS);
});

test('G-e the rows follow a pause and a start in the header player', async () => {
  const page = await openSettled({ saved: SAVED });

  page.audio.pause();
  await nextTurn();
  const paused = drawn(page);
  page.audio.play();
  await nextTurn();

  assert.deepEqual([paused, drawn(page)], [NONE_PLAYS, FIRST_PLAYS]);
});

test('G-e the rows follow the close button', async () => {
  const page = await openSettled({ saved: SAVED });

  page.close.click();
  await nextTurn();

  assert.deepEqual(song(page), { ...NO_SONG, title: FIRST.title });
  assert.deepEqual(drawn(page), NONE_PLAYS);
});

test('G-e a replaced song that does not start leaves every row at Play', async () => {
  const page = await openSettled({ saved: SAVED });
  page.audio.refusesPlay = true;

  page.rows[1].children['.track-play'].click();
  await nextTurn();

  assert.deepEqual(drawn(page), NONE_PLAYS);
});

test('G-e the next song after the end is drawn', async () => {
  const page = await openSettled({ saved: SAVED });

  page.audio.finish();
  await nextTurn();

  assert.deepEqual(drawn(page), SECOND_PLAYS);
});

test('G-e a song that ends and has no next song shows Play', async () => {
  const page = await openSettled({ saved: SAVED });
  page.audio.onended = null;

  page.audio.finish();
  await nextTurn();

  assert.deepEqual(drawn(page), NONE_PLAYS);
});

for (const [name, options, expected] of [
  ['a restored playing song', { saved: SAVED }, FIRST_PLAYS],
  ['a restored paused song', { saved: { ...SAVED, playing: false } }, NONE_PLAYS],
  ['a shared song', { query: '?play=second' }, SECOND_PLAYS],
  ['a song that is not in the list', { saved: { ...SAVED, src: '/music/gone.mp3' } }, NONE_PLAYS],
]) {
  test(`G-e the first draw shows ${name}`, async () => {
    const page = await openSettled(options);

    assert.deepEqual(drawn(page), expected);
  });
}

test('G-e a Music page opened inside the site shows the playing song and stays in sync', async () => {
  const page = await openSettled({ listed: [], saved: SAVED });

  page.show(rowsOf([FIRST, SECOND]));
  const opened = drawn(page);
  page.audio.pause();
  await nextTurn();

  assert.deepEqual([opened, drawn(page)], [FIRST_PLAYS, NONE_PLAYS]);
});

test('G-e page loads add no listener to the audio element and each new toggle acts once', async () => {
  const page = await openSettled({ saved: SAVED });
  const before = page.audio.listeners.length;

  page.show(rowsOf([FIRST, SECOND]));
  page.show(rowsOf([FIRST, SECOND]));
  await nextTurn();
  toggleOf(page, 0).click();
  await nextTurn();

  assert.notEqual(before, 0);
  assert.equal(page.audio.listeners.length, before);
  assert.equal(song(page).paused, true);
});
