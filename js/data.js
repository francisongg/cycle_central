/*
 * PLACEHOLDER INVENTORY
 * ---------------------
 * Replace these entries with the real inventory. Each item needs:
 *   id, type ("bike" | "part"), category, name, price (PHP), and optionally
 *   compareAt (original price), tag, colors, specs, rating, stock, image.
 * If `image` is set (a URL/path), it is used instead of the generated SVG.
 *
 * SEO fields (all optional; sensible defaults are generated when missing):
 *   product.description  one or two sentences shown on the product page and
 *                        used for its Google snippet
 *   product.slug         web address, e.g. "aero-road-cf-8" -> /products/aero-road-cf-8/
 *   category.seoTitle / category.intro / category.metaDescription
 */
window.CC_DATA = {
  // Site-wide settings used for page titles, links and Google results
  site: {
    name: "Cycle Central",
    url: "https://cyclecentral.ph",
    tagline: "Online Bike Shop in the Philippines",
    description: "Shop road, gravel, mountain, city and electric bikes, plus parts and gear, at Cycle Central. Compare bikes, take the Bike Finder quiz and earn rewards.",
    locale: "en_PH",
    language: "en-PH",
    currency: "PHP"
  },

  // Copy for the main listing pages (title tag, Google description, intro text)
  pages: {
    home: {
      aboutTitle: "Bike shop in the Philippines",
      about: "Cycle Central sells road, gravel, mountain, city and electric bikes, plus components, wheels, tires and riding gear. Browse by category, compare bikes side by side, or take the Bike Finder quiz to find the right fit. Every purchase earns XP in the Rider Club, which unlocks member discounts. All prices are in Philippine pesos."
    },
    bikes: {
      seoTitle: "Bikes for Sale in the Philippines",
      intro: "Road, gravel, mountain, city and electric bikes in one place. Filter by type and price, compare up to three bikes side by side, or take the Bike Finder quiz to get matched.",
      metaDescription: "Shop road, gravel, mountain, city and electric bikes at Cycle Central. Filter by price, compare bikes side by side and find your match with the Bike Finder."
    },
    parts: {
      seoTitle: "Bike Parts, Wheels & Cycling Gear",
      intro: "Upgrade or repair your ride with groupsets, brakes, handlebars, wheels, tires, helmets, lights and other accessories.",
      metaDescription: "Shop bike parts at Cycle Central: groupsets, brakes, handlebars, wheelsets, tires, helmets, bike computers, lights and accessories. Prices in pesos."
    },
    sale: {
      seoTitle: "Bike Sale: Discounted Bikes, Parts & Gear",
      intro: "Bikes, parts and gear with reduced prices. The original price is shown crossed out next to the sale price.",
      metaDescription: "Discounted bikes, parts and cycling gear at Cycle Central. See current sale prices on road and mountain bikes, components and accessories."
    },
    rewards: {
      seoTitle: "Rider Club Rewards",
      metaDescription: "Earn XP every time you shop at Cycle Central. Unlock badges and member discounts as you level up from Rookie to Champion in the Rider Club."
    }
  },

  categories: [
    { id: "road",     label: "Road",     type: "bike", blurb: "Built for speed on tarmac.",
      singular: "Road Bike", seoTitle: "Road Bikes for Sale in the Philippines",
      intro: "Road bikes are built for speed and efficiency on paved roads, from weekend group rides to long climbs. Choose from aero carbon race bikes to comfortable endurance bikes." },
    { id: "gravel",   label: "Gravel",   type: "bike", blurb: "Pavement ends. Fun doesn't.",
      singular: "Gravel Bike", seoTitle: "Gravel Bikes for Sale in the Philippines",
      intro: "Gravel bikes handle tarmac, dirt roads and rough backroads on one bike, with wider tires and stable handling for long days out." },
    { id: "mountain", label: "Mountain", type: "bike", blurb: "Trails, roots and rock gardens.",
      singular: "Mountain Bike", seoTitle: "Mountain Bikes (MTB) for Sale in the Philippines",
      intro: "Mountain bikes for trail riding, cross-country and descents, with hardtail and full-suspension options." },
    { id: "city",     label: "City",     type: "bike", blurb: "Commute in comfort and style.",
      singular: "City Bike", seoTitle: "City & Commuter Bikes for Sale in the Philippines",
      intro: "City and commuter bikes for daily rides around town, with upright riding positions and practical extras like fenders and racks." },
    { id: "electric", label: "Electric", type: "bike", blurb: "Go further with a boost.",
      singular: "Electric Bike", seoTitle: "Electric Bikes (E-Bikes) for Sale in the Philippines",
      intro: "Electric bikes with pedal assist that make commutes easier and let you ride further on roads and trails." },
    { id: "components", label: "Components", type: "part", blurb: "Drivetrains, brakes, cockpits.",
      singular: "Bike Component", seoTitle: "Bike Components: Groupsets, Brakes & Handlebars",
      intro: "Groupsets, brakes, handlebars and other bike components for upgrades and repairs." },
    { id: "wheels",   label: "Wheels & Tires", type: "part", blurb: "Roll faster, grip harder.",
      singular: "Wheels & Tires", seoTitle: "Bike Wheels & Tires",
      intro: "Wheelsets and tires for road, gravel and trail riding, including tubeless options." },
    { id: "gear",     label: "Gear & Apparel", type: "part", blurb: "Helmets, kits and accessories.",
      singular: "Cycling Gear", seoTitle: "Cycling Gear & Accessories",
      intro: "Helmets, bike computers, lights, bottles and other cycling gear and accessories." }
  ],

  products: [
    // ---- Bikes ----
    { id: "b1", type: "bike", category: "road", name: "Aero Road CF 8",
      description: "A carbon aero road bike with a 12-speed electronic groupset and 50mm carbon wheels, built for fast group rides and racing.", price: 189000, compareAt: 215000, tag: "Sale",
      colors: ["#111111", "#e63946", "#f1faee"], rating: 4.8, stock: 4,
      specs: { Frame: "Carbon", Groupset: "12-speed electronic", Weight: "7.6 kg", Wheels: "50mm carbon" },
      quiz: { terrain: "road", goal: "speed", level: "advanced" } },
    { id: "b2", type: "bike", category: "road", name: "Endurance AL 6",
      description: "An aluminium endurance road bike with a comfortable riding position and 11-speed gearing, a good first road bike for fitness riding.", price: 78000, tag: "New",
      colors: ["#1d3557", "#a8dadc"], rating: 4.6, stock: 12,
      specs: { Frame: "Aluminium", Groupset: "11-speed mechanical", Weight: "9.2 kg", Wheels: "Alloy" },
      quiz: { terrain: "road", goal: "fitness", level: "beginner" } },
    { id: "b3", type: "bike", category: "gravel", name: "Gravel Explorer 7",
      description: "An aluminium gravel bike with a 1x12 drivetrain and 45mm tires for mixed roads, dirt and weekend adventures.", price: 112000,
      colors: ["#6b705c", "#ddbea9"], rating: 4.7, stock: 7,
      specs: { Frame: "Aluminium", Groupset: "1x12 mechanical", Weight: "9.8 kg", Tires: "45mm" },
      quiz: { terrain: "mixed", goal: "adventure", level: "intermediate" } },
    { id: "b4", type: "bike", category: "gravel", name: "Gravel CF Race 9",
      description: "A carbon gravel race bike with a 2x12 electronic groupset and fast 40mm tires, made for speed on mixed surfaces.", price: 168000, tag: "Hot",
      colors: ["#264653", "#e9c46a"], rating: 4.9, stock: 3,
      specs: { Frame: "Carbon", Groupset: "2x12 electronic", Weight: "8.4 kg", Tires: "40mm" },
      quiz: { terrain: "mixed", goal: "speed", level: "advanced" } },
    { id: "b5", type: "bike", category: "mountain", name: "Trail 140 AL",
      description: "An aluminium trail mountain bike with 140mm of travel, a 1x12 drivetrain and 29-inch wheels for technical trails.", price: 125000,
      colors: ["#2a9d8f", "#111111"], rating: 4.6, stock: 9,
      specs: { Frame: "Aluminium", Travel: "140mm", Groupset: "1x12", Wheels: "29\"" },
      quiz: { terrain: "trail", goal: "adventure", level: "intermediate" } },
    { id: "b6", type: "bike", category: "mountain", name: "Hardtail XC 5",
      description: "An aluminium cross-country hardtail with a 100mm fork, 1x10 gearing and 29-inch wheels, a solid start on the trails.", price: 54000, compareAt: 62000, tag: "Sale",
      colors: ["#f4a261", "#222222"], rating: 4.4, stock: 15,
      specs: { Frame: "Aluminium", Travel: "100mm fork", Groupset: "1x10", Wheels: "29\"" },
      quiz: { terrain: "trail", goal: "fitness", level: "beginner" } },
    { id: "b7", type: "bike", category: "city", name: "Urban Glide 3",
      description: "An 8-speed aluminium city bike with fenders and a rack, made for daily commutes and errands around town.", price: 32000,
      colors: ["#457b9d", "#f1faee", "#111111"], rating: 4.5, stock: 20,
      specs: { Frame: "Aluminium", Gears: "8-speed", Extras: "Fenders, rack", Weight: "11.5 kg" },
      quiz: { terrain: "city", goal: "commute", level: "beginner" } },
    { id: "b8", type: "bike", category: "electric", name: "E-Commuter 500",
      description: "An electric commuter bike with a 250W mid-drive motor and a 500Wh battery with up to 100 km of range.", price: 98000, tag: "New",
      colors: ["#222222", "#adb5bd"], rating: 4.7, stock: 6,
      specs: { Motor: "250W mid-drive", Battery: "500Wh", Range: "Up to 100 km", Frame: "Aluminium" },
      quiz: { terrain: "city", goal: "commute", level: "intermediate" } },
    { id: "b9", type: "bike", category: "electric", name: "E-Trail 160",
      description: "A long-travel electric mountain bike with an 85Nm motor, a 750Wh battery and 160mm of travel for big trail days.", price: 245000,
      colors: ["#0b3d2e", "#111111"], rating: 4.9, stock: 2,
      specs: { Motor: "85Nm mid-drive", Battery: "750Wh", Travel: "160mm", Wheels: "29/27.5\"" },
      quiz: { terrain: "trail", goal: "adventure", level: "advanced" } },

    // ---- Parts ----
    { id: "p1", type: "part", category: "components", name: "12-Speed Groupset",
      description: "A complete 12-speed groupset with shifters, derailleurs, crankset, cassette and chain for a full drivetrain upgrade.", price: 42000, rating: 4.7, stock: 8, icon: "gear", tag: "Hot" },
    { id: "p2", type: "part", category: "components", name: "Hydraulic Disc Brake Set",
      description: "A front and rear hydraulic disc brake set for strong, consistent stopping in all weather.", price: 9800, rating: 4.6, stock: 14, icon: "brake" },
    { id: "p3", type: "part", category: "components", name: "Carbon Handlebar",
      description: "A lightweight carbon handlebar that reduces weight and road vibration.", price: 7500, compareAt: 8900, tag: "Sale", rating: 4.5, stock: 10, icon: "bar" },
    { id: "p4", type: "part", category: "wheels", name: "Carbon Wheelset 45mm",
      description: "A 45mm-deep carbon wheelset that is fast on flat roads and light enough for climbing.", price: 58000, rating: 4.8, stock: 5, icon: "wheel" },
    { id: "p5", type: "part", category: "wheels", name: "Tubeless Road Tire 28c",
      description: "A 28mm tubeless road tire with low rolling resistance and good grip.", price: 2600, rating: 4.6, stock: 40, icon: "tire" },
    { id: "p6", type: "part", category: "wheels", name: "Gravel Tire 45mm",
      description: "A 45mm tubeless-ready gravel tire with a fast center tread and grippy side knobs.", price: 2900, rating: 4.5, stock: 30, icon: "tire", tag: "New" },
    { id: "p7", type: "part", category: "gear", name: "Aero Helmet",
      description: "An aerodynamic road helmet with vents to keep you cool on hot rides.", price: 8500, rating: 4.7, stock: 18, icon: "helmet" },
    { id: "p8", type: "part", category: "gear", name: "Bike Computer GPS",
      description: "A GPS bike computer that tracks speed, distance and routes, with turn-by-turn navigation.", price: 14500, rating: 4.8, stock: 9, icon: "computer" },
    { id: "p9", type: "part", category: "gear", name: "Front & Rear Light Set",
      description: "A rechargeable front and rear light set so you can see and be seen on early and late rides.", price: 2200, compareAt: 2800, tag: "Sale", rating: 4.4, stock: 50, icon: "light" },
    { id: "p10", type: "part", category: "gear", name: "Bottle Cage + Bottle",
      description: "A lightweight bottle cage with a matching water bottle.", price: 950, rating: 4.3, stock: 60, icon: "bottle" }
  ],

  // Gamification config
  levels: [
    { name: "Rookie",     min: 0 },
    { name: "Domestique", min: 150 },
    { name: "Climber",    min: 400 },
    { name: "Sprinter",   min: 800 },
    { name: "Champion",   min: 1500 }
  ],
  freeShippingThreshold: 5000,
  spinPrizes: [
    { label: "5% OFF",   code: "SPIN5",   pct: 5 },
    { label: "+50 XP",   xp: 50 },
    { label: "10% OFF",  code: "SPIN10",  pct: 10 },
    { label: "Free Ship", code: "SHIPFREE", ship: true },
    { label: "+25 XP",   xp: 25 },
    { label: "3% OFF",   code: "SPIN3",   pct: 3 },
    { label: "+100 XP",  xp: 100 },
    { label: "Try again" }
  ]
};
