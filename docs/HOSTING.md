# Gate Prototype — Hosting

The prototype works on any static host with the `prototype/` folder as the site root.

## Requirements
- Static file server (GitHub Pages, Netlify, Vercel, S3, nginx, `python3 -m http.server`)
- No build step. No server-side rendering. No API.
- No analytics. No external requests. No CDN.

## Checklist
1. Use an unlisted URL (do not include the link in meta tags)
2. Open it on a phone (390px) and in a second browser
3. Check that a deep link to a scenario step works (e.g. `#/merchant/payments/P-1003?scenario=E2&step=4`)
4. Press `H` to hide the demo bar, `R` to reset, `1`/`2` to switch seats
5. Export CSV on S3 and verify the file downloads
6. Open the Compliance panel (`C`) on a held-payment scenario

## robots.txt
The repo includes a `robots.txt` that disallows all crawlers, and `<meta name="robots" content="noindex, nofollow">` in the HTML head. The site is for the interview panel, not the search engines.
