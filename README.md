# Scale Computing Marketing Ops Dashboard — modular structure

The dashboard is now split so a **single section can be edited without touching the
rest of the file**. The big `index.html` shell stays put; each modular section
lives in its own small folder and is pulled in at runtime from `manifest.json`.

## Repo layout

```
/
├─ index.html              ← shell: sidebar, masthead, existing inline sections,
│                                and the section loader (reads manifest.json)
├─ manifest.json               ← list of dynamically-loaded sections + their metadata
├─ data/
│  └─ tag-library.js           ← SINGLE SOURCE OF TRUTH for all tags, naming rules,
│                                platform guide, and the campaign registry. Loaded by
│                                index.html as a blocking <script>; sets window.TAG_DATA.
├─ vendor/
│  └─ docx.bundle.js            ← Word-export engine (docx + JSZip + pako), loaded on
│                                demand the first time someone exports — not on page load
└─ sections/
   └─ campaign-builder/
      ├─ section.html          ← markup mounted into the page (no <script>, no .page wrapper)
      ├─ section.css           ← styles, scoped under #p-builder
      └─ section.js            ← logic, self-contained IIFE
```

## Important: it must be served (GitHub Pages)

The loader uses `fetch()` to pull in each section, so the dashboard has to be served
over HTTP. GitHub Pages does this automatically. Opening `index.html` directly from
your hard drive (a `file://` URL) **will not load the sections** — the browser blocks
`fetch()` of local files. For a quick local preview, run a tiny server from the repo
root, e.g. `python3 -m http.server` and open `http://localhost:8000/index.html`.

## Updating the Tag Library (single source of truth)

All tags, naming conventions, the platform guide, and the campaign registry live in
**`data/tag-library.js`** — and nowhere else. `index.html` loads it as a blocking
`<script>` in `<head>`, which defines `window.TAG_DATA` before any section runs. Both
the **Tag Library** section and the **Campaign Builder** read from `window.TAG_DATA`, so
a single edit flows everywhere automatically:

- Add / rename / retire a tag, change a description or platform → edit the `tags` array.
- Change a naming format → edit the `naming` array.
- Register a new campaign → add to the `campaigns` array.

No edits to `index.html` are needed (or wanted). The "Total Tags" KPI and all category
counts are derived from the array at load, so they update themselves.

Two notes:

- The file is a tiny JS wrapper (`var TAG_DATA = { … }; window.TAG_DATA = TAG_DATA;`)
  around what is otherwise plain JSON — keep that wrapper so the bare `TAG_DATA`
  references in `index.html` resolve. The object itself is pure data.
- Browsers cache the file. After committing a change, hard-refresh (or append a
  `?v=` query to the `<script src>` in `index.html`) to bypass a stale cache.

## Updating the Campaign Builder

Edit only the three files in `sections/campaign-builder/`. You can hand me just those
files (or just the one that needs changing) and I can work on the section in isolation —
no need to send the whole 1.2&nbsp;MB dashboard. Commit, and Pages redeploys.

- Change wording, fields, layout → `section.html`
- Change look → `section.css` (keep every selector under `#p-builder`)
- Change behavior / the generated Word doc → `section.js`

## Adding a new section

1. Create `sections/<id>/section.html`, `section.css`, `section.js`.
2. Add an entry to `manifest.json` (see fields below).

That's it — **no edits to the shell.** The loader builds the sidebar nav item, the top
tab, the breadcrumb, and the badge from the manifest, mounts the markup, attaches the
CSS, and runs the JS.

Conventions that keep sections from colliding:

- **`section.html`** is just the inner markup. The loader wraps it in
  `<div class="page" id="p-<id>">`, so don't include your own `.page` wrapper.
- **`section.css`** — scope every rule under `#p-<id>` (e.g. `#p-builder .cb-card{…}`).
  Define any custom properties on `#p-<id>` rather than `:root`.
- **`section.js`** — wrap everything in an IIFE `(function(){ … })();`. If you attach
  listeners to `document`, guard them so they only act inside your page, e.g.
  `if(!(ev.target.closest && ev.target.closest('#p-<id>'))) return;`. Element IDs in
  your markup should be unique across the dashboard.

## manifest.json fields

The manifest also takes one optional **top-level** field, `version` (a string). When
present, the loader appends `?v=<version>` to every section file it fetches, so bumping
it forces browsers to pull the new `section.html`/`.css`/`.js` instead of a cached copy.
Leave it out and files are fetched with normal browser caching.

| Field        | Purpose                                                              |
|--------------|----------------------------------------------------------------------|
| `id`         | Section id. The page becomes `#p-<id>`; nav uses `data-nav="<id>"`.   |
| `title`      | Label shown in the sidebar and top tab.                              |
| `navGroup`   | Which sidebar group to add the nav item to (`Performance`/`Channels`/`Governance`). |
| `navIcon`    | Inline SVG string for the nav icon.                                  |
| `badge`      | Header badge text for the section.                                   |
| `breadcrumb` | `{ "group": "...", "leaf": "..." }` shown in the header breadcrumb.   |
| `pageClass`  | Class for the mounted page element (e.g. `page gov-ed`).             |
| `pageStyle`  | Inline style for the page element (padding / max-width / centering). |
| `html`/`css`/`js` | Paths (relative to `index.html`) to the section's files.    |

## How the loader works (in `index.html`)

On load it fetches `manifest.json`, then for each section: creates the `.page` element,
injects `section.html`, links `section.css`, registers the breadcrumb + badge, adds the
sidebar nav item and top tab (wired to the existing `showMainTab`), and finally fetches
and runs `section.js`. The existing inline sections (Overview, Campaigns, Email, Forms,
Tag Library, etc.) are untouched and can be migrated to this same pattern one at a time
whenever you want.
