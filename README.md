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
The shop is built around how people buy a bike: budget first, then fit, then specs.

- **Budget-first home page**: a budget slider (or type an exact amount) and a "where will you ride" picker sit in the hero. Three picks update as you move it: **Best match**, **Best value** and **Worth the stretch** (up to 15% over budget), each with the reasons it fits.
- **Bike Finder** (`/bike-finder/`): the same controls plus goal, experience and e-bike preference. It scores every bike out of 100 and lists them best first. The answers are kept in the address, so a set of picks can be shared as a link.
- **Specs at a glance**: every bike card shows frame, gearing and weight. **Quick view** opens the specs, sizes and Add to cart without leaving the list.
- **Compare**: add up to 3 bikes from any card, or compare the Finder's picks in one tap. The table marks the lowest price and lightest bike and can show differences only. Each bike's page also has a ready-made "How it compares" table against its two closest alternatives.
- **Listing pages**: real addresses for home (`/`), listings (`/bikes/`, `/bikes/road/`, `/parts/`, `/sale/`), products (`/products/aero-road-cf-8/`) and rewards (`/rewards/`). Filter by budget, type, frame and rider level; filters stay in the address (`/bikes/?max=50000&type=road`) and survive the back button. On phones the filters open as a bottom sheet.
- **Search** (press `/`): instant results as you type. A number is read as a budget, so `road 50k` shows road bikes around ₱50,000.
- **Product page**: key specs up top, frame sizes with the rider heights they fit (type your height and the size is picked for you), full spec table, and a buy button that stays on screen while you scroll.
- **Cart drawer**: a free-shipping progress meter, quick-add upsells, discount codes, and member-level discounts.
- **Ordering by chat** (no online payment yet): the cart's **Send order request** collects the customer's name, mobile, delivery area and notes, then builds an order message with every item, size, colour, price, discount and a reference number (`CC-MMDD-XXXX`). It opens Viber with the message filled in (or Messenger), and always copies it so it can be pasted anywhere. Bike pages get an **Ask about this bike** button. The **How to order** page (`/how-to-order/`) explains the four steps and lists the contact channels.
- Old `/#/...` links redirect to the new addresses.

### Gamification
- **XP and 5 rider levels** (Rookie → Champion). Each level unlocks a bigger member discount (0–8%) that's applied in the cart automatically.
- **11 badges / missions**: viewing products, exploring every category, using the Bike Finder, saving favourites, comparing bikes, building a full bike, unlocking free shipping, checking out, and more.
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
What the build and app do for search engines, AI search and link previews:

**Pages that match what people search**
- **Product pages** are titled "<Model> Price in the Philippines", with a unique description (price, type, sizes, colours, stock), the full spec table, answers to common questions (price, sizes and colours, stock, how to order) and links to the brand, type, budget and guide pages.
- **Brand price lists** (`/brands/<brand>/`, e.g. "Trek Bikes Price List Philippines 2026") with a short factual note on the brand, a price table, stock and answers. `/brands/` lists every brand.
- **Budget pages** (`/bikes/under-50k/` etc.): "Best Bikes Under ₱50,000 in the Philippines", best-equipped first, with the best bike of each type at that budget. A page is only made when it has at least 3 bikes and differs from the one below it.
- **Type pages** (`/bikes/road/` ...) and **Framesets** (`/bikes/framesets/`) with a price table, answers and links.
- **Guides**: a bike size guide (`/guides/bike-size-guide/`, height charts in cm and feet, inseam formulas) and how to choose a bike (`/guides/how-to-choose-a-bike/`: types, budgets, frame materials, groupsets). **About us** at `/about/`.
- Every page is linked from the menu, footer, home page or a related page, so nothing is orphaned.

