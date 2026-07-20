// =====================================================================
//  SET REGISTRY — add a new set here and it appears on the home page
//  and gets its own tracker at tracker.html?set=<id>
//
//  To activate a templated set below:
//   1. Add a tab for it in the spreadsheet (same columns)
//   2. Click the tab and copy the number after #gid= in the address bar
//   3. Replace PASTE_TAB_GID in that entry and un-comment the block
//  (The whole document is published, so no re-publishing is needed.)
//
//  Fields:
//   name       display name  ·  code: display code for the home tile
//   sheet      published CSV link for that tab (only the gid differs)
//   tcgSet     pokemontcg.io id (images + logo; covers sets up to ~2025)
//   tcgdexSet  TCGdex id (images + logo; covers newer sets incl. Mega era)
//   cardmarketSet  Cardmarket catalog code used in marketplace searches
//   logo / imgTemplate / promoSet / subtitle / eyebrow: optional
// =====================================================================

const SETS = {

  // ==================================================================
  //  SCARLET & VIOLET ERA (2023–2025) — un-comment as you add tabs
  //  These all work with pokemontcg.io via tcgSet.
  // ==================================================================

  "scarlet-violet": {          // Mar 2023
    name: "Scarlet & Violet",
//    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv1",
  },

  "paldea-evolved": {          // Jun 2023
    name: "Paldea Evolved",
//    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv2",
  },

  "obsidian-flames": {         // Aug 2023
    name: "Obsidian Flames",
//    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv3",
  },

  "pokemon-151": {                     // Sep 2023 · special set (no reverse holos; Poké Ball / Master Ball foils instead)
    name: "151",
//    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv3pt5",
  },

  "paradox-rift": {            // Nov 2023
    name: "Paradox Rift",
//    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv4",
  },

  "paldean-fates": {           // Jan 2024 · special set (shiny Pokémon)
    name: "Paldean Fates",
 //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv4pt5",
  },

  "temporal-forces": {         // Mar 2024
    name: "Temporal Forces",
//    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv5",
  },

  "twilight-masquerade": {     // May 2024
    name: "Twilight Masquerade",
//    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv6",
  },

  "shrouded-fable": {          // Aug 2024 · special set
    name: "Shrouded Fable",
//    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv6pt5",
  },

  "stellar-crown": {
    name: "Stellar Crown",
    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=1801512098&single=true&output=csv",
    tcgSet: "sv7",
    cardmarketSet: "SCR",
  },

  "surging-sparks": {          // Nov 2024
    name: "Surging Sparks",
  //  sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv8",
  },

  "prismatic-evolutions": {    // Jan 2025 · special set (Eeveelutions; Poké Ball / Master Ball foils)
    name: "Prismatic Evolutions",
 //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv8pt5",
  },

  // ---- 2025 sets: pokemontcg.io coverage gets patchy here, so these ----
  // ---- carry BOTH ids — the fallback chain uses whichever responds. ----

  "journey-together": {        // Mar 2025
    name: "Journey Together",
   // sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv9",
    tcgdexSet: "sv09",
  },

  "destined-rivals": {         // May 2025
    name: "Destined Rivals",
 //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "sv10",
    tcgdexSet: "sv10",
  },

  "black-bolt": {              // Jul 2025 · special set (paired with White Flare)
    name: "Black Bolt",
 //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "zsv10pt5",        // VERIFY — open images.pokemontcg.io/zsv10pt5/logo.png
    tcgdexSet: "sv10.5b",      // VERIFY on tcgdex.net
  },

  "white-flare": {             // Jul 2025 · special set (paired with Black Bolt)
    name: "White Flare",
 //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgSet: "rsv10pt5",        // VERIFY — open images.pokemontcg.io/rsv10pt5/logo.png
    tcgdexSet: "sv10.5w",      // VERIFY on tcgdex.net
  },

  // ==================================================================
  //  MEGA EVOLUTION ERA (2025–) — not on pokemontcg.io; TCGdex only
  // ==================================================================

  "mega-evolution": {          // Sep 2025
    name: "Mega Evolution",
    code: "ME01",
  //  sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgdexSet: "me01",
  },

  "phantasmal-flames": {       // Nov 2025
    name: "Phantasmal Flames",
    code: "ME02",
   // sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgdexSet: "me02",
  },

  "ascended-heroes": {         // Jan 2026 · special set
    name: "Ascended Heroes",
    code: "ME02.5",
 //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgdexSet: "me02.5",       // VERIFY on tcgdex.net
  },

  "perfect-order": {
    name: "Perfect Order",
    code: "ME03",
    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=1756238588&single=true&output=csv",
    tcgdexSet: "me03",   // images + logo come from TCGdex automatically
    cardmarketSet: "POR",
  },

  "chaos-rising": {
    name: "Chaos Rising",
    code: "ME04",
  //  sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgdexSet: "me04",       // VERIFY on tcgdex.net
  },

  "pitch-black": {
    name: "Pitch Black",
    code: "ME05",
  //  sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=PASTE_TAB_GID&single=true&output=csv",
    tcgdexSet: "me05",       // VERIFY on tcgdex.net
  },

};
