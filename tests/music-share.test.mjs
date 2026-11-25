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

class FakeAudio extends FakeElement {
  paused = true;
  currentTime = 0;
  refusesPlay = false;

  set src(value) {
    this.attributes.set('src', value);
    this.load();
  }

  load() {
    this.paused = true;
    this.currentTime = 0;
  }

  play() {
    if (this.refusesPlay) return Promise.reject(new DOMException('refused', 'NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

function openPage({ query = '', saved = null, refusesPlay = false, navigator = {} } = {}) {
  const audio = new FakeAudio();
  audio.refusesPlay = refusesPlay;
  const title = new FakeElement();
  const player = new FakeElement();
  player.hidden = true;
  player.children = { '.player-title': title, audio, '.player-close': new FakeElement() };
  const rows = [FIRST, SECOND].map((song) => {
    const row = new FakeElement({ 'data-track-id': song.id });
    const play = new FakeElement({ href: song.href });
    play.textContent = song.title;
    const share = new FakeElement({ href: `/music/?play=${song.id}` });
    share.textContent = 'Share';
    row.children = { '.track-play': play, '.track-share': share };
    return row;
  });
  const window = new FakeElement();
  window.location = new URL(`/music/${query}`, ORIGIN);
  const history = {
    state: { kept: true },
    replaced: [],
    replaceState(...args) {
      this.replaced.push(args);
    },
  };
  const lists = { '.track': rows, '.track-play': rows.map((row) => row.children['.track-play']) };
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
  const shares = rows.map((row) => row.children['.track-share']);
  return { audio, title, player, history, shares };
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
