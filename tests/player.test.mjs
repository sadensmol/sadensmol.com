import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, test } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const SCRIPT = require.resolve('../assets/js/player.js');
const ORIGIN = 'https://sadensmol.com';
const KEY = 'player';
const FIRST = { href: '/music/first%20song.mp3', title: 'First song' };
const SECOND = { href: '/music/second%20song.mp3', title: 'Second song' };
const FAKED_GLOBALS = ['window', 'document', 'sessionStorage', 'addEventListener'];

let originals;
let storage;

beforeEach(() => {
  originals = FAKED_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  storage = new FakeStorage();
});

afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

class FakeStorage {
  values = new Map();
  failing = new Set();

  fail(operation) {
    this.failing.add(operation);
  }

  guard(operation) {
    if (this.failing.has(operation)) throw new Error(`storage refuses ${operation}`);
  }

  getItem(key) {
    this.guard('getItem');
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.guard('setItem');
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.guard('removeItem');
    this.values.delete(key);
  }
}

class FakeTarget {
  listeners = [];

  addEventListener(type, listener) {
    this.listeners.push({ type, listener });
  }

  dispatch(type, event = {}) {
    for (const entry of this.listeners.filter((each) => each.type === type)) {
      entry.listener.call(this, { type, target: this, currentTarget: this, ...event });
    }
  }
}

class FakeElement extends FakeTarget {
  attributes = new Map();
  textContent = '';
  children = {};

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  querySelector(selector) {
    return this.children[selector] ?? null;
  }

  get hidden() {
    return this.hasAttribute('hidden');
  }

  set hidden(value) {
    if (value) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }
}

class FakeAudio extends FakeElement {
  paused = true;
  playCalls = 0;
  refusesPlay = false;
  position = 0;

  get src() {
    return this.hasAttribute('src') ? new URL(this.getAttribute('src'), ORIGIN).href : '';
  }

  set src(value) {
    this.setAttribute('src', value);
  }

  setAttribute(name, value) {
    super.setAttribute(name, value);
    if (name === 'src') this.load();
  }

  get currentTime() {
    return this.position;
  }

  set currentTime(value) {
    if (!Number.isFinite(value)) throw new TypeError('currentTime must be finite');
    this.position = Math.max(0, value);
  }

  load() {
    this.paused = true;
    this.position = 0;
  }

