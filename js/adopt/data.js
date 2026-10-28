/* Waymo Care · Adopt-a-Waymo · the content tables. Everything the relaxed mode is made of lives here as plain data,
   keyed by string ids: neighbourhoods and the roads between them, needs and their funny labels, traits, items, wraps,
   dashpets, shops, dailies, random events, riders and their cards, stamps, seasons, car-show themes, garage upgrades
   and the bits of writing that go with them. No logic: js/adopt/sim.js reads these, so new content needs no new code.
   Runs in the browser and in Node (tools/adopt_sim.js), so it only touches the global WG. */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  const WG = (root.WG = root.WG || {});
  const D = {};

  /* ---------- the city: San Francisco's districts as lands. The centres come from js/isle.js ISL.DIST (island units);
     these rows add what each one means to a car. tags change the needs (sim.js TAG_FX), rank is the Crew Rank that
     unlocks a land (null: a plain neighbourhood, always open, with no shop), care is the Care Spot's zone key in
     js/world.js ZONES, title is what a car raised here grows up to be called ---------- */
  D.HOODS = {
    "Russian Hill": {
      tags: ["hills"],
      rank: 1,
      care: "lombard",
      home: true,
      shop: "corner",
      daily: "zigzag",
      feats: ["garage", "lot"],
      title: "Hill Legend",
      lore: "Home. The garage sits at the top of Lombard's crooked bricks, where the tourists film every car that zigzags down. Steep, sunny and a little smug about the view.",
    },
    "Fisherman's Wharf": {
      tags: ["tourist"],
      rank: 1,
      shop: "pier",
      daily: "sourdough",
      feats: ["fishing", "rally"],
      title: "Wharf Rat",
      lore: "Sea lions barking at Pier 39, chowder in bread bowls, and more tourists per square metre than anywhere else in the city. Riders here tip well and leave doors open.",
    },
    "North Beach": {
      tags: ["tourist"],
      rank: 2,
      shop: "lantern",
      daily: "fortune",
      feats: [],
      hub: "lunar",
      title: "Lantern Keeper",
      lore: "Espresso on Columbus, red lanterns over Grant Avenue in Chinatown next door, and Saints Peter and Paul's twin spires. The fortune cookies are made by hand round the corner.",
    },
    "Financial District": {
      tags: ["downtown"],
      rank: 3,
      care: "downtown",
      shop: "gadget",
      daily: "interest",
      feats: ["bank", "stocks"],
      title: "Lunch Rush Hero",
      lore: "The Pyramid, 555 California and a thousand people in fleece vests all wanting a ride at the same time. Crumbs everywhere by two o'clock.",
    },
    Embarcadero: {
      tags: ["downtown"],
      rank: 4,
      shop: "ferry",
      daily: "foghorn",
      feats: ["auction"],
      hub: "fleet",
      title: "Ferry Friend",
      lore: "The Ferry Building's clock tower, the Bay Bridge's lights and a farmers' market that sells nine kinds of mushroom. The fog horns are tuned to B-flat. Probably.",
    },
    Presidio: {
      tags: ["park"],
      rank: 4,
      care: "presidio",
      shop: "eucalyptus",
      daily: "birdfeeder",
      feats: [],
      title: "Bird Friend",
      lore: "Eucalyptus groves, red-brick barracks and the Golden Gate Bridge over the trees. The birds here are organised. They have a leader.",
    },
    "Western Addition": {
      tags: ["tourist"],
      rank: 5,
      care: "ladies",
      shop: "paint",
      daily: "fountain",
      feats: ["show"],
      title: "Painted Darling",
      lore: "Alamo Square and the Painted Ladies, the most photographed houses in the city. The paint shop on Steiner has mixed every colour a Victorian ever wore.",
    },
    "Golden Gate Park": {
      tags: ["park", "fog"],
      rank: 6,
      shop: "paddock",
      daily: "bloom",
      feats: [],
      hub: "outside",
      title: "Meadow Wanderer",
      lore: "Three miles of meadows, lakes, the Conservatory of Flowers and a real herd of bison. The Dashpet Paddock is next to the bison, who are polite about it.",
    },
    "Twin Peaks": {
      tags: ["hills"],
      rank: 7,
      shop: "chips",
      daily: "summit",
      feats: ["academy", "riddle", "derby"],
      title: "Summit Sage",
      lore: "The top of the city, with Sutro Tower humming overhead. The Driving Academy teaches up here because if you can corner on Twin Peaks you can corner anywhere.",
    },
    "Ocean Beach": {
      tags: ["beach", "fog"],
      rank: 8,
      care: "windmills",
      shop: "surf",
      daily: "bonfire",
      feats: ["karl"],
      title: "Fog Whisperer",
      lore: "Four miles of cold sand, the windmills, surfers in thick wetsuits and Karl the Fog's front door. The bonfire pits are warm all evening.",
    },
    Mission: {
      tags: ["nightlife"],
      rank: 9,
      shop: "mural",
      daily: "taqueria",
      feats: [],
      hub: "muertos",
      title: "Mural Muse",
      lore: "Sunniest neighbourhood in the city, murals down every alley, burritos the size of a battery pack. Riders here are artists, and they like a car with a story.",
    },
    Castro: {
      tags: ["nightlife"],
      rank: 10,
      shop: "theatre",
      daily: "raffle",
      feats: [],
      hub: "pride",
      title: "Marquee Star",
      lore: "Rainbow crosswalks, the Castro Theatre's neon marquee and the best people-watching in town. Every car looks better under that sign.",
    },
    SoMa: {
      tags: ["downtown"],
      rank: 10,
      shop: "swag",
      daily: "lab",
      feats: [],
      title: "Beta Tester",
      lore: "Warehouses turned into startups turned into other startups. The SoMa Startup Lab will zap your car with something. Nobody knows what. That's the pitch.",
    },
    "Haight-Ashbury": {
      tags: ["nightlife"],
      rank: 12,
      shop: "thrift",
      daily: "freebox",
      feats: [],
      title: "Groovy Old Soul",
      lore: "Victorian houses in tie-dye, record shops and the best vintage thrift in the west. Someone always leaves something good in the free box.",
    },
    "Lands End": {
      tags: ["park", "fog"],
      rank: 14,
      daily: "sutro",
      feats: ["stamp_hidden"],
      title: "Ruin Explorer",
      lore: "Cliffs, cypress trees and the ruins of the Sutro Baths. Something sleeps in the old pools. It snores like a fog horn.",
    },
    // plain neighbourhoods: places to drive, ride and hang out, no land of their own
    "Telegraph Hill": { tags: ["hills"], rank: null, title: "Parrot Pal", lore: "Coit Tower on top and a flock of wild parrots in the gardens on the stairs." },
    "Nob Hill": { tags: ["hills"], rank: null, title: "Cable Car Kid", lore: "Grand hotels, Grace Cathedral and the cable cars clanking up California Street." },
    Marina: { tags: [], rank: null, title: "Marina Jogger", lore: "Flat, sunny and full of joggers. The Palace of Fine Arts is just down the road." },
    "Pacific Heights": { tags: ["hills"], rank: null, title: "Mansion Cruiser", lore: "Mansions, views and very steep streets with very expensive hedges." },
    "Crissy Field": { tags: ["park", "beach"], rank: null, title: "Kite Flyer", lore: "A long lawn and a beach under the Golden Gate Bridge. Kites, dogs and windsurfers." },
    Richmond: { tags: ["fog"], rank: null, title: "Dim Sum Devotee", lore: "Dim sum on Clement Street, fog by four, and the Legion of Honor at the end of the road." },
    Sunset: { tags: ["fog"], rank: null, title: "Fog Belt Local", lore: "Rows of pastel houses, a grid that runs to the sea, and Karl most afternoons." },
    "Mission Bay": { tags: [], rank: null, title: "Ballpark Buddy", lore: "The ballpark, the Chase Center and new glass buildings on old railway land." },
    "Potrero Hill": { tags: ["hills"], rank: null, title: "Sunny Slope", lore: "The sunniest hill in the city, with a view straight down at downtown." },
    "Noe Valley": { tags: [], rank: null, title: "Stroller Champion", lore: "Strollers, bakeries and a high street that feels like a small town." },
    "Bernal Heights": { tags: ["hills"], rank: null, title: "Hilltop Rebel", lore: "A bald hilltop with a swing and dogs everywhere. Bernal is proud of being Bernal." },
    "Mount Davidson": { tags: ["hills", "park"], rank: null, title: "Cross Keeper", lore: "The highest point in the city, a forest and a big concrete cross on top." },
    "Lake Merced": { tags: ["park", "fog"], rank: null, title: "Lake Loafer", lore: "A quiet lake by the zoo, rowers in the morning and golf all afternoon." },
    Excelsior: { tags: [], rank: null, title: "Outer Mission Ace", lore: "Mission Street keeps going, past taquerias, bakeries and very friendly neighbours." },
    "Ocean View": { tags: ["fog"], rank: null, title: "Quiet Achiever", lore: "Little houses, Muni at the end of the line and the sea just over the hill." },
    "Crocker-Amazon": { tags: ["park"], rank: null, title: "Park Regular", lore: "A big playground at the very south of the city." },
    "Visitacion Valley": { tags: [], rank: null, title: "Valley Voyager", lore: "A valley in the southeast, with a community garden and a view of the bay." },
    Bayview: { tags: [], rank: null, title: "Third Street Star", lore: "The T line runs down Third Street through a neighbourhood that knows everybody." },
    "Hunters Point": { tags: ["beach"], rank: null, title: "Shipyard Sailor", lore: "The old shipyard by the bay, artists' studios in the old navy buildings." },
    Candlestick: { tags: ["beach"], rank: null, title: "Windy Point", lore: "Where the old ballpark stood. Still the windiest spot in the city." },
    "Fort Funston": { tags: ["beach", "fog"], rank: null, title: "Dune Dog", lore: "Cliffs and dunes, hang gliders overhead and every dog in the city on the beach." },
  };
  // the island's districts that aren't San Francisco proper (and so aren't on the map)
  D.EXCLUDE = ["Daly City", "Colma", "Brisbane", "South San Francisco", "Pacifica", "San Bruno Mountain", "Westlake", "Bayshore Heights", "Sunnydale", "Serramonte", "Crocker Heights"];
  // the roads between neighbourhoods (undirected). Length is the straight line × 1.25 (sim.js)
  D.EDGES = `
Fisherman's Wharf: North Beach, Russian Hill, Telegraph Hill, Marina
North Beach: Telegraph Hill, Russian Hill, Nob Hill, Financial District
Telegraph Hill: Financial District, Embarcadero
Russian Hill: Nob Hill, Pacific Heights, Marina
Nob Hill: Financial District, Western Addition, Pacific Heights, SoMa
Financial District: Embarcadero, SoMa
Embarcadero: SoMa, Mission Bay
SoMa: Mission Bay, Mission, Western Addition, Potrero Hill
Mission Bay: Potrero Hill
Potrero Hill: Mission, Bernal Heights, Bayview
Mission: Castro, Noe Valley, Bernal Heights
Castro: Noe Valley, Haight-Ashbury, Western Addition, Twin Peaks
Western Addition: Pacific Heights, Haight-Ashbury
Pacific Heights: Marina, Presidio
Marina: Crissy Field, Presidio
Crissy Field: Presidio
Presidio: Richmond, Lands End
Richmond: Lands End, Golden Gate Park
Lands End: Ocean Beach
Golden Gate Park: Haight-Ashbury, Sunset, Ocean Beach
Haight-Ashbury: Twin Peaks
Twin Peaks: Noe Valley, Sunset, Mount Davidson
Sunset: Ocean Beach, Mount Davidson, Lake Merced
Ocean Beach: Lake Merced, Fort Funston
Noe Valley: Bernal Heights
Bernal Heights: Excelsior, Bayview
Excelsior: Mount Davidson, Ocean View, Crocker-Amazon, Visitacion Valley
Ocean View: Lake Merced, Mount Davidson, Crocker-Amazon
Lake Merced: Fort Funston
Crocker-Amazon: Visitacion Valley
Visitacion Valley: Bayview, Candlestick
Bayview: Hunters Point, Candlestick
Hunters Point: Candlestick`;
  // island units to real kilometres: Slop Skies squeezes San Francisco to about a third, so a unit is about 3.3 m
  D.KM_PER_UNIT = 0.0033;
  // how a neighbourhood changes a car's needs per in-game hour while it drives there (sim.js applies them)
  D.TAG_FX = {
    hills: { label: "Hills", desc: "Charge −12/h instead of −8", icon: "⛰️" },
    park: { label: "Park", desc: "Senses −5/h, birds 3× as likely", icon: "🌳" },
    beach: { label: "Beach", desc: "Shine −6/h (sand and salt)", icon: "🏖️" },
    fog: { label: "Fog belt", desc: "Clarity −8/h when Karl is out", icon: "🌫️" },
    downtown: { label: "Downtown", desc: "Cozy −6/h (lunch crumbs), cones 2× as likely", icon: "🏙️" },
    tourist: { label: "Tourist hotspot", desc: "Doors left open 2× as often, more stamps", icon: "📸" },
    nightlife: { label: "Nightlife", desc: "Busier from 20:00 to midnight", icon: "🌃" },
  };

  /* ---------- needs: shown by their funny labels, not the numbers. Each label's lower bound ---------- */
  D.NEEDS = {
    charge: {
      name: "Charge",
      icon: "🔋",
      job: "charge",
      labels: [
        [0, "Running on Fumes"],
        [15, "Peckish for Electrons"],
        [35, "Needs a Top-up"],
        [60, "Charged"],
        [85, "Fully Charged"],
        [101, "Overcharged & Bloated"],
      ],
    },
    shine: {
      name: "Shine",
      icon: "🧽",
      job: "dirty",
      labels: [
        [0, "Swamp Thing"],
        [20, "Grubby"],
        [40, "Dusty"],
        [60, "Clean"],
        [80, "Sparkling"],
        [95, "Showroom"],
      ],
    },
    cozy: {
      name: "Cozy",
      icon: "🍿",
      job: "vacuum",
      labels: [
        [0, "Crumb Apocalypse"],
        [20, "Snack Graveyard"],
        [40, "Lived-in"],
        [60, "Tidy"],
        [80, "Fresh"],
        [95, "Spa Day"],
      ],
    },
    senses: {
      name: "Senses",
      icon: "🐦",
      job: "birds",
      labels: [
        [0, "Pigeon Hotel"],
        [20, "Squinting"],
        [45, "Smudgy"],
        [70, "Clear"],
        [92, "Eagle-eyed"],
      ],
    },
    clarity: {
      name: "Clarity",
      icon: "💻",
      job: "reboot",
      labels: [
        [0, "Bluescreened"],
        [20, "Glitchy"],
        [45, "Laggy"],
        [70, "Stable"],
        [92, "Big Brain"],
      ],
    },
    mood: {
      name: "Mood",
      icon: "😊",
      labels: [
        [0, "Sulking"],
        [20, "Grumpy"],
        [40, "Meh"],
        [60, "Content"],
        [75, "Happy"],
        [92, "Ecstatic"],
      ],
    },
  };
  D.NEED_KEYS = ["charge", "shine", "cozy", "senses", "clarity"];
  D.MOOD_FACE = ["😤", "😒", "😐", "🙂", "😊", "🤩"];
  // the one-off incidents during rides; they stop the car until fixed (the doors and cone jobs)
  D.INCIDENTS = {
    doors: { name: "Doors left open", icon: "🚪", job: "doors", text: "{car}'s riders walked off and left the doors open. It won't budge until they're shut." },
    cone: { name: "Boxed in by cones", icon: "🔶", job: "cone", text: "Somebody boxed {car} in with traffic cones. It's not going anywhere." },
  };

  /* ---------- traits: two at random when a car is adopted (their effects are in sim.js, by id) ---------- */
  D.TRAITS = {
    hill_hater: { name: "Hill Hater", icon: "⛰️", desc: "Charge drains ×1.6 on hills; happier in flat neighbourhoods" },
    bird_magnet: { name: "Bird Magnet", icon: "🐦", desc: "Senses drain ×2 in parks, but it likes birds (no mood penalty)" },
    neat_freak: { name: "Neat Freak", icon: "🧼", desc: "Mood follows Shine twice as strongly" },
    foodie: { name: "Foodie", icon: "🍔", desc: "Cozy drains ×1.5; riders tip +20%" },
    night_owl: { name: "Night Owl", icon: "🦉", desc: "Faster at night; sleepy in the morning (rides 20% slower)" },
    fog_lover: { name: "Fog Lover", icon: "🌫️", desc: "Immune to fog glitches; happier at Ocean Beach and Lands End" },
    tour_guide: { name: "Tour Guide", icon: "📸", desc: "Twice the chance of stamps and postcards at landmarks" },
    shy: { name: "Shy", icon: "🙈", desc: "Grumpier downtown; happier in quiet neighbourhoods" },
    chatty: { name: "Chatty", icon: "💬", desc: "Beeps more, extra captions; more bond from pats" },
    speed_demon: { name: "Speed Demon", icon: "💨", desc: "Rides 15% faster, Charge drains ×1.2" },
  };
  // 10 hearts: each trait's upgraded form
  D.TRAIT_PLUS = {
    hill_hater: "Hill Tolerator (no extra drain on hills)",
    bird_magnet: "Bird Whisperer (birds clean its sensors)",
    neat_freak: "Neat Champion (Shine drains half as fast)",
    foodie: "Gourmand (tips +40%)",
    night_owl: "Moon Racer (no morning sleepiness)",
    fog_lover: "Karl's Favourite (+Clarity in fog)",
    tour_guide: "City Historian (×3 stamps)",
    shy: "Quietly Confident (no downtown penalty)",
    chatty: "Life of the Party (+mood to every car nearby)",
    speed_demon: "Smooth Operator (no extra drain)",
  };

  /* ---------- stats (only ever go up) ---------- */
  D.STATS = {
    range: { name: "Range", icon: "🔋", desc: "Charge drains 2% less per point" },
    handling: { name: "Handling", icon: "🛞", desc: "Rides are 3% faster per point" },
    comfort: { name: "Comfort", icon: "🛋️", desc: "Tips +2% per point; Cozy drains less" },
    smarts: { name: "Smarts", icon: "🧠", desc: "Better routes, more rider requests. Raised by reading" },
    charm: { name: "Charm", icon: "✨", desc: "Car Show score and stamp finds" },
  };
  D.STAT_KEYS = ["range", "handling", "comfort", "smarts", "charm"];
  D.STAGES = [
    { id: "rookie", name: "Rookie", badge: "🌱", slots: ["topper", "roof"] },
    { id: "regular", name: "Regular", badge: "⭐", slots: ["topper", "roof", "mirrors", "horn"], need: { age: 2, km: 120, bond: 2, level: 3 } },
    { id: "veteran", name: "Veteran", badge: "🎖️", slots: ["topper", "roof", "mirrors", "horn", "dash"], need: { age: 7, km: 600, bond: 5, level: 6 } },
    { id: "legend", name: "Legend", badge: "🏆", slots: ["topper", "roof", "mirrors", "horn", "dash", "plate"], need: { age: 21, km: 2000, bond: 8, level: 12 } },
  ];
  D.SLOTS = { topper: "Topper", roof: "Roof", mirrors: "Mirrors", horn: "Horn", dash: "Dash", plate: "Plate frame" };
  D.HEARTS = [
    [2, "Nickname"],
    [4, "Custom horn"],
    [6, "Lidar dance"],
    [8, "Ride Along"],
    [10, "Trait upgrade"],
  ];

  /* ---------- items: rarity 1–101 (Neopets' scale: 90+ rarely restocks, 100+ is never sold) ---------- */
  const I = (D.ITEMS = {});
  const add = (cat, rows) => {
    for (const [id, name, icon, rarity, price, o] of rows) I[id] = Object.assign({ id, name, icon, rarity, price, cat }, o || {});
  };
  add("snack", [
    ["snack_volt_bar", "Volt Bar", "🔋", 8, 20, { effect: { charge: 20 }, desc: "A chewy bar of pure electrons." }],
    ["snack_fry", "Seagull-Approved Fry", "🍟", 12, 15, { effect: { charge: 8, mood: 8 }, desc: "A gull let this one go. A sign of respect." }],
    ["snack_electron_chips", "Electron Chips", "🥔", 15, 25, { effect: { charge: 15, mood: 6 }, desc: "Salt and voltage." }],
    ["snack_dutch_crunch", "Dutch Crunch Current", "🥪", 22, 35, { effect: { charge: 25 }, desc: "The crunchiest charge in the city." }],
    ["snack_fortune_amp", "Fortune Amp Cookie", "🥠", 28, 40, { effect: { charge: 15, mood: 10 }, desc: "Inside: 'You will reach 100%.'" }],
    ["snack_capacitor", "Ghirardelli Capacitor", "🍫", 35, 45, { effect: { charge: 30, mood: 5 }, desc: "Dark chocolate, dark current." }],
    ["snack_sourdough_cell", "Sourdough Battery Bowl", "🥖", 40, 60, { effect: { charge: 45 }, desc: "Chowder not included." }],
    ["snack_dim_sum", "Dim Sum Discharge Pack", "🥟", 42, 80, { effect: { charge: 40, mood: 6 }, desc: "Four little dumplings of power." }],
    ["snack_irish_coffee", "Buena Vista Irish Coffee (decaf, for cars)", "☕", 45, 70, { effect: { charge: 25, clarity: 15 }, desc: "Wakes up the processor." }],
    ["snack_burrito_battery", "Mission Burrito Battery", "🌯", 50, 95, { effect: { charge: 70, cozy: -10 }, desc: "Enormous. Some of it ends up on the seats." }],
    ["snack_cioppino_cell", "Cioppino Power Cell", "🍲", 55, 120, { effect: { charge: 60, mood: 5 }, desc: "A Wharf classic, in a can with terminals." }],
    ["snack_its_it", "It's-It Coolant", "🍦", 60, 140, { effect: { charge: 35, mood: 15 }, desc: "Ice cream between two oatmeal cookies, dipped in chocolate. For the radiator." }],
    ["snack_megawatt_muffin", "Mega Megawatt Muffin", "🧁", 72, 220, { effect: { charge: 60, mood: 4 }, over: true, desc: "Can push a car past 100%. It will regret nothing." }],
    ["snack_grandma_cookie", "Grandma's Cookie", "🍪", 100, 60, { effect: { cozy: 10, mood: 12, charge: 10 }, desc: "Left in the back seat, still warm." }],
    ["snack_pumpkin_cell", "Pumpkin Spice Power Cell", "🎃", 70, 90, { effect: { charge: 40, mood: 10 }, season: "halloween", desc: "Seasonal. Smells like October." }],
    ["snack_mooncake", "Mooncake Megacell", "🥮", 70, 90, { effect: { charge: 40, mood: 10 }, season: "lunar", desc: "Rich, dense and full of lotus-paste joules." }],
    ["snack_pan_muerto", "Pan de Muerto Pack", "🍞", 70, 90, { effect: { charge: 35, mood: 14 }, season: "muertos", desc: "Sweet bread for the season." }],
  ]);
  add("wash", [
    ["wipe_basic", "Wet Wipes", "🧻", 5, 20, { effect: { shine: 15 }, desc: "Better than nothing." }],
    ["wipe_fog_mist", "Fog Mist Spray", "💨", 18, 40, { effect: { shine: 25 }, desc: "Bottled Karl, with a squeegee." }],
    ["wax_sea_salt", "Sea Salt Scrub", "🧂", 28, 55, { effect: { shine: 30 }, desc: "Gritty, but it works." }],
    ["wax_surf", "Surf Wax", "🏄", 35, 75, { effect: { shine: 40, mood: 4 }, desc: "Made for boards. Works on robotaxis." }],
    ["wax_showroom", "Showroom Polish", "✨", 65, 220, { effect: { shine: 70 }, desc: "So shiny the gulls get confused." }],
  ]);
  add("cozy", [
    ["cozy_lint", "Lint Roller", "🧽", 8, 25, { effect: { cozy: 15 }, desc: "Takes care of the dog hair. And the crumbs." }],
    ["cozy_air", "Eucalyptus Air Freshener", "🌿", 24, 45, { effect: { cozy: 25, mood: 3 }, desc: "Smells like the Presidio after rain." }],
    ["cozy_cushion", "Hand-Knit Seat Cushion", "🧶", 45, 110, { effect: { cozy: 45 }, desc: "Knitted by a grandma in the Sunset." }],
    ["cozy_crumbvac", "Pocket Crumb-Vac", "🌀", 55, 160, { effect: { cozy: 60 }, desc: "A tiny vacuum with a big attitude." }],
  ]);
  add("senses", [
    ["sense_lens", "Lens Cloth", "👓", 8, 25, { effect: { senses: 20 }, desc: "For lidar domes and spectacles." }],
    ["sense_bird_sign", "Polite Bird Sign", "🪧", 30, 60, { effect: { senses: 30 }, desc: "'Please roost elsewhere. Thank you.'" }],
    ["sense_eagle_drops", "Eagle-Eye Drops", "🦅", 55, 150, { effect: { senses: 55 }, desc: "Sees round corners. Almost." }],
  ]);
  add("clarity", [
    ["clar_reboot_tea", "Reboot Tea", "🍵", 14, 35, { effect: { clarity: 20 }, desc: "Turn it off, have a cup, turn it on again." }],
    ["clar_patch", "Weekend Patch Notes", "📄", 30, 60, { effect: { clarity: 35 }, desc: "Fixed a bug where the car believed it was a boat." }],
    ["clar_defrag", "Defrag Massage", "💆", 50, 130, { effect: { clarity: 55, mood: 5 }, desc: "Soothing for every sector." }],
  ]);
  add("toy", [
    ["toy_tennis", "Golden Gate Tennis Ball", "🎾", 15, 30, { effect: { mood: 10 }, desc: "Bouncy. Orange. Irresistible." }],
    ["toy_squeaky_cone", "Squeaky Cone", "🔶", 20, 45, { effect: { mood: 15 }, desc: "The only cone a robotaxi likes." }],
    ["toy_rubber_sea_lion", "Rubber Sea Lion", "🦭", 35, 70, { effect: { mood: 20 }, desc: "Arf." }],
    ["toy_kite", "Crissy Field Kite", "🪁", 40, 90, { effect: { mood: 25 }, desc: "It ties to the lidar." }],
    ["toy_cable_bell", "Toy Cable Car Bell", "🛎️", 45, 100, { effect: { mood: 22 }, desc: "Ding ding!" }],
    ["toy_karl_plush", "Karl Plushie", "☁️", 60, 180, { effect: { mood: 30 }, desc: "A soft fog cloud with a smug little face." }],
  ]);
  add("treat", [
    ["treat_birdseed", "Bird Seed", "🌾", 10, 20, { effect: { mood: 8 }, pet: true, desc: "For dashpets with beaks." }],
    ["treat_kelp", "Kelp Crisp", "🌿", 25, 40, { effect: { mood: 12 }, pet: true, desc: "Sea lion pups go wild for it." }],
    ["treat_cracker", "Parrot Cracker", "🍘", 30, 45, { effect: { mood: 12 }, pet: true, desc: "Polly would like one." }],
    ["treat_dew", "Morning Dew Drop", "💧", 40, 60, { effect: { mood: 15 }, pet: true, desc: "Mini Karl's favourite." }],
  ]);
  // map packs and podcasts: +Smarts, once per car (Neopets' books)
  add("read", [
    ["map_presidio_trails", "Presidio Trails Map Pack", "🗺️", 20, 80, { smarts: 1, desc: "Every path through the eucalyptus." }],
    ["pod_bridges", "Podcast: Bridges, Explained", "🎧", 25, 90, { smarts: 1, desc: "Forty minutes on rivets. Riveting." }],
    ["map_lombard_curves", "Lombard Curves, Annotated", "🗺️", 30, 110, { smarts: 1, desc: "Eight hairpins, footnoted." }],
    ["pod_startups", "Podcast: 99 Startups That Didn't", "🎧", 30, 100, { smarts: 1, desc: "Lessons, mostly about kombucha." }],
    ["map_pothole_atlas", "The Pothole Atlas", "🗺️", 35, 130, { smarts: 1, desc: "Know your enemy." }],
    ["map_hidden_stairways", "Hidden Stairways of SF", "🗺️", 40, 150, { smarts: 1, desc: "Cars can't use them. Cars like knowing about them." }],
    ["pod_fog", "Podcast: Fog Talk Radio", "🎧", 45, 180, { smarts: 1, desc: "Karl calls in at the end." }],
    ["pod_gold_rush", "Podcast: The Gold Rush in 40 Minutes", "🎧", 50, 220, { smarts: 1, desc: "1849, abridged." }],
    ["map_fog_patterns", "Karl's Patterns: A Field Guide", "🗺️", 58, 300, { smarts: 2, desc: "When, where and how thick." }],
    ["map_muni_lines", "Every Muni Line (Ever)", "🗺️", 66, 420, { smarts: 2, desc: "Including the ones that only ran on Tuesdays." }],
    ["map_secret_tunnels", "Secret Tunnels Map (Probably Fake)", "🗺️", 92, 1500, { smarts: 3, desc: "X marks a spot. Several spots." }],
  ]);
  // firmware chips: the Driving Academy's codestones
  add("chip", [
    ["chip_lombard", "Chip-Lombard", "💾", 25, 120, { desc: "Firmware for beginners' courses." }],
    ["chip_sutro", "Chip-Sutro", "💾", 45, 300, { desc: "Firmware for intermediate courses." }],
    ["chip_coit", "Chip-Coit", "💾", 65, 800, { desc: "Firmware for advanced courses." }],
    ["chip_bridge", "Chip-Bridge", "💾", 86, 2200, { desc: "Firmware for master classes." }],
  ]);
  // accessories, one per slot (charm adds to the Car Show and to stamp finds)
  add("gear", [
    ["topper_beanie", "Knit Beanie", "🧢", 20, 150, { slot: "topper", charm: 1, theme: ["fog"] }],
    ["topper_party", "Party Hat", "🥳", 25, 180, { slot: "topper", charm: 1, theme: ["party"] }],
    ["topper_lantern", "Paper Lantern Topper", "🏮", 40, 400, { slot: "topper", charm: 2, theme: ["lunar", "night"] }],
    ["topper_sunhat", "Floppy Sun Hat", "👒", 35, 320, { slot: "topper", charm: 2, theme: ["sunny", "bloom"] }],
    ["topper_crown", "Tiny Crown", "👑", 78, 2600, { slot: "topper", charm: 4, theme: ["fancy"] }],
    ["topper_witch", "Witch Hat", "🧙", 75, 600, { slot: "topper", charm: 3, theme: ["halloween"], season: "halloween" }],
    ["topper_marigold", "Marigold Crown", "🌼", 75, 600, { slot: "topper", charm: 3, theme: ["muertos", "bloom"], season: "muertos" }],
    ["topper_sailor", "Sailor Cap", "⚓", 75, 600, { slot: "topper", charm: 3, theme: ["fleet"], season: "fleet" }],
    ["roof_box", "Cargo Roof Box", "📦", 20, 300, { slot: "roof", charm: 1 }],
    ["roof_bike", "Bike Rack", "🚲", 30, 450, { slot: "roof", charm: 1, theme: ["sunny"] }],
    ["roof_surfboard", "Surfboard", "🏄", 35, 600, { slot: "roof", charm: 2, theme: ["sunny", "beach"] }],
    ["roof_flowers", "Rooftop Flower Garden", "🌸", 50, 900, { slot: "roof", charm: 2, theme: ["bloom"] }],
    ["roof_pumpkin", "Giant Pumpkin", "🎃", 80, 900, { slot: "roof", charm: 3, theme: ["halloween"], season: "halloween" }],
    ["mirror_dice", "Fuzzy Dice", "🎲", 20, 160, { slot: "mirrors", charm: 1, theme: ["party"] }],
    ["mirror_lashes", "Headlight Eyelashes", "👁️", 30, 250, { slot: "mirrors", charm: 2, theme: ["fancy"] }],
    ["mirror_streamers", "Rainbow Streamers", "🎏", 40, 380, { slot: "mirrors", charm: 2, theme: ["pride", "party"] }],
    ["dash_bobble", "Bobble-Head Bison", "🦬", 35, 300, { slot: "dash", charm: 1, theme: ["bloom"] }],
    ["dash_hula", "Dashboard Hula Dancer", "💃", 30, 260, { slot: "dash", charm: 1, theme: ["sunny", "party"] }],
    ["dash_snowglobe", "Golden Gate Snow Globe", "🔮", 55, 700, { slot: "dash", charm: 2, theme: ["fancy", "fog"] }],
    ["plate_rainbow", "Rainbow Plate Frame", "🌈", 35, 400, { slot: "plate", charm: 1, theme: ["pride"] }],
    ["plate_gold", "Gold Plate Frame", "🥇", 55, 900, { slot: "plate", charm: 2, theme: ["fancy"] }],
    ["horn_duck", "Duck Horn", "🦆", 25, 200, { slot: "horn", horn: "squawk" }],
    ["horn_cablecar", "Cable Car Ding", "🔔", 35, 350, { slot: "horn", horn: "ding" }],
    ["horn_foghorn", "Foghorn Horn", "📯", 45, 450, { slot: "horn", horn: "foghorn", theme: ["fog"] }],
  ]);
  // radio songs: kept, not used up. The Playlist Club counts which songs each car has heard
  add("song", [
    ["song_bossa", "Bossa on the Bay", "🎵", 10, 60, { song: true, desc: "Gentle guitar for a gentle commute." }],
    ["song_fog_blues", "Karl's Blues", "🎵", 25, 120, { song: true, theme: ["fog"], desc: "Slow and grey and beautiful." }],
    ["song_cable_swing", "Cable Car Swing", "🎵", 30, 150, { song: true, desc: "Ding-ding, doo-wop." }],
    ["song_surf", "Ocean Beach Surf Rock", "🎵", 35, 180, { song: true, theme: ["beach"], desc: "Reverb all the way up." }],
    ["song_disco", "Castro Disco Inferno", "🎵", 45, 240, { song: true, theme: ["pride", "party"], desc: "Four on the floor, four on the road." }],
    ["song_psych", "Haight Street Psychedelia", "🎵", 55, 320, { song: true, desc: "Twelve minutes long. Every second needed." }],
    ["song_lullaby", "Garage Lullaby", "🎵", 40, 200, { song: true, desc: "For winding down after a long day." }],
    ["song_spooky", "Monster Mash-Up", "🎵", 70, 260, { song: true, season: "halloween", theme: ["halloween"], desc: "It was a garage smash." }],
  ]);
  // garage furniture: each takes a slot and gives a small passive bonus to every car at home
  add("furniture", [
    ["furn_fern", "Potted Fern", "🪴", 12, 200, { bonus: { mood: 1 } }],
    ["furn_rug", "Cable Car Rug", "🟥", 22, 320, { bonus: { comfort: 1 } }],
    ["furn_lamp", "Lava Lamp", "🫧", 30, 420, { bonus: { mood: 2 } }],
    ["furn_poster", "Castro Theatre Poster", "🎞️", 35, 500, { bonus: { mood: 2 } }],
    ["furn_beanbag", "Beanbag Charge Mat", "🛋️", 40, 650, { bonus: { comfort: 1, mood: 1 } }],
    ["furn_neon", "Neon Fog Sign", "🌫️", 48, 800, { bonus: { mood: 3 } }],
    ["furn_orchid", "Conservatory Orchid", "🌺", 55, 900, { bonus: { comfort: 1, mood: 2 } }],
    ["furn_jukebox", "Garage Jukebox", "📻", 62, 1400, { bonus: { mood: 4 } }],
    ["furn_hammock", "Car-Sized Hammock", "🏝️", 75, 2400, { bonus: { comfort: 2, mood: 3 } }],
    ["furn_jack_o", "Jack-o'-Lantern Stack", "🎃", 80, 700, { bonus: { mood: 3 }, season: "halloween" }],
  ]);
  // rare finds: prizes and quest rewards, never on a shop shelf
  add("rare", [
    ["rare_golden_ticket", "Golden Cable Car Ticket", "🎫", 101, 5000, { effect: { mood: 40 }, desc: "Free rides for life. For whom is unclear." }],
    ["rare_sea_glass", "Sutro Sea Glass", "🔹", 100, 2500, { desc: "Worn smooth by a hundred years of tides. Sell it, or keep it as a treasure." }],
    ["rare_old_token", "Old Muni Token", "🪙", 100, 1800, { desc: "From before the Clipper card. A collector's dream." }],
    ["rare_bison_hair", "Lucky Bison Hair", "🦬", 100, 1500, { effect: { mood: 25, charge: 25, shine: 25, cozy: 25, senses: 25, clarity: 25 }, desc: "Freely given. Very lucky." }],
    ["rare_fog_jar", "Jar of Karl", "🫙", 101, 4000, { effect: { clarity: 100 }, desc: "A whole morning of fog, in a jar. Handle gently." }],
    ["rare_starter_loaf", "Sourdough Mother Loaf", "🍞", 101, 6000, { effect: { charge: 100, mood: 30 }, desc: "Grown from a Sourdough Starter over thirty days." }],
  ]);
  // paint wraps: used up when applied (Neopets' paint brushes)
  for (const [id, name, rarity, price, o] of [
    ["wrap_golden_gate", "Golden Gate Orange", 40, 1500],
    ["wrap_karl_grey", "Karl Grey", 35, 1500],
    ["wrap_sea_lion", "Sea Lion", 48, 3000],
    ["wrap_sourdough", "Sourdough", 45, 2000],
    ["wrap_cable_red", "Cable Car Red", 45, 2000],
    ["wrap_painted_lady", "Painted Lady Pastels", 52, 2500],
    ["wrap_sutro_stripes", "Sutro Stripes", 58, 4000],
    ["wrap_castro_rainbow", "Castro Rainbow", 72, 12000],
    ["wrap_starry_night", "Starry Night", 78, 15000],
    ["wrap_mission_mural", "Mission Mural", 88, 15000],
    ["wrap_gold", "Gold", 101, 50000],
    ["wrap_haunted", "Haunted", 85, 6000, { season: "halloween" }],
    ["wrap_calavera", "Calavera", 85, 6000, { season: "muertos" }],
    ["wrap_lantern", "Lunar Lantern", 85, 6000, { season: "lunar" }],
    ["wrap_blue_angels", "Blue Angels", 85, 6000, { season: "fleet" }],
    ["wrap_pride", "Pride Parade", 85, 6000, { season: "pride" }],
    ["wrap_breakers", "Bay to Breakers Costume", 85, 6000, { season: "breakers" }],
    ["wrap_tie_dye", "Festival Tie-Dye", 85, 6000, { season: "outside" }],
  ])
    I[id] = Object.assign({ id, name: name + " Wrap", icon: "🎨", rarity, price, cat: "wrap", wrap: id.slice(5), desc: "Paints a car " + name + ". Used up when applied." }, o || {});
  // dashpet adoption papers (bought at the Paddock; used up when a car adopts the dashpet)
  D.DASHPETS = {
    pigeon_pal: { name: "Pigeon Pal", icon: "🐦", perk: "Other birds leave the car alone half the time", price: 900, rarity: 30, food: "treat_birdseed", desc: "A bird you shooed. Now a friend." },
    gull_chick: { name: "Gull Chick", icon: "🐣", perk: "Bigger tips at the Wharf and the Embarcadero", price: 1200, rarity: 40, food: "treat_birdseed" },
    sea_lion_pup: { name: "Sea Lion Pup", icon: "🦭", perk: "Happier at Pier 39 (Fisherman's Wharf)", price: 1500, rarity: 45, food: "treat_kelp" },
    parrot: { name: "Telegraph Hill Parrot", icon: "🦜", perk: "+2 Charm; repeats captions", price: 2000, rarity: 55, food: "treat_cracker" },
    mini_karl: { name: "Mini Karl", icon: "☁️", perk: "Fog doesn't cause glitches", price: 2500, rarity: 60, food: "treat_dew" },
    succulent: { name: "Lombard Succulent", icon: "🌵", perk: "Cozy drains less", price: 800, rarity: 25, food: "treat_dew" },
    starter: { name: "Sourdough Starter", icon: "🫙", perk: "Grows into a rare loaf after 30 days", price: 1800, rarity: 50, food: "treat_dew" },
    mini_bison: { name: "Mini Bison", icon: "🦬", perk: "+2 Range", price: 3000, rarity: 65, food: "treat_kelp" },
    bell: { name: "Cable Car Bell", icon: "🔔", perk: "+1 Handling in the Derby", price: 1400, rarity: 40, food: "treat_dew" },
  };
  for (const [k, p] of Object.entries(D.DASHPETS))
    I["pet_" + k] = { id: "pet_" + k, name: p.name + " (adoption papers)", icon: p.icon, rarity: p.rarity, price: p.price, cat: "dashpet", dashpet: k, desc: p.perk + "." };
  // dashpet-pets: tiny cosmetic hangers-on
  D.MITES = { crumb_mite: { name: "Crumb Mite", icon: "🦠" }, dust_bunny: { name: "Dust Bunny", icon: "🐰" }, fog_droplet: { name: "Fog Droplet", icon: "💧" } };
  D.CAT_NAMES = {
    snack: "Snacks",
    wash: "Shine",
    cozy: "Cozy",
    senses: "Senses",
    clarity: "Clarity",
    toy: "Toys",
    treat: "Dashpet treats",
    read: "Map packs & podcasts",
    chip: "Firmware chips",
    gear: "Accessories",
    wrap: "Paint wraps",
    dashpet: "Dashpets",
    song: "Radio songs",
    furniture: "Garage furniture",
    rare: "Treasures",
  };

  /* ---------- wraps: a tint on the body (vertex colours × tint), the lidar ring, and decals (map.js draws them) ---------- */
  D.WRAPS = {
    default: { name: "Waymo White", tint: "#ffffff", ring: "#36d3c4" },
    golden_gate: { name: "Golden Gate Orange", tint: "#f0643a", ring: "#ffd23a", decal: { kind: "stripe", col: "#ffffff" }, theme: ["sunny"] },
    karl_grey: { name: "Karl Grey", tint: "#b8c0c6", ring: "#e6eef4", decal: { kind: "clouds", col: "#ffffff" }, theme: ["fog"] },
    sea_lion: { name: "Sea Lion", tint: "#7c6a5a", ring: "#9be0ff", decal: { kind: "spots", col: "#5a4a3e" }, theme: ["beach"] },
    sourdough: { name: "Sourdough", tint: "#e9c88f", ring: "#fff3d0", decal: { kind: "stripe", col: "#a8743a" } },
    cable_red: { name: "Cable Car Red", tint: "#c8322e", ring: "#ffd23a", decal: { kind: "trim", col: "#f2e6c8" } },
    painted_lady: { name: "Painted Lady Pastels", tint: "#f4c6d8", ring: "#a6e3d6", decal: { kind: "bands", cols: ["#f7e39a", "#a6d8f2", "#c9b4ec"] }, theme: ["bloom", "fancy"] },
    sutro_stripes: { name: "Sutro Stripes", tint: "#ffffff", ring: "#ff4b3e", decal: { kind: "bands", cols: ["#e8433f", "#ffffff", "#e8433f"] } },
    castro_rainbow: { name: "Castro Rainbow", tint: "#ffffff", ring: "#ff7ad9", decal: { kind: "bands", cols: ["#e8433f", "#ff9a2e", "#ffd23a", "#41c45a", "#2a9fe6", "#8a5fd8"] }, theme: ["pride", "party"] },
    starry_night: { name: "Starry Night", tint: "#2a3c86", ring: "#ffe066", decal: { kind: "stars", col: "#ffe066" }, theme: ["night", "fancy"] },
    mission_mural: { name: "Mission Mural", tint: "#ffcf5a", ring: "#e8508a", decal: { kind: "bands", cols: ["#e8508a", "#2cc4e4", "#41c45a"] }, theme: ["party", "bloom"] },
    gold: { name: "Gold", tint: "#ffcc3a", ring: "#fff6b0", shiny: true, decal: { kind: "trim", col: "#fff6b0" }, theme: ["fancy"] },
    haunted: { name: "Haunted", tint: "#5a4a7a", ring: "#7dff7a", decal: { kind: "ghosts", col: "#e8ffe8" }, theme: ["halloween", "night"] },
    calavera: { name: "Calavera", tint: "#f4f0e6", ring: "#ff9a2e", decal: { kind: "spots", col: "#e8508a" }, theme: ["muertos", "bloom"] },
    lantern: { name: "Lunar Lantern", tint: "#d8302e", ring: "#ffd23a", decal: { kind: "trim", col: "#ffd23a" }, theme: ["lunar"] },
    blue_angels: { name: "Blue Angels", tint: "#1c3c8a", ring: "#ffd23a", decal: { kind: "stripe", col: "#ffd23a" }, theme: ["fleet"] },
    pride: { name: "Pride Parade", tint: "#ffffff", ring: "#ffffff", decal: { kind: "bands", cols: ["#e8433f", "#ff9a2e", "#ffd23a", "#41c45a", "#2a9fe6", "#8a5fd8"] }, theme: ["pride", "party"] },
    breakers: { name: "Bay to Breakers Costume", tint: "#41c45a", ring: "#ff7ad9", decal: { kind: "spots", col: "#ffd23a" }, theme: ["party"] },
    tie_dye: { name: "Festival Tie-Dye", tint: "#ff9ad0", ring: "#2cc4e4", decal: { kind: "bands", cols: ["#ffd23a", "#2cc4e4", "#8a5fd8"] }, theme: ["party", "bloom"] },
  };
  // the lidar ring colours the Adoption Lot and the Lab hand out
  D.RINGS = ["#36d3c4", "#2a9fe6", "#ff7ad9", "#ffd23a", "#41c45a", "#ff9a2e", "#8a7fd8", "#e8433f", "#7dff7a", "#ffffff"];

  /* ---------- shops: each restocks every in-game hour from its pool (sim.js), haggling with its keeper ---------- */
  D.SHOPS = {
    corner: { name: "Lombard Corner Store", keeper: "Mr. Chen", icon: "🏪", size: 6, pool: ["snack_volt_bar", "snack_electron_chips", "snack_dutch_crunch", "snack_capacitor", "wipe_basic", "cozy_lint", "sense_lens", "clar_reboot_tea", "toy_tennis", "treat_birdseed", "map_lombard_curves", "song_bossa"] },
    pier: { name: "Pier Snack Shack", keeper: "Captain Lou", icon: "🦀", size: 6, pool: ["snack_fry", "snack_sourdough_cell", "snack_cioppino_cell", "snack_its_it", "snack_capacitor", "toy_rubber_sea_lion", "treat_kelp", "wipe_fog_mist", "pod_bridges", "snack_megawatt_muffin"] },
    lantern: { name: "Lantern & Charm Shop", keeper: "Auntie Mei", icon: "🏮", size: 6, pool: ["topper_lantern", "topper_party", "mirror_dice", "dash_hula", "snack_fortune_amp", "snack_dim_sum", "toy_cable_bell", "song_cable_swing", "topper_beanie", "mirror_lashes"] },
    gadget: { name: "Gadget Exchange", keeper: "Priya", icon: "📟", size: 6, pool: ["clar_patch", "clar_defrag", "clar_reboot_tea", "pod_startups", "map_muni_lines", "chip_lombard", "snack_irish_coffee", "roof_box", "dash_snowglobe"] },
    ferry: { name: "Ferry Building Market", keeper: "Rosa", icon: "⛴️", size: 6, pool: ["snack_its_it", "snack_megawatt_muffin", "snack_cioppino_cell", "snack_sourdough_cell", "cozy_air", "furn_orchid", "furn_fern", "map_hidden_stairways", "pod_gold_rush", "toy_kite"] },
    eucalyptus: { name: "Eucalyptus Outfitters", keeper: "Ranger Dee", icon: "🌲", size: 6, pool: ["sense_lens", "sense_bird_sign", "sense_eagle_drops", "cozy_air", "map_presidio_trails", "roof_bike", "treat_birdseed", "toy_kite", "topper_beanie"] },
    paint: { name: "Painted Ladies Paint Shop", keeper: "Madame Victoria", icon: "🎨", size: 5, pool: ["wrap_golden_gate", "wrap_karl_grey", "wrap_sourdough", "wrap_cable_red", "wrap_painted_lady", "wrap_sea_lion", "wrap_sutro_stripes", "wrap_starry_night"] },
    paddock: { name: "Dashpet Paddock", keeper: "Bison Bob", icon: "🦬", size: 5, pool: ["pet_pigeon_pal", "pet_gull_chick", "pet_sea_lion_pup", "pet_parrot", "pet_mini_karl", "pet_succulent", "pet_starter", "pet_mini_bison", "pet_bell", "treat_birdseed", "treat_kelp", "treat_cracker", "treat_dew"] },
    chips: { name: "Firmware Chip Kiosk", keeper: "Sutro-9000", icon: "💾", size: 5, pool: ["chip_lombard", "chip_sutro", "chip_coit", "chip_bridge", "clar_patch", "clar_defrag", "map_fog_patterns"] },
    surf: { name: "Surf & Wax", keeper: "Dune", icon: "🏄", size: 6, pool: ["wax_surf", "wax_sea_salt", "wax_showroom", "wipe_fog_mist", "roof_surfboard", "song_surf", "toy_karl_plush", "song_fog_blues", "horn_foghorn"] },
    mural: { name: "Mural Supply Co.", keeper: "Inés", icon: "🖌️", size: 6, pool: ["wrap_painted_lady", "wrap_mission_mural", "cozy_cushion", "cozy_crumbvac", "snack_burrito_battery", "roof_flowers", "topper_sunhat", "furn_poster"] },
    theatre: { name: "Castro Theatre Gift Shop", keeper: "Marquee Mike", icon: "🎭", size: 6, pool: ["wrap_castro_rainbow", "mirror_streamers", "plate_rainbow", "song_disco", "furn_poster", "furn_neon", "topper_party", "mirror_lashes"] },
    swag: { name: "Startup Swag", keeper: "Chad (Head of Swag)", icon: "👕", size: 6, pool: ["pod_startups", "clar_defrag", "furn_beanbag", "furn_lamp", "roof_box", "dash_snowglobe", "horn_duck", "chip_sutro"] },
    thrift: { name: "Vintage Thrift", keeper: "Moonbeam", icon: "🧥", size: 6, random: true, pool: ["topper_crown", "plate_gold", "furn_lamp", "furn_jukebox", "furn_hammock", "song_psych", "horn_cablecar", "mirror_lashes", "dash_bobble", "map_secret_tunnels", "wrap_starry_night", "topper_sunhat", "roof_flowers"] },
  };

  /* ---------- dailies: one free go a day each (the real calendar date, reset at local midnight) ---------- */
  D.DAILIES = {
    zigzag: { name: "Lombard Zigzag Spin", icon: "🎡", kind: "wheel", desc: "Spin the wheel down Lombard's eight hairpins. Every slice wins something. Mostly." },
    sourdough: { name: "Giant Sourdough Bowl", icon: "🥖", kind: "grab", desc: "Take one free snack from the enormous bowl. Just one. They're watching." },
    fortune: { name: "Fortune Cookie", icon: "🥠", kind: "fortune", desc: "Crack a cookie for a fortune, and sometimes a prize." },
    interest: { name: "Credit Union Interest", icon: "🏦", kind: "interest", desc: "Collect today's interest on your Fares." },
    foghorn: { name: "Fog Horn Toss", icon: "📯", kind: "timing", desc: "Toss the ring onto the horn. Tap when the marker is in the gold." },
    birdfeeder: { name: "Bird Feeder", icon: "🐦", kind: "roll", table: "birdfeeder", desc: "The Presidio's birds leave a little something for your dashpets." },
    fountain: { name: "Paint Fountain", icon: "⛲", kind: "fountain", desc: "Toss a coin. A small chance of a free wrap." },
    bloom: { name: "Conservatory Bloom", icon: "🌺", kind: "roll", table: "bloom", desc: "Something's flowering in the Conservatory. Take a cutting." },
    summit: { name: "Summit Wish", icon: "🌄", kind: "summit", desc: "Make a wish at the top of the city. A car might grow a little. Or not." },
    bonfire: { name: "Bonfire", icon: "🔥", kind: "bonfire", desc: "Warm one car by the fire: every need restored." },
    taqueria: { name: "Taqueria Punch Card", icon: "🌮", kind: "punch", desc: "Get today's punch. Seven punches wins something rare." },
    raffle: { name: "Marquee Raffle", icon: "🎟️", kind: "scratch", desc: "Scratch three of nine stars under the marquee." },
    lab: { name: "Lab Zap", icon: "⚡", kind: "lab", desc: "The SoMa Startup Lab zaps one car. Results may vary. Results will vary.", rank: 10 },
    freebox: { name: "Free Box", icon: "📦", kind: "roll", table: "freebox", desc: "Whatever somebody left out on the stoop today." },
    sutro: { name: "Sutro Baths Wish", icon: "🌊", kind: "sneak", desc: "Something sleeps in the old baths, on a pile of treasure. Sneak up and take one thing…" },
  };
  // prize tables: [weight, prize]. A prize is { item, n } or { fares } or { text } (a joke) or a special kind
  D.LOOT = {
    zigzag: [
      [18, { fares: 50 }],
      [12, { fares: 150 }],
      [3, { fares: 600 }],
      [14, { item: "snack_capacitor" }],
      [10, { item: "toy_squeaky_cone" }],
      [8, { item: "chip_lombard" }],
      [6, { item: "wax_surf" }],
      [10, { text: "The wheel stopped on a pothole. Nothing! But a lovely spin." }],
      [8, { item: "map_lombard_curves" }],
      [1, { item: "rare_golden_ticket" }],
    ],
    sourdough: [
      [20, { item: "snack_sourdough_cell" }],
      [20, { item: "snack_volt_bar" }],
      [16, { item: "snack_dutch_crunch" }],
      [12, { item: "snack_fry" }],
      [10, { item: "snack_cioppino_cell" }],
      [6, { item: "snack_its_it" }],
      [3, { item: "snack_megawatt_muffin" }],
    ],
    fortune: [
      [30, { text: "fortune" }],
      [20, { fares: 80 }],
      [16, { item: "snack_fortune_amp" }],
      [10, { item: "snack_dim_sum" }],
      [8, { item: "song_cable_swing" }],
      [4, { item: "topper_lantern" }],
    ],
    birdfeeder: [
      [30, { item: "treat_birdseed" }],
      [16, { item: "treat_cracker" }],
      [12, { item: "treat_kelp" }],
      [10, { item: "treat_dew" }],
      [10, { item: "sense_lens" }],
      [6, { item: "sense_bird_sign" }],
      [1, { item: "pet_pigeon_pal" }],
    ],
    bloom: [
      [24, { item: "furn_fern" }],
      [18, { item: "cozy_air" }],
      [10, { item: "furn_orchid" }],
      [10, { item: "roof_flowers" }],
      [14, { fares: 100 }],
      [8, { item: "topper_sunhat" }],
      [2, { item: "rare_bison_hair" }],
    ],
    freebox: [
      [16, { item: "mirror_dice" }],
      [14, { item: "furn_lamp" }],
      [12, { item: "song_psych" }],
      [12, { item: "map_hidden_stairways" }],
      [16, { text: "A single sock. You leave it for someone who needs it more." }],
      [10, { item: "dash_bobble" }],
      [8, { item: "toy_karl_plush" }],
      [6, { item: "horn_cablecar" }],
      [2, { item: "rare_old_token" }],
    ],
    taqueria: [
      [20, { item: "rare_bison_hair" }],
      [20, { item: "wrap_mission_mural" }],
      [30, { item: "chip_coit" }],
      [30, { item: "furn_jukebox" }],
    ],
    raffle: [
      [24, { fares: 120 }],
      [8, { fares: 500 }],
      [1, { fares: 3000 }],
      [12, { item: "song_disco" }],
      [10, { item: "plate_rainbow" }],
      [8, { item: "mirror_streamers" }],
      [4, { item: "furn_neon" }],
    ],
    sutro: [
      [20, { item: "rare_sea_glass" }],
      [16, { item: "rare_old_token" }],
      [14, { item: "chip_bridge" }],
      [12, { item: "wrap_starry_night" }],
      [10, { item: "rare_fog_jar" }],
      [6, { item: "topper_crown" }],
      [2, { item: "wrap_gold" }],
    ],
    // a ride's lucky find (5% of rides)
    ride: [
      [30, { item: "chip_lombard" }],
      [8, { item: "chip_sutro" }],
      [26, { item: "snack_volt_bar" }],
      [14, { item: "snack_electron_chips" }],
      [10, { item: "pod_bridges" }],
      [8, { item: "map_pothole_atlas" }],
      [4, { item: "toy_tennis" }],
    ],
    // a fishing cast off Pier 39 (better with skill)
    fishing: [
      [30, { text: "An old boot. Classic." }],
      [20, { item: "treat_kelp" }],
      [16, { item: "snack_fry" }],
      [12, { item: "snack_cioppino_cell" }],
      [8, { item: "toy_rubber_sea_lion" }],
      [6, { fares: 200 }],
      [3, { item: "rare_sea_glass" }],
      [1, { item: "pet_sea_lion_pup" }],
    ],
  };
  D.FORTUNES = [
    "A long road is just a lot of short roads. Charge often.",
    "You will meet a pigeon who changes your life. Probably not for the better.",
    "The fog lifts for those who wait. Then comes back at four.",
    "Your next rider will leave a crumb. Forgive them.",
    "A shiny car is a happy car. A happy car is a shiny car. Think about it.",
    "Lucky numbers: 7, 14, 22, the 38 Geary.",
    "Help! I'm trapped in a fortune cookie factory in North Beach!",
    "The hill you dread is the view you'll love.",
    "Today a stranger will tip generously. Tomorrow, a student will not.",
    "Your car is thinking about you right now. It's thinking 'more snacks'.",
  ];
  D.WHEEL = ["◎50", "Snack", "◎150", "Toy", "Chip", "Nothing!", "Wax", "◎600"];

  /* ---------- random events: each car, 8% per in-game hour. tone: good (70%), funny (20%) or bad (10%, always easy to
     fix). fx: needs, fares, an item, a stat, bond, a wrap, a dashpet chance; when: a condition (fog, park, beach, …) ---------- */
  D.EVENTS = [
    { id: "fry", tone: "good", icon: "🍟", text: "A seagull dropped a french fry on {car}'s roof. It… seems pleased?", fx: { mood: 10 } },
    { id: "cookie", tone: "good", icon: "🍪", text: "Grandma left a cookie in {car}'s back seat.", fx: { item: "snack_grandma_cookie", cozy: 5 } },
    { id: "podcast", tone: "good", icon: "🎧", text: "{car} downloaded a podcast about bridges. +1 Smarts!", fx: { stat: "smarts" } },
    { id: "wave", tone: "good", icon: "👋", text: "A kid on a cable car waved at {car}. {car} flashed its lights back.", fx: { mood: 8, bond: 0.05 } },
    { id: "tip", tone: "good", icon: "💸", text: "A rider in a hurry left a ◎{n} tip in {car}'s cup holder.", fx: { fares: [20, 60] } },
    { id: "photo", tone: "good", icon: "📸", text: "A tourist took {car}'s photo. {car} is now briefly famous on the internet.", fx: { mood: 12 }, when: "tourist" },
    { id: "rainbow", tone: "good", icon: "🌈", text: "A rainbow over the bay! {car} slowed down to look.", fx: { mood: 10 } },
    { id: "sunbeam", tone: "good", icon: "☀️", text: "Sun broke through over {hood}. {car}'s panels drank it up.", fx: { charge: 10, mood: 5 } },
    { id: "street_sweeper", tone: "good", icon: "🧹", text: "A street sweeper gave {car} a free rinse on the way past.", fx: { shine: 20 } },
    { id: "chip_found", tone: "good", icon: "💾", text: "{car} found a firmware chip under a seat.", fx: { item: "chip_lombard" } },
    { id: "parrots", tone: "good", icon: "🦜", text: "The wild parrots of Telegraph Hill sang to {car}.", fx: { mood: 14 }, when: "hills" },
    { id: "bison", tone: "good", icon: "🦬", text: "A bison in Golden Gate Park nodded at {car}. Respect.", fx: { mood: 10, bond: 0.05 }, when: "park" },
    { id: "kind_rider", tone: "good", icon: "🧻", text: "A kind rider tidied {car}'s cabin before getting out.", fx: { cozy: 20 } },
    { id: "mural", tone: "good", icon: "🖌️", text: "A street artist in the Mission painted a tiny mural on {car}! (A free Mission Mural wrap!)", fx: { item: "wrap_mission_mural" }, rare: 0.03 },
    { id: "map_gift", tone: "good", icon: "🗺️", text: "A retired cabbie gave {car} his old map pack.", fx: { item: "map_hidden_stairways" } },
    { id: "fog_hug", tone: "good", icon: "🌫️", text: "Karl wrapped {car} in a cool, soft hug.", fx: { mood: 10, shine: 5 }, when: "fog" },
    { id: "pigeon_home", tone: "funny", icon: "🐦", text: "A pigeon has decided {car} is its home now.", fx: { senses: -30, petChance: "pigeon_pal" } },
    { id: "beige", tone: "funny", icon: "🎭", text: "{car} spent ten minutes convinced it was a parking meter. It's fine now.", fx: { clarity: -5, mood: 3 } },
    { id: "sock", tone: "funny", icon: "🧦", text: "{car} found a single sock. It doesn't know what to do with it. Nobody does.", fx: { cozy: -5 } },
    { id: "dog", tone: "funny", icon: "🐕", text: "A dog barked at {car} for a full minute. {car} beeped back. They're friends now.", fx: { mood: 5 } },
    { id: "selfie", tone: "funny", icon: "🤳", text: "An influencer used {car} as a background for forty-five selfies.", fx: { mood: 4, shine: -5 } },
    { id: "sea_lion_bark", tone: "funny", icon: "🦭", text: "The sea lions at Pier 39 barked at {car} and {car} took it personally.", fx: { mood: -3 }, when: "tourist" },
    { id: "karl_steal", tone: "bad", icon: "🌫️", text: "Karl the Fog swept through and stole ◎{n}.", fx: { fares: [-60, -20] }, when: "fog" },
    { id: "mud", tone: "bad", icon: "💩", text: "{car} drove through a puddle that was mostly mud.", fx: { shine: -25 } },
    { id: "crumbs", tone: "bad", icon: "🍿", text: "A whole bag of popcorn went off like a firework in {car}'s back seat.", fx: { cozy: -25 } },
    { id: "glitch", tone: "bad", icon: "💻", text: "{car} downloaded an update in the middle of a hill start. It needs a moment.", fx: { clarity: -25 } },
  ];

  /* ---------- riders: the cast, plus nameless riders. tip multiplies the fare; mess multiplies the Cozy cost ---------- */
  D.RIDERS = {
    TOURIST: { name: "The Tourist", icon: "🧢", tip: 1.3, mess: 1.0, fav: ["Fisherman's Wharf", "North Beach", "Russian Hill"], desc: "A wide-eyed dad from Ohio. Everything is amazing." },
    INFLUENCER: { name: "The Influencer", icon: "🤳", tip: 1.15, mess: 0.8, fav: ["Western Addition", "Castro", "Crissy Field"], desc: "Every smudge is a crisis. Every view is content." },
    GRANDMA: { name: "Grandma", icon: "👵", tip: 1.2, mess: 0.7, fav: ["Golden Gate Park", "Sunset", "North Beach"], desc: "Sweet, a little confused, always has a cookie." },
    FOUNDER: { name: "The Founder", icon: "💼", tip: 1.4, mess: 2.0, fav: ["SoMa", "Financial District", "Mission Bay"], desc: "Late for standup. Eats a whole lunch in the back seat." },
    LOCAL: { name: "The Local", icon: "🧥", tip: 0.9, mess: 1.0, fav: ["Bernal Heights", "Haight-Ashbury", "Richmond"], desc: "Deadpan. Has seen it all. Secretly loves your car." },
    ARTIST: { name: "The Artist", icon: "🎨", tip: 1.0, mess: 1.2, fav: ["Mission", "Haight-Ashbury", "Lands End"], desc: "Dreamy, from the Mission. Finds everything a little cosmic." },
    STUDENT: { name: "The Student", icon: "🎒", tip: 0.8, mess: 1.5, fav: ["Haight-Ashbury", "Sunset", "Mission"], desc: "Frazzled and sorry. Hands full of burritos." },
  };
  D.RIDER_KEYS = Object.keys(D.RIDERS);
  // the items each rider might ask for once you're friends (friendship level 2)
  D.RIDER_ASKS = {
    TOURIST: ["snack_sourdough_cell", "toy_rubber_sea_lion", "snack_capacitor", "toy_cable_bell"],
    INFLUENCER: ["wax_surf", "mirror_lashes", "wipe_fog_mist", "cozy_air"],
    GRANDMA: ["snack_capacitor", "cozy_cushion", "snack_fortune_amp", "song_bossa"],
    FOUNDER: ["clar_patch", "snack_irish_coffee", "pod_startups", "snack_volt_bar"],
    LOCAL: ["map_pothole_atlas", "song_fog_blues", "snack_dutch_crunch", "map_hidden_stairways"],
    ARTIST: ["song_psych", "roof_flowers", "snack_burrito_battery", "furn_lamp"],
    STUDENT: ["snack_burrito_battery", "cozy_lint", "pod_gold_rush", "snack_electron_chips"],
  };
  D.ASK_LINES = {
    TOURIST: "I promised the kids a {item}! Can you find one before {when}?",
    INFLUENCER: "I need a {item} for a shoot. Like, need-need. By {when}?",
    GRANDMA: "Dear, would you find me a {item}? No rush. Well, {when}.",
    FOUNDER: "I need a {item} before {when}. It's for a pitch. Don't ask.",
    LOCAL: "Find me a {item}. By {when}. Don't make it weird.",
    ARTIST: "A {item}… I dreamed of one. Could you bring it by {when}?",
    STUDENT: "Sorry, sorry, could I get a {item}? Before {when}? Sorry!",
  };
  // rider cards (Neopets' NeoDeck): common, holo and secret for each rider
  D.CARDS = {};
  for (const [r, list] of Object.entries({
    TOURIST: ["Wide-Eyed Arrival", "Fanny Pack Fortress", "The Clam Chowder Pilgrim"],
    INFLUENCER: ["Golden Hour Glow", "Ring Light Ritual", "#NoFilter (Filtered)"],
    GRANDMA: ["Cookie Courier", "Hand-Knit Hero", "Grandma Classic Edition"],
    FOUNDER: ["Standup in Five", "Series A Smile", "The Pivot"],
    LOCAL: ["Seen It All", "Burrito Purist", "Karl's Old Friend"],
    ARTIST: ["Mural at Dusk", "Cosmic Commute", "The Muse"],
    STUDENT: ["All-Nighter", "Burrito Juggler", "Finals Week Survivor"],
  }))
    list.forEach((name, i) => (D.CARDS[r.toLowerCase() + "_" + ["c", "h", "s"][i]] = { rider: r, name, tier: ["common", "holo", "secret"][i] }));

  /* ---------- the Landmark Stamp Album: the first time any car visits a landmark's neighbourhood in the right
     conditions (when: any, morning, day, dusk, night, fog, clear) ---------- */
  D.STAMPS = [
    { mark: "Lombard Street", hood: "Russian Hill", when: "morning", name: "Lombard at Dawn" },
    { mark: "Coit Tower", hood: "Telegraph Hill", when: "any", name: "Coit Tower" },
    { mark: "Pier 39", hood: "Fisherman's Wharf", when: "day", name: "Sea Lions of Pier 39" },
    { mark: "Saints Peter and Paul", hood: "North Beach", when: "any", name: "Twin Spires" },
    { mark: "Transamerica Pyramid", hood: "Financial District", when: "day", name: "The Pyramid at Noon" },
    { mark: "555 California", hood: "Financial District", when: "night", name: "555 After Dark" },
    { mark: "Ferry Building", hood: "Embarcadero", when: "morning", name: "Ferry Building Market Day" },
    { mark: "Bay Bridge (west span)", hood: "Embarcadero", when: "night", name: "The Bay Lights" },
    { mark: "Salesforce Tower", hood: "SoMa", when: "any", name: "Salesforce Tower" },
    { mark: "Golden Gate Bridge", hood: "Presidio", when: "dusk", name: "Golden Gate at Sunset" },
    { mark: "Fort Point", hood: "Crissy Field", when: "fog", name: "Fort Point in the Fog" },
    { mark: "Palace of Fine Arts", hood: "Marina", when: "any", name: "Palace of Fine Arts" },
    { mark: "Painted Ladies", hood: "Western Addition", when: "dusk", name: "Painted Ladies, Golden Hour" },
    { mark: "City Hall", hood: "Western Addition", when: "night", name: "City Hall Lit Up" },
    { mark: "Conservatory of Flowers", hood: "Golden Gate Park", when: "day", name: "Conservatory in Bloom" },
    { mark: "Stow Lake", hood: "Golden Gate Park", when: "morning", name: "Stow Lake Morning" },
    { mark: "Dutch Windmill", hood: "Ocean Beach", when: "fog", name: "Windmills in Fog" },
    { mark: "Ocean Beach", hood: "Ocean Beach", when: "dusk", name: "Ocean Beach Sunset" },
    { mark: "Sutro Tower", hood: "Twin Peaks", when: "fog", name: "Sutro Above the Fog" },
    { mark: "Twin Peaks", hood: "Twin Peaks", when: "night", name: "City Lights from Twin Peaks" },
    { mark: "Legion of Honor", hood: "Richmond", when: "any", name: "Legion of Honor" },
    { mark: "Lands End ruins", hood: "Lands End", when: "dusk", name: "Sutro Baths Ruins", hidden: true },
    { mark: "Mile Rock light", hood: "Lands End", when: "fog", name: "Mile Rock in the Mist", hidden: true },
    { mark: "Ballpark", hood: "Mission Bay", when: "day", name: "Ballgame Day" },
    { mark: "Chase Center", hood: "Mission Bay", when: "night", name: "Chase Center Game Night" },
    { mark: "Mount Davidson cross", hood: "Mount Davidson", when: "morning", name: "Mount Davidson Sunrise" },
    { mark: "Alcatraz", hood: "Fisherman's Wharf", when: "fog", name: "Alcatraz Through the Fog" },
  ];

  /* ---------- seasons (real calendar, month-day). Each brings limited wraps and items (sold only during the event,
     retired after it) and a short storyline that unlocks a chapter a day. A chapter asks for a job, an item or a visit ---------- */
  D.SEASONS = [
    {
      id: "halloween",
      name: "Halloween in the Fog",
      icon: "🎃",
      from: "10-17",
      to: "11-02",
      hub: "Russian Hill",
      shop: ["wrap_haunted", "topper_witch", "roof_pumpkin", "snack_pumpkin_cell", "song_spooky", "furn_jack_o"],
      story: [
        { title: "Something in the Garage", text: "Dispatch swears the garage lights flickered on their own last night. Give a car a reboot to check its sensors weren't imagining it.", ask: { job: "reboot" } },
        { title: "The Pumpkin Patch", text: "The Corner Store is out of pumpkins. Bring a Pumpkin Spice Power Cell to the garage to start the decorations.", ask: { item: "snack_pumpkin_cell" } },
        { title: "Phantom Fares", text: "Riders keep asking for a ride to 'the old baths'. Send a car to Ocean Beach to see what's out there.", ask: { visit: "Ocean Beach" } },
        { title: "Cobweb Clean-up", text: "Somebody spun cobwebs all over a cabin. Vacuum it out before the trick-or-treaters arrive.", ask: { job: "vacuum" } },
        { title: "The Ghost of Lombard Street", text: "It was a pigeon in a sheet all along. Shoo it (gently) and it'll haunt someone else.", ask: { job: "birds" } },
      ],
      reward: { avatar: "ghost", item: "wrap_haunted", fares: 1000 },
    },
    {
      id: "muertos",
      name: "Día de los Muertos",
      icon: "💀",
      from: "10-30",
      to: "11-03",
      hub: "Mission",
      shop: ["wrap_calavera", "topper_marigold", "snack_pan_muerto"],
      story: [
        { title: "Marigolds", text: "The Mission is building ofrendas. Take a car to the Mission to help carry marigolds.", ask: { visit: "Mission" } },
        { title: "Sweet Bread", text: "Bring Pan de Muerto for the altar at the garage.", ask: { item: "snack_pan_muerto" } },
        { title: "The Procession", text: "Give a car a wash so it shines for the evening procession down 24th Street.", ask: { job: "dirty" } },
      ],
      reward: { avatar: "calavera", item: "topper_marigold", fares: 600 },
    },
    {
      id: "fleet",
      name: "Fleet Week",
      icon: "✈️",
      from: "10-05",
      to: "10-13",
      hub: "Embarcadero",
      shop: ["wrap_blue_angels", "topper_sailor"],
      story: [
        { title: "Air Show Traffic", text: "Everybody wants a ride to the Marina for the air show. Send a car there.", ask: { visit: "Marina" } },
        { title: "Rattled Sensors", text: "The jets rattled a car's sensors. Shoo the startled pigeons off its lidar.", ask: { job: "birds" } },
      ],
      reward: { avatar: "jet", item: "topper_sailor", fares: 500 },
    },
    {
      id: "lunar",
      name: "Lunar New Year",
      icon: "🏮",
      from: "01-25",
      to: "02-20",
      hub: "North Beach",
      shop: ["wrap_lantern", "snack_mooncake", "topper_lantern"],
      story: [
        { title: "Lanterns on Grant", text: "Help string lanterns: take a car to North Beach.", ask: { visit: "North Beach" } },
        { title: "Firecracker Confetti", text: "Confetti everywhere! Vacuum a cabin out.", ask: { job: "vacuum" } },
      ],
      reward: { avatar: "dragon", item: "wrap_lantern", fares: 500 },
    },
    {
      id: "pride",
      name: "Pride",
      icon: "🏳️‍🌈",
      from: "06-01",
      to: "06-30",
      hub: "Castro",
      shop: ["wrap_pride", "mirror_streamers", "plate_rainbow"],
      story: [
        { title: "Parade Prep", text: "Wash a car so it gleams for the parade.", ask: { job: "dirty" } },
        { title: "Under the Marquee", text: "Take a car to the Castro for the party.", ask: { visit: "Castro" } },
      ],
      reward: { avatar: "rainbow", item: "wrap_pride", fares: 500 },
    },
    {
      id: "breakers",
      name: "Bay to Breakers",
      icon: "🏃",
      from: "05-10",
      to: "05-20",
      hub: "Golden Gate Park",
      shop: ["wrap_breakers"],
      story: [{ title: "Costumed Runners", text: "A centipede of runners left the doors open. Bump them shut.", ask: { job: "doors" } }],
      reward: { avatar: "runner", item: "wrap_breakers", fares: 400 },
    },
    {
      id: "outside",
      name: "Outside Lands",
      icon: "🎪",
      from: "08-05",
      to: "08-12",
      hub: "Golden Gate Park",
      shop: ["wrap_tie_dye", "song_psych"],
      story: [{ title: "Festival Charge-Up", text: "Every phone in the park is dead. Recharge a car so it can run the shuttle.", ask: { job: "charge" } }],
      reward: { avatar: "festival", item: "wrap_tie_dye", fares: 400 },
    },
  ];

  /* ---------- the weekly Car Show (Alamo Square): a theme each week; wraps, gear and traits that match score more ---------- */
  D.SHOW_THEMES = [
    { id: "fog", name: "Most Foggy" },
    { id: "sunny", name: "Sunniest Disposition" },
    { id: "fancy", name: "Most Distinguished" },
    { id: "bloom", name: "Best in Bloom" },
    { id: "party", name: "Life of the Party" },
    { id: "beach", name: "Beach Bum" },
    { id: "night", name: "Night Owl" },
    { id: "halloween", name: "Best Halloween", season: "halloween" },
  ];
  D.NPC_CARS = ["Biscuit", "Captain Lidar", "Duchess", "Rumbles", "Fogcutter", "Zippy", "Old Faithful", "Mx. Sparkle", "Turbo Tom", "Lady Lombard", "Beep Beep", "Clementine"];

  /* ---------- the garage: upgrades (cost per level) and furniture slots ---------- */
  D.GARAGE = {
    bays: { name: "Charger bays", icon: "🔌", max: 4, cost: [0, 800, 2500, 6000], desc: "Each bay charges one car at home (+15 Charge an hour)." },
    wash: { name: "Auto-wash", icon: "🫧", max: 2, cost: [0, 1500, 5000], desc: "A slow wash overnight: +20 Shine per level for every car at home." },
    pods: { name: "Nap pods", icon: "😴", max: 2, cost: [0, 1500, 5000], desc: "A deep rest overnight: +20 Clarity per level." },
    fridge: { name: "Snack fridge", icon: "🧊", max: 3, cost: [0, 600, 2000, 5000], desc: "More inventory space: 40, 60, 90, then 130 items." },
    rooms: { name: "Rooms", icon: "🏠", max: 3, cost: [0, 1200, 4000, 9000], desc: "Furniture slots: 2, 4, 6, then 8." },
    vault: { name: "Credit union account", icon: "🏦", max: 3, cost: [0, 1000, 4000, 10000], desc: "Daily interest: 0.5%, 0.75%, 1%, then 1.25%." },
  };
  D.FRIDGE = [40, 60, 90, 130];
  D.ROOMS = [2, 4, 6, 8];
  D.INTEREST = [0.005, 0.0075, 0.01, 0.0125];
  // what each Crew Rank unlocks besides lands
  D.RANK_UNLOCKS = { 2: "A 2nd car slot", 5: "A 3rd car slot", 6: "The Hill Climb Derby", 9: "A 4th car slot", 10: "The Lab Zap", 12: "The SF Startup Index" };
  D.CAR_SLOTS = [
    [1, 1],
    [2, 2],
    [5, 3],
    [9, 4],
  ];
  D.ADOPT_FEE = [0, 500, 1500, 3500, 6000];

  /* ---------- the Adoption Lot: names, backstories and plates for the cars waiting there ---------- */
  D.CAR_NAMES = ["Pickle", "Sir Lidar", "Mochi", "Biscuit", "Noodle", "Sprocket", "Pixel", "Clementine", "Dumpling", "Waffles", "Juniper", "Chowder", "Ziggy", "Pebble", "Tofu", "Marbles", "Bagel", "Sunny", "Karlita", "Gizmo", "Pretzel", "Bruno", "Lumen", "Beans"];
  D.BACKSTORIES = [
    "Found circling the Embarcadero, looking for its old rider.",
    "Spent a year as a parking-lot shuttle at the airport. Never saw the city. Dreams of hills.",
    "Retired from a film shoot where it played 'Car in Background #3'. Wants a speaking part.",
    "Turned up at the garage one foggy morning with a pigeon on its roof. Both stayed.",
    "Was a demo car at a trade show. Has been poked by a thousand strangers. Needs a friend.",
    "Got lost on the way to Daly City in 2023 and has been trying to get home ever since.",
    "Says it used to drive for a famous chef. Will not say which one. Smells faintly of garlic.",
    "Loves the Sutro Tower. Stares at it. Nobody knows why.",
    "Missed its rider's wedding by four minutes. Has been punctual ever since.",
    "Its last fleet was sold. It was not. It is trying not to take this personally.",
    "Escaped a car wash halfway through. Still a little sudsy on one side.",
    "Knows every bakery in the Sunset. Will drive past each one slowly.",
  ];
  D.PLATE_WORDS = ["FOG", "SF", "BAY", "HILL", "KARL", "LIDR", "BEEP", "ZOOM", "CABL", "SURF"];

  /* ---------- quests ---------- */
  // Karl the Fog quests (only on foggy days): he asks for an item, the reward is a big permanent boost
  D.KARL_REWARDS = [{ stat: 2 }, { wrap: "wrap_karl_grey" }, { dashpet: "mini_karl" }, { item: "rare_fog_jar" }];
  D.KARL_ASKS = ["toy_karl_plush", "wipe_fog_mist", "song_fog_blues", "horn_foghorn", "map_fog_patterns", "snack_irish_coffee", "topper_beanie"];
  // the Sutro Tower riddle: SF trivia (the car trivia is made up from your save, in sim.js)
  D.TRIVIA = [
    ["What colour is the Golden Gate Bridge officially called?", ["International Orange", "Bridge Red", "Fog Gold"], 0],
    ["How many hairpin turns does Lombard Street's crooked block have?", ["Five", "Eight", "Twelve"], 1],
    ["What's the nickname of San Francisco's summer fog?", ["Karl", "Gerald", "The Grey"], 0],
    ["Which animals took over Pier 39 in 1989?", ["Pelicans", "Sea lions", "Otters"], 1],
    ["What runs on Powell, Hyde and California Streets?", ["Trolleybuses", "Cable cars", "Ferries"], 1],
    ["What are the Victorian houses on Alamo Square called?", ["The Painted Ladies", "The Pastel Sisters", "The Seven Gables"], 0],
    ["Which park has a herd of bison?", ["The Presidio", "Golden Gate Park", "Dolores Park"], 1],
    ["What stands on top of Telegraph Hill?", ["Sutro Tower", "Coit Tower", "City Hall"], 1],
    ["What's the tall red-and-white tower on the ridge above the Castro?", ["Sutro Tower", "Salesforce Tower", "The Transamerica"], 0],
    ["What were the ruins at Lands End?", ["A fort", "Public baths", "A lighthouse"], 1],
  ];
  // the SF Startup Index (rank 12): silly startups whose shares wander every in-game hour
  D.STARTUPS = [
    { id: "FOGG", name: "Fogg.ly", desc: "Fog as a service", p: 40 },
    { id: "BRRT", name: "Burrito Cloud", desc: "Burritos, but on the blockchain", p: 25 },
    { id: "PGN", name: "PigeonPost", desc: "Messages delivered by pigeon. Eventually.", p: 12 },
    { id: "HILL", name: "HillHop", desc: "Uber for walking up hills", p: 60 },
    { id: "KMBU", name: "KombuChain", desc: "Fermented tea futures", p: 18 },
    { id: "SOCK", name: "OneSock", desc: "Matching lost socks with AI", p: 8 },
  ];
  // auction lots the NPC bidders fight over
  D.AUCTION_POOL = ["topper_crown", "wrap_starry_night", "wrap_castro_rainbow", "furn_hammock", "chip_bridge", "map_secret_tunnels", "pet_mini_bison", "pet_parrot", "furn_jukebox", "wax_showroom", "rare_old_token"];
  D.BIDDERS = ["xX_Lidar_Xx", "GrandmaMaude", "TechBroTodd", "SeaLionSally", "FogDog42", "Moonbeam"];

  /* ---------- trophies and avatars ---------- */
  D.TROPHIES = {
    first_adopt: { name: "Welcome to the Fleet", icon: "🚗", desc: "Adopt your first car" },
    pigeon_whisperer: { name: "Pigeon Whisperer", icon: "🐦", desc: "Shoo 10 flocks of birds" },
    survived_karl: { name: "Survived Karl", icon: "🌫️", desc: "Get through 5 foggy days" },
    grandmas_favorite: { name: "Grandma's Favorite", icon: "👵", desc: "Reach friendship 5 with Grandma" },
    collector: { name: "Stamp Collector", icon: "📮", desc: "Collect 10 stamps" },
    full_fleet: { name: "Full Garage", icon: "🅿️", desc: "Have 4 active cars" },
    legend: { name: "A Legend Is Born", icon: "🏆", desc: "Raise a car to Legend" },
    show_winner: { name: "Best in Show", icon: "🎀", desc: "Win the Car Show" },
    derby_winner: { name: "King of the Hill", icon: "⛰️", desc: "Win the Hill Climb Derby" },
    millionaire: { name: "Fare Millionaire", icon: "💰", desc: "Hold ◎100,000" },
    bookworm: { name: "Bookworm", icon: "📚", desc: "Have one car read 10 map packs or podcasts" },
    halloween: { name: "Ghost of Lombard Street", icon: "👻", desc: "Finish the Halloween storyline" },
  };
  // the arcade's trophies: bronze, silver and gold scores for each job played on its own
  D.ARCADE = { tiers: [600, 900, 1200], divisor: 30, plays: 3, runCap: 600, runDivisor: 20 };
  D.AVATARS = { pigeon: "🐦", car: "🚗", fog: "🌫️", ghost: "👻", calavera: "💀", jet: "✈️", dragon: "🐉", rainbow: "🌈", runner: "🏃", festival: "🎪", crown: "👑", bison: "🦬" };

  /* ---------- the diary: Dispatch narrates the day ---------- */
  D.DIARY = {
    open: ["Day {day}. Another day, another bag of crumbs.", "Day {day} in the books. Here's how your fleet did, crew.", "Day {day}. I watched the whole thing. On a screen. Eating chips."],
    km: "{car} drove {km} km and gave {rides} rides.",
    best: "{car} had the best day. Don't tell the others.",
    low: "{car}'s {need} rating is '{label}'. Proud of you. (That was sarcasm.)",
    good: ["Everybody's tucked in and happy. Sickening, honestly.", "Nobody sulked today. A new record."],
    fares: "The fleet earned ◎{fares} today.",
    close: ["Sleep tight. The fog doesn't.", "Go to bed. I'll mind the garage. (I will not mind the garage.)", "Same time tomorrow? Obviously."],
  };

  WG.adoptData = D;
})();
