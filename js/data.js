/*
 * PLACEHOLDER INVENTORY
 * ---------------------
 * Replace these entries with the real inventory. Each item needs:
 *   id, type ("bike" | "part"), category, name, price (PHP)
 * and can have:
 *   compareAt     original price, shown crossed out (the item counts as "on sale")
 *   tag           "New" | "Hot" (a Sale tag is added automatically from compareAt)
 *   colors        frame colours: [{ name: "Red", hex: "#e63946" }, ...]
 *   stock         units left; leave it out for "in stock", 0 = sold out
 *   image         URL/path of a product photo (used instead of the drawn illustration)
 *   description   one or two sentences for the product page and Google snippet
 *   slug          web address, e.g. "aero-road-cf-8" -> /products/aero-road-cf-8/
 *   rating + reviews   star rating and number of reviews. Stars only show when
 *                      `reviews` is set, so ratings always come from real reviews.
 *
 * Bikes only:
 *   bestFor       a few words: what this bike is best at (shown on cards)
 *   fit           { terrain: "road"|"mixed"|"trail"|"city",
 *                   goal: "speed"|"fitness"|"adventure"|"commute",
 *                   level: "beginner"|"intermediate"|"advanced" }
 *                 The Bike Finder uses this to rank bikes for a shopper.
 *   specs         Use these names so cards, filters and compare line up:
 *                 Frame, Fork, Suspension, Groupset, Gearing, Brakes, Wheels, Tires,
 *                 Weight ("9.2 kg"), Motor, Battery, Range, Extras
 *
 * Categories and listing pages: seoTitle / intro / metaDescription (all optional).
 */
