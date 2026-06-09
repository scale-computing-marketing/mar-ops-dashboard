# Scale Computing Marketing Ops Dashboard — modular structure

The dashboard is now split so a **single section can be edited without touching the
rest of the file**. The big `dashboard.html` shell stays put; each modular section
lives in its own small folder and is pulled in at runtime from `manifest.json`.

## Repo layout

```
/
├─ dashboard.html              ← shell: sidebar, masthead, existing inline sections,
│                                and the section loader (reads manifest.json)
├─ manifest.json               ← list of dynamically-loaded sections + their metadata
└─ sections/
   └─ campaign-builder/
      ├─ section.html          ← markup mounted into the page (no <script>, no .page wrapper)
      ├─ section.css           ← styles, scoped under #p-builder
      └─ section.js            ← logic, self-contained IIFE
```

## Important: it must be served (GitHub Pages)

The loader uses `fetch()` to pull in each section, so the dashboard has to be served
over HTTP. GitHub Pages does this automatically. Opening `dashboard.html` directly from
your hard drive (a `file://` URL) **will not load the sections** — the browser blocks
`fetch()` of local files. For a quick local preview, run a tiny server from the repo
root, e.g. `python3 -m http.server` and open `http://localhost:8000/dashboard.html`.

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
| `html`/`css`/`js` | Paths (relative to `dashboard.html`) to the section's files.    |

## How the loader works (in `dashboard.html`)

On load it fetches `manifest.json`, then for each section: creates the `.page` element,
injects `section.html`, links `section.css`, registers the breadcrumb + badge, adds the
sidebar nav item and top tab (wired to the existing `showMainTab`), and finally fetches
and runs `section.js`. The existing inline sections (Overview, Campaigns, Email, Forms,
Tag Library, etc.) are untouched and can be migrated to this same pattern one at a time
whenever you want.
