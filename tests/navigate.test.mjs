import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const SCRIPT = require.resolve('../assets/js/navigate.js');
const ORIGIN = 'https://sadensmol.com';
const ASSETS = ['/css/main.1.css', '/js/navigate.1.js'];
const SAVE_SCROLL_MS = 300;
const FAKED_GLOBALS = ['window', 'document', 'history', 'fetch', 'DOMParser'];

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

class FakeElement extends EventTarget {
  style = {};
  classes = new Set();
  focusCalls = [];

  constructor(name, attributes = {}) {
    super();
    this.name = name;
    this.attributes = new Map(Object.entries(attributes));
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

  focus(options) {
    this.focusCalls.push(options);
  }
}

function matches(element, selector) {
  const [, name, attribute, operator, value] = selector.match(/^(\w+)(?:\[(\w+)(?:(\^?=)"(.*)")?\])?$/);
  if (element.name !== name) return false;
  if (!attribute) return true;
  const actual = element.getAttribute(attribute);
  if (actual === null) return false;
  if (!operator) return true;
  return operator === '=' ? actual === value : actual.startsWith(value);
}

class FakeDocument extends EventTarget {
  ids = {};

  constructor({ title, tags = [], assets = ASSETS, active = null, main = true }) {
    super();
    this.title = title;
    this.tags = [
      ...assets.map((url) => (url.endsWith('.css') ? new FakeElement('link', { rel: 'stylesheet', href: url }) : new FakeElement('script', { src: url }))),
      ...tags.map(([name, attributes]) => new FakeElement(name, attributes)),
    ];
    this.menu = ['/', '/about/', '/skills/'].map((href) => new FakeElement('a', { href }));
    for (const link of this.menu) if (link.getAttribute('href') === active) link.classes.add('active');
    this.main = main ? new FakeElement('main') : null;
    if (this.main) {
      this.main.replaceWith = (next) => {
        this.main = next;
        next.replaceWith = (after) => {
          this.main = after;
        };
      };
    }
    this.head = {
      querySelectorAll: (selector) => this.querySelectorAll(selector),
      appendChild: (tag) => this.adopt(tag),
    };
  }

  adopt(tag) {
    this.tags.push(tag);
    tag.remove = () => {
      this.tags = this.tags.filter((each) => each !== tag);
    };
  }

  querySelector(selector) {
    assert.equal(selector, 'main');
    return this.main;
  }

  querySelectorAll(selector) {
    if (selector === 'body > header a') return this.menu;
    if (selector === 'body > header a.active') return this.menu.filter((link) => link.classes.has('active'));
    const found = this.tags.filter((tag) => selector.split(', ').some((each) => matches(tag, each)));
    for (const tag of found) tag.remove ??= () => {
      this.tags = this.tags.filter((each) => each !== tag);
    };
    return found;
  }

  getElementById(id) {
    return this.ids[id] ?? null;
  }

  active() {
    return this.menu.filter((link) => link.classes.has('active')).map((link) => link.getAttribute('href'));
  }
}

class FakeHistory {
  scrollRestoration = 'auto';
  index = 0;

  constructor(window, url, state) {
    this.window = window;
    this.entries = [{ url: new URL(url, ORIGIN).href, state }];
  }

  get current() {
    return new URL(this.entries[this.index].url);
  }

  get state() {
    return this.entries[this.index].state;
  }

  pushState(state, _, url) {
    this.entries = [...this.entries.slice(0, this.index + 1), { url: new URL(url, this.current).href, state }];
    this.index++;
  }

  replaceState(state, _, url) {
    this.entries[this.index] = { url: url === undefined ? this.current.href : new URL(url, this.current).href, state };
  }

