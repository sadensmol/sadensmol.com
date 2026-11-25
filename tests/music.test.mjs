import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, before, test } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const BASE_URL = 'https://sadensmol.com';
const SONGS = [
  { title: 'თბილისის მზიანი სია', sha256: '0f10dda93609296794230d16bbb804b7e0d94fbf215d016d2fe5f4ecc768d23f' },
  { title: 'Дед Мороз идет!', sha256: 'c6b176cad28f6109cec40ce11d67473eccc3e2068691928796ab58468416e998' },
];
const SONG_FILES = SONGS.map(({ title }) => `music/${title}.mp3`);

let work;
let site;

before(() => {
  work = mkdtempSync(join(tmpdir(), 'music-test-'));
  site = join(work, 'public');
  execFileSync(
    join(ROOT, 'node_modules', '.bin', 'hugo'),
    ['--source', ROOT, '--destination', site, '--baseURL', `${BASE_URL}/`, '--noBuildLock', '--quiet'],
    { stdio: 'pipe', env: { ...process.env, HUGO_SECURITY_HTTP_URLS: 'none' } },
  );
});

after(() => rmSync(work, { recursive: true, force: true }));

function publishedFiles() {
  return readdirSync(site, { recursive: true }).filter((name) => statSync(join(site, name)).isFile());
}

function shellPages() {
  const pages = publishedFiles()
    .filter((name) => name.endsWith('.html'))
    .map((name) => ({ name, html: readFileSync(join(site, name), 'utf8') }))
    .filter(({ html }) => /<main\b/.test(html));
  assert.notEqual(pages.length, 0);
  return pages;
}

function attributes(tag) {
  const found = {};
  const body = tag.replace(/^<[a-z0-9]+/i, '').replace(/>$/, '');
  for (const [, name, double, single, bare] of body.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g)) {
    found[name.toLowerCase()] = (double ?? single ?? bare ?? '').replaceAll('&amp;', '&').replaceAll('&#43;', '+').replaceAll('&#34;', '"');
  }
  return found;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>`, 'gi'))].map(([tag]) => attributes(tag));
}

function links(html) {
  return [...html.matchAll(/(<a\s[^>]*>)([\s\S]*?)<\/a>/gi)].map(([, tag, body]) => ({
    ...attributes(tag),
    text: body.replace(/<[^>]*>/g, '').trim(),
  }));
}

function hasClass(element, name) {
  return (element.class ?? '').split(/\s+/).includes(name);
}

function pathOf(href) {
  return decodeURIComponent(new URL(href, `${BASE_URL}/music/`).pathname);
}

function musicPage() {
  const path = join(site, 'music', 'index.html');
  assert.ok(existsSync(path), '/music/ is not built');
  return readFileSync(path, 'utf8');
}

function songLinks() {
  return links(musicPage()).filter((link) => hasClass(link, 'track-play'));
}

test('AC1 the music page is built with the title Music', () => {
  const html = musicPage();

  assert.match(html, /<title>\s*Music\b[^<]*<\/title>/);
  assert.match(html, /<h1[^>]*>\s*Music\s*<\/h1>/);
});

test('AC1 the music page lists exactly the two songs in order', () => {
  assert.deepEqual(songLinks().map((link) => link.text), SONGS.map((song) => song.title));
});

test('AC2 every page has the Music menu item between Skills and About', () => {
  const wrong = [];
  for (const { name, html } of shellPages()) {
    const nav = html.match(/<nav\b[\s\S]*?<\/nav>/);
    if (!nav) continue;
    const menu = links(nav[0]);
    const music = menu.findIndex((link) => link.text === 'Music');
    const around = [menu[music - 1]?.text, menu[music + 1]?.text];
    if (music < 0 || pathOf(menu[music].href) !== '/music/' || around.join() !== 'Skills,About') wrong.push(name);
  }

  assert.deepEqual(wrong, []);
});

test('AC3 the site publishes exactly the two song files', () => {
  const mp3 = publishedFiles().filter((name) => /\.mp3$/i.test(name));

  assert.deepEqual(mp3.sort(), [...SONG_FILES].sort());
});

for (const { title, sha256 } of SONGS) {
  test(`AC3 the bytes of "${title}" match the attachment`, () => {
    const path = join(site, 'music', `${title}.mp3`);

    assert.ok(existsSync(path), `${relative(site, path)} is not published`);
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), sha256);
  });
}

test('AC4 each song title links to its own published file', () => {
  const found = songLinks();

  assert.deepEqual(found.map((link) => [link.text, pathOf(link.href)]), SONGS.map(({ title }) => [title, `/music/${title}.mp3`]));
  assert.deepEqual(found.filter((link) => !existsSync(join(site, pathOf(link.href)))), []);
});

test('AC4 no song title or file name contains "(1)"', () => {
  const names = [...songLinks().map((link) => link.text), ...publishedFiles().filter((name) => /\.mp3$/i.test(name))];

  assert.equal(names.length, 4);
  assert.deepEqual(names.filter((name) => name.includes('(1)')), []);
});

test('AC5 every page has one hidden idle player bar', () => {
  const wrong = [];
  for (const { name, html } of shellPages()) {
    const bars = tags(html, 'div').filter((tag) => tag.id === 'player');
    if (bars.length !== 1) {
      wrong.push(`${name}: ${bars.length} player bars`);
      continue;
    }
    const start = html.search(/<div\s[^>]*\bid=["']?player["'\s>]/i);
    const bar = html.slice(start).split(/<script\b/i)[0];
    const audio = tags(bar, 'audio');
    const close = tags(bar, 'button').filter((tag) => hasClass(tag, 'player-close'));
    if (!('hidden' in bars[0]) || !hasClass(bars[0], 'player')) wrong.push(`${name}: bar is not a hidden .player`);
    if (audio.length !== 1 || !('controls' in audio[0])) wrong.push(`${name}: no audio controls`);
    else if ('src' in audio[0] || 'autoplay' in audio[0] || /<source\b/i.test(bar)) wrong.push(`${name}: audio is not idle`);
    if (!/class=["']?player-title["'\s>][^<]*<\//.test(bar)) wrong.push(`${name}: no title element`);
    if (close.length !== 1 || close[0].type !== 'button' || !close[0]['aria-label']) wrong.push(`${name}: no close button`);
  }

  assert.deepEqual(wrong, []);
});

test('AC5 every page loads the player script with a matching integrity hash', () => {
  const wrong = [];
  for (const { name, html } of shellPages()) {
    const scripts = tags(html, 'script').filter((tag) => /\/js\/player\b[^/]*\.js$/.test(tag.src ?? ''));
    if (scripts.length !== 1) {
      wrong.push(`${name}: ${scripts.length} player scripts`);
      continue;
    }
    const file = join(site, pathOf(scripts[0].src));
    const hash = existsSync(file) && createHash('sha256').update(readFileSync(file)).digest('base64');
    if (scripts[0].integrity !== `sha256-${hash}`) wrong.push(`${name}: integrity`);
    if (!('defer' in scripts[0])) wrong.push(`${name}: not deferred`);
  }

  assert.deepEqual(wrong, []);
});
