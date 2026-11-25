import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, test } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const FAKED_GLOBALS = ['window', 'document', 'fetch'];

let originals;

beforeEach(() => {
  originals = FAKED_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
});

afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

class FakeElement extends EventTarget {
  attributes = new Map();
  children = [];
  style = {};
  found = {};
  classes = new Set();
  parent = null;

  constructor(tag) {
    super();
    this.tag = tag;
  }

  set className(value) {
    this.classes = new Set(value.split(' '));
  }

  get classList() {
    return {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
    };
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'src') this.src = '';
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  querySelector(selector) {
    return this.found[selector] ?? null;
  }

  querySelectorAll(selector) {
    return this.found[selector] ?? [];
  }

  click() {
    this.dispatchEvent(new Event('click'));
  }
}

function load(name, content = {}) {
  const window = new EventTarget();
  const body = new FakeElement('body');
  const document = new EventTarget();
  Object.assign(document, {
    body,
    content,
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => ({ text }),
    querySelector: (selector) => document.content[selector] ?? null,
    querySelectorAll: (selector) => document.content[selector] ?? [],
    getElementById: (id) => document.content[`#${id}`] ?? null,
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  const script = require.resolve(`../assets/js/${name}.js`);
  delete require.cache[script];
  require(script);

  return {
    body,
    document,
    window,
    show(next) {
      document.content = next;
      window.dispatchEvent(new Event('page:load'));
    },
    lightboxes: () => body.children.filter((child) => child.classes.has('lightbox')),
  };
}

function post(tops = [], imageCount = 1) {
  const headings = tops.map((top) => ({
    top,
    reads: 0,
    getBoundingClientRect() {
      this.reads++;
      return { top: this.top };
    },
  }));
  const links = headings.map((_, index) => {
    const link = new FakeElement('a');
    link.setAttribute('href', `#%D0%B3-${index}`);
    return link;
  });
  const toc = new FakeElement('aside');
  toc.found = { a: links };
  const images = Array.from({ length: imageCount }, (_, index) => Object.assign(new FakeElement('img'), { src: `/images/${index}.png`, alt: `Image ${index}` }));
  const content = new FakeElement('div');
  content.found = { img: images };
  const page = { '.toc-sidebar': toc, '.post-content': content };
  headings.forEach((heading, index) => {
    page[`#г-${index}`] = heading;
  });
  return { page, headings, links, images };
}

function active({ links }) {
  return links.map((link) => link.classes.has('active'));
}

function escape({ document }, key = 'Escape') {
  document.dispatchEvent(Object.assign(new Event('keydown'), { key }));
}

test('E-f the table of contents marks the last heading above the line', () => {
  const first = post([-50, 100, 101]);

  load('post', first.page);

  assert.deepEqual(active(first), [false, true, false]);
});

test('E-f the table of contents follows the scroll', () => {
  const first = post([10, 300]);
  const site = load('post', first.page);

  first.headings[1].top = 50;
  site.window.dispatchEvent(new Event('scroll'));

  assert.deepEqual(active(first), [false, true]);
});

test('E-f the table of contents marks nothing above the first heading', () => {
  const first = post([300]);

  load('post', first.page);

  assert.deepEqual(active(first), [false]);
});

test('E-f a post opened in place has its own table of contents and the old one is not followed', () => {
  const [first, second] = [post([10]), post([10, 20])];
  const site = load('post', first.page);

  site.show(second.page);
  const reads = first.headings[0].reads;
  site.window.dispatchEvent(new Event('scroll'));

  assert.deepEqual([active(second), first.headings[0].reads], [[false, true], reads]);
});

test('E-f a page without a post adds nothing, and a post opened after it works', () => {
  const site = load('post');
  assert.equal(site.lightboxes().length, 0);

  const next = post([10]);
  site.show(next.page);

  assert.deepEqual([site.lightboxes().length, active(next)], [1, [true]]);
});

test('E-f a post without images has no lightbox', () => {
  assert.equal(load('post', post([], 0).page).lightboxes().length, 0);
});

test('E-f a click on an image opens it in the lightbox', () => {
  const first = post([], 2);
  const site = load('post', first.page);

  first.images[1].click();

  const [box] = site.lightboxes();
  assert.deepEqual([box.classes.has('open'), box.children[0].src, box.children[0].alt], [true, '/images/1.png', 'Image 1']);
  assert.equal(site.body.style.overflow, 'hidden');
});

for (const [name, close] of [
  ['a click', (site) => site.lightboxes()[0].click()],
  ['Escape', (site) => escape(site)],
]) {
  test(`E-f ${name} closes the lightbox`, () => {
    const first = post();
    const site = load('post', first.page);
    first.images[0].click();

    close(site);

    const [box] = site.lightboxes();
    assert.deepEqual([box.classes.has('open'), box.children[0].src, site.body.style.overflow], [false, '', '']);
  });
}

test('E-f another key keeps the lightbox open', () => {
  const first = post();
  const site = load('post', first.page);
  first.images[0].click();

  escape(site, 'Enter');

  assert.equal(site.lightboxes()[0].classes.has('open'), true);
});

test('E-f leaving a post removes its open lightbox and gives the scroll back', () => {
  const first = post();
  const site = load('post', first.page);
  first.images[0].click();

  site.show({});
  first.images[0].click();

  assert.deepEqual([site.lightboxes().length, site.body.style.overflow], [0, '']);
});

test('E-f posts opened one after another keep one lightbox', () => {
  const site = load('post', post().page);

  for (let i = 0; i < 3; i++) site.show(post().page);

  assert.equal(site.lightboxes().length, 1);
});

function form() {
  const button = new FakeElement('button');
  const element = new FakeElement('form');
  element.found = { button };
  element.submits = 0;
  const add = element.addEventListener.bind(element);
  element.addEventListener = (type, listener) => {
    element.submits++;
    add(type, listener);
  };
  return { element, button };
}

function frames({ body }) {
  return body.children.filter((child) => child.tag === 'iframe');
}

test('E-f each subscribe form is bound once and shares one frame over page loads', () => {
  const [header, first, second] = [form(), form(), form()];
  const site = load('subscribe', { '.subscribe-form': [header.element, first.element] });

  site.show({ '.subscribe-form': [header.element, second.element] });
  site.show({ '.subscribe-form': [header.element] });

  assert.deepEqual([header, first, second].map(({ element }) => [element.submits, element.target]), Array(3).fill([1, 'subscribe-frame']));
  assert.deepEqual(frames(site).map(({ name, hidden }) => [name, hidden]), [['subscribe-frame', true]]);
});

test('E-f a form of a page opened in place shows the note after the answer', () => {
  const site = load('subscribe');
  assert.equal(site.body.children.length, 0);
  const next = form();
  site.show({ '.subscribe-form': [next.element] });

  next.element.dispatchEvent(new Event('submit'));
  assert.deepEqual([next.button.disabled, next.element.innerHTML], [true, undefined]);
  site.body.children[0].dispatchEvent(new Event('load'));

  assert.match(next.element.innerHTML, /Check your inbox/);
});

test('E-f a frame load without a submit changes no form', () => {
  const only = form();
  const site = load('subscribe', { '.subscribe-form': [only.element] });

  site.body.children[0].dispatchEvent(new Event('load'));

  assert.equal(only.element.innerHTML, undefined);
});

function feeds({ size = '2', src = '/feeds.json' } = {}) {
  const button = new FakeElement('button');
  button.removed = false;
  button.textContent = 'Load more';
  button.remove = () => {
    button.removed = true;
  };
  const list = new FakeElement('ul');
  const container = new FakeElement('section');
  container.setAttribute('data-src', src);
  container.setAttribute('data-pack-size', size);
  container.found = { '.feeds-more': button, ul: list };
  return { button, list, page: { '#interesting-blogs': container } };
}

function answer({ entries, ok = true }) {
  const requests = [];
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async (url) => {
      requests.push(url);
      return { ok, status: ok ? 200 : 500, json: async () => entries };
    },
  });
  return requests;
}

