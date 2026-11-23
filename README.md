# In Fourths

Bass practice built on the modes and the 2 Position System. A static site: plain HTML, CSS and JavaScript, no build step and no dependencies, so there is nothing to update or break.

## What's in it

| Page | What it does |
|---|---|
| Home (`#/`) | The idea, the three ways to practise, links to the books |
| The Woodshed (`#/woodshed`) | All 182 daily pages of *The Bass Woodshed*, with progress saved in the visitor's browser |
| A day (`#/woodshed/27`) | Diagrams you can tap to hear, a play button per diagram, "Play the line" with a tempo slider on Day 6 pages, a drone button set to the page's root, mark-as-done, print |
| Cells (`#/cells/C/0/block`) | Block, moves, triad, 7th, 9th and the map of the key, in all 12 keys, with interval or note-name labels |
| One Root (`#/one-root/E/triads`) | The eight one-note ladders on any root |
| Songs (`#/songs`) | The songs-as-vehicles list |
| How it works (`#/about`) | The two positions, the diagram key, the drone, progress, who made it |

The drone bar at the bottom of every page holds a low root for as long as you want it.

## Publish it

1. Create a new GitHub repository (empty, no README) and push this folder to it:
   ```
   git init
   git add .
   git commit -m "In Fourths"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/infourths.git
   git push -u origin main
   ```
2. In Vercel: **Add New → Project**, import the repository.
   - Framework preset: **Other**
   - Build command: leave empty
   - Output directory: leave empty (the site is the repository root)
3. Deploy. Every push to `main` redeploys.
4. Domain: in the Vercel project go to **Settings → Domains**, add the domain, and set the DNS records Vercel shows you at the registrar.

To try it locally: `python3 -m http.server` in this folder, then open http://localhost:8000. (Opening `index.html` straight from disk won't load the Woodshed data, because browsers block `fetch` from `file://`.)

## Where things live

```
index.html          shell: header, footer, drone bar
css/site.css        all styling, including print styles for the day pages
js/app.js           pages and routing
js/theory.js        intervals, spelling, modes, 2 Position placement
js/neck.js          the fretboard diagrams (SVG), tap-to-hear and playback
js/audio.js         plucked bass tone and the drone (Web Audio, no samples)
js/cells.js         the Cells views
js/oneroot.js       the One Root ladders
js/songs.js         the songs list
data/woodshed.json  the 182 Woodshed pages: text plus every diagram as note data
fonts/              Oswald (headings) and Atkinson Hyperlegible (text), self-hosted
```

### Editing Woodshed text

Each day in `data/woodshed.json` has `title`, `sub`, `intro`, `do` (the three steps), `rule` and `got`. Edit the text and push. Diagrams are stored as `notes: [string, fret, label, style, beat]`, with strings numbered 0–3 from E to G. Styles are `root`, `lit`, `sel`, `colour`, `faint` and `out`.

### Changing a link

The two book links are constants at the top of `js/app.js` (`UTG_BASS` and `UTG_BUNDLE`).

## Notes

- Progress (days marked done, tempo, drone note, label choice) is kept in `localStorage`, so it belongs to one browser on one device. Nothing is collected or sent anywhere.
- Pages use hash URLs (`/#/woodshed/27`), so no server rewrites are needed and any page can be bookmarked.
- The diagrams print in black and white from the day pages (Print this page).
