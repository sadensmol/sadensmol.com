import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const SCRIPTS = ['feeds', 'subscribe', 'player', 'music', 'post', 'navigate'];
const RELEASED_LINKS = {
  '/music/?play=tbilisis-mziani-sia': 'თბილისის მზიანი სია',
  '/music/?play=ded-moroz-idet': 'Дед Мороз идет!',
};

let work;
let site;
let music;

before(() => {
  work = mkdtempSync(join(tmpdir(), 'music-page-test-'));
  site = join(work, 'public');
  execFileSync(
    join(ROOT, 'node_modules', '.bin', 'hugo'),
    ['--source', ROOT, '--destination', site, '--minify', '--noBuildLock', '--quiet'],
    { stdio: 'pipe', env: { ...process.env, HUGO_SECURITY_HTTP_URLS: 'none' } },
  );
  music = readFileSync(join(site, 'music', 'index.html'), 'utf8');
});

after(() => rmSync(work, { recursive: true, force: true }));

function attributes(tag) {
  const found = {};
  for (const [, name, double, single, bare] of tag.slice(0, -1).matchAll(/\s([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g)) {
    found[name] = (double ?? single ?? bare ?? '').replaceAll('&#43;', '+');
  }
  return found;
}

function rows() {
  const found = [...music.matchAll(/<li class="?track[" ][\s\S]*?(?=<li|<\/ol>)/g)].map(([html]) => {
    const row = attributes(html.match(/<li[^>]*>/)[0]);
    const parts = [...html.matchAll(/(<(a|span)\s[^>]*>)([^<]*)<\/\2>/g)].map(([, tag, , text]) => ({ ...attributes(tag), text }));
    return { id: row['data-track-id'], parts, ...Object.fromEntries(parts.map((part) => [part.class, part])) };
  });
  assert.notEqual(found.length, 0, 'no rows in the playlist');
  return found;
}

function scripts(html) {
  return [...html.matchAll(/<script\s[^>]*\bsrc=[^>]*>/g)].map(([tag]) => attributes(tag));
}

test('E-a the Music page has no panel, idle text or label', () => {
  const main = music.match(/<main>[\s\S]*<\/main>/)[0];

  assert.match(main, /class="?track-list/);
  assert.doesNotMatch(main, /<audio|player-idle|player-label|id="?player["\s>]/);
  assert.doesNotMatch(music, /Now Playing|Select a track to play/);
});

test('D-b the playlist has a header and numbers its rows', () => {
  const order = [/<main>/, /class="?playlist["\s>]/, /class="?playlist-header"?>Playlist</, /class="?track-list["\s>]/].map((part) => music.search(part));

  assert.ok(order[0] > 0);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.deepEqual(rows().map((row) => row['track-number'].text), rows().map((_, index) => `Track ${index + 1}`));
});

test('D-i each row holds the title, number, download link and share link in order', () => {
  for (const { parts } of rows()) {
    assert.deepEqual(parts.map((part) => part.class), ['track-play', 'track-number', 'track-download', 'track-share']);
    assert.deepEqual([parts[2].text, parts[3].text], ['Download', 'Share']);
  }
});

test('D-i each download link saves the song of its row', () => {
  for (const row of rows()) {
    assert.ok('download' in row['track-download']);
    assert.equal(row['track-download'].href, row['track-play'].href);
  }
});

test('D-i each share link names the id of its row', () => {
  for (const row of rows()) assert.equal(row['track-share'].href, `/music/?play=${row.id}`);
});

test('D-l each row has its own id in the documented form', () => {
  const ids = rows().map((row) => row.id);

  assert.deepEqual(ids.filter((id) => !/^[a-z0-9-]+$/.test(id ?? '')), []);
  assert.equal(new Set(ids).size, ids.length);
});

test('D-h2 the released share links still name their songs', () => {
  const titles = Object.fromEntries(rows().map((row) => [row['track-share'].href, row['track-play'].text]));

  for (const [href, title] of Object.entries(RELEASED_LINKS)) assert.equal(titles[href], title);
});

test('E-f every page loads the six scripts in order with matching integrity hashes', () => {
  const pages = readdirSync(site, { recursive: true })
    .filter((name) => name.endsWith('.html'))
    .map((name) => ({ name, html: readFileSync(join(site, name), 'utf8') }))
    .filter(({ html }) => /<main\b/.test(html));
  assert.ok(pages.some(({ name }) => name === join('music', 'index.html')));

  for (const { name, html } of pages) {
    const loaded = scripts(html);
    assert.deepEqual(loaded.map(({ src }) => src.match(/\/js\/([a-z]+)\./)[1]), SCRIPTS, name);
    for (const { src, integrity, defer } of loaded) {
      const file = readFileSync(join(site, new URL(src, 'https://sadensmol.com').pathname));
      assert.equal(defer, '', name);
      assert.equal(integrity, `sha256-${createHash('sha256').update(file).digest('base64')}`, name);
    }
  }
});

test('E-f no page depends on a script inside main', () => {
  const found = readdirSync(site, { recursive: true })
    .filter((name) => name.endsWith('.html'))
    .flatMap((name) => {
      const main = readFileSync(join(site, name), 'utf8').match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
      return [...main.matchAll(/<script[^>]*>/g)].map(([tag]) => tag).filter((tag) => attributes(tag).type !== 'application/ld+json').map((tag) => `${name}: ${tag}`);
    });

  assert.match(readFileSync(join(site, 'about', 'index.html'), 'utf8'), /<main\b[\s\S]*application\/ld\+json[\s\S]*<\/main>/);
  assert.deepEqual(found, []);
});