  play() {
    this.playCalls++;
    if (this.refusesPlay) return Promise.reject(new DOMException('refused', 'NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

class FakeLink extends FakeElement {
  constructor({ href, title }) {
    super();
    this.setAttribute('href', href);
    this.textContent = title;
  }

  click(how = {}) {
    let prevented = false;
    this.dispatch('click', {
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...how,
      preventDefault: () => {
        prevented = true;
      },
    });
    return prevented;
  }
}

function openPage({ songs = [FIRST, SECOND], bar = true, refusesPlay = false } = {}) {
  const player = new FakeElement();
  player.hidden = true;
  const audio = new FakeAudio();
  audio.refusesPlay = refusesPlay;
  const title = new FakeElement();
  const close = new FakeElement();
  player.children = { '.player-title': title, audio, '.player-close': close };
  const links = songs.map((song) => new FakeLink(song));
  const window = new FakeTarget();
  const document = {
    getElementById: (id) => (bar && id === 'player' ? player : null),
    querySelectorAll: (selector) => (selector === '.track-play' ? links : []),
  };
  const sessionStorage = {
    configurable: true,
    get() {
      storage.guard('access');
      return storage;
    },
  };
  Object.defineProperty(window, 'sessionStorage', sessionStorage);
  const globals = {
    window: { configurable: true, value: window },
    document: { configurable: true, value: document },
    sessionStorage,
    addEventListener: { configurable: true, value: window.addEventListener.bind(window) },
  };
  Object.defineProperties(globalThis, globals);

  delete require.cache[SCRIPT];
  assert.doesNotThrow(() => require(SCRIPT));

  return {
    player,
    audio,
    title,
    close,
    links,
    window,
    leave: () => assert.doesNotThrow(() => window.dispatch('pagehide', { persisted: true })),
    show: (persisted) => {
      Object.defineProperties(globalThis, globals);
      assert.doesNotThrow(() => window.dispatch('pageshow', { persisted }));
    },
  };
}

function save(state) {
  storage.values.set(KEY, typeof state === 'string' ? state : JSON.stringify(state));
}

function saved() {
  return JSON.parse(storage.values.get(KEY) ?? 'null');
}

function stateOf(song, time, playing) {
  return { src: song.href, title: song.title, time, playing };
}

function assertBar(page, song, time, playing) {
  assert.deepEqual(
    {
      hidden: page.player.hidden,
      src: page.audio.src,
      title: page.title.textContent,
      time: page.audio.currentTime,
      playing: !page.audio.paused,
    },
    { hidden: false, src: `${ORIGIN}${song.href}`, title: song.title, time, playing },
  );
}

function assertIdle(page) {
  assert.deepEqual(
    { hidden: page.player.hidden, src: page.audio.src, playing: !page.audio.paused },
    { hidden: true, src: '', playing: false },
  );
}

test('AC6 a plain click plays the song in the bar without leaving the page', () => {
  const page = openPage();

  const prevented = page.links[0].click();

  assert.equal(prevented, true);
  assertBar(page, FIRST, 0, true);
});

test('AC6 a click on another song replaces the current song', () => {
  const page = openPage();
  page.links[0].click();
  page.audio.currentTime = 30;

  page.links[1].click();

  assertBar(page, SECOND, 0, true);
});

test('AC6 a click on the current song plays it from the start', () => {
  const page = openPage();
  page.links[0].click();
  page.audio.currentTime = 30;

  page.links[0].click();

  assertBar(page, FIRST, 0, true);
});

for (const [name, how] of [
  ['Ctrl', { ctrlKey: true }],
  ['Cmd', { metaKey: true }],
  ['Shift', { shiftKey: true }],
  ['Alt', { altKey: true }],
  ['a non-primary button', { button: 1 }],
]) {
  test(`AC6 a click with ${name} keeps the normal link behaviour`, () => {
    const page = openPage();

    assert.equal(page.links[0].click(how), false);
    assertIdle(page);

    assert.equal(page.links[0].click(), true);
    assertBar(page, FIRST, 0, true);
  });
}

test('AC7 a playing song continues on the next page at its position', () => {
  const first = openPage();
  first.links[1].click();
  first.audio.currentTime = 42.5;
  first.leave();

  const next = openPage({ songs: [] });

  assertBar(next, SECOND, 42.5, true);
});

test('AC7 leaving a page saves the state in the agreed shape', () => {
  const page = openPage();
  page.links[0].click();
  page.audio.currentTime = 12.25;

  page.leave();

  const state = saved();
  assert.notEqual(state, null);
  assert.deepEqual(
    { ...state, src: new URL(state.src, ORIGIN).pathname },
    stateOf(FIRST, 12.25, true),
  );
});

test('AC7 a restored song continues over several pages', () => {
  save(stateOf(FIRST, 10, true));
  const second = openPage({ songs: [] });
  second.audio.currentTime = 25;
  second.leave();

  const third = openPage({ songs: [] });

  assertBar(third, FIRST, 25, true);
});

test('AC7 a song saved at position zero is restored', () => {
  save(stateOf(FIRST, 0, true));

  assertBar(openPage(), FIRST, 0, true);
});

test('AC7 a page without a bar keeps the song for the next page', () => {
  save(stateOf(FIRST, 10, true));
  openPage({ bar: false }).leave();

  assertBar(openPage(), FIRST, 10, true);
});

test('AC7 a page without a current song saves nothing until a song starts', () => {
  const page = openPage();

  page.leave();
  assert.equal(saved(), null);

  page.links[0].click();
  page.leave();
  assert.notEqual(saved(), null);
});

test('AC8 a song paused by the visitor returns paused on the next page', () => {
  const first = openPage();
  first.links[0].click();
  first.audio.currentTime = 20;
  first.audio.pause();
  first.leave();

  const next = openPage();

  assertBar(next, FIRST, 20, false);
  assert.equal(next.audio.playCalls, 0);
});

test('AC8 a paused song stays paused over several pages', () => {
  save(stateOf(FIRST, 20, false));
  openPage({ songs: [] }).leave();

  const third = openPage();

  assertBar(third, FIRST, 20, false);
  assert.equal(third.audio.playCalls, 0);
});

test('AC8 a refused start keeps the bar visible and paused without an unhandled error', async () => {
  save(stateOf(FIRST, 33, true));

  const page = openPage({ refusesPlay: true });
  await nextTurn();

  assert.equal(page.audio.playCalls, 1);
  assertBar(page, FIRST, 33, false);
});

test('AC8 a refused start after a click keeps the bar visible and paused without an unhandled error', async () => {
  const page = openPage({ refusesPlay: true });

  page.links[0].click();
  await nextTurn();

  assert.equal(page.audio.playCalls, 1);
  assertBar(page, FIRST, 0, false);
});

test('AC9 leaving a page stops its sound', () => {
  const page = openPage();
  page.links[0].click();
  assert.equal(page.audio.paused, false);

  page.leave();

  assert.equal(page.audio.paused, true);
  assert.equal(saved()?.playing, true);
});

test('AC9 a kept page takes the latest saved state', () => {
  const kept = openPage();
  kept.links[0].click();
  kept.leave();
  save(stateOf(SECOND, 77, true));

  kept.show(true);

  assertBar(kept, SECOND, 77, true);
});

test('AC9 a kept page takes a state that was paused later', () => {
  const kept = openPage();
  kept.links[0].click();
  kept.leave();
  save(stateOf(FIRST, 50, false));

  kept.show(true);

  assertBar(kept, FIRST, 50, false);
});

test('AC9 a kept page without saved state stays silent and hides its bar', () => {
  const kept = openPage();
  kept.links[0].click();
  assertBar(kept, FIRST, 0, true);
  kept.leave();
  storage.values.clear();

  kept.show(true);

  assertIdle(kept);
});

test('AC9 a page that was not kept is not restored a second time', () => {
  save(stateOf(FIRST, 10, true));
  const page = openPage();
  page.audio.currentTime = 15;

  page.show(false);
  assertBar(page, FIRST, 15, true);

  page.show(true);
  assertBar(page, FIRST, 10, true);
});

test('AC10 the close button stops the song and the bar does not return', () => {
  const first = openPage();
  first.links[0].click();
  assertBar(first, FIRST, 0, true);
  first.leave();
  const second = openPage();
  assertBar(second, FIRST, 0, true);

  second.close.dispatch('click');

  assertIdle(second);
  assert.equal(saved(), null);
  second.leave();
  assertIdle(openPage());
});

test('AC10 a song can start again after the close', () => {
  const page = openPage();
  page.links[0].click();
  page.close.dispatch('click');
  assertIdle(page);

  page.links[1].click();

  assertBar(page, SECOND, 0, true);
});

test('AC10 the close button works when the storage refuses the removal', () => {
  const page = openPage();
  page.links[0].click();
  assertBar(page, FIRST, 0, true);
  storage.fail('removeItem');

  assert.doesNotThrow(() => page.close.dispatch('click'));

  assertIdle(page);
});

const INVALID_STATES = [
  ['broken JSON', '{"src":'],
  ['null', 'null'],
  ['a string', '"song"'],
  ['an empty object', '{}'],
  ['no src', { title: 'x', time: 1, playing: true }],
  ['a src of a wrong type', { ...stateOf(FIRST, 1, true), src: 5 }],
  ['a title of a wrong type', { ...stateOf(FIRST, 1, true), title: 5 }],
  ['a time of a wrong type', stateOf(FIRST, '1', true)],
  ['a null time', stateOf(FIRST, null, true)],
  ['a negative time', stateOf(FIRST, -1, true)],
  ['a non-finite time', `{"src":"${FIRST.href}","title":"x","time":1e999,"playing":true}`],
  ['a playing flag of a wrong type', stateOf(FIRST, 1, 'true')],
];

for (const [name, state] of INVALID_STATES) {
  test(`AC11 saved data with ${name} is ignored and a click still plays`, () => {
    save(state);

    const page = openPage();
    assertIdle(page);

    page.links[1].click();
    assertBar(page, SECOND, 0, true);
  });
}

test('AC11 a kept page treats invalid saved data as no state', () => {
  const kept = openPage();
  kept.links[0].click();
  assertBar(kept, FIRST, 0, true);
  kept.leave();
  save('{"src":');

  kept.show(true);

  assertIdle(kept);
});

for (const operation of ['access', 'getItem', 'setItem', 'removeItem']) {
  test(`AC11 a click plays when the storage refuses ${operation}`, () => {
    storage.fail(operation);

    const page = openPage();
    assert.doesNotThrow(() => page.links[0].click());
    assertBar(page, FIRST, 0, true);

    page.leave();
    assert.equal(page.audio.paused, true);
  });
}