const ENTRIES = ['a', 'a', 'b', 'a', 'c'].map((source, index) => ({
  source,
  title: `Entry ${index}`,
  link: `https://${source}.example/${index}`,
  site: `https://${source}.example/`,
  date: index === 1 ? 'unknown' : '2026-11-25T00:00:00Z',
}));

function titles({ list }) {
  return list.children.map((item) => item.children.at(-1).children[0].textContent);
}

test('E-f Load more adds packs with one entry of each blog and then goes away', async () => {
  const requests = answer({ entries: ENTRIES });
  const only = feeds();
  load('feeds', only.page);

  only.button.click();
  await nextTurn();
  assert.deepEqual([titles(only), only.button.removed, only.button.textContent], [['Entry 1', 'Entry 4'], false, 'Load more']);
  only.button.click();

  assert.deepEqual([titles(only), only.button.removed, requests], [['Entry 1', 'Entry 4', 'Entry 3'], true, ['/feeds.json']]);
  assert.deepEqual(only.list.children.map((item) => item.children.length), [1, 2, 2]);
});

test('E-f Load more works on the list of a page opened in place', async () => {
  answer({ entries: ENTRIES });
  const [first, second] = [feeds(), feeds()];
  const site = load('feeds', first.page);

  site.show(second.page);
  second.button.click();
  await nextTurn();

  assert.deepEqual([titles(first), titles(second)], [[], ['Entry 1', 'Entry 4']]);
});

test('E-f a page load that keeps the list binds it once', async () => {
  const requests = answer({ entries: ENTRIES });
  const only = feeds();
  const site = load('feeds', only.page);

  site.show(only.page);
  only.button.click();
  await nextTurn();

  assert.deepEqual([titles(only), requests.length], [['Entry 1', 'Entry 4'], 1]);
});

test('E-f a second click while the list loads sends no second request', async () => {
  const requests = answer({ entries: ENTRIES });
  const only = feeds();
  load('feeds', only.page);

  only.button.click();
  only.button.click();
  await nextTurn();

  assert.deepEqual([requests.length, titles(only).length], [1, 2]);
});

test('E-f Load more goes away when there is no other pack', async () => {
  answer({ entries: ENTRIES.slice(0, 1) });
  const only = feeds();
  load('feeds', only.page);

  only.button.click();
  await nextTurn();

  assert.deepEqual([titles(only), only.button.removed], [[], true]);
});

test('E-f a refused list says so', async () => {
  answer({ ok: false });
  const only = feeds({ size: '' });
  load('feeds', only.page);

  only.button.click();
  await nextTurn();

  assert.equal(only.button.textContent, 'Could not load more');
});

test('E-f a page without a list, or with an empty one, adds nothing', () => {
  const requests = answer({ entries: ENTRIES });
  const site = load('feeds');
  const empty = feeds();
  empty.page['#interesting-blogs'].found = {};

  site.show(empty.page);
  empty.button.click();

  assert.deepEqual([requests, titles(empty)], [[], []]);
});
