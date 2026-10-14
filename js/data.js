/*
 * PLACEHOLDER INVENTORY
 * ---------------------
 * Replace these entries with the real inventory. Each item needs:
 *   id, type ("bike" | "part"), category, name, price (PHP), and optionally
 *   compareAt (original price), tag, colors, specs, rating, stock, image.
 * If `image` is set (a URL/path), it is used instead of the generated SVG.
 */
window.CC_DATA = {
  categories: [
    { id: "road",     label: "Road",     type: "bike", blurb: "Built for speed on tarmac." },
    { id: "gravel",   label: "Gravel",   type: "bike", blurb: "Pavement ends. Fun doesn't." },
    { id: "mountain", label: "Mountain", type: "bike", blurb: "Trails, roots and rock gardens." },
    { id: "city",     label: "City",     type: "bike", blurb: "Commute in comfort and style." },
    { id: "electric", label: "Electric", type: "bike", blurb: "Go further with a boost." },
    { id: "components", label: "Components", type: "part", blurb: "Drivetrains, brakes, cockpits." },
    { id: "wheels",   label: "Wheels & Tires", type: "part", blurb: "Roll faster, grip harder." },
    { id: "gear",     label: "Gear & Apparel", type: "part", blurb: "Helmets, kits and accessories." }
  ],

  products: [
    // ---- Bikes ----
    { id: "b1", type: "bike", category: "road", name: "Aero Road CF 8", price: 189000, compareAt: 215000, tag: "Sale",
      colors: ["#111111", "#e63946", "#f1faee"], rating: 4.8, stock: 4,
      specs: { Frame: "Carbon", Groupset: "12-speed electronic", Weight: "7.6 kg", Wheels: "50mm carbon" },
      quiz: { terrain: "road", goal: "speed", level: "advanced" } },
    { id: "b2", type: "bike", category: "road", name: "Endurance AL 6", price: 78000, tag: "New",
      colors: ["#1d3557", "#a8dadc"], rating: 4.6, stock: 12,
      specs: { Frame: "Aluminium", Groupset: "11-speed mechanical", Weight: "9.2 kg", Wheels: "Alloy" },
      quiz: { terrain: "road", goal: "fitness", level: "beginner" } },
    { id: "b3", type: "bike", category: "gravel", name: "Gravel Explorer 7", price: 112000,
      colors: ["#6b705c", "#ddbea9"], rating: 4.7, stock: 7,
      specs: { Frame: "Aluminium", Groupset: "1x12 mechanical", Weight: "9.8 kg", Tires: "45mm" },
      quiz: { terrain: "mixed", goal: "adventure", level: "intermediate" } },
    { id: "b4", type: "bike", category: "gravel", name: "Gravel CF Race 9", price: 168000, tag: "Hot",
      colors: ["#264653", "#e9c46a"], rating: 4.9, stock: 3,
      specs: { Frame: "Carbon", Groupset: "2x12 electronic", Weight: "8.4 kg", Tires: "40mm" },
      quiz: { terrain: "mixed", goal: "speed", level: "advanced" } },
    { id: "b5", type: "bike", category: "mountain", name: "Trail 140 AL", price: 125000,
      colors: ["#2a9d8f", "#111111"], rating: 4.6, stock: 9,
      specs: { Frame: "Aluminium", Travel: "140mm", Groupset: "1x12", Wheels: "29\"" },
      quiz: { terrain: "trail", goal: "adventure", level: "intermediate" } },
    { id: "b6", type: "bike", category: "mountain", name: "Hardtail XC 5", price: 54000, compareAt: 62000, tag: "Sale",
      colors: ["#f4a261", "#222222"], rating: 4.4, stock: 15,
      specs: { Frame: "Aluminium", Travel: "100mm fork", Groupset: "1x10", Wheels: "29\"" },
      quiz: { terrain: "trail", goal: "fitness", level: "beginner" } },
    { id: "b7", type: "bike", category: "city", name: "Urban Glide 3", price: 32000,
      colors: ["#457b9d", "#f1faee", "#111111"], rating: 4.5, stock: 20,
      specs: { Frame: "Aluminium", Gears: "8-speed", Extras: "Fenders, rack", Weight: "11.5 kg" },
      quiz: { terrain: "city", goal: "commute", level: "beginner" } },
    { id: "b8", type: "bike", category: "electric", name: "E-Commuter 500", price: 98000, tag: "New",
      colors: ["#222222", "#adb5bd"], rating: 4.7, stock: 6,
      specs: { Motor: "250W mid-drive", Battery: "500Wh", Range: "Up to 100 km", Frame: "Aluminium" },
      quiz: { terrain: "city", goal: "commute", level: "intermediate" } },
    { id: "b9", type: "bike", category: "electric", name: "E-Trail 160", price: 245000,
      colors: ["#0b3d2e", "#111111"], rating: 4.9, stock: 2,
      specs: { Motor: "85Nm mid-drive", Battery: "750Wh", Travel: "160mm", Wheels: "29/27.5\"" },
      quiz: { terrain: "trail", goal: "adventure", level: "advanced" } },

    // ---- Parts ----
    { id: "p1", type: "part", category: "components", name: "12-Speed Groupset", price: 42000, rating: 4.7, stock: 8, icon: "gear", tag: "Hot" },
    { id: "p2", type: "part", category: "components", name: "Hydraulic Disc Brake Set", price: 9800, rating: 4.6, stock: 14, icon: "brake" },
    { id: "p3", type: "part", category: "components", name: "Carbon Handlebar", price: 7500, compareAt: 8900, tag: "Sale", rating: 4.5, stock: 10, icon: "bar" },
    { id: "p4", type: "part", category: "wheels", name: "Carbon Wheelset 45mm", price: 58000, rating: 4.8, stock: 5, icon: "wheel" },
    { id: "p5", type: "part", category: "wheels", name: "Tubeless Road Tire 28c", price: 2600, rating: 4.6, stock: 40, icon: "tire" },
    { id: "p6", type: "part", category: "wheels", name: "Gravel Tire 45mm", price: 2900, rating: 4.5, stock: 30, icon: "tire", tag: "New" },
    { id: "p7", type: "part", category: "gear", name: "Aero Helmet", price: 8500, rating: 4.7, stock: 18, icon: "helmet" },
    { id: "p8", type: "part", category: "gear", name: "Bike Computer GPS", price: 14500, rating: 4.8, stock: 9, icon: "computer" },
    { id: "p9", type: "part", category: "gear", name: "Front & Rear Light Set", price: 2200, compareAt: 2800, tag: "Sale", rating: 4.4, stock: 50, icon: "light" },
    { id: "p10", type: "part", category: "gear", name: "Bottle Cage + Bottle", price: 950, rating: 4.3, stock: 60, icon: "bottle" }
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