window.CC_DATA = {
  // Site-wide settings used for page titles, links and Google results
  site: {
    name: "Cycle Central",
    url: "https://cyclecentral.ph",
    tagline: "Your Go-To Bike Shop in the Philippines",
    description: "Shop road, gravel, mountain, city and electric bikes, plus parts and gear, at Cycle Central. Set your budget, compare specs side by side and find the right bike.",
    locale: "en_PH",
    language: "en-PH",
    currency: "PHP",
    alternateName: "cyclecentral.ph",
    // Your public pages (Facebook, Instagram, TikTok, YouTube ...). Google uses these to
    // connect the site to your brand, e.g. ["https://www.facebook.com/cyclecentralph"]
    social: [],
    // Codes from Google Search Console and Bing Webmaster Tools ("HTML tag" method: the
    // content="..." value only). Not needed if you verify with a DNS record instead.
    verification: { google: "", bing: "" }
  },

  // Rider Club rewards: XP and levels with member discounts, badges, the Daily Spin wheel (discount
  // codes) and Bike Town's coins and Town Pass. Switched off for now: set to true to bring it all back.
  rewards: false,

  // Mailing list. The signup appears in the footer, on the home page and on the blog once
  // `action` is set; until then it's hidden. See docs/mailing-list.md.
  //  - Cycle Beast (recommended): action: "https://cycle-beast.vercel.app/api/newsletter/subscribe",
  //    emailField: "email", cors: true
  //  - or an email service's signup form (Brevo, MailerLite, Kit, Buttondown, Mailchimp): paste
  //    the form's action="..." URL and its email field name (Brevo/Mailchimp "EMAIL",
  //    MailerLite "fields[email]", Kit "email_address", Buttondown "email"), cors: false
  newsletter: {
    action: "",
    emailField: "email",
    cors: false,          // true for Cycle Beast: it replies, so errors can be shown
    hidden: {},           // extra hidden fields an email service's form needs, as { name: "value" }
    title: "Get new arrivals, deals and riding tips",
    text: "One email every couple of weeks from Cycle Central. Unsubscribe anytime."
  },

  // Store policies. Each one shows on the site and in Google results only once it's filled in,
  // so nothing is promised that isn't your policy. Google shows shops with a clear return
  // policy and delivery time more prominently.
  policies: {
    returnDays: null,     // days to return an item, e.g. 7. Use 0 if you don't accept returns
    returnFees: null,     // "free" (you pay return shipping) or "customer" (the customer pays)
    deliveryDays: null,   // working days from confirming an order to delivery, e.g. [2, 7]
    warranty: ""          // e.g. "Manufacturer warranty on frames and components"
  },

  // How customers reach you to order. Leave a value empty ("") to hide it on the site.
  // There is no online payment yet: customers send an order request by chat and a
  // sales rep confirms stock, size, price, delivery and payment.
  contact: {
    viber: "",           // Viber number with country code, e.g. "+63 917 123 4567"
    viberCommunity: "",  // Viber community invite link, e.g. "https://invite.viber.com/?g2=..."
    messenger: "",       // Messenger link, e.g. "https://m.me/cyclecentralph"
    phone: "",           // shown as a call link
    email: "",
    hours: "",           // e.g. "Mon–Sat, 10am–7pm"
    store: null          // a shop customers can visit: { name: "", address: "", mapUrl: "", hours: "" }
  },

  // Copy for the main listing pages (title tag, Google description, intro text)
  pages: {
    home: {
      aboutTitle: "Bike shop in the Philippines",
      about: "Cycle Central sells road, gravel, mountain, city and electric bikes, plus components, wheels, tires and riding gear. Set your budget to see the best bikes for it, compare specs side by side, or browse by category. All prices are in Philippine pesos."
    },
    bikes: {
      seoTitle: "Bikes for Sale in the Philippines",
      intro: "Road, gravel, mountain, city and electric bikes in one place. Filter by type and price, compare up to three bikes side by side, or let the Bike Finder pick the best ones for your budget.",
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
    finder: {
      seoTitle: "Bike Finder: Find the Best Bike for Your Budget",
      intro: "Set your budget and how you ride. We rank every bike in the shop for you and explain why each one fits.",
      metaDescription: "Tell Cycle Central your budget and where you ride. The Bike Finder ranks road, gravel, mountain, city and electric bikes for you and explains each pick."
    },
    order: {
      seoTitle: "How to Order a Bike Online: Order by Chat, No Online Payment",
      intro: "No online payment needed. Build your cart, send us your order request in one tap, and a sales rep confirms the details with you.",
      metaDescription: "How to buy a bike from Cycle Central: choose your bike, send an order request from your cart, and our sales team confirms stock, size, price and delivery with you."
    },
    rewards: {
      seoTitle: "Rider Club Rewards",
      metaDescription: "Earn XP every time you shop at Cycle Central. Unlock badges and member discounts as you level up from Rookie to Champion in the Rider Club."
    }
  },

  categories: [
    { id: "road",     label: "Road",     type: "bike", blurb: "Built for speed on tarmac.",
      singular: "Road Bike", seoTitle: "Road Bikes for Sale in the Philippines",
      intro: "Road bikes are built for speed and efficiency on paved roads, from weekend group rides to long climbs. Choose from aero carbon race bikes to comfortable endurance bikes.",
      metaDescription: "Road bikes for sale in the Philippines: aero, race and endurance road bikes with prices in pesos, full specs and sizes. Compare and order by chat." },
    { id: "gravel",   label: "Gravel",   type: "bike", blurb: "Pavement ends. Fun doesn't.",
      singular: "Gravel Bike", seoTitle: "Gravel Bikes for Sale in the Philippines",
      intro: "Gravel bikes handle tarmac, dirt roads and rough backroads on one bike, with wider tires and stable handling for long days out.",
      metaDescription: "Gravel bikes for sale in the Philippines: drop-bar bikes with wide tires for tarmac, dirt and backroads. Prices in pesos, full specs and sizes." },
    { id: "mountain", label: "Mountain", type: "bike", blurb: "Trails, roots and rock gardens.",
      singular: "Mountain Bike", seoTitle: "Mountain Bikes (MTB) for Sale in the Philippines",
      intro: "Mountain bikes for trail riding, cross-country and descents, with hardtail and full-suspension options.",
      metaDescription: "Mountain bikes (MTB) for sale in the Philippines: hardtail and full-suspension trail bikes with prices in pesos, full specs and sizes." },
    { id: "city",     label: "City",     type: "bike", blurb: "Commute in comfort and style.",
      singular: "City Bike", seoTitle: "City & Commuter Bikes for Sale in the Philippines",
      intro: "City and commuter bikes for daily rides around town, with upright riding positions and practical extras like fenders and racks.",
      metaDescription: "City, commuter and hybrid bikes for sale in the Philippines, with upright riding positions and practical extras. Prices in pesos, specs and sizes." },
    { id: "electric", label: "Electric", type: "bike", blurb: "Go further with a boost.",
      singular: "Electric Bike", seoTitle: "Electric Bikes (E-Bikes) for Sale in the Philippines",
      intro: "Electric bikes with pedal assist that make commutes easier and let you ride further on roads and trails.",
      metaDescription: "Electric bikes (e-bikes) for sale in the Philippines: pedal-assist road, city and mountain e-bikes with motor, battery and range specs. Prices in pesos." },
    { id: "folding",  label: "Folding",  type: "bike", blurb: "Small wheels, packs down small.",
      singular: "Folding Bike", seoTitle: "Folding Bikes for Sale in the Philippines",
      intro: "Folding bikes fold down to fit in a car, a condo or on the train, so the ride can start wherever you are.",
      metaDescription: "Folding bikes for sale in the Philippines that fit in a car, condo or train. Prices in pesos, full specs, weights and folded sizes." },
    { id: "other",    label: "Other",    type: "bike", blurb: "More bikes from our range.",
      singular: "Bike", seoTitle: "More Bikes",
      intro: "Bikes from our range that don't fit the other types.",
      metaDescription: "More bikes from the Cycle Central range, with prices in Philippine pesos, full specs, sizes and colours." },
    { id: "components", label: "Components", type: "part", blurb: "Drivetrains, brakes, cockpits.",
      singular: "Bike Component", seoTitle: "Bike Components: Groupsets, Brakes & Handlebars",
      intro: "Groupsets, brakes, handlebars and other bike components for upgrades and repairs.",
      metaDescription: "Bike components in the Philippines: groupsets, brakes, handlebars and other upgrades and replacement parts, with prices in pesos." },
    { id: "wheels",   label: "Wheels & Tires", type: "part", blurb: "Roll faster, grip harder.",
      singular: "Wheels & Tires", seoTitle: "Bike Tires & Wheels Philippines: Road, Gravel & MTB Tires",
      intro: "Wheelsets and tires for road, gravel and trail riding, including tubeless options.",
      metaDescription: "Bike tires and wheels in the Philippines: road, gravel and mountain bike tires and wheelsets, including tubeless options. Prices in pesos." },
    { id: "gear",     label: "Gear & Apparel", type: "part", blurb: "Helmets, kits and accessories.",
      singular: "Cycling Gear", seoTitle: "Cycling Gear & Accessories",
      intro: "Helmets, bike computers, lights, bottles and other cycling gear and accessories.",
      metaDescription: "Cycling gear and accessories in the Philippines: helmets, bike computers, lights, bottles and more, with prices in pesos." }
  ],

  products: [
    // ---- Bikes ----
    { id: "b10", type: "bike", category: "road", name: "Sprint AL 3", price: 42000,
      description: "An aluminium road bike with easy gearing and confident disc brakes, a friendly first step into road cycling.",
      bestFor: "Your first road bike", colors: [{ name: "Blue", hex: "#3c78c6" }, { name: "Charcoal", hex: "#1c2126" }], stock: 14,
      fit: { terrain: "road", goal: "fitness", level: "beginner" },
      specs: { Frame: "Aluminium", Fork: "Alloy", Groupset: "Mechanical 8-speed", Gearing: "2×8 speed", Brakes: "Mechanical disc", Wheels: "700c alloy", Tires: "28 mm", Weight: "10.4 kg" } },
    { id: "b11", type: "bike", category: "road", name: "Tempo AL 4", price: 49500, tag: "New",
      description: "A lighter aluminium road bike with a carbon fork and 20 gears, quick enough for weekend group rides without the race-bike price.",
      bestFor: "Fast weekend rides on a budget", colors: [{ name: "Red", hex: "#e63946" }, { name: "Charcoal", hex: "#1c2126" }, { name: "Cream", hex: "#eeebe3" }], stock: 9,
      fit: { terrain: "road", goal: "speed", level: "beginner" },
      specs: { Frame: "Aluminium", Fork: "Carbon", Groupset: "Mechanical 10-speed", Gearing: "2×10 speed", Brakes: "Mechanical disc", Wheels: "700c alloy", Tires: "28 mm", Weight: "9.8 kg" } },
    { id: "b2", type: "bike", category: "road", name: "Endurance AL 6", price: 78000,
      description: "An aluminium endurance road bike with a relaxed riding position, hydraulic brakes and room for wider tires on long days.",
      bestFor: "Long rides in comfort", colors: [{ name: "Navy", hex: "#1d3557" }, { name: "Mint", hex: "#a8dadc" }], stock: 12,
      fit: { terrain: "road", goal: "fitness", level: "intermediate" },
      specs: { Frame: "Aluminium", Fork: "Carbon", Groupset: "Mechanical 11-speed", Gearing: "2×11 speed", Brakes: "Hydraulic disc", Wheels: "700c alloy", Tires: "32 mm", Weight: "9.2 kg" } },
    { id: "b1", type: "bike", category: "road", name: "Aero Road CF 8", price: 189000, compareAt: 215000,
      description: "A carbon aero road bike with a 12-speed electronic groupset and 50mm carbon wheels, built for fast group rides and racing.",
      bestFor: "Racing and fast group rides", colors: [{ name: "Black", hex: "#111111" }, { name: "Red", hex: "#e63946" }, { name: "White", hex: "#f1faee" }], stock: 4,
      fit: { terrain: "road", goal: "speed", level: "advanced" },
      specs: { Frame: "Carbon", Fork: "Carbon", Groupset: "Electronic 12-speed", Gearing: "2×12 speed", Brakes: "Hydraulic disc", Wheels: "700c carbon, 50 mm deep", Tires: "28 mm", Weight: "7.6 kg" } },

    { id: "b12", type: "bike", category: "gravel", name: "Gravel Rover 3", price: 47000,
      description: "An aluminium gravel bike with 40mm tires and mounts for racks and bags, ready for rough roads and light trails.",
      bestFor: "Mixed roads and light trails", colors: [{ name: "Olive", hex: "#6b705c" }, { name: "Charcoal", hex: "#1c2126" }], stock: 11,
      fit: { terrain: "mixed", goal: "adventure", level: "beginner" },
      specs: { Frame: "Aluminium", Fork: "Alloy", Groupset: "Mechanical 9-speed", Gearing: "2×9 speed", Brakes: "Mechanical disc", Wheels: "700c alloy", Tires: "40 mm", Weight: "11.0 kg" } },
    { id: "b3", type: "bike", category: "gravel", name: "Gravel Explorer 7", price: 112000,
      description: "An aluminium gravel bike with a 1x12 drivetrain and 45mm tires for mixed roads, dirt and weekend adventures.",
      bestFor: "Weekend adventures off the tarmac", colors: [{ name: "Olive", hex: "#6b705c" }, { name: "Sand", hex: "#ddbea9" }], stock: 7,
      fit: { terrain: "mixed", goal: "adventure", level: "intermediate" },
      specs: { Frame: "Aluminium", Fork: "Carbon", Groupset: "Mechanical 12-speed", Gearing: "1×12 speed", Brakes: "Hydraulic disc", Wheels: "700c alloy, tubeless ready", Tires: "45 mm", Weight: "9.8 kg" } },
    { id: "b4", type: "bike", category: "gravel", name: "Gravel CF Race 9", price: 168000, tag: "Hot",
      description: "A carbon gravel race bike with a 2x12 electronic groupset and fast 40mm tires, made for speed on mixed surfaces.",
      bestFor: "Gravel racing", colors: [{ name: "Deep Teal", hex: "#264653" }, { name: "Gold", hex: "#e9c46a" }], stock: 3,
      fit: { terrain: "mixed", goal: "speed", level: "advanced" },
      specs: { Frame: "Carbon", Fork: "Carbon", Groupset: "Electronic 12-speed", Gearing: "2×12 speed", Brakes: "Hydraulic disc", Wheels: "700c carbon", Tires: "40 mm", Weight: "8.4 kg" } },

    { id: "b13", type: "bike", category: "mountain", name: "Hardtail XC 3", price: 36000,
      description: "An aluminium hardtail with a 100mm suspension fork and wide-range gearing, a simple and sturdy way to start trail riding.",
      bestFor: "Starting out on trails", colors: [{ name: "Teal", hex: "#2a9d8f" }, { name: "Charcoal", hex: "#1c2126" }], stock: 16,
      fit: { terrain: "trail", goal: "fitness", level: "beginner" },
      specs: { Frame: "Aluminium", Suspension: "100 mm fork (coil)", Groupset: "Mechanical 9-speed", Gearing: "2×9 speed", Brakes: "Mechanical disc", Wheels: "29 in alloy", Tires: "2.25 in", Weight: "14.1 kg" } },
    { id: "b6", type: "bike", category: "mountain", name: "Hardtail XC 5", price: 54000, compareAt: 62000,
      description: "An aluminium cross-country hardtail with a 100mm air fork, 1x11 gearing and 29-inch wheels, light enough to climb and quick on flowing trails.",
      bestFor: "Cross-country trails and climbs", colors: [{ name: "Orange", hex: "#f4a261" }, { name: "Black", hex: "#222222" }], stock: 15,
      fit: { terrain: "trail", goal: "fitness", level: "beginner" },
      specs: { Frame: "Aluminium", Suspension: "100 mm fork (air)", Groupset: "Mechanical 11-speed", Gearing: "1×11 speed", Brakes: "Hydraulic disc", Wheels: "29 in alloy, tubeless ready", Tires: "2.25 in", Weight: "12.9 kg" } },
    { id: "b5", type: "bike", category: "mountain", name: "Trail 140 AL", price: 125000,
      description: "An aluminium trail mountain bike with 140mm of travel front and rear, a 1x12 drivetrain and 29-inch wheels for technical trails.",
      bestFor: "Technical trails and descents", colors: [{ name: "Teal", hex: "#2a9d8f" }, { name: "Black", hex: "#111111" }], stock: 9,
      fit: { terrain: "trail", goal: "adventure", level: "intermediate" },
      specs: { Frame: "Aluminium", Suspension: "140 mm front and rear", Groupset: "Mechanical 12-speed", Gearing: "1×12 speed", Brakes: "Hydraulic disc, 4-piston", Wheels: "29 in alloy, tubeless ready", Tires: "2.4 in", Weight: "14.6 kg" } },

    { id: "b7", type: "bike", category: "city", name: "Urban Glide 3", price: 32000,
      description: "An 8-speed aluminium city bike with fenders and a rack, made for daily commutes and errands around town.",
      bestFor: "Short commutes and errands", colors: [{ name: "Steel Blue", hex: "#457b9d" }, { name: "White", hex: "#f1faee" }, { name: "Black", hex: "#111111" }], stock: 20,
      fit: { terrain: "city", goal: "commute", level: "beginner" },
      specs: { Frame: "Aluminium", Fork: "Steel", Groupset: "Mechanical 8-speed", Gearing: "1×8 speed", Brakes: "Mechanical disc", Wheels: "700c alloy", Tires: "38 mm", Weight: "11.5 kg", Extras: "Fenders, rear rack" } },
    { id: "b14", type: "bike", category: "city", name: "Urban Glide 5", price: 45000,
      description: "A lighter 10-speed city bike with hydraulic brakes, fenders, a rack and built-in lights for commuting in any weather.",
      bestFor: "Daily commuting in any weather", colors: [{ name: "Charcoal", hex: "#1c2126" }, { name: "Brown", hex: "#92694b" }], stock: 10,
      fit: { terrain: "city", goal: "commute", level: "beginner" },
      specs: { Frame: "Aluminium", Fork: "Alloy", Groupset: "Mechanical 10-speed", Gearing: "1×10 speed", Brakes: "Hydraulic disc", Wheels: "700c alloy", Tires: "40 mm", Weight: "11.0 kg", Extras: "Fenders, rear rack, lights" } },

    { id: "b15", type: "bike", category: "electric", name: "E-City 300", price: 68000,
      description: "An electric city bike with a rear hub motor and up to 70 km of range, an easy way to arrive without the sweat.",
      bestFor: "Easy city rides with a boost", colors: [{ name: "Steel Blue", hex: "#457b9d" }, { name: "Charcoal", hex: "#1c2126" }], stock: 8,
      fit: { terrain: "city", goal: "commute", level: "beginner" },
      specs: { Motor: "250 W rear hub", Battery: "360 Wh", Range: "Up to 70 km", Frame: "Aluminium", Gearing: "1×8 speed", Brakes: "Mechanical disc", Wheels: "700c alloy", Tires: "42 mm", Weight: "20.8 kg", Extras: "Fenders, lights" } },
    { id: "b8", type: "bike", category: "electric", name: "E-Commuter 500", price: 98000, tag: "New",
      description: "An electric commuter bike with a 250W mid-drive motor and a 500Wh battery with up to 100 km of range.",
      bestFor: "Long commutes with a boost", colors: [{ name: "Black", hex: "#222222" }, { name: "Silver", hex: "#adb5bd" }], stock: 6,
      fit: { terrain: "city", goal: "commute", level: "intermediate" },
      specs: { Motor: "250 W mid-drive", Battery: "500 Wh", Range: "Up to 100 km", Frame: "Aluminium", Gearing: "1×9 speed", Brakes: "Hydraulic disc", Wheels: "700c alloy", Tires: "45 mm", Weight: "22.5 kg", Extras: "Fenders, rear rack, lights" } },
    { id: "b9", type: "bike", category: "electric", name: "E-Trail 160", price: 245000,
      description: "A long-travel electric mountain bike with an 85Nm motor, a 750Wh battery and 160mm of travel for big trail days.",
      bestFor: "Big trail days with a boost", colors: [{ name: "Forest Green", hex: "#0b3d2e" }, { name: "Black", hex: "#111111" }], stock: 2,
      fit: { terrain: "trail", goal: "adventure", level: "advanced" },
      specs: { Motor: "85 Nm mid-drive", Battery: "750 Wh", Range: "Up to 90 km", Frame: "Aluminium", Suspension: "160 mm front and rear", Gearing: "1×12 speed", Brakes: "Hydraulic disc, 4-piston", Wheels: "29 in front, 27.5 in rear", Tires: "2.5 in", Weight: "24.3 kg" } },

    // ---- Parts ----
    { id: "p1", type: "part", category: "components", name: "12-Speed Groupset",
      description: "A complete 12-speed groupset with shifters, derailleurs, crankset, cassette and chain for a full drivetrain upgrade.", price: 42000, stock: 8, icon: "gear", tag: "Hot", specs: { Speeds: "12", Includes: "Shifters, derailleurs, crankset, cassette, chain" } },
    { id: "p2", type: "part", category: "components", name: "Hydraulic Disc Brake Set",
      description: "A front and rear hydraulic disc brake set for strong, consistent stopping in all weather.", price: 9800, stock: 14, icon: "brake", specs: { Type: "Hydraulic disc", Includes: "Front and rear calipers, levers, hoses" } },
    { id: "p3", type: "part", category: "components", name: "Carbon Handlebar",
      description: "A lightweight carbon handlebar that reduces weight and road vibration.", price: 7500, compareAt: 8900, stock: 10, icon: "bar", specs: { Material: "Carbon", Width: "40 / 42 / 44 cm" } },
    { id: "p4", type: "part", category: "wheels", name: "Carbon Wheelset 45mm",
      description: "A 45mm-deep carbon wheelset that is fast on flat roads and light enough for climbing.", price: 58000, stock: 5, icon: "wheel", specs: { Depth: "45 mm", Material: "Carbon", Tubeless: "Yes" } },
    { id: "p5", type: "part", category: "wheels", name: "Tubeless Road Tire 28c",
      description: "A 28mm tubeless road tire with low rolling resistance and good grip.", price: 2600, stock: 40, icon: "tire", specs: { Width: "28 mm", Tubeless: "Yes" } },
    { id: "p6", type: "part", category: "wheels", name: "Gravel Tire 45mm",
      description: "A 45mm tubeless-ready gravel tire with a fast center tread and grippy side knobs.", price: 2900, stock: 30, icon: "tire", tag: "New", specs: { Width: "45 mm", Tubeless: "Ready" } },
    { id: "p7", type: "part", category: "gear", name: "Aero Helmet",
      description: "An aerodynamic road helmet with vents to keep you cool on hot rides.", price: 8500, stock: 18, icon: "helmet", specs: { Sizes: "S / M / L", Use: "Road" } },
    { id: "p8", type: "part", category: "gear", name: "Bike Computer GPS",
      description: "A GPS bike computer that tracks speed, distance and routes, with turn-by-turn navigation.", price: 14500, stock: 9, icon: "computer", specs: { Features: "GPS, navigation, ride tracking", Battery: "Up to 20 hours" } },
    { id: "p9", type: "part", category: "gear", name: "Front & Rear Light Set",
      description: "A rechargeable front and rear light set so you can see and be seen on early and late rides.", price: 2200, compareAt: 2800, stock: 50, icon: "light", specs: { Charging: "USB-C", Includes: "Front and rear light" } },
    { id: "p10", type: "part", category: "gear", name: "Bottle Cage + Bottle",
      description: "A lightweight bottle cage with a matching water bottle.", price: 950, stock: 60, icon: "bottle", specs: { Volume: "600 ml", Includes: "Cage and bottle" } }
  ],

  // Frame sizes and the rider heights (cm) they suit
  sizes: [
    { s: "XS", min: 150, max: 160 }, { s: "S", min: 160, max: 168 }, { s: "M", min: 168, max: 176 },
    { s: "L", min: 176, max: 184 }, { s: "XL", min: 184, max: 200 }
  ],

  // Bike Finder: budget slider range and quick-pick amounts.
  // "stretch" = how far over budget a bike can be and still be suggested (0.15 = 15%).
  finder: { budgetMin: 20000, budgetMax: 260000, step: 1000, defaultBudget: 50000, quick: [30000, 50000, 80000, 120000, 200000], stretch: 0.15 },

  // Price ranges offered as one-tap filters on listing pages: [from, to] (null = no limit)
  priceBands: {
    bike: [[0, 50000], [50000, 100000], [100000, 150000], [150000, null]],
    part: [[0, 3000], [3000, 10000], [10000, null]]
  },
  shippingFee: 350,

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
