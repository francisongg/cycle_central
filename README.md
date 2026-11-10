# Cycle Central

An online store for bikes, parts and gear. The layout follows Canyon's site: a sticky header with mega-menus, a full-width hero, category tiles, and product rails. On top of that, the store is turned into a game.

It's a static site. A small build step saves a finished HTML page for every address, so search engines can read each page without running JavaScript.

```bash
npm install           # once
npm run build         # writes the public site to dist/
npm run preview       # serves dist/ locally and prints the address
```

For quick edits you can also serve the project folder (`python3 -m http.server 8000`) and open the home page. Clicking around works, but reloading a deeper page needs the built version.

## Features
- **Shop**: real page addresses for home (`/`), listings (`/bikes/`, `/bikes/road/`, `/parts/`, `/sale/`), products (`/products/aero-road-cf-8/`) and rewards (`/rewards/`). Filter by category, price, search and sort. Old `/#/...` links redirect to the new addresses.
- **Product page**: colour swatches, frame sizes, a size suggester that works from your height, specs, and "Complete your build" upsells.
- **Cart drawer**: a free-shipping progress meter, quick-add upsells, discount codes, and member-level discounts.
- **Compare**: up to 3 bikes side by side, with the best price and rating highlighted.

### Gamification
- **XP and 5 rider levels** (Rookie → Champion). Each level unlocks a bigger member discount (0–8%) that's applied in the cart automatically.
- **11 badges / missions**: viewing products, exploring every category, saving favourites, comparing bikes, building a full bike, unlocking free shipping, checking out, and more.
- **Bike Finder quiz**: 4 questions that score every bike and show the best match as a percentage.
- **Daily Spin wheel**: one spin a day for discount codes, free shipping or bonus XP.
- **Scroll "ride" bar**: a progress line with a rider that crosses the screen as you scroll. Toasts, confetti and level-up celebrations add to the effect.
- Progress is saved in the browser's `localStorage`.

## Branding
This follows the Cycle Central brand guide (`CYCLE CENTRAL - PEGS`):
- **Colours**: Blue `#3c78c6` (primary), Cream `#eeebe3` (backgrounds), Brown `#92694b` (secondary and rewards), Charcoal `#1c2126` (text and dark surfaces).
- **Type**: Inter Bold / Bold Italic for headings and buttons, Open Sauce Sans for body text. Open Sauce is self-hosted in `assets/fonts` under the OFL licence.
- **Logo**: `assets/logo.svg` (dark wordmark), `assets/logo-light.svg` (footer), `assets/mark.svg` (mobile header) and `assets/favicon.svg` (round badge). All are vectors taken from the brand PDF.
- **Vibe** (minimalist, innovative, fast): clean cream surfaces, italic headings like the wordmark, and the logo's triangle mosaic used as a light pattern.

## SEO
What the build and app do for search engines and link previews:
- **One HTML file per page** (`scripts/build.mjs` renders each page with headless Chromium), so the full text, headings and links are in the page source.
- **Unique title and description** for every page, plus a **canonical link**, **Open Graph** and **Twitter card** tags.
- **Structured data** (schema.org JSON-LD): `OnlineStore` and `WebSite` on every page, `BreadcrumbList` on listing and product pages, and `Product` with price, currency, stock and sale price on product pages. Ratings are left out of structured data until they come from real reviews.
- **Share images**: a 1200×630 image for every product (`/og/products/<slug>.png`) and one for the site (`/assets/og-image.png`).
- **`sitemap.xml`** and **`robots.txt`**, a real **404 page** (marked `noindex`), and `noindex` on the personal Favourites page.
- **Speed**: fonts are self-hosted and the two main ones are preloaded, scripts are deferred, and there are no third-party requests.
- **Icons**: SVG and PNG favicons, an Apple touch icon and a web app manifest.

The build stops with an error if any page is missing a title, description, canonical link, a single H1 or valid structured data, or if two pages share a title.

**Where to edit the words**: `js/data.js` holds the site name and description (`site`), the listing page titles, descriptions and intro text (`pages`), each category's `seoTitle` and `intro`, and each product's `description`. The live address comes from GitHub Pages during deployment (`SITE_URL`/`BASE_PATH`), falling back to `site.url`.

## Customising
- **Brand colours and fonts**: they live in the tokens at the top of `css/styles.css`.
- **Inventory**: replace the placeholder items in `js/data.js`. Give a product an `image` URL to use a real photo in place of the generated illustration.
- **Rewards tuning**: change levels, spin prizes and the free-shipping threshold in `js/data.js`. Change badge XP and level discounts in `js/app.js` (`BADGES`, `LEVEL_PERKS`).

Checkout is a demo for now. No payment provider is connected yet.

## Hosting (GitHub Pages + custom domain)
`.github/workflows/pages.yml` runs `npm run build` and publishes `dist/` to GitHub Pages on every push to the default branch. It reads the live address from GitHub, so links and the sitemap use `https://cyclecentral.ph` once the custom domain is active.

One-time setup:
1. **Turn on Pages**: in the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Then re-run the "Deploy to GitHub Pages" workflow from the **Actions** tab, or push any change.
2. **Add DNS records** at the domain's DNS provider (dot.ph):

   | Type  | Host / Name | Value |
   |-------|-------------|-------|
   | A     | @ (blank)   | 185.199.108.153 |
   | A     | @ (blank)   | 185.199.109.153 |
   | A     | @ (blank)   | 185.199.110.153 |
   | A     | @ (blank)   | 185.199.111.153 |
   | CNAME | www         | francisongg.github.io |

   Remove any other A, AAAA or CNAME records for `@` and `www` that point somewhere else (for example a parking page).
3. **Set the domain**: in **Settings → Pages → Custom domain**, enter the domain (for example `yourdomain.ph`) and save. Once the DNS check passes, tick **Enforce HTTPS**. The certificate can take up to an hour.
4. **Optional but recommended**: verify the domain under your GitHub profile **Settings → Pages → Add a domain**, so nobody else can claim it on GitHub.

After the domain works:
5. **Google Search Console**: add `cyclecentral.ph` as a **Domain** property, add the TXT record it gives you in dot.ph's DNS Records, then submit `https://cyclecentral.ph/sitemap.xml` under **Sitemaps**.
6. Re-run the deploy once (Actions tab → Deploy to GitHub Pages → Run workflow) so every page's links use the custom domain.
