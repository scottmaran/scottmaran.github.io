# Scott Maran — work and writing

A small static personal website, built around selected work, writing, and a little background. The generated HTML and local assets can be served directly by GitHub Pages. There are no browser JavaScript dependencies, external fonts, or runtime requests to a CMS.

## Preview

```sh
npm ci
npm run build
npm run dev
```

Open `http://localhost:4187`. A different port can be supplied with `python3 -m http.server 4188 --bind 127.0.0.1`.

## Editing

- `content/*.html` contains the page bodies. Edit these rather than the generated HTML.
- `content/site.json` defines page metadata, contact links, selected projects, and writing entries.
- `scripts/build.mjs` supplies the shared document, header, navigation, and footer, and renders the indexes.
- `styles.css` contains the responsive design, reading layouts, focus states, and print styles.
- `assets/projects/` contains the original project videos and figures.

Run `npm run build` after editing content. Commit both the sources and generated HTML so GitHub Pages needs no build configuration.

## Adding writing

1. Copy `content/first-note.html` to a new content file, such as `content/my-essay.html`. Replace the placeholder notice, title, and body.
2. Add a page in `content/site.json` with `key: "my-essay"`, `url: "writing/my-essay.html"`, a title and description, `section: "writing"`, and `article: true`.
3. Add its title, URL, status (for example, `"Essay"`), and description to the `writing` array. Remove the placeholder entry and its page when the first piece is ready.
4. Run `npm run build`.

Use `{{base}}` before local links inside nested pages. The build replaces it with the relative path to the site root. The placeholder is explicitly labeled and excluded from search indexing.

## Pages

- `/` — introduction, selected work, writing, background, and contact
- `/projects.html` — work index, preserving the previous project URL
- `/work/lux.html` — Lux project
- `/work/pay-attention-to-tackles.html` — NFL Big Data Bowl project
- `/writing.html` — writing index
- `/writing/first-note.html` — temporary article
- `/about.html` — background
- `/contact.html` — direct contact page, preserving the previous URL
- `/404.html` — missing-page fallback

The previous game assets and historical concepts remain in the repository; the redesigned site does not load them.

## Checks

```sh
npm run check
npm run lint
```

`check` verifies that generated pages match their content and templates. `lint` checks the build script. The site works with JavaScript disabled; navigation and media controls use browser-native behavior. Videos use native controls, preload metadata, and do not autoplay.
