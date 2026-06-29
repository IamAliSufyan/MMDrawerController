# PaceBar — Landing Page

A single-page, dependency-free marketing site for **PaceBar** (vanilla
HTML/CSS/JS, no build step). Dark, stagetimer-inspired design with scroll-reveal
animations, a sticky blurred nav, an interactive animated overlay-bar demo, and
an accordion FAQ. Respects `prefers-reduced-motion`.

```
landing/
├── index.html   # all sections: hero, value props, USP, features, use cases,
│                #   how-it-works, warnings/overrun highlight, FAQ, CTA, footer
├── styles.css   # design system + responsive layout + animations
└── app.js       # reveal observer, sticky nav, FAQ, feature grid, live demos
```

## Run locally

It's static — just open `index.html`, or serve the folder:

```bash
cd landing
python3 -m http.server 8080   # then visit http://localhost:8080
```

## Deploy (free)

**GitHub Pages**
1. Push the repo to GitHub.
2. Settings → Pages → Source: deploy from a branch, folder `/landing`
   (or move these files to `/docs` and point Pages at `/docs`).

**Netlify / Vercel / Cloudflare Pages**
- New project from the repo, set the **publish/output directory** to `landing`,
  no build command. Done.

## Before going live — update these

- **Download link:** the buttons marked `data-download` point to
  `https://github.com/IamAliSufyan/MMDrawerController/releases/latest`. Point
  them at your real `.dmg` release (or a direct download URL) once published.
- **GitHub links:** update the repo URL if it changes.
- **Social preview:** the `og:` meta tags are set; add an `og:image` (e.g. a
  1200×630 screenshot of the app) for nicer link unfurls.
- **Domain:** set a custom domain in your host if you have one.

The hero and highlight demos are pure CSS/JS recreations of the real overlay, so
no screenshots are required — but a short screen-recording of the app in action
would make a great addition near the hero.