**Technical**
- **One HTML file per page** (`scripts/build.mjs` renders each page with headless Chromium), so the full text, headings and links are in the page source. On first load the app keeps that HTML and only updates what's personal (cart, XP), so the main photo isn't painted twice.
- **Titles** fit Google's ~65 characters (" | Cycle Central" is added when there's room), **descriptions** stay under 160, with a **canonical link**, **Open Graph** and **Twitter card** tags. SKU pages (`/products/<sku>/`) point Google at their model page but keep their own address for Facebook shares.
- **Structured data** (schema.org JSON-LD): `OnlineStore` (with your social pages, contact and return policy once set) and `WebSite` on every page; `BreadcrumbList`; product pages use `ProductGroup` with one `Product` + `Offer` per SKU (price, sale price, stock, condition), plus `FAQPage`; listing pages use `CollectionPage` + `ItemList` + `FAQPage`; guides use `Article`. Ratings are left out until they come from real reviews.
- **Photos** are downloaded from Cycle Beast at build time and served from this site as WebP in three sizes (`img/p/`), with `srcset`, `width` and `height` (no layout shift). The main product photo loads first; the rest lazily. Each colour gets a 1200×630 share image (`og/products/`).
- **`sitemap.xml`** lists every indexable page with its photos (image sitemap) and a `lastmod` that only changes when that page's content changes (tracked in `.cache/seo-state.json`, which GitHub keeps between runs). **`robots.txt`** allows everything. The 404 page, Favourites and Rider Club are `noindex`.
- **IndexNow**: after each deploy, `scripts/indexnow.mjs` tells Bing (which also feeds ChatGPT search and Copilot), Yandex and others which pages changed. Google reads the sitemap instead.
- **Shopping feed**: `feeds/products.xml` (one item per SKU) for Google Merchant Center free listings, Bing Merchant Center and Facebook/Instagram shops (Meta Commerce Manager).
- **Speed and accessibility** (Lighthouse, mobile): performance 92–96, accessibility, best practices and SEO 100. Fonts are self-hosted and preloaded, scripts deferred, no third-party requests.

The build stops with an error if any page is missing a title, description, canonical link, a single H1 or valid structured data, or if two pages share a title.

