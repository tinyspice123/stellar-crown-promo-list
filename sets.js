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
//   tcgdexSet (optional) TCGdex set id (e.g. "me03") — a second image API
//            that covers newer sets pokemontcg.io lacks (it stopped updating
//            before the Mega era). Used automatically as a fallback; for a
//            Mega-era set just set tcgdexSet and skip tcgSet entirely.
//   imgTemplate (optional) fully custom card image URL template for any
//            other source. {num} = unpadded number, {num3} = zero-padded.
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
    tab: "stellar_crown",
  },

  // ---- Mega-era example (pokemontcg.io lacks these sets) --------------
  "perfect-order": {
    name: "Perfect Order",
    code: "ME03",
    sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPhhxFigR_Cyyp3Vi-Ne6yUBj2OrgG6VjbMNrBEzCm7dppuZkRgNj-9aeF7LbHYK3F3C4cIDm35GpE/pub?gid=1756238588&single=true&output=csv",
    tcgdexSet: "me03",   // images + logo come from TCGdex automatically
  },

  // ---- template: copy, un-comment, fill in ----------------------------
  // "paradox-rift": {
  //   name: "Paradox Rift",
  //   sheet: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=YOUR_TAB_GID&single=true&output=csv",
  //   tcgSet: "sv4",
  // },

};
