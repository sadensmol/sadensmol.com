import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const SCRIPT = require.resolve('../assets/js/player.js');
const SECOND_SONG = { src: '/music/second.mp3', title: 'Second' };
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
  const added = [];
  return {
    handlers,
    added,
    textContent: '',
    addEventListener: (type, handler) => {
      added.push(type);
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

function linksOf(songs) {
  return songs.map((song) => element({ ariaCurrent: null, textContent: song.title, getAttribute: () => song.src }));
}

function openPage({ state = null, failing = [], bar = true, refusesPlay = false, songs = [SONG] } = {}) {
  const guarded = (operation, value) => () => {
    if (failing.includes(operation)) throw new Error(`storage refuses ${operation}`);
    return value;
  };
  const audio = audioElement(refusesPlay);
  const close = element();
  const title = element();
  let links = linksOf(songs);
  const player = element({
    hidden: true,
    querySelector: (selector) => ({ '.player-title': title, audio, '.player-close': close })[selector],
  });
  const window = element();
  const globals = {
    window,
    document: {
      getElementById: () => (bar ? player : null),
      querySelectorAll: () => links,
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
  return {
    audio,
    close,
    link: links[0],
    links,
    player,
    title,
    window,
    show(next) {
      links = next;
      window.handlers['page:load']();
      return { links };
    },
  };
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

function click(link) {
  link.handlers.click({ button: 0, preventDefault() {} });
}

function marks({ links }) {
  return links.map((link) => link.ariaCurrent);
}

// Like a real audio element, which is paused when a song ends.
function end(audio) {
  audio.paused = true;
  audio.currentTime = 100;
  audio.onended();
}

test('D-d no row is marked without a song', () => {
  assert.deepEqual(marks(openPage({ songs: [SONG, SECOND_SONG] })), [null, null]);
});

test('D-d a restored song marks its row', () => {
  assert.deepEqual(marks(openPage({ state: SONG, songs: [SECOND_SONG, SONG] })), [null, 'true']);
});

test('D-d a click moves the mark to the new row', () => {
  const page = openPage({ state: SONG, songs: [SONG, SECOND_SONG] });

  click(page.links[1]);

  assert.deepEqual(marks(page), [null, 'true']);
});

test('D-d the close button removes the mark', () => {
  const page = openPage({ state: SONG, songs: [SONG, SECOND_SONG] });
  assert.deepEqual(marks(page), ['true', null]);

  page.close.handlers.click();

  assert.deepEqual(marks(page), [null, null]);
});

for (const [name, current, next] of [
  ['the next song starts at the end of a song', SONG, SECOND_SONG],
  ['the first song starts at the end of the last song', SECOND_SONG, SONG],
  ['the first song starts at the end of a song outside the playlist', { src: '/music/gone.mp3', title: 'Gone' }, SONG],
]) {
  test(`D-e ${name}`, () => {
    const songs = [SONG, SECOND_SONG];
    const page = openPage({ state: { ...current, time: 5, playing: true }, songs });

    end(page.audio);

    const { audio, title, player } = page;
    assert.deepEqual([audio.loaded, title.textContent, audio.currentTime, audio.paused, player.hidden], [next.src, next.title, 0, false, false]);
    assert.deepEqual(marks(page), songs.map((song) => (song === next ? 'true' : null)));
  });
}

test('D-e a song stops at its end on a page without a playlist', () => {
  const { audio, player } = openPage({ state: SONG, songs: [] });
  assert.equal(audio.paused, false);

  end(audio);

  assert.deepEqual([audio.loaded, audio.paused, player.hidden], [SONG.src, true, false]);
});

function playing({ audio, title, player }) {
  return [audio.loaded, title.textContent, audio.currentTime, audio.paused, player.hidden];
}

test('E-g a page load keeps the song, its position and its state', () => {
  const page = openPage({ state: SONG, songs: [SONG, SECOND_SONG] });

  page.show([]);

  assert.deepEqual(playing(page), [SONG.src, SONG.title, SONG.time, false, false]);
  page.audio.pause();
  page.show(linksOf([SONG]));
  assert.deepEqual(playing(page), [SONG.src, SONG.title, SONG.time, true, false]);
});

test('E-g a page load marks the row of the current song', () => {
  const page = openPage({ state: SONG, songs: [] });

  assert.deepEqual(marks(page.show(linksOf([SECOND_SONG, SONG]))), [null, 'true']);
});

test('E-g a page load without a song marks no row', () => {
  const page = openPage({ songs: [] });

  assert.deepEqual(marks(page.show(linksOf([SONG, SECOND_SONG]))), [null, null]);
});

test('E-g a row of a page opened in place plays its song', () => {
  const page = openPage({ songs: [] });
  const next = page.show(linksOf([SONG, SECOND_SONG]));

  click(next.links[1]);

  assert.deepEqual(playing(page), [SECOND_SONG.src, SECOND_SONG.title, 0, false, false]);
  assert.deepEqual(marks(next), [null, 'true']);
});

test('E-g rows that stay over a page load are bound once', () => {
  const page = openPage({ songs: [SONG, SECOND_SONG] });

  page.show(page.links);

  assert.deepEqual(page.links.map(({ added }) => added), [['click'], ['click']]);
});

test('E-g the next song starts after the visitor left the playlist', () => {
  const page = openPage({ state: SONG, songs: [SONG, SECOND_SONG] });
  page.show([]);

  end(page.audio);

  assert.deepEqual(playing(page), [SECOND_SONG.src, SECOND_SONG.title, 0, false, false]);
});

test('E-g the last playlist that is not empty is the one that plays', () => {
  const third = { src: '/music/third.mp3', title: 'Third' };
  const page = openPage({ state: SONG, songs: [SONG, SECOND_SONG] });
  page.show(linksOf([SONG, third]));
  page.show([]);

  end(page.audio);

  assert.deepEqual(playing(page), [third.src, third.title, 0, false, false]);
});

test('E-g a page load in a tab that saw no playlist still lets the song stop at its end', () => {
  const page = openPage({ state: SONG, songs: [] });
  page.show([]);

  end(page.audio);

  assert.deepEqual(playing(page), [SONG.src, SONG.title, 100, true, false]);
});
