import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(resolve(root, path), 'utf8');
const site = JSON.parse(await read('content/site.json'));
const checking = process.argv.includes('--check');
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]
  );
const arrow = '<span aria-hidden="true">↗</span>';

function workList(base, heading = 'h3') {
  return `<div class="work-list">${site.work
    .map(
      (work) => `
    <article class="work-entry" id="${work.id}">
      <div class="entry-heading"><${heading}><a href="${base}${work.url}">${escape(work.title)} <span aria-hidden="true">↗</span></a></${heading}><span class="entry-year">${work.year}</span></div>
      <p>${escape(work.description)}</p>
      <span class="entry-category">${escape(work.category)}</span>
    </article>`
    )
    .join('')}</div>`;
}

function writingList(base, heading = 'h3') {
  return `<div class="writing-list">${site.writing
    .map(
      (post) => `
    <article class="writing-entry">
      <div class="entry-heading"><${heading}><a href="${base}${post.url}">${escape(post.title)} ${arrow}</a></${heading}><span class="status">${escape(post.status)}</span></div>
      <p>${escape(post.description)}</p>
    </article>`
    )
    .join('')}</div>`;
}

function footer(base) {
  return `<footer class="site-footer" id="contact">
    <div class="footer-top"><div><p class="footer-heading">Always happy to compare notes.</p><a class="email-link" href="mailto:${site.email}">${site.email} ${arrow}</a></div>
    <nav class="elsewhere" aria-label="Elsewhere"><a href="${site.github}">GitHub ${arrow}</a><a href="${site.linkedin}">LinkedIn ${arrow}</a><a href="${site.twitter}">X ${arrow}</a></nav></div>
    <div class="footer-bottom"><a href="${base}index.html">Scott Maran</a><span>New York City</span></div>
  </footer>`;
}

let stale = 0;
for (const page of site.pages) {
  const base = '../'.repeat(page.url.split('/').length - 1);
  const nav = [
    ['projects.html', 'Work', 'work'],
    ['writing.html', 'Writing', 'writing'],
    ['about.html', 'About', 'about'],
  ]
    .map(
      ([url, label, section]) =>
        `<a href="${base}${url}"${page.section === section ? ' aria-current="' + (page.url === url ? 'page' : 'true') + '"' : ''}>${label}</a>`
    )
    .join('\n');
  const tokens = {
    base,
    workList: workList(base, page.key === 'work' ? 'h2' : 'h3'),
    writingList: writingList(base, page.key === 'writing' ? 'h2' : 'h3'),
  };
  const content = (await read(`content/${page.key}.html`)).replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => {
      if (!(key in tokens)) throw new Error(`Unknown template token: ${key}`);
      return tokens[key];
    }
  );
  const title =
    page.key === 'home'
      ? 'Scott Maran — Work & writing'
      : `${page.title} — Scott Maran`;
  const canonical = `https://scottmaran.github.io/${page.url === 'index.html' ? '' : page.url}`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(page.description)}" />
    <meta name="theme-color" content="#f8f7f3" />
    ${page.noindex ? '<meta name="robots" content="noindex, follow" />' : `<link rel="canonical" href="${canonical}" />`}
    <meta property="og:type" content="${page.article ? 'article' : 'website'}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(page.description)}" />
    <meta property="og:url" content="${canonical}" />
    <link rel="icon" href="${page.key === 'not-found' ? '/' : base}assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${page.key === 'not-found' ? '/' : base}styles.css" />
  </head>
  <body class="page-${page.key}">
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="site-shell">
      <header class="site-header">
        <a class="site-name" href="${base}index.html"${page.key === 'home' ? ' aria-current="page"' : ''}>Scott Maran<span class="name-dot" aria-hidden="true">.</span></a>
        <nav class="site-nav" aria-label="Main navigation">${nav}</nav>
      </header>
      <main id="main" tabindex="-1">${content}</main>
      ${footer(base)}
    </div>
  </body>
</html>
`;
  // A GitHub Pages 404 can be served at any URL depth.
  const output =
    page.key === 'not-found'
      ? html.replace(
          /href="(index|projects|writing|about)\.html"/g,
          'href="/$1.html"'
        )
      : html;
  const path = resolve(root, page.url);
  if (checking) {
    const existing = await readFile(path, 'utf8').catch(() => '');
    if (existing !== output) {
      console.error(`Needs build: ${page.url}`);
      stale++;
    }
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, output);
  }
}
if (stale) process.exitCode = 1;
else
  console.log(
    `${checking ? 'Checked' : 'Built'} ${site.pages.length} static pages.`
  );
