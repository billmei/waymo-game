/* Waymo Care · Sunday Drive · the content. The six districts the city opens up in (each a handful of the neighbourhoods
   on Adopt-a-Waymo's road graph, js/adopt/data.js HOODS and EDGES), what each one does to a car, how it looks, which
   arcade street patch (js/world.js ZONES) its hands-on care is played on and which instrument it adds to the music;
   the riders' thank-you notes, the photo filters and borders. Plain tables: new content needs no new code. */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const D = {};

  /* ---------- the districts, in the order the map opens. hoods: neighbourhood names on the road graph (the first is the
     district's hub, where its depot is and its new cars start). cost: Map Seals to part the clouds. look: the light
     while the camera is over it (map) and down on its street patch (street). needs: the needs a car picks up driving
     there, with the status line the Inspector card shows. stem: the instrument it weaves into the bossa nova ---------- */
  D.DISTRICTS = [
    {
      id: "lombard",
      name: "Russian Hill",
      sub: "Lombard Street to Coit Tower",
      hoods: ["Russian Hill", "North Beach", "Telegraph Hill", "Fisherman's Wharf", "Nob Hill"],
      cost: 0,
      zone: "lombard",
      look: { map: "morning", street: "morning" },
      needs: [
        ["charge", "Battery's tired from Russian Hill's steep climbs"],
        ["doors", "A tourist left a door open on the slope"],
        ["vacuum", "Sourdough crumbs from the Wharf in the back seat"],
      ],
      quirk: "Morning sun, steep grades and doors left open on the slopes.",
      stem: "Nylon guitar & electric piano",
      icon: "🌄",
    },
    {
      id: "downtown",
      name: "Downtown",
      sub: "The Financial District's towers",
      hoods: ["Financial District", "Embarcadero", "SoMa", "Mission Bay"],
      cost: 2,
      zone: "downtown",
      look: { map: "day", street: "day" },
      needs: [
        ["dirty", "Chassis is dusty from the Downtown lunch rush"],
        ["vacuum", "Burrito crumbs and a coffee lid in the cabin"],
        ["charge", "Idled through the whole lunch rush; battery's low"],
      ],
      quirk: "Skyscraper shadows, the lunch rush's dust and coffee splashes.",
      stem: "Upright bass",
      icon: "🏙️",
    },
    {
      id: "presidio",
      name: "The Presidio",
      sub: "Under the Golden Gate Bridge",
      hoods: ["Presidio", "Marina", "Crissy Field", "Pacific Heights"],
      cost: 4,
      zone: "presidio",
      look: { map: "day", street: "day" },
      needs: [
        ["birds", "Pigeons are roosting on the warm lidar"],
        ["dirty", "Pine needles and gull droppings on the roof"],
        ["doors", "A kite-flyer left the boot open at Crissy Field"],
      ],
      quirk: "Coastal pine breezes, and pigeons and gulls roosting on lidars.",
      stem: "Vibraphone melody",
      icon: "🌉",
    },
    {
      id: "ladies",
      name: "Alamo Square",
      sub: "The Painted Ladies",
      hoods: ["Western Addition", "Haight-Ashbury", "Castro"],
      cost: 6,
      zone: "ladies",
      look: { map: "dusk", street: "dusk" },
      needs: [
        ["cone", "Picnickers boxed it in with traffic cones"],
        ["vacuum", "Picnic crumbs and a lost sock in the cabin"],
        ["birds", "Park pigeons found the sunny roof"],
      ],
      quirk: "Perpetual golden hour, picnickers and cones blocking the lanes.",
      stem: "Brush drums & shaker",
      icon: "🏠",
    },
    {
      id: "windmills",
      name: "Ocean Beach",
      sub: "The windmills, in Karl the Fog",
      hoods: ["Ocean Beach", "Golden Gate Park", "Richmond", "Lands End", "Sunset"],
      cost: 8,
      zone: "windmills",
      look: { map: "day", street: "fog" },
      karl: true,
      needs: [
        ["reboot", "Karl the Fog misted up the sensors; needs a reboot"],
        ["dirty", "Salt spray and sand all down the sides"],
        ["birds", "Gulls are sheltering from the fog on the lidar"],
      ],
      quirk: "Karl the Fog rolling over the dunes, salt spray and misty reboots.",
      stem: "Mellow horn",
      icon: "🌫️",
    },
    {
      id: "twinpeaks",
      name: "Twin Peaks & the Waterfront",
      sub: "The rest of the city",
      // every other neighbourhood on the graph joins this one (see sunday/city.js)
      hoods: ["Twin Peaks", "Noe Valley", "Mission", "Potrero Hill", "Bernal Heights"],
      rest: true,
      cost: 10,
      zone: "ladies",
      look: { map: "day", street: "day" },
      needs: [
        ["charge", "The long climb up Twin Peaks drained the battery"],
        ["dirty", "Dusty from the long scenic route across the city"],
        ["doors", "A ballgame crowd left the doors open"],
        ["cone", "Street fair cones round the car"],
      ],
      quirk: "Panoramic heights, ferry horns and long scenic routes across the city.",
      stem: "Full ensemble harmony",
      icon: "⛰️",
    },
  ];
  D.BY_ID = {};
  for (const d of D.DISTRICTS) D.BY_ID[d.id] = d;

  // the need kinds (js/jobs.js), with the bubble's short label and the card's verb
  D.NEEDS = {
    dirty: { label: "Dusty chassis", act: "Wash car", word: "Sparkling!" },
    charge: { label: "Low battery", act: "Top up battery", word: "All charged!" },
    cone: { label: "Boxed in by cones", act: "Clear the cones", word: "All clear!" },
    birds: { label: "Birds on the lidar", act: "Shoo the birds", word: "Lovely!" },
    reboot: { label: "Sensor glitch", act: "Reboot sensors", word: "All set!" },
    vacuum: { label: "Crumbs in the cabin", act: "Vacuum the cabin", word: "Spotless!" },
    doors: { label: "Door left ajar", act: "Close the doors", word: "All set!" },
  };

  /* ---------- Map Seals ---------- */
  D.SEALS = { perCares: 3, perFares: 10, perPostcard: 1 };
  D.AUTO_CARE_SECS = 180; // a need nobody looks at sorts itself out at a depot after three minutes

  /* ---------- the fleet ---------- */
  D.FLEET = { base: 3, perDistrict: 1, max: 9, speed: 34 }; // speed: island units per second on the map
  D.RING_COLS = ["#36d3c4", "#ff7ad9", "#ffc93a", "#7fdcff", "#9be15d", "#ff9a5a", "#b48aff", "#ff5a6e", "#5ad1ff"];

  /* ---------- thank-you notes, by rider (js/adopt/data.js RIDERS) and job; "*" for any job ---------- */
  D.NOTES = {
    GRANDMA: {
      vacuum: "Such a polite crew, thank you dear!",
      dirty: "Shiny as my good silverware. Have a cookie, dear.",
      "*": "You're a treasure. I'll knit you a scarf for the fog.",
    },
    TOURIST: {
      doors: "Didn't even know cars could close their own doors. Wait, they can't?",
      birds: "Saw a real SF pigeon up close! Best day of the trip!",
      "*": "Ohio is gonna hear ALL about this crew!",
    },
    INFLUENCER: {
      dirty: "Literally glowing. Tagging you in my story.",
      vacuum: "The cabin is so clean it's basically a vibe.",
      "*": "Ten out of ten, no notes. Okay one note: you're iconic.",
    },
    FOUNDER: {
      charge: "Made standup with 4% to spare. You're a 10x pit crew.",
      reboot: "Fastest reboot I've seen. Want to join my startup?",
      "*": "Sending you a calendar invite to say thanks.",
    },
    LOCAL: {
      dirty: "Best pit crew in SF. Keep it easy.",
      cone: "Cones, huh. Classic. Thanks.",
      "*": "Not bad. Not bad at all.",
    },
    ARTIST: {
      birds: "The pigeons were a gift, but so are you.",
      reboot: "The fog and the car are one now. Beautiful work.",
      "*": "Your care has a colour, and it's warm yellow.",
    },
    STUDENT: {
      vacuum: "Sorry about the burrito. And thank you. Mostly sorry.",
      charge: "Got to my exam on time!! Thank you thank you.",
      "*": "You saved my whole afternoon, honestly.",
    },
  };

  /* ---------- photo mode ---------- */
  // css: the live viewfinder's look (and the capture's, through the 2D canvas's filter); vignette: how dark (or, for
  // Karl's Mist, how white) the corners go
  D.FILTERS = [
    { id: "natural", name: "Natural", css: "none", vig: 0 },
    { id: "golden", name: "Golden Hour", css: "sepia(0.32) saturate(1.35) brightness(1.06) contrast(1.04) hue-rotate(-8deg)", vig: 0.28, warm: true },
    { id: "mist", name: "Karl's Mist", css: "saturate(0.62) brightness(1.1) contrast(0.82)", vig: 0.45, white: true },
    { id: "kodachrome", name: "Kodachrome '68", css: "contrast(1.18) saturate(1.5) sepia(0.12) brightness(1.02)", vig: 0.32 },
    { id: "noir", name: "Monochrome Noir", css: "grayscale(1) contrast(1.38) brightness(0.96)", vig: 0.5 },
  ];
  D.BORDERS = [
    { id: "none", name: "No border" },
    { id: "postcard", name: "Vintage postcard" },
    { id: "stamp", name: "Postage stamp" },
    { id: "snapshot", name: "Snapshot" },
  ];

  WG.sundayData = D;
})();
