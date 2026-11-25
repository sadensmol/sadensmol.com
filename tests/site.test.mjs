import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, before, test } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const BASE_URL = 'https://sadensmol.com';
const DRAFT_SLUG = 'draft-that-must-stay-hidden';

let work;
let site;

before(() => {
  work = mkdtempSync(join(tmpdir(), 'site-test-'));
  site = join(work, 'public');
  const content = join(work, 'content');
  cpSync(join(ROOT, 'content'), content, { recursive: true });
  writeFileSync(
    join(content, 'posts', `2020-01-01-${DRAFT_SLUG}.md`),
    `+++\ntitle = '${DRAFT_SLUG}'\ndate = 2020-01-01\ndraft = true\n+++\n`,
  );
  execFileSync(
    join(ROOT, 'node_modules', '.bin', 'hugo'),
    ['--source', ROOT, '--contentDir', content, '--destination', site, '--baseURL', `${BASE_URL}/`, '--noBuildLock', '--quiet'],
    { stdio: 'pipe', env: { ...process.env, HUGO_SECURITY_HTTP_URLS: 'none' } },
  );
});

after(() => rmSync(work, { recursive: true, force: true }));

function filesUnder(dir) {
  return readdirSync(dir, { recursive: true })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

function publishedPosts() {
  const dir = join(ROOT, 'content', 'posts');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== '_index.md')
    .filter((name) => {
      const front = readFileSync(join(dir, name), 'utf8').split('+++')[1];
      const date = new Date(front.match(/^date\s*=\s*['"]?([^'"\n]+)/m)[1].trim());
      return !/^draft\s*=\s*true/m.test(front) && date <= new Date();
    });
}

function postList() {
  return JSON.parse(readFileSync(join(site, 'posts', 'index.json'), 'utf8')).items;
}

for (const page of ['', 'posts', 'projects', 'skills', 'about']) {
  test(`page /${page} is built and has a title`, () => {
    const html = readFileSync(join(site, page, 'index.html'), 'utf8');

    assert.match(html, /<title>[^<]+<\/title>/);
  });
}

for (const feed of ['index.xml', 'posts/index.xml']) {
  test(`RSS feed /${feed} has items`, () => {
    const xml = readFileSync(join(site, feed), 'utf8');

    assert.match(xml, /<rss\b/);
    assert.match(xml, /<item>/);
  });
}

test('the custom domain file is published', () => {
  assert.equal(readFileSync(join(site, 'CNAME'), 'utf8').trim(), 'sadensmol.com');
});

test('the post list holds every published post', () => {
  assert.equal(postList().length, publishedPosts().length);
});

test('every post of the post list is built', () => {
  const missing = postList().filter((post) => !existsSync(join(site, new URL(post.url).pathname, 'index.html')));

  assert.deepEqual(missing, []);
});

test('a draft is not published', () => {
  const leaks = filesUnder(site).filter((path) => path.includes(DRAFT_SLUG) || readFileSync(path).includes(DRAFT_SLUG));

  assert.deepEqual(leaks, []);
});

test('internal links and images resolve', () => {
  const broken = [];
  for (const page of filesUnder(site).filter((path) => path.endsWith('.html'))) {
    const pageUrl = new URL(relative(site, page).replace(/index\.html$/, ''), `${BASE_URL}/`);
    const html = readFileSync(page, 'utf8').replace(/<(script|pre|code)\b[\s\S]*?<\/\1>/g, (block) => block.match(/^<[^>]*>/)[0]);
    for (const [, , double, single, bare] of html.matchAll(/<[a-z][^>]*?\s(href|src)=(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi)) {
      const url = new URL((double ?? single ?? bare).replaceAll('&amp;', '&'), pageUrl);
      if (url.origin !== BASE_URL) continue;
      const target = join(site, decodeURIComponent(url.pathname));
      if (!existsSync(target) || (statSync(target).isDirectory() && !existsSync(join(target, 'index.html')))) {
        broken.push(`${pageUrl.pathname} -> ${url.pathname}`);
      }
    }
  }

  assert.deepEqual([...new Set(broken)], []);
});
