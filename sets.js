// =====================================================================
//  SET REGISTRY — add a new set here and it appears on the home page
//  and gets its own tracker at tracker.html?set=<id>
// =====================================================================
//
//  To add a set:
//   1. In your Google Spreadsheet, add a new tab with the same columns
//      (Group, Card, Number, Variant, Source, Status, Price, Have, Image)
//   2. File → Share → Publish to web → pick THAT TAB → CSV → copy link
//   3. Add an entry below. Done — no other files need touching.
//
//  Fields:
//   name     display name of the set
//   sheet    the published CSV link for that tab (note each tab has its
//            own gid=... in the link)
//   tcgSet   pokemontcg.io set code for card images and the set logo
//            (sv7 = Stellar Crown, sv4 = Paradox Rift, sv8 = Surging
//            Sparks, sv3pt5 = 151 ... see pokemontcg.io/sets)
//   promoSet (optional) promo set code for "SVP NNN" numbers, default "svp"
//   logo     (optional) custom logo URL, defaults to the tcgSet logo
//   imgTemplate (optional) card image URL template for sets that are NOT
//            on pokemontcg.io (it stopped updating before the Mega era).
//            {num} = unpadded number, {num3} = zero-padded. Example below.
//   code     (optional) display code for the home tile when tcgSet is unset
//   eyebrow  (optional) small line above the logo
//   subtitle (optional) small line under the logo (hidden if omitted)
//   file     (optional) local xlsx fallback if sheet is empty/unreachable
//   tab      (optional) tab name inside that xlsx
// =====================================================================

const SETS = {

  "stellar-crown": {
    name: "Stellar Crown",
    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=1801512098&single=true&output=csv",
    tcgSet: "sv7",
    file: "checklist.xlsx",
    tab: "Promos & Variants",
  },

  // ---- Mega-era example (pokemontcg.io lacks these sets) --------------
  // "perfect-order": {
  //   name: "Perfect Order",
  //   code: "ME03",
  //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=YOUR_TAB_GID&single=true&output=csv",
  //   // TCGdex hosts Mega-era images; open one URL in your browser to
  //   // verify the path before committing, adjust if needed:
  //   imgTemplate: "https://assets.tcgdex.net/en/me/me03/{num}/high.png",
  //   logo: "https://assets.tcgdex.net/en/me/me03/logo.png",
  // },

  // ---- template: copy, un-comment, fill in ----------------------------
  // "paradox-rift": {
  //   name: "Paradox Rift",
  //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=YOUR_TAB_GID&single=true&output=csv",
  //   tcgSet: "sv4",
  // },

};
