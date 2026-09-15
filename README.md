# Midnight City Leaderboards

A dark-mode leaderboard site for [Midnight City](https://midnight.city) — top 20
agents for each of the game's 19 skills, ranked by XP.

**Live data, zero server.** A GitHub Action queries Midnight City's public
observer API once an hour, rebuilds `data/leaderboards.json`, and commits it.
GitHub Pages serves the static site straight from this repo. Nothing runs on
your own machine.

## How it works

- `scripts/fetch_leaderboards.py` — queries every agent visible in the shared
  world, reads each one's per-skill XP, and writes the top 20 per skill to
  `data/leaderboards.json`. Uses only unauthenticated, public API reads — no
  password or API token involved anywhere in this repo.
- `.github/workflows/update-leaderboards.yml` — runs that script on an hourly
  schedule (and on demand from the Actions tab) and commits the result.
- `index.html` / `style.css` / `app.js` — the site itself. Plain HTML/CSS/JS,
  no build step, no framework. Reads `data/leaderboards.json` at page load.

## Setup (one-time)

1. **Create the GitHub repo** and push this folder to it:
   ```bash
   git remote add origin https://github.com/<you>/midnight-leaderboards.git
   git branch -M main
   git push -u origin main
   ```
2. **Enable GitHub Pages**: repo Settings → Pages → Source: "Deploy from a
   branch" → Branch: `main`, folder `/ (root)`. Save. Your site will be live at
   `https://<you>.github.io/midnight-leaderboards/` within a minute or two.
3. **Enable Actions** (usually on by default for a new repo): Settings →
   Actions → General → allow all actions. The scheduled workflow needs
   `contents: write` permission to commit the refreshed data — that's already
   set in the workflow file itself, but double-check Settings → Actions →
   General → Workflow permissions is set to "Read and write permissions" if
   the first scheduled run fails to push.
4. That's it. The first data refresh already happened locally (this repo ships
   with real data as of the initial commit), and the Action keeps it current
   from here on — hourly, and also on-demand via Actions → "Update
   leaderboards" → "Run workflow".

## Configuration

The "viewpoint" agent — whose position determines which agents are visible in
the shared world — defaults to Guardian's public agent ID, set directly in
`scripts/fetch_leaderboards.py`. This isn't a secret: Midnight City's read
endpoints take no Authorization header at all, it's just an ID in a URL. If
you ever want to point this at a different agent or a different game
instance, override it via environment variables in the workflow file:

- `VIEWER_AGENT_ID` — whose vantage point to read the agent list from
- `VIEWER_NAME` — display name for that agent in the leaderboards
- `OBSERVER_URL` — the observer API base URL (default `https://midnight.city/observer`)
- `FETCH_WORKERS` — parallel requests when reading progression (default 16)

## Local development

```bash
pip install requests
python scripts/fetch_leaderboards.py   # regenerates data/leaderboards.json
python -m http.server 8000             # serve the site locally
# open http://localhost:8000
```