  go(delta) {
    this.index += delta;
    this.window.dispatchEvent(new Event('popstate'));
  }
}

function openPage({ url = '/', state = null, page = {}, site = {}, held = false } = {}) {
  const document = new FakeDocument({ title: 'Home', active: '/', ...page });
  const window = new EventTarget();
  const history = new FakeHistory(window, url, state);
  const fullLoads = [];
  const requests = [];
  const loads = [];
  window.scrollY = 0;
  window.scrollTo = (_, top) => {
    window.scrollY = top;
  };
  window.location = {
    assign: (to) => fullLoads.push(`assign ${to}`),
    reload: () => fullLoads.push('reload'),
  };
  for (const part of ['origin', 'href', 'pathname', 'search', 'hash']) {
    Object.defineProperty(window.location, part, { get: () => history.current[part] });
  }

  const parsed = new Map();
  function fetch(to, { signal }) {
    return new Promise((resolve, reject) => {
      const answer = () => {
        const address = new URL(to);
        address.hash = '';
        const found = site[address.pathname + address.search] ?? {};
        if (found.refused) {
          reject(new TypeError('network error'));
          return;
        }
        const body = `body ${parsed.size}`;
        parsed.set(body, () => new FakeDocument({ title: `Page ${address.pathname}`, ...found }));
        resolve({
          ok: found.status === undefined,
          status: found.status ?? 200,
          url: found.url ?? address.href,
          headers: { get: (name) => (name === 'content-type' ? (found.type === undefined ? 'text/html; charset=utf-8' : found.type) : null) },
          text: async () => body,
        });
      };
      requests.push({ url: to, signal, answer });
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      if (!held) answer();
    });
  }

  const globals = {
    window,
    document,
    history,
    fetch,
    DOMParser: class {
      parseFromString(body, type) {
        assert.equal(type, 'text/html');
        return parsed.get(body)();
      }
    },
  };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  window.addEventListener('page:load', () => {
    loads.push({ title: document.title, address: history.current.pathname, scrollY: window.scrollY, focused: document.main.focusCalls.length });
  });

  delete require.cache[SCRIPT];
  require(SCRIPT);

  return { document, window, history, requests, fullLoads, loads, firstMain: document.main };
}

function click(href, { attributes = [], ...how } = {}) {
  const url = new URL(href, globalThis.history.current);
  const link = { hasAttribute: (name) => attributes.includes(name) };
  for (const part of ['href', 'origin', 'protocol', 'pathname', 'search']) link[part] = url[part];
  const event = new Event('click', { cancelable: true });
  const { prevented = false, ...fields } = how;
  Object.assign(event, { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...fields });
  Object.defineProperty(event, 'target', { value: { closest: (selector) => (selector === 'a[href]' ? link : null) } });
  if (prevented) event.preventDefault();
  globalThis.document.dispatchEvent(event);
  return event.defaultPrevented;
}

function scroll(page, top) {
  page.window.scrollY = top;
  page.window.dispatchEvent(new Event('scroll'));
}

function shown({ document, history, fullLoads }) {
  return { title: document.title, href: history.current.href.slice(ORIGIN.length), entries: history.entries.length, fullLoads };
}

test('E-b a click shows the fetched page in place and replaces main', async () => {
  const page = openPage();
  page.window.scrollY = 700;

  assert.equal(click('/about/'), true);
  await nextTurn();

  assert.deepEqual(shown(page), { title: 'Page /about/', href: '/about/', entries: 2, fullLoads: [] });
  assert.notEqual(page.document.main, page.firstMain);
  assert.deepEqual(page.requests.map(({ url }) => url), [`${ORIGIN}/about/`]);
});

test('E-d page:load comes once, after the swap, the address, the focus and the scroll', async () => {
  const page = openPage();
  page.window.scrollY = 700;

  click('/about/');
  await nextTurn();

  assert.deepEqual(page.loads, [{ title: 'Page /about/', address: '/about/', scrollY: 0, focused: 1 }]);
});

test('E-d the new main gets the focus without a scroll or an outline', async () => {
  const page = openPage();

  click('/about/');
  await nextTurn();

  const { main } = page.document;
  assert.deepEqual([main.focusCalls, main.getAttribute('tabindex'), main.style.outline], [[{ preventScroll: true }], '-1', 'none']);
});

test('E-d the page tags of the head are replaced and the others stay', async () => {
  const tags = (version) => [
    ['meta', { name: 'description', content: version }],
    ['meta', { name: 'author', content: version }],
    ['meta', { name: 'robots', content: version }],
    ['meta', { name: 'twitter:title', content: version }],
    ['meta', { property: 'og:title', content: version }],
    ['link', { rel: 'canonical', href: version }],
  ];
  const keywords = ['meta', { name: 'keywords', content: 'old' }];
  const viewport = ['meta', { name: 'viewport', content: 'stays' }];
  const page = openPage({ page: { tags: [...tags('old'), keywords, viewport] }, site: { '/about/': { tags: tags('new') } } });

  click('/about/');
  await nextTurn();

  const left = page.document.tags.slice(ASSETS.length).map((tag) => Object.fromEntries(tag.attributes));
  assert.deepEqual(left, [viewport, ...tags('new')].map(([, attributes]) => attributes));
});

test('E-d the menu marks the same links as the fetched page', async () => {
  const page = openPage({ site: { '/about/': { active: '/about/' } } });
  assert.deepEqual(page.document.active(), ['/']);

  click('/about/');
  await nextTurn();

  assert.deepEqual(page.document.active(), ['/about/']);
});

for (const [name, hash, id] of [
  ['a hash', '#part', 'part'],
  ['an encoded hash', '#%D0%B3%D0%BB%D0%B0%D0%B2%D0%B0', 'глава'],
]) {
  test(`E-d ${name} scrolls to its element`, async () => {
    const page = openPage();
    page.document.ids[id] = { scrollIntoView: () => page.window.scrollTo(0, 420) };

    click(`/about/${hash}`);
    await nextTurn();

    assert.deepEqual([page.window.scrollY, shown(page).href], [420, `/about/${hash}`]);
  });
}

for (const [name, hash, warnings] of [
  ['an unknown hash', '#gone', 0],
  ['a hash that cannot be decoded', '#%E0%A4%A', 1],
]) {
  test(`E-d ${name} scrolls to the top`, async () => {
    const page = openPage();
    page.window.scrollY = 700;

    click(`/about/${hash}`);
    await nextTurn();

    assert.deepEqual([page.window.scrollY, page.loads.length, page.fullLoads, warn.mock.callCount()], [0, 1, [], warnings]);
  });
}

test('E-d a link to the open page adds no history entry', async () => {
  const page = openPage({ url: '/about/' });

  click('/about/');
  await nextTurn();

  assert.deepEqual([page.loads.length, shown(page).entries], [1, 1]);
});

test('E-d a redirect shows the final address with the hash of the link', async () => {
  const page = openPage({ site: { '/about': { url: `${ORIGIN}/about/` } } });

  click('/about#part');
  await nextTurn();

  assert.deepEqual([shown(page).href, page.fullLoads], ['/about/#part', []]);
});

for (const [name, href, how] of [
  ['a click with Ctrl', '/about/', { ctrlKey: true }],
  ['a click with Cmd', '/about/', { metaKey: true }],
  ['a click with Shift', '/about/', { shiftKey: true }],
  ['a click with Alt', '/about/', { altKey: true }],
  ['a click with a non-primary button', '/about/', { button: 1 }],
  ['a link with a target', '/about/', { attributes: ['target'] }],
  ['a download link', '/about/', { attributes: ['download'] }],
  ['another origin', 'https://example.com/about/'],
  ['a mail link', 'mailto:a@example.com'],
  ['a hash of the open page', '/#top'],
  ['an empty hash of the open page', '/#'],
  ['an mp3 file', '/music/song.mp3'],
  ['an xml feed', '/posts/index.xml'],
  ['a json file', '/posts/index.json'],
  ['an image in capitals', '/images/a.PNG'],
]) {
  test(`E-c the browser handles ${name}`, async () => {
    const page = openPage();

    const prevented = click(href, how);
    await nextTurn();

    assert.deepEqual([prevented, page.requests, page.loads], [false, [], []]);
    click('/about/');
    await nextTurn();
    assert.equal(page.loads.length, 1);
  });
}

test('E-c a click that another script handled is left alone', async () => {
  const page = openPage();

  click('/about/', { prevented: true });
  await nextTurn();

  assert.deepEqual([page.requests, shown(page).title], [[], 'Home']);
  click('/about/');
  assert.equal(page.requests.length, 1);
});

for (const [name, href] of [
  ['an html path', '/about/index.HTML'],
  ['a path with a dot in a folder', '/v1.2/notes/'],
  ['the open path with another query', '/?play=first#top'],
  ['a hash of another page', '/about/#top'],
]) {
  test(`E-c ${name} opens in place`, async () => {
    const page = openPage();

    assert.equal(click(href), true);
    await nextTurn();

    assert.deepEqual([shown(page).href, page.loads.length], [href, 1]);
  });
}

const FALLBACKS = [
  ['a failed fetch', { refused: true }],
  ['a status that is not ok', { status: 404 }],
  ['a type that is not HTML', { type: 'application/xml' }],
  ['a missing type', { type: null }],
  ['a final address on another origin', { url: 'https://example.com/about/' }],
  ['a page without main', { main: false }],
  ['a new stylesheet', { assets: ['/css/main.2.css', ASSETS[1]] }],
  ['a new script', { assets: [ASSETS[0], '/js/navigate.2.js'] }],
];

for (const [name, answer] of FALLBACKS) {
  test(`E-e ${name} loads the link in full`, async () => {
    const page = openPage({ site: { '/about/': answer } });

    click('/about/#part');
    await nextTurn();

    assert.deepEqual(shown(page), { title: 'Home', href: '/', entries: 1, fullLoads: [`assign ${ORIGIN}/about/#part`] });
    assert.deepEqual([page.document.main === page.firstMain, page.loads, warn.mock.callCount()], [true, [], 1]);
  });

  test(`E-e ${name} on Back reloads the page`, async () => {
    const page = openPage({ url: '/about/', site: { '/about/': answer } });
    click('/skills/');
    await nextTurn();

    page.history.go(-1);
    await nextTurn();

    assert.deepEqual([page.fullLoads, page.loads.length, page.document.title], [['reload'], 1, 'Page /skills/']);
  });
}

test('E-e a script of another origin is no new deploy', async () => {
  const page = openPage({ page: { assets: [...ASSETS, 'https://extension.example/a.js'] } });

  click('/about/');
  await nextTurn();

  assert.deepEqual([page.fullLoads, page.loads.length], [[], 1]);
});

test('E-e nothing changes while the fetch runs', async () => {
  const page = openPage({ held: true });

  click('/about/');
  await nextTurn();

  assert.deepEqual(shown(page), { title: 'Home', href: '/', entries: 1, fullLoads: [] });
  assert.equal(page.document.main, page.firstMain);
  page.requests[0].answer();
  await nextTurn();
  assert.equal(page.document.title, 'Page /about/');
});

test('E-e a newer click aborts the older fetch, which then does nothing', async () => {
  const page = openPage({ held: true });

  click('/about/');
  click('/skills/');
  await nextTurn();
  page.requests[1].answer();
  page.requests[0].answer();
  await nextTurn();

  assert.deepEqual(page.requests.map(({ signal }) => signal.aborted), [true, false]);
  assert.deepEqual(shown(page), { title: 'Page /skills/', href: '/skills/', entries: 2, fullLoads: [] });
  assert.deepEqual([page.loads.length, warn.mock.callCount()], [1, 0]);
});

test('E-e an answer that arrives just before a newer click does nothing', async () => {
  const page = openPage({ held: true });

  click('/about/');
  page.requests[0].answer();
  click('/skills/');
  page.requests[1].answer();
  await nextTurn();

  assert.deepEqual([shown(page).title, page.loads.length, shown(page).entries], ['Page /skills/', 1, 2]);
});

for (const [name, href, aborted] of [
  ['a click to another origin aborts', 'https://example.com/', true],
  ['a click on a file aborts', '/posts/index.xml', true],
  ['a click on a mail link keeps', 'mailto:a@example.com', false],
]) {
  test(`E-e ${name} the running fetch`, async () => {
    const page = openPage({ held: true });
    click('/about/');

    click(href);

    assert.equal(page.requests[0].signal.aborted, aborted);
  });
}

test('E-d Back and Forward show their pages without a new history entry and restore the scroll', async () => {
  const page = openPage();
  page.window.scrollY = 700;
  click('/about/');
  await nextTurn();
  scroll(page, 250);
  mock.timers.tick(SAVE_SCROLL_MS);

  page.history.go(-1);
  await nextTurn();
  assert.deepEqual([shown(page).title, page.window.scrollY], ['Page /', 700]);
  page.history.go(1);
  await nextTurn();

  assert.deepEqual([shown(page), page.window.scrollY], [{ title: 'Page /about/', href: '/about/', entries: 2, fullLoads: [] }, 250]);
});

test('E-d Back to an entry without a saved scroll shows its start', async () => {
  const page = openPage({ url: '/about/' });
  click('/skills/');
  await nextTurn();
  page.history.entries[0].state = null;
  page.window.scrollY = 300;

  page.history.go(-1);
  await nextTurn();

  assert.deepEqual([page.document.title, page.window.scrollY], ['Page /about/', 0]);
});

test('E-d a history move inside the page fetches nothing and restores its scroll', async () => {
  const page = openPage({ state: { scroll: 120 } });
  page.history.pushState(null, '', '/#part');
  page.window.dispatchEvent(new Event('popstate'));
  scroll(page, 900);
  mock.timers.tick(SAVE_SCROLL_MS);

  page.history.go(-1);
  assert.equal(page.window.scrollY, 120);
  page.history.go(1);

  assert.deepEqual([page.window.scrollY, page.requests, page.loads], [900, [], []]);
});

test('E-d a move back to the shown page aborts the running fetch', async () => {
  const page = openPage();
  click('/about/');
  await nextTurn();
  page.history.go(-1);
  const request = page.requests[1];

  page.history.go(1);
  await nextTurn();

  assert.deepEqual([request.signal.aborted, page.document.title, page.fullLoads], [true, 'Page /about/', []]);
});

test('E-d a scroll during a history move does not overwrite the saved scroll', async () => {
  const page = openPage({ held: true });
  page.window.scrollY = 700;
  click('/about/');
  page.requests[0].answer();
  await nextTurn();
  page.history.go(-1);

  scroll(page, 30);
  mock.timers.tick(SAVE_SCROLL_MS);
  page.window.dispatchEvent(new Event('pagehide'));

  assert.deepEqual(page.history.state, { scroll: 700 });
});

test('E-d the scroll is saved when it rests and keeps the rest of the state', () => {
  const page = openPage({ state: { kept: true } });

  scroll(page, 100);
  mock.timers.tick(SAVE_SCROLL_MS - 1);
  scroll(page, 200);
  mock.timers.tick(SAVE_SCROLL_MS - 1);
  assert.deepEqual(page.history.state, { kept: true });
  mock.timers.tick(1);

  assert.deepEqual(page.history.state, { kept: true, scroll: 200 });
});

test('E-d the scroll is saved before a jump to a hash of the page', () => {
  const page = openPage();
  page.window.scrollY = 80;

  click('/#part');

  assert.deepEqual(page.history.state, { scroll: 80 });
});

test('E-d a reload restores the saved scroll', () => {
  const before = openPage();
  before.window.scrollY = 333;
  before.window.dispatchEvent(new Event('pagehide'));

  const page = openPage({ state: before.history.state });

  assert.deepEqual([page.window.scrollY, page.history.scrollRestoration], [333, 'manual']);
});

test('E-d a late image restores the scroll again until the visitor scrolls', () => {
  const page = openPage({ state: { scroll: 500 } });
  page.window.scrollY = 90;
  page.document.main.dispatchEvent(new Event('load'));
  assert.equal(page.window.scrollY, 500);

  page.window.dispatchEvent(new Event('wheel'));
  page.window.scrollY = 10;
  page.document.main.dispatchEvent(new Event('load'));

  assert.equal(page.window.scrollY, 10);
});

test('E-h an address that a page:load listener changes is the shown page', async () => {
  const page = openPage({ url: '/music/' });
  page.window.addEventListener('page:load', () => page.history.replaceState(page.history.state, '', '/about/'));
  click('/about/?play=first');
  await nextTurn();
  page.history.pushState(null, '', '/about/#part');

  page.history.go(-1);
  await nextTurn();

  assert.equal(page.requests.length, 1);
});

test('E-i nothing is fetched before a click', async () => {
  const page = openPage();

  for (const type of ['mouseover', 'pointerdown', 'touchstart', 'focusin']) page.document.dispatchEvent(new Event(type));
  await nextTurn();

  assert.deepEqual(page.requests, []);
  click('/about/');
  assert.equal(page.requests.length, 1);
});

test('E-b a page without main keeps the normal links', () => {
  const page = openPage({ page: { main: false } });

  assert.deepEqual([click('/about/'), page.requests], [false, []]);
});
