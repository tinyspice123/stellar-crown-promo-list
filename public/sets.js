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
//   sheetGid   numeric Google Sheets tab id; the shared URL lives below
//   tcgSet     pokemontcg.io id (images + logo; covers sets up to ~2025)
//   tcgdexSet  TCGdex id (images + logo; covers newer sets incl. Mega era)
//   cardmarketSet  Cardmarket catalog code used in marketplace searches
//   cardmarketUrl  optional collection-wide Cardmarket page (e.g. a species)
//   homeGroup  home-page section: sv, mega, or misc
//   logo / imgTemplate / promoSet / subtitle / eyebrow: optional
// =====================================================================

const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub";

const SETS = {

  // ==================================================================
  //  SCARLET & VIOLET ERA (2023–2025) — un-comment as you add tabs
  //  These all work with pokemontcg.io via tcgSet.
  // ==================================================================

  "scarlet-violet": {          // Mar 2023
    name: "Scarlet & Violet",
    homeGroup: "sv",
    sheetGid: "711342047",
    tcgSet: "sv1",
    cardmarketSet: "SVI",
  },

  "paldea-evolved": {          // Jun 2023
    name: "Paldea Evolved",
    homeGroup: "sv",
   sheetGid: "2027393009",
    tcgSet: "sv2",
    cardmarketSet: "PAL",
  },

  "obsidian-flames": {         // Aug 2023
    name: "Obsidian Flames",
    homeGroup: "sv",
    sheetGid: "39019753",
    tcgSet: "sv3",
    cardmarketSet: "OBF",
  },

  "pokemon-151": {             // Sep 2023 · special set (no reverse holos; Poké Ball / Master Ball foils instead)
    name: "151",
    homeGroup: "sv",
    sheetGid: "1515120620",
    tcgSet: "sv3pt5",
    cardmarketSet: "MEW",
  },

  "paradox-rift": {            // Nov 2023
    name: "Paradox Rift",
    homeGroup: "sv",
    sheetGid: "1785181060",
    tcgSet: "sv4",
    cardmarketSet: "PAR",
  },

  "paldean-fates": {           // Jan 2024 · special set (shiny Pokémon)
    name: "Paldean Fates",
    homeGroup: "sv",
    sheetGid: "1416771791",
    tcgSet: "sv4pt5",
    cardmarketSet: "PAF",
  },

  "temporal-forces": {         // Mar 2024
    name: "Temporal Forces",
    homeGroup: "sv",
    sheetGid: "27323771",
    tcgSet: "sv5",
    cardmarketSet: "TEF",
  },

  "twilight-masquerade": {     // May 2024
    name: "Twilight Masquerade",
    homeGroup: "sv",
    sheetGid: "60428636",
    tcgSet: "sv6",
    cardmarketSet: "TWM",
  },

  "shrouded-fable": {          // Aug 2024 · special set
    name: "Shrouded Fable",
    homeGroup: "sv",
    sheetGid: "269046513",
    tcgSet: "sv6pt5",
    cardmarketSet: "SFA",
  },

  "stellar-crown": {
    name: "Stellar Crown",
    homeGroup: "sv",
    sheetGid: "1801512098",
    tcgSet: "sv7",
    cardmarketSet: "SCR",
  },

  "surging-sparks": {          // Nov 2024
    name: "Surging Sparks",
    homeGroup: "sv",
    sheetGid: "337322374",
    tcgSet: "sv8",
    cardmarketSet: "SSP",
  },

  "prismatic-evolutions": {    // Jan 2025 · special set (Eeveelutions; Poké Ball / Master Ball foils)
    name: "Prismatic Evolutions",
    homeGroup: "sv",
    sheetGid: "615856191",
    tcgSet: "sv8pt5",
    cardmarketSet: "PRE",
  },

  // ---- 2025 sets: pokemontcg.io coverage gets patchy here, so these ----
  // ---- carry BOTH ids — the fallback chain uses whichever responds. ----

  "journey-together": {        // Mar 2025
    name: "Journey Together",
    homeGroup: "sv",
    sheetGid: "779986776",
    tcgSet: "sv9",
    tcgdexSet: "sv09",
    cardmarketSet: "JTG",
  },

  "destined-rivals": {         // May 2025
    name: "Destined Rivals",
    homeGroup: "sv",
    sheetGid: "217413449",
    tcgSet: "sv10",
    tcgdexSet: "sv10",
    cardmarketSet: "DRI",
  },

  "black-bolt": {              // Jul 2025 · special set (paired with White Flare)
    name: "Black Bolt",
    homeGroup: "sv",
    sheetGid: "880239600",
    tcgSet: "zsv10pt5",        // VERIFY — open images.pokemontcg.io/zsv10pt5/logo.png
    tcgdexSet: "sv10.5b",      // VERIFY on tcgdex.net
    cardmarketSet: "BLK",
  },

  "white-flare": {             // Jul 2025 · special set (paired with Black Bolt)
    name: "White Flare",
    homeGroup: "sv",
    sheetGid: "210774537",
    tcgSet: "rsv10pt5",        // VERIFY — open images.pokemontcg.io/rsv10pt5/logo.png
    tcgdexSet: "sv10.5w",      // VERIFY on tcgdex.net
    cardmarketSet: "WHT",
  },

  // ==================================================================
  //  MEGA EVOLUTION ERA (2025–) — not on pokemontcg.io; TCGdex only
  // ==================================================================

  "mega-evolution": {          // Sep 2025
    name: "Mega Evolution",
    homeGroup: "mega",
    code: "ME01",
   sheetGid: "1307332424",
    tcgdexSet: "me01",
    cardmarketSet: "MEG",
  },

  "phantasmal-flames": {       // Nov 2025
    name: "Phantasmal Flames",
    homeGroup: "mega",
    code: "ME02",
   sheetGid: "686865005",
    tcgdexSet: "me02",
    cardmarketSet: "PFL",
  },

  "ascended-heroes": {         // Jan 2026 · special set
    name: "Ascended Heroes",
    homeGroup: "mega",
    code: "ME02.5",
   sheetGid: "1197270292",
    tcgdexSet: "me02.5",       // VERIFY on tcgdex.net
    cardmarketSet: "ASC",
  },

  "perfect-order": {
    name: "Perfect Order",
    homeGroup: "mega",
    code: "ME03",
    sheetGid: "1756238588",
    tcgdexSet: "me03",   // images + logo come from TCGdex automatically
    cardmarketSet: "POR",
  },

  "chaos-rising": {
    name: "Chaos Rising",
    homeGroup: "mega",
    code: "ME04",
   sheetGid: "951588215",
    tcgdexSet: "me04",       // VERIFY on tcgdex.net
    cardmarketSet: "CRI",
  },

  "pitch-black": {
    name: "Pitch Black",
    homeGroup: "mega",
    code: "ME05",
   sheetGid: "1809096743",
    tcgdexSet: "me05",       // VERIFY on tcgdex.net
    cardmarketSet: "PBL",
  },

  "mew-collection": {
    name: "Mew Collection",
    homeGroup: "misc",
    code: "MEW",
    sheetGid: "1254467412",
    cardmarketUrl: "https://www.cardmarket.com/en/Pokemon/Species/Mew",
  },

};

// Browser consumers continue to use cfg.sheet; only the registry stores gids.
for(const cfg of Object.values(SETS)){
  if(cfg.sheetGid){
    cfg.sheet=`${SHEET_BASE_URL}?gid=${encodeURIComponent(cfg.sheetGid)}&single=true&output=csv`;
  }
}
