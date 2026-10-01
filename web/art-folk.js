/* Cozy Hollow art - who's who
   Every villager's own look (drawn by ART.personSprite on the farmers' grids), and Claude's.
   A look: body "boy" (shirt and trousers, overalls bib unless bib:false) or "girl" (a dress, apron unless apron:false), head "boy" | "girl",
   style short | long | bob | bun | ponytail | bald | quiff | curly, skin light | fair | tan | brown | deep, hair (see HAIRS in art-farmers.js),
   shirt / skirt / coat / vest / jacket / apron / boots as #hex, pants (TROUSERS), hat cowboy | ranger | straw | cap | beanie | chef | tophat |
   bandana | flower with hatColor / hatBand, beard full | mustache | goatee, glasses round | shades, eyepatch, bow, and extras:
   badge, bowtie, tie, scarf, necklace, lei, chain, stethoscope, belt, satchel, toolbelt. */
"use strict";
(function () {
const LOOKS = window.ART.LOOKS;
Object.assign(LOOKS, {
  // ---- Hollow Town
  "Bram": { body: "boy", skin: "fair", hair: "chestnut", shirt: "#e8d9b0", bib: false, pants: "brown", apron: "#4f8f4a", beard: "mustache", extras: ["belt"] },
  "Rusty": { body: "boy", skin: "light", hair: "ginger", shirt: "#f4efe4", bib: false, pants: "black", vest: "#3a2a2a", beard: "mustache", hat: "cowboy", hatColor: "#6a4228", extras: ["bowtie"], tieColor: "#c94a5a" },
  "Mayor Hazel": { body: "girl", skin: "fair", hair: "gray", style: "bun", shirt: "#8a3f86", skirt: "#6a2c68", apron: false, glasses: "round", extras: ["necklace"] },
  "Professor Fern": { body: "boy", head: "girl", skin: "tan", hair: "chestnut", style: "ponytail", shirt: "#5a9a5a", bib: false, pants: "khaki", coat: "#f2f0ea", glasses: "round", bow: "#3f8a3f" },
  "Doc Alder": { body: "boy", skin: "brown", hair: "silver", shirt: "#7cc4bc", bib: false, pants: "gray", coat: "#f6f6f2", beard: "goatee", beardColor: "silver", extras: ["stethoscope"] },
  "Ingrid": { body: "boy", head: "girl", skin: "fair", hair: "blonde", style: "ponytail", shirt: "#c8483c", bib: false, pants: "brown", apron: "#7a4a2a", boots: "#3a2a20", bow: "#7a4a2a" },
  "Juniper": { body: "girl", skin: "tan", hair: "brown", style: "bob", shirt: "#f2c744", skirt: "#e0a830", hat: "chef" },
  "Pip": { body: "boy", skin: "light", hair: "blonde", shirt: "#4a86d8", bib: false, pants: "navy", hat: "cap", hatColor: "#2e4a8e", hatBand: "#f2c744", extras: ["satchel"] },
  "Oakley": { body: "boy", skin: "tan", hair: "brown", shirt: "#4f8f4a", pants: "denim", beard: "full", hat: "beanie", hatColor: "#e07a30", hatBand: "#f4efe4", extras: ["toolbelt"] },
  "Nell": { body: "girl", skin: "deep", hair: "black", style: "bun", shirt: "#f08a3a", skirt: "#3a4a7a", apron: false, hat: "cap", hatColor: "#3a4a7a", hatBand: "#2a3458", badge: "#f2c744" },
  "Barnaby": { body: "boy", skin: "fair", hair: "blonde", shirt: "#5a8ad0", bib: false, pants: "khaki", glasses: "round", beard: "goatee", extras: ["satchel"] },
  "Mabel": { body: "girl", skin: "light", hair: "ginger", style: "bun", shirt: "#6aa84f", skirt: "#4a8a3a", apron: "#f6e7c8", hat: "flower" },
  "Granny Rose": { body: "girl", skin: "fair", hair: "white", style: "bun", shirt: "#b48ad0", skirt: "#8a64aa", apron: false, glasses: "round", extras: ["scarf"], scarf: "#f0a0b8" },
  "Theo": { body: "boy", skin: "brown", hair: "black", style: "curly", shirt: "#3ab8c8", pants: "denim", hat: "bandana", hatColor: "#d9463c" },
  "Ivy": { body: "girl", skin: "brown", hair: "teal", style: "long", shirt: "#3ab8a8", skirt: "#2a8a80", apron: false, bow: "#f2c744" },
  "Rowan": { body: "boy", head: "girl", skin: "light", hair: "chestnut", style: "long", shirt: "#c84ab0", bib: false, pants: "brown", vest: "#4a7a3a", beard: "goatee", extras: ["belt"] },
  "Velvet": { body: "girl", skin: "fair", hair: "platinum", style: "bob", shirt: "#6a2a6a", skirt: "#4a1a4a", apron: false, extras: ["necklace"], hat: "tophat", hatColor: "#2b2a33", hatBand: "#c94a8a" },
  // ---- the beach, the woods, the ridge
  "Old Tomas": { body: "boy", skin: "tan", hair: "white", style: "bald", shirt: "#2e4a7a", bib: false, pants: "navy", beard: "full", beardColor: "white", hat: "beanie", hatColor: "#2a3a5a", hatBand: "#c94a4a" },
  "Wren": { body: "girl", skin: "light", hair: "ginger", style: "bob", shirt: "#f4f1ea", skirt: "#2e4a7a", apron: false, extras: ["scarf"], scarf: "#d9463c" },
  "Ranger Moss": { body: "boy", skin: "tan", hair: "brown", shirt: "#7a8a4a", bib: false, pants: "olive", beard: "mustache", hat: "ranger", hatColor: "#8a7a4a", hatBand: "#4a5a2a", extras: ["badge", "belt"] },
  "Captain Ash": { body: "boy", head: "girl", skin: "light", hair: "silver", style: "ponytail", shirt: "#d0c8b8", bib: false, pants: "black", coat: "#2e3a5e", eyepatch: true, boots: "#2a2228", bow: "#c94a4a" },
  "Coco": { body: "girl", skin: "deep", hair: "black", style: "curly", shirt: "#ff7eb6", skirt: "#f2c744", apron: false, hat: "flower", extras: ["lei"] },
  // ---- Dusty Gulch
  "Dolly": { body: "girl", skin: "fair", hair: "blonde", style: "long", shirt: "#d64fbf", skirt: "#a8329a", apron: false, hat: "cowboy", hatColor: "#f4efe4", hatBand: "#d64fbf" },
  "Mr. Penny": { body: "boy", skin: "fair", hair: "gray", style: "bald", shirt: "#f4f1ea", bib: false, pants: "black", coat: "#2b2a33", beard: "mustache", beardColor: "gray", glasses: "round", glassColor: "#c9a640", extras: ["bowtie"], tieColor: "#2e7a4a", hat: "tophat", hatColor: "#2b2a33", hatBand: "#2e7a4a" },
  "Sheriff Boone": { body: "boy", skin: "brown", hair: "black", shirt: "#c8a46a", bib: false, pants: "brown", vest: "#5a3a24", beard: "mustache", hat: "cowboy", hatColor: "#2b2620", hatBand: "#8a6a3a", extras: ["badge", "belt"] },
  "Prospector Gus": { body: "boy", skin: "tan", hair: "white", shirt: "#c84a3a", pants: "brown", beard: "full", beardColor: "white", hat: "cowboy", hatColor: "#9a7a52", hatBand: "#5a3a24" },
  "Hank": { body: "boy", skin: "deep", hair: "black", style: "bald", shirt: "#f4f1ea", bib: false, pants: "gray", apron: "#e8e2d6", beard: "full", extras: ["belt"] },
  // ---- Claude, the AI farmer: a cool guy in shades, a quiff, a coral bomber over a white tee, black jeans and clean white kicks
  "claude": { body: "boy", skin: "fair", hair: "black", style: "quiff", shirt: "#f8f4ec", bib: false, pants: "jeans", jacket: "#d97757", boots: "#f2efe8", glasses: "shades", extras: ["chain"] },
});
})();