**Settings in `js/data.js`** (each one is used only once it's filled in):
- `site.social`: your Facebook, Instagram, TikTok ... page addresses (helps Google connect the site to your brand).
- `site.verification`: Google Search Console / Bing Webmaster Tools "HTML tag" codes (not needed if you verify by DNS).
- `policies`: `returnDays`, `returnFees`, `deliveryDays`, `warranty`. Google shows shops with a stated return policy and delivery time more prominently, and Merchant Center needs a return policy.
- `contact`: Viber number, email and so on, also used in the structured data.

**Where to edit the words**: `js/data.js` holds the site name and description (`site`), the listing page titles, descriptions and intro text (`pages`), each category's `seoTitle`, `intro` and `metaDescription`, and the placeholder products. Brand notes and the guides are in `js/app.js` (`BRAND_INFO`, `GUIDES`). The live address comes from GitHub Pages during deployment (`SITE_URL`/`BASE_PATH`), falling back to `site.url`.

## Bikes from Cycle Beast
The bikes, prices and stock come from Cycle Beast's catalog feed:

```
GET https://cycle-beast.vercel.app/api/feed/cycle-central?key=<CATALOG_FEED_KEY>
```

**Setup (once):** in this repository go to **Settings → Secrets and variables → Actions → New repository secret**, name it `CATALOG_FEED_KEY` and paste the key. The next deploy uses it. Until it's set, the placeholder bikes in `js/data.js` are shown. To use a different feed address, add a repository *variable* `CATALOG_FEED_URL`.

**When the site updates:** on every push, every hour (at :23), and on demand from the Actions tab (**Deploy to GitHub Pages → Run workflow**). Cycle Beast can also trigger a rebuild right away by calling GitHub's `repository_dispatch` with event type `cycle-beast-updated`; this needs a GitHub token with permission to start workflows on this repository.

**How the feed becomes pages** (`scripts/catalog.mjs`, run by `npm run build`):
- Rows are grouped by **brand + model** (plus year, when a model is sold in more than one year) into one page per model at `/products/<brand-model>/`, with its colours and sizes as options.
- **Every SKU gets its own page** at `/products/<sku in lowercase>/`, so links shared on Facebook keep working. It opens the model with that colour and size picked. Search engines are pointed at the model page (canonical link), while the share preview keeps the SKU's own address. Choosing a colour and size on a model page also switches the address to that SKU.
- `price` is the selling price; when it's lower than `srp`, the SRP is shown crossed out. If only `srp` and `discountPercent` are given, the price is worked out from them.
- `availability`: in stock shows "In stock" (and "Only N left" when a quantity is given). **Anything not in stock is "Available to order", never sold out**, and can still be added to the cart. The order message tells the sales rep which SKUs are to order.
- `photos` are used in this order: the colour's own photos, then the model's. They must be public `https://` addresses. A model with no photos shows a drawing.
- `specs`, `description` (paragraphs separated by a blank line) and `highlights` (list, or one per line) show on the product page and in comparisons.
- **What each product is** comes from a `category` field if the feed has one (for example `Road`, `Gravel`, `Mountain`, `City`, `Folding`, `E-bike`, `Tires`, `Components`, `Gear`). Without it, the importer works it out in this order:
  1. **Parts**: brands that only make parts (Michelin, Continental, Shimano ...), part words in the name (tire, helmet, saddle ...), or tire specs (TPI, bead, casing). These go to **Parts & Gear**: tires and wheels under Wheels & Tires.
  2. **E-bikes**: a real motor or e-bike battery in the specs (Bosch, Wh, Nm ...), or an e-bike name (Rail+, Moterra Neo). Electronic-shifting batteries (SRAM AXS, Shimano Di2) don't count.
  3. **Known model families** in the name: Domane, Madone, SuperSix and Synapse are road; Checkpoint and Topstone are gravel; Marlin, Procaliber and Trail are mountain; FX, Verve and Quick are city.
  4. Otherwise, the words used most in the name, description and highlights.

  The build log says how each product was typed. **Adding `category` to the feed is the reliable fix** for anything listed under "Other" or in the wrong place.
- Names with "Frameset" are listed with the bikes of their type, but the Bike Finder doesn't suggest them as complete bikes.
- Only these fields are copied, so anything else in the feed never reaches the public site.
- If the key is set but the feed can't be read (wrong key, Cycle Beast down, not JSON, no bikes), the build stops and the site that's already live stays up. The key is never printed.
- Each run's summary on GitHub (Actions → the run) lists every imported model with its type, price, SKUs, stock and photo count, plus anything to check.
- Photos are downloaded once and kept in `.cache/img` between runs (see SEO above); a photo that can't be downloaded keeps its original address and is listed in the run summary.
- Parts & Gear shows the parts found in the feed. When the feed has none, that section is hidden. A part sold in several sizes or colours (like a tire) is picked by size, the same way as a bike.

Test the import locally with the sample feed: `CATALOG_FEED_FILE=scripts/fixtures/sample-feed.json npm run build`.

## Customising
- **Brand colours and fonts**: they live in the tokens at the top of `css/styles.css`.
- **Inventory**: comes from Cycle Beast (see above). Without the feed key, the placeholder items in `js/data.js` are used; the comment at the top of that file lists every field. Give a product an `image` URL to use a real photo in place of the drawn illustration (`js/art.js`).
- **Bike specs**: use the standard spec names (Frame, Gearing, Brakes, Weight and so on) so cards, filters and compare tables line up. `bestFor` and `fit` (terrain, goal, level) drive the Bike Finder.
- **Star ratings** only show for products that have a `reviews` count, so they always come from real reviews.
- **Contact channels**: fill in `contact` at the top of `js/data.js` (Viber number, Viber community link, Messenger, phone, email, hours, store). Anything left empty is hidden. Until a Viber number or Messenger link is set, the site tells shoppers the ordering line opens soon and offers Copy only.
- **Budget ranges, sizes and shipping fee**: `finder`, `priceBands`, `sizes` and `shippingFee` in `js/data.js`.
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
