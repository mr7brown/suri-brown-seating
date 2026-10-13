# Suri–Brown Wedding Seating Finder

Mobile-first seating wayfinder for the **Suri–Brown Wedding Reception** (October 16, 2026). Guests scan a QR code, enter their name, and see their table highlighted on the Grand Ballroom floor plan.

Live site (after Pages is enabled):  
`https://mr7brown.github.io/suri-brown-seating/`

## Features

- Name search (first and/or last; live after 2+ characters)
- Interactive floor plan with table highlights and guest lists
- Tap any table to see who’s seated there
- Seed guest/table data in a replaceable JSON file
- Printable QR page (`qr.html`) pointing at the deployed or local URL

## Run locally

This is a static site (no build step). Serve the folder over HTTP so `fetch` can load the guest data:

```bash
cd /Users/ashtonbrown/Desktop/seating
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

QR helper: [http://localhost:8080/qr.html](http://localhost:8080/qr.html)

> Opening `index.html` via `file://` will not load `data/guests.json` in most browsers.

## Guest QR flow

1. Deploy the site (GitHub Pages below).
2. Open `/qr.html` on the deployed URL.
3. Confirm the destination URL (defaults to the homepage).
4. Print or screenshot the QR code for table cards / signage.
5. Guests scan → land on the seating finder → enter their name.

## Deploy to GitHub Pages

1. Push this repo to `https://github.com/mr7brown/suri-brown-seating` (already the intended remote).
2. On GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Branch: `main`, folder: `/ (root)` → Save.
5. Wait a minute, then visit `https://mr7brown.github.io/suri-brown-seating/`.
6. Update the printable QR URL to that address if needed.

Optional: add a custom domain under the same Pages settings.

## Updating guest data

All seating content lives in [`data/guests.json`](data/guests.json):

- `event` — title, headline, date, venue
- `tables` — table id → `{ name, guests[] }`
- `positions` — table id → `{ x, y }` percentages on the floor plan (venue layout; not in the spreadsheet)

### Re-import from the Excel spreadsheet

Guest lists are sourced from **Wedding Invitations.xlsx → sheet `Seating Chart`** (not the alternate `New Seating Chart` draft).

```bash
# Requires: pip install openpyxl
python3 scripts/import_seating.py
# or point at a different file:
python3 scripts/import_seating.py "/path/to/Wedding Invitations.xlsx"
```

Then commit the updated `data/guests.json`. Keep table ids `"1"`…`"16"` and positions unless the room layout changes.

The importer:

- Reads headers like `Crying Tiger (1)`
- Treats numeric cells (e.g. `8`, `10`) as seat counts, not guest names
- Applies careful typo normalization (`Art Instituite` → `Art Institute of Chicago`)

## Project layout

```
├── index.html          # Guest seating finder
├── qr.html             # Printable QR generator
├── css/styles.css
├── js/app.js
├── js/qr.js
├── data/guests.json    # Swap this when the spreadsheet arrives
└── README.md
```

## Design notes

Chicago-night **sapphire + champagne**: deep ink blues, soft mist atmosphere, Fraunces + Figtree typography. Motion on hero entrance, result panel reveal, and active-table pulse.
