import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const CONTROLS = {
  '.player-title': ({ classes }) => classes.includes('player-title'),
  audio: ({ name }) => name === 'audio',
  '.player-close': ({ classes }) => classes.includes('player-close'),
};

let work;
let site;

before(() => {
  work = mkdtempSync(join(tmpdir(), 'player-bar-test-'));
  site = join(work, 'public');
  execFileSync(
    join(ROOT, 'node_modules', '.bin', 'hugo'),
    ['--source', ROOT, '--destination', site, '--noBuildLock', '--quiet'],
    { stdio: 'pipe', env: { ...process.env, HUGO_SECURITY_HTTP_URLS: 'none' } },
  );
});

after(() => rmSync(work, { recursive: true, force: true }));

function shellPages() {
  return readdirSync(site, { recursive: true })
    .filter((name) => name.endsWith('.html'))
    .map((name) => ({ name, html: readFileSync(join(site, name), 'utf8') }))
    .filter(({ html }) => /<main\b/.test(html));
}

function attribute(tag, name) {
  const found = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return found?.[1] ?? found?.[2] ?? found?.[3] ?? '';
}

function parsedTags(html) {
  return [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-z][\w-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/gi)].map(
    ([tag, slash, name]) => ({
      name: name.toLowerCase(),
      closing: slash === '/',
      id: attribute(tag, 'id'),
      classes: attribute(tag, 'class').split(/\s+/),
    }),
  );
}

function playerElement(html) {
  const all = parsedTags(html);
  const start = all.findIndex(({ id, closing }) => id === 'player' && !closing);
  assert.notEqual(start, -1, 'no #player');
  let depth = 0;
  for (let i = start; i < all.length; i++) {
    if (all[i].name !== all[start].name) continue;
    depth += all[i].closing ? -1 : 1;
    if (depth === 0) return all.slice(start + 1, i);
  }
  return assert.fail('#player is not closed');
}

test('AC5 the player controls are inside the player bar on every page', () => {
  const pages = shellPages();
  assert.notEqual(pages.length, 0);
  const wrong = [];

  for (const { name, html } of pages) {
    const inside = playerElement(html).filter(({ closing }) => !closing);
    for (const [selector, matches] of Object.entries(CONTROLS)) {
      const count = inside.filter(matches).length;
      if (count !== 1) wrong.push(`${name}: ${count} ${selector} inside #player`);
    }
  }

  assert.deepEqual(wrong, []);
});

function openBefore(tags, name) {
  const named = tags.filter((tag) => tag.name === name);
  return named.filter(({ closing }) => !closing).length - named.filter(({ closing }) => closing).length;
}

test('E-a every page has its one player in the header after the nav', () => {
  const wrong = [];
  const pages = shellPages();
  assert.ok(pages.some(({ name }) => name === join('music', 'index.html')));

  for (const { name, html } of pages) {
    const all = parsedTags(html);
    const players = all.filter(({ id }) => id === 'player').length;
    const preceding = all.slice(0, all.findIndex(({ id }) => id === 'player'));
    const place = {
      players,
      header: openBefore(preceding, 'header'),
      main: openBefore(preceding, 'main'),
      nav: openBefore(preceding, 'nav'),
      navs: preceding.filter((tag) => tag.name === 'nav' && tag.closing).length,
    };
    const expected = { players: 1, header: 1, main: 0, nav: 0, navs: 1 };
    if (JSON.stringify(place) !== JSON.stringify(expected)) wrong.push(`${name}: ${JSON.stringify(place)}`);
  }

  assert.deepEqual(wrong, []);
});
