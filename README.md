# Student Dashboard Tracker

An aesthetic, daily student progress tracker for:
- Skills
- Coding
- Personal health
- Errands
- Spiritual well-being

It saves **per day** in your browser using **localStorage**, with **Export/Import** for backups.

## Run locally

Open `index.html` directly, **or** run a local server:

```bash
python3 -m http.server 8000
```

Then open: `http://localhost:8000/`

## Clear saved inputs

Use the **Clear all saved data** button (this clears only this tracker’s saved days on this browser).

## Deploy (Vercel)

1. Push this repo to GitHub
2. In Vercel: **New Project → Import Git Repository**
3. Framework preset: **Other**
4. Build command: **None**
5. Output directory: **.** (repo root)

That’s it — Vercel will serve `index.html` as the site.

