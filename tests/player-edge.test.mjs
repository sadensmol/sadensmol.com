import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const SCRIPT = require.resolve('../assets/js/player.js');
const SONG = { src: '/music/song.mp3', title: 'Song', time: 5, playing: true };

let originals;
let warn;

beforeEach(() => {
  originals = ['window', 'document', 'sessionStorage'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  warn = mock.method(console, 'warn', () => {});
});

afterEach(() => {
  mock.restoreAll();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

function element(extra = {}) {
  const handlers = {};
  return {
    handlers,
    textContent: '',
    addEventListener: (type, handler) => {
      handlers[type] = handler;
    },
    ...extra,
  };
}

// Like a real audio element, removing src does not unload the song: load() does.
function audioElement(refusesPlay) {
  let src = null;
  return {
    loaded: null,
    paused: true,
    currentTime: 0,
    set src(value) {
      src = value;
      this.loaded = value;
    },
    getAttribute: () => src,
    hasAttribute: () => src !== null,
    removeAttribute: () => {
      src = null;
    },
    load() {
      this.loaded = src;
      this.currentTime = 0;
      this.paused = true;
    },
    play() {
      if (refusesPlay) return Promise.reject(new DOMException('refused', 'NotAllowedError'));
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
}

function openPage({ state = null, failing = [], bar = true, refusesPlay = false } = {}) {
  const guarded = (operation, value) => () => {
    if (failing.includes(operation)) throw new Error(`storage refuses ${operation}`);
    return value;
  };
  const audio = audioElement(refusesPlay);
  const close = element();
  const link = element({ textContent: SONG.title, getAttribute: () => SONG.src });
  const player = element({
    hidden: true,
    querySelector: (selector) => ({ '.player-title': element(), audio, '.player-close': close })[selector],
  });
  const window = element();
  const globals = {
    window,
    document: {
      getElementById: () => (bar ? player : null),
      querySelectorAll: () => [link],
    },
    sessionStorage: {
      getItem: guarded('getItem', state && JSON.stringify(state)),
      setItem: guarded('setItem'),
      removeItem: guarded('removeItem'),
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  delete require.cache[SCRIPT];
  require(SCRIPT);
  return { audio, close, link, player, window };
}

function warnings() {
  return warn.mock.calls.map(({ arguments: [message] }) => message);
}

test('V13 a page without a bar adds no handlers', () => {
  const page = openPage({ bar: false });

  assert.deepEqual([page.link.handlers, page.window.handlers], [{}, {}]);
});

test('V10 the close button unloads the closed song', () => {
  const page = openPage({ state: SONG });
  assert.equal(page.audio.loaded, SONG.src);

  page.close.handlers.click();

  assert.deepEqual([page.audio.loaded, page.audio.paused, page.player.hidden], [null, true, true]);
});

for (const [operation, action, message] of [
  ['getItem', () => {}, /read/],
  ['setItem', (page) => page.window.handlers.pagehide(), /save/],
  ['removeItem', (page) => page.close.handlers.click(), /remove/],
]) {
  test(`V12 a refused ${operation} is logged once`, () => {
    const page = openPage({ state: SONG, failing: [operation] });

    action(page);

    assert.equal(warnings().length, 1);
    assert.match(warnings()[0], message);
  });
}

test('V8 a refused start is logged once', async () => {
  openPage({ state: SONG, refusesPlay: true });

  await nextTurn();

  assert.equal(warnings().length, 1);
  assert.match(warnings()[0], /start/);
});
