# PaceBar — Landing Pages

Two complete, dependency-free landing pages for **PaceBar** (vanilla HTML/CSS/JS,
no build step). Open `index.html` for a chooser, or go straight to either:

```
landing/
├── index.html          # version chooser (links to both)
├── editorial/          # Version A — editorial / print-inspired
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── showcase/           # Version B — product / app showcase
    ├── index.html
    ├── styles.css
    └── app.js
```

### Version A — Editorial
Ink-on-paper, print-inspired layout with a **timeline-ruler** motif, monospace
numerals, hairline rules and a numbered section index. Restrained, confident,
no gradients.

### Version B — Product showcase
An app-style page that pairs copy with **animated recreations of the real app
UI** — the click-through overlay bar, the timer builder (sections, sliders,
colours), the menu-bar popover, the 3·2·1 countdown, the settings panel, and the
warnings/overrun state. Light and airy.

Both use the same curated warm palette (vermillion · amber · green · teal — no
blue/purple, no gradients) and respect `prefers-reduced-motion`.

## Run locally

They're static — just open a file, or serve the folder:

```bash
cd landing
python3 -m http.server 8080      # then visit http://localhost:8080
# or simply:  open index.html
```

## Deploy (free)

Pick the version you want to ship and point your host at that subfolder
(`landing/editorial` or `landing/showcase`), or deploy the whole `landing/`
folder and let visitors choose from `index.html`.

- **GitHub Pages:** Settings → Pages → deploy from branch, folder `/landing`
  (or copy your chosen version's files into `/docs`).
- **Netlify / Vercel / Cloudflare Pages:** new project from the repo, set the
  publish directory to `landing` (or `landing/showcase`), no build command.

## Before going live — update these

- **Download link:** buttons marked `data-download` point to
  `…/releases/latest`. Point them at your real `.dmg` once published.
- **GitHub links:** update if the repo moves.
- **Social preview:** add an `og:image` (a real screenshot/recording) for nicer
  link unfurls.

The component mockups are pure CSS/JS recreations of the app UI, so no
screenshots are required — but a short screen-recording of the real app would
make a great addition near the hero.
