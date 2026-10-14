# Cycle Central

An online store for bikes, parts and gear. The layout follows Canyon's site: a sticky header with mega-menus, a full-width hero, category tiles, and product rails. On top of that, the store is turned into a game.

It's a static site with no build step. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Features
- **Shop**: hash-routed pages for home, category and shop listings, product detail and rewards. Filter by category, price, search and sort.
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

## Customising
- **Brand colours and fonts**: edit the tokens at the top of `css/styles.css` (`--brand`, `--ink`, `--bg`, fonts and so on). Everything else picks them up.
- **Inventory**: replace the placeholder items in `js/data.js`. Give a product an `image` URL to use a real photo in place of the generated illustration.
- **Rewards tuning**: change levels, spin prizes and the free-shipping threshold in `js/data.js`. Change badge XP and level discounts in `js/app.js` (`BADGES`, `LEVEL_PERKS`).

Checkout is a demo for now. No payment provider is connected yet.
