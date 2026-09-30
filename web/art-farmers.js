/* Cozy Hollow art - farmers
   the farmers (32x48, 4 facings, 8 walk frames, hat option, arms-up pose), held tools, cows, Father TongTong and the wedding arch.
   Draw only with px() (fillRect) and drawImage at integer coordinates; finish sprites with outline(canvas, OUT).
   Most sprites here are drawn from character grids (one character per art pixel, blitted with px runs) so the shapes stay readable.
   Render any sprite to a PNG to check it:  node tools/render.js out.png 5 "expr" ...   (expr evaluated against ART) */
"use strict";
(function () {
const { A, cache, blank, px, hash, rng, hex, rgb, shade, mix, cached, outline, mirrored, OUT, COLORS, ITEM_HEX, SEASON, TREE_PAL, WOOD, text3x5, textWidth } = window.ART;
const ART = window.ART;

// ------------------------------------------------------------ grid blitter
/* rows: strings, one character per art pixel; pal maps a character to a colour. '.' (or any unmapped char) is transparent.
   Runs of the same character become one fillRect, always at integer coordinates. */
function blit(g, x0, y0, rows, pal) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length;) {
      const ch = r[x]; let n = 1;
      while (x + n < r.length && r[x + n] === ch) n++;
      const col = pal[ch];
      if (col) px(g, x0 + x, y0 + y, n, 1, col);
      x += n;
    }
  }
}
function grid(name, rows) {
  const w = rows[0].length;
  for (const r of rows) if (r.length !== w) console.warn("art-farmers: uneven grid " + name + " (" + r + ")");
  return rows;
}
const mirrorRows = (rows) => rows.map((r) => r.split("").reverse().join(""));

// ------------------------------------------------------------ shared palettes
const SKIN = "#f4c9a0", SKIN_S = "#d9a678", SKIN_L = "#fbe0c4", BLUSH = "#f0a0a0", MOUTH = "#c06a5a", EYE = "#2a1f1a", EYE_SOFT = "#4a3a32", EYE_W = "#ffffff";
const HAIR = "#3a2a22", HAIR_L = "#4f3b31", HAIR_X = "#6b5447", HAIR_D = "#251b16";   // black hair: base (a step lighter than OUT so the outline reads), crescent sheen, bright strand, strand breaks
const BOOT = "#4a2e1a", BOOT_L = "#6a4630", BOOT_X = "#2b1a10";
const DENIM = "#3b5786", DENIM_D = "#27395c", DENIM_L = "#5474a6", DENIM_X = "#1c2a44", CLASP = "#e8c060";   // greyed denim, well apart from the blue shirts
const APRON = "#f6e7c8", APRON_D = "#d9c7a6", APRON_L = "#fff6e2", APRON_X = "#c2ab86", APRON_DOT = "#e88a9a";
const WHITE = "#f8f4ea";
const RED = "#e04a5a", RED_D = "#a83a48", RED_P = "#ffb0b8";

// ------------------------------------------------------------ farmer grids (x = 7..24 for heads, rows start at y = 3)
/* hair: H base, h sheen, x bright strand, d dark strand break; the sheen is a crescent on the top-left (the light side)
   and a few dark breaks on the right split the mass into strands.
   eyes: w highlight, e dark, E the softer bottom pixel. Side heads show an ear (kK) where the hair meets the face.
   Every head is 20 rows: 8 rows of hair above the hairline row (HAIRLINE), then the face; blitted at y = 3 the hairline lands on y = 11,
   and the 2px walk bob lifts the top no higher than row 1, leaving row 0 for outline(). */
const HAIRLINE = 8;
const HEAD_FRONT_BOY = grid("headFrontBoy", [
  "...HH...HH..HH....",
  "..HHhhhHHHHHHHHH..",
  ".HHhhxhhHHhhHHHHH.",
  "HHhxxhHHHHhHHHHHHH",
  "HHhxhHHHHHHhHHHHHH",
  "HHhhHHHHHHHHHHdHHH",
  "HHhHHHHHHHHHHHdHHH",
  "HHHHHHHHHdHHHHHHHH",
  "HHHkHHHkkHHHkkHHHH",
  "HhkkkHHkkkkHkkkkHH",
  "HhkkLLkkkkkkkkkkdH",
  "HhkkkkkkkkkkkkkkKH",
  "HkkkweekkkkweekkKH",
  "HkkkeeekkkkeeekkKH",
  "kkkkeEekkkkeEekkKK",
  "kkbbkkkkkkkkkkbbKK",
  "kkkkkkkkkkkkkkkkKK",
  ".kkkkkkkkmmkkkkkK.",
  "..kkkkkkkkkkkkkK..",
  "...KKKKKKKKKKKK...",
]);
const HEAD_FRONT_GIRL = grid("headFrontGirl", [
  "......HHHHHH......",
  "...HHHhhhHHHHHH...",
  "..HHhhxhhHHhHHHH..",
  ".HHhxxhHHHHhHHHHH.",
  "HHhxhHHHHHHHHHHHHH",
  "HHhhHHHHHHHHHHdHHH",
  "HHhHHHHHHHHHHHdHHH",
  "HHHHHHHHdHHHHHHHHH",
  "HHHHkkHHHHHHHkkHHH",
  "HhHkkkkHHHHHkkkkHH",
  "HhkkLLkkkkkHkkkkdH",
  "HhkkkkkkkkkkkkkkdH",
  "HhkkweekkkkweekkdH",
  "HHkkeeekkkkeeekkdH",
  "HHkkeEekkkkeEekKHH",
  "HHbbkkkkkkkkkkbbHH",
  "HHkkkkkkkkkkkkkKHH",
  "HHkkkkkkkmmkkkkKHH",
  "HHkkkkkkkkkkkkkKHH",
  "HHKKKKKKKKKKKKKKHH",
]);
const HEAD_SIDE_BOY = grid("headSideBoy", [
  "....HH..HH...H....",
  "..HHhhhHHHHHHHH...",
  ".HHhhxhhHHHHHHHH..",
  ".HHhxxhHHHHHHHHHH.",
  "HHhxhHHHHhHHHHHHH.",
  "HHhhHHHHHhhHHHHHHH",
  "HHhHHHHHHHhHHHHHHH",
  "HHHHHHHHHHHHHHdHHH",
  "HHHHHHHHHHHHHkHHkH",
  "HhHHHHHHHHHkkkkkkk",
  "HhHHHHHHHHkkLkkkkk",
  "HhhHHHHHkkkkkkkkkk",
  "HHhHHdkKkkkkkweekk",
  "HHhHHdkKkkkkkeeekk",
  "HHHHHdHkkkkkkeEekK",
  "HHHHHdHkkkkkbbkkkK",
  "HHHHHHHkkkkkkkkkkk",
  ".HHHHHHkkkkkkkkkmk",
  ".HHHHHkkkkkkkkkkk.",
  "..HHHKKKKKKKKKKK..",
]);
const HEAD_SIDE_GIRL = grid("headSideGirl", [
  ".....HHHHHHHH.....",
  "...HHHhhhHHHHHH...",
  "..HHhhxhhHHHHHHH..",
  ".HHhxxhHHHHhHHHHH.",
  "HHhxhHHHHHhhHHHHH.",
  "HHhhHHHHHHHhHHHHHH",
  "HHhHHHHHHHHHHHHHHH",
  "HHHHHHHHHHHHHHdHHH",
  "HHHHHHHHHHHHHHHkkH",
  "HhHHHHHHHHHHHkkkkk",
  "HhHHHHHHHHHkkLkkkk",
  "HhhHHHHHHHkkkkkkkk",
  "HHhHHHHdkKkkkweekk",
  "HHhHHHHdkKkkkeeekk",
  "HHHHHHHdHkkkkeEekK",
  "HHHHHHHdkkkkbbkkkK",
  "HHHHHHHHkkkkkkkkkk",
  "HHHHHHHHkkkkkkkkmk",
  "HHHHHHHHkkkkkkkkk.",
  "HHHHHHHHKKKKKKKKK.",
]);
const HEAD_BACK_BOY = grid("headBackBoy", [
  "...HH...HH..HH....",
  "..HHhhhHHHHHHHHH..",
  ".HHhhxhhHHhhHHHHH.",
  "HHhxxhHHHHhHHHHHHH",
  "HHhxhHHHHHHHHHHHHH",
  "HHhhHHHHHHHHHHdHHH",
  "HHhHHHHHHHHHHHdHHH",
  "HHHHHHHHHHHHHHdHHH",
  "HHhHHHHHHHHHHHHHHH",
  "HHhHHHHHHhHHHdHHHH",
  "HhhHHHHHHhHHHdHHHH",
  "HhHHHHHHHHHHHdHHHH",
  "HhHHHHHHHHHHHHHHHH",
  "HHHHHHHHdHHHHHHHHH",
  "HHHHHHHHdHHHHHHHHH",
  "HHHHHHHHHHHHHHHHHH",
  ".HHHHHHHHHHHHHHHH.",
  ".HHHHHHHHHHHHHHHH.",
  "...HHHkkkkkkHHH...",
  "....KKKKKKKKKK....",
]);
const HEAD_BACK_GIRL = grid("headBackGirl", [
  "......HHHHHH......",
  "...HHHhhhHHHHHH...",
  "..HHhhxhhHHhHHHH..",
  ".HHhxxhHHHHhHHHHH.",
  "HHhxhHHHHHHHHHHHHH",
  "HHhhHHHHHHHHHHdHHH",
  "HHhHHHHHHHHHHHdHHH",
  "HHHHHHHHHHHHHHdHHH",
  "HHhHHHHHHHHHHHHHHH",
  "HHhHHHHHHhHHHdHHHH",
  "HhhHHHHHHhHHHdHHHH",
  "HhHHHHHHHHHHHdHHHH",
  "HhHHHHHHHHHHHHHHHH",
  "HHHHHHHHdHHHHHHHHH",
  "HHHHHHHHdHHHHHHHHH",
  "HHHHHHHHHHHHHHHHHH",
  "HHHHHHHHHHHHHHHHHH",
  "HHHHHHHHHHHHHHHHHH",
  "HHHHHHHHHHHHHHHHHH",
  "HHHHHHHHHHHHHHHHHH",
]);
/* the girl's long hair: falls down the back (over the body, back view) or in two strands beside the body (front / side, behind it) */
const HAIR_BACK_LONG = grid("hairBackLong", [
  "HHHHHHHHHHHHHHHHHH",
  "HHhHHHHHHHHHHdHHHH",
  "HHhHHHHHHHHHHdHHHH",
  ".HHHHHHHHHHHHHHHH.",
  ".HHhHHHHHdHHHHHHH.",
  ".HHhHHHHHdHHHHHHH.",
  "..HHHHHHHHHHHHHH..",
  "..HHhHHHHHHHdHHH..",
  "..HHHHHHHHHHdHHH..",
  "...HHHHHHHHHHHH...",
  "...HHhHHHHHHHHH...",
  "....HHHHHHHHHH....",
]);
const HAIR_STRAND = grid("hairStrand", [".HHH", "HHHH", "HHHH", "HhHH", "HhHH", "HhHH", "HHHH", "HHdH", "HHdH", "HHHH", "HHHH", "HHH.", "HhH.", "HhH.", "HHH.", "HHH.", ".HH.", ".dH.", ".HH.", ".HH.", ".HH.", "..H.", "..H."]);
const HAIR_SIDE_LONG = grid("hairSideLong", ["HHHHHHHH", "HHhHHHHH", "HHhHHdHH", "HHhHHdH.", "HHHHHHH.", "HHHHHH..", "HHhHHH..", ".HhHHH..", ".HHHdH..", ".HHHH...", "..HHH...", "..HH...."]);
const BOW_BIG = grid("bowBig", [".RRR.RRR.", "RRRRpRRRR", "RRRDpDRRR", "DRRRRRRRD", ".DD...DD."]);
const BOW_SMALL = grid("bowSmall", [".RR.RR.", "RRRpRRR", "RRRDRRR", "DRR.RRD", ".D...D."]);
const BOW_TINY = grid("bowTiny", [".RR.", "RRpR", "RRRR", ".DD."]);

/* hats: crown 16 wide (x 8..23, y 3..7), brims under it (drawn first); the crown starts two rows below the top so outline() can still
   edge it on the walk frames where the 2px bob lifts it to row 1 */
const CROWN_COWBOY = grid("crownCowboy", [
  "....LLLLXMMMM...",
  "..LLLLLLXMMMMMD.",
  ".LLLLMMMMMMMMMDD",
  ".BBBBBBBBBBBBBB.",
  ".YYYYYYccYYYYYY.",
]);
const BRIM_COWBOY_FRONT = grid("brimCowboyFront", [
  "LL........................LL",
  "LLLLLLLLLLLMMMMMMMMMMMMMMMDD",
  "MMMMMMMMMMMMMMMMMMMMMMDDDDDD",
  "XDDDDDDDDDDDDDDDDDDDDDDDDDDX",
]);
const BRIM_COWBOY_SIDE = grid("brimCowboySide", [
  "LL....................LL",
  "LLLLLLLLLMMMMMMMMMMMMMDD",
  "MMMMMMMMMMMMMMMMMMMDDDDD",
  "XDDDDDDDDDDDDDDDDDDDDDDX",
]);
const CROWN_STRAW = grid("crownStraw", [
  "...LLMLMLMLMLD..",
  "..LLMLMLMLMLMLD.",
  ".LMLMLMLMLMLMLDD",
  ".BBBBBBBBBBBBBB.",
  ".YYYYYYYYYYYYYY.",
]);
const BRIM_STRAW_FRONT = grid("brimStrawFront", [
  "L............................L",
  "LLLMLMLMLMLMLMLMLMLMLMLMLMLMDD",
  "MMLMLMLMLMLMLMLMLMLMLMLMLMLDDD",
  "XDDDDDDDDDDDDDDDDDDDDDDDDDDDDX",
]);
const BRIM_STRAW_SIDE = grid("brimStrawSide", [
  "L........................L",
  "LLLMLMLMLMLMLMLMLMLMLMLMDD",
  "MMLMLMLMLMLMLMLMLMLMLMLDDD",
  "XDDDDDDDDDDDDDDDDDDDDDDDDX",
]);

/* torsos: 14 wide (x 9..22) front/back, 12 wide (x 10..21) side; rows start at y = 22
   the overall bib is edged in dark denim (N) so it separates from any shirt colour */
const BOY_TORSO_FRONT = grid("boyTorsoFront", [
  "tssssssssssssS",
  "tsnNsswwssnNsS",
  "tsnNssssssnNsS",
  "ssNNNNNNNNNNsS",
  "ssNclnnnnncNsS",
  "ssNnlNNNNnnNsS",
  "ssNnnNllNnnNsS",
  "SsNnnNNNNnnNsS",
  "nnnnnnnnnnnnnN",
  "lnnnnnnnnnnnnN",
  "nnnnnnnnnnnnnN",
  "nnnnnnnnnnnnnN",
  "NnnnnnNNnnnnnN",
]);
const BOY_TORSO_SIDE = grid("boyTorsoSide", [
  "tsssssssssss",
  "tssssnNsssss",
  "tssssnNssssS",
  "sssssNNNNNNN",
  "sssssNlnnnnN",
  "sssssNnNNnnN",
  "sssssNnNlnnN",
  "SssssNnnnnnN",
  "nnnnnnnnnnnN",
  "lnnnnnnnnnnN",
  "nnnnnnnnnnnN",
  "nnnnnnnnnnnN",
  "NnnnnnnnnnnN",
]);
const BOY_TORSO_BACK = grid("boyTorsoBack", [
  "tssssssssssssS",
  "tsnNssssssnNsS",
  "tssnNssssnNssS",
  "ssssnNssnNsssS",
  "sssssnNnNssssS",
  "sssssnNnNssssS",
  "ssssnNssnNsssS",
  "SssnNssssnNssS",
  "nnnnnnnnnnnnnN",
  "lnnnnnnnnnnnnN",
  "nnnNNNnnNNNnnN",
  "nnnNlNnnNlNnnN",
  "NnnnnnNNnnnnnN",
]);
const GIRL_TORSO_FRONT = grid("girlTorsoFront", [
  "tssssssssssssS",
  "tsssswwwwssssS",
  "tssssswwsssssS",
  "tsssssssssssSS",
  "ssssaaaaaassSS",
  "ssssaaaaaassSS",
  "ssAAAAAAAAAAsS",
  "ssaaaaaaaaaasS",
  "ssaaPaaaaPaasS",
]);
const GIRL_TORSO_SIDE = grid("girlTorsoSide", [
  "tsssssssssss",
  "tsssssssswwS",
  "tssssssssssS",
  "tssssssssssS",
  "ssssssaaaaaS",
  "ssssssaaaaaS",
  "sssAAAAAAAAS",
  "sssaaaaaaaaS",
  "sssaaPaaaPaS",
]);
const GIRL_TORSO_BACK = grid("girlTorsoBack", [
  "tssssssssssssS",
  "tssssssssssssS",
  "tssssssssssssS",
  "tsssssssssssSS",
  "sssssssssssssS",
  "sssssssssssssS",
  "ssAAAAAAAAAAAS",
  "ssssaaAAaasssS",
  "sssssaaaassssS",
]);
/* legs and boots: the leg grids reach two rows up under the torso, so the body can bob without opening a gap */
const LEG_BOY_L = grid("legBoyL", ["lnnnN", "lnnnN", "lnnnN", "lnnnN", "lnnnN", "lnnnN", "lnnnN", "lnnnN", "lnnnN", "NNNNN"]);
const LEG_BOY_R = grid("legBoyR", ["nnnnN", "nnnnN", "nnnnN", "nnnnN", "nnnnN", "nnnnN", "nnnnN", "nnnnN", "nnnnN", "NNNNN"]);
const LEG_BOY_FAR = grid("legBoyFar", ["NNNNX", "NNNNX", "NNNNX", "NNNNX", "NNNNX", "NNNNX", "NNNNX", "NNNNX", "NNNNX", "XXXXX"]);
const BOOT_FRONT = grid("bootFront", ["OOOOO", "ooooo", "ooooo", "zzzzz"]);
const BOOT_SIDE = grid("bootSide", ["OOOOO.", "ooooo.", "oooooo", "zzzzzz"]);
const BOOT_SIDE_FAR = grid("bootSideFar", ["ooooo.", "ooooo.", "oooooo", "zzzzzz"]);
const LEG_GIRL = grid("legGirl", ["kkkk", "kkkk", "kkkk", "kkkk", "WWWW"]);
const LEG_GIRL_FAR = grid("legGirlFar", ["KKKK", "KKKK", "KKKK", "KKKK", "VVVV"]);
const SHOE_FRONT = grid("shoeFront", ["OOOO", "oWoo", "oooo", "zzzz"]);
const SHOE_SIDE = grid("shoeSide", ["OOOO.", "oooW.", "ooooo", "zzzzz"]);
const SHOE_SIDE_FAR = grid("shoeSideFar", ["oooo.", "oooo.", "ooooo", "zzzzz"]);
/* arms: 3 wide, rows from y = 23; sleeves then hands */
/* the boy's sleeves end in a rolled cuff (t), the girl's puffed sleeves in a white trim (W) */
const ARM_BOY_L = grid("armBoyL", ["tss", "sss", "sss", "sss", "ssS", "ssS", "ttS", "kkk", "kkk", "KKK"]);
const ARM_BOY_R = grid("armBoyR", ["sSS", "sSS", "sSS", "sSS", "sSS", "SSS", "tSS", "kkK", "kkK", "KKK"]);
const ARM_GIRL_L = grid("armGirlL", ["tss", "sss", "sss", "ssS", "WWV", "kkk", "kkk", "kkk", "kkk", "KKK"]);
const ARM_GIRL_R = grid("armGirlR", ["sSS", "sSS", "sSS", "sSS", "WVV", "kkK", "kkK", "kkK", "kkK", "KKK"]);
const ARM_BOY_SIDE = grid("armBoySide", ["tsss", "ssss", "ssss", "ssss", "sssS", "sssS", "tttS", ".kkk", ".kkk", ".KKK"]);
const ARM_GIRL_SIDE = grid("armGirlSide", ["tsss", "ssss", "ssss", "sssS", "WWWV", ".kkk", ".kkk", ".kkk", ".kkk", ".KKK"]);
const ARM_UP_BOY_L = grid("armUpBoyL", ["kkk", "kkk", "KKK", "ttS", "sss", "sss", "sss", "sss", "sss", "sss", "sss", "sss", "ssS", "ssS", "ssS"]);
const ARM_UP_GIRL_L = grid("armUpGirlL", ["kkk", "kkk", "KKK", "kkk", "kkk", "kkk", "kkk", "kkk", "kkK", "WWV", "sss", "sss", "sss", "ssS", "SSS"]);
/* raised arms that reach higher: the hand, a transparent row under it (outline() or the dark rim behind it turns it into a wrist line),
   a bare wrist, then the same cuff and sleeve rows. Under a hat the front/back views blit the 20-row one at y = 4 so the hand shows
   above the brim while the wrist passes behind it; the side view draws the 19-row one at y = 5 over the head and hat. */
const raisedArm = (up, wrist) => up.slice(0, 3).concat(["..."], Array(wrist).fill("kkk"), up.slice(3));
const ARM_UP_BOY_HAT = raisedArm(ARM_UP_BOY_L, 4), ARM_UP_GIRL_HAT = raisedArm(ARM_UP_GIRL_L, 4);
const ARM_UP_BOY_SIDE = raisedArm(ARM_UP_BOY_L, 3), ARM_UP_GIRL_SIDE = raisedArm(ARM_UP_GIRL_L, 3);

// ------------------------------------------------------------ farmers 32x48
/* layout: the figure stands two rows below the top edge (hat crown and hair from y = 3, feet on y = 46) so the 2px walk bob and the
   outline both fit inside the canvas on every frame. Body parts above the legs are drawn in a context translated up by the bob. */
function farmerSprite(kind, facing, frame, shirtHex, hatKind, armsUp) {
  const key = "farmer:" + kind + facing + frame + shirtHex + (hatKind || "cowboy") + (armsUp ? "U" : "");
  const hit = cache.get(key);
  if (hit) return hit;
  const side = facing === "left" || facing === "right", back = facing === "up", front = !side && !back;
  const boy = kind !== "girl", hat = hatKind !== "none";
  const c = blank(32, 48), g = c.getContext("2d");
  const shirt = shirtHex, shirtD = shade(shirtHex, 0.72), shirtL = shade(shirtHex, 1.18);
  const P = {
    H: HAIR, h: HAIR_L, x: HAIR_X, d: HAIR_D, k: SKIN, K: SKIN_S, L: SKIN_L, e: EYE, E: EYE_SOFT, w: EYE_W, b: BLUSH, m: MOUTH,
    s: shirt, S: shirtD, t: shirtL, n: DENIM, N: DENIM_D, l: DENIM_L, X: DENIM_X, c: CLASP,
    a: APRON, A: APRON_D, P: APRON_DOT, W: WHITE, V: "#d8d2c4", o: BOOT, O: BOOT_L, z: BOOT_X,
    R: RED, D: RED_D, p: RED_P,
  };
  const PSHADOW = Object.assign({}, P, { k: SKIN_S, L: SKIN, H: HAIR, h: HAIR, x: HAIR, d: HAIR });     // the row right under a hat brim
  const HAT = boy
    ? { L: "#a67248", M: "#8a5a3a", D: "#6a4228", X: "#4a2e1c", B: "#4a2e1c", Y: "#3a2314", c: CLASP }
    : { L: "#eacf88", M: "#d9b86a", D: "#b3934c", X: "#8f7438", B: "#c94a5a", Y: "#a83a48" };
  // smooth 8-frame cycle: legs and arms swing on a sine; the body rises on the passing frames (2 and 6) and sits lowest
  // on the contact frames (0 and 4), so the bob runs 0,1,2,1,0,1,2,1 (the same rhythm the game uses for the held tool)
  const t = (frame % 8) / 8, sn = Math.sin(t * Math.PI * 2), cs = Math.cos(t * Math.PI * 2);
  const liftL = Math.round(Math.max(0, sn) * 3), liftR = Math.round(Math.max(0, -sn) * 3);
  const swing = Math.round(sn * 2), bob = Math.round(Math.abs(sn) * 2);
  const f = Math.round(sn * 4);                                             // side-view stride
  const liftNear = Math.round(Math.max(0, cs) * Math.abs(sn) * 3), liftFar = Math.round(Math.max(0, -cs) * Math.abs(sn) * 3);

  // --- legs and feet (drawn first; the leg grids start under the torso)
  if (!side) {
    if (boy) {
      blit(g, 10, 33 - liftL, LEG_BOY_L, P); blit(g, 10, 43 - liftL, BOOT_FRONT, P);
      blit(g, 17, 33 - liftR, LEG_BOY_R, P); blit(g, 17, 43 - liftR, BOOT_FRONT, P);
    } else {
      blit(g, 11, 38 - liftL, LEG_GIRL, P); blit(g, 11, 43 - liftL, SHOE_FRONT, P);
      blit(g, 17, 38 - liftR, LEG_GIRL, P); blit(g, 17, 43 - liftR, SHOE_FRONT, P);
    }
  } else if (boy) {
    blit(g, 12 - f, 33 - liftFar, LEG_BOY_FAR, P); blit(g, 12 - f, 43 - liftFar, BOOT_SIDE_FAR, P);
    blit(g, 15 + f, 33 - liftNear, LEG_BOY_L, P); blit(g, 15 + f, 43 - liftNear, BOOT_SIDE, P);
  } else {
    blit(g, 13 - f, 38 - liftFar, LEG_GIRL_FAR, P); blit(g, 13 - f, 43 - liftFar, SHOE_SIDE_FAR, P);
    blit(g, 15 + f, 38 - liftNear, LEG_GIRL, P); blit(g, 15 + f, 43 - liftNear, SHOE_SIDE, P);
  }
  g.translate(0, -bob);                                                     // everything above the legs bounces
  // --- long hair behind the body (girl, front and side); it hangs from the head, so it bobs with it
  if (!boy && front) { blit(g, 4, 11, HAIR_STRAND, P); blit(g, 24, 11, mirrorRows(HAIR_STRAND), P); }
  if (!boy && side) blit(g, 6, 21, HAIR_SIDE_LONG, P);
  // --- far arm peeks out behind the body in the side view
  if (side && !armsUp) blit(g, 9 - swing, 24, boy ? ARM_BOY_R : ARM_GIRL_R, P);
  // --- torso
  if (boy) blit(g, side ? 10 : 9, 22, side ? BOY_TORSO_SIDE : back ? BOY_TORSO_BACK : BOY_TORSO_FRONT, P);
  else {
    blit(g, side ? 10 : 9, 22, side ? GIRL_TORSO_SIDE : back ? GIRL_TORSO_BACK : GIRL_TORSO_FRONT, P);
    // the skirt flares out toward the hem; the apron hangs over it in front
    for (let y = 31; y < 41; y++) {
      const hem = y === 40;
      if (!side) {
        const w = 14 + Math.floor((y - 31) * 0.5), x = 16 - Math.floor(w / 2);
        px(g, x, y, w, 1, hem ? shirtD : shirt); px(g, x + w - 2, y, 2, 1, shirtD); if (!hem) px(g, x, y, 1, 1, shirtL);
        if (y >= 33 && y < 39 && !(y & 1)) { px(g, x + 1, y, 1, 1, shirtD); px(g, x + w - 3, y, 1, 1, shirtD); }
        if (y === 39) for (let k = x + 1; k < x + w - 2; k += 2) px(g, k, y, 1, 1, shirtL);      // ruffle above the hem
      } else {
        const w = 12 + Math.floor((y - 31) * 0.5), x = 22 - w;
        px(g, x, y, w, 1, hem ? shirtD : shirt); px(g, x + w - 1, y, 1, 1, shirtD); if (!hem) px(g, x, y, 1, 1, shirtL);
        if (y >= 33 && y < 39 && !(y & 1)) px(g, x + 2, y, 1, 1, shirtD);
        if (y === 39) for (let k = x + 1; k < x + w - 1; k += 2) px(g, k, y, 1, 1, shirtL);
      }
    }
    if (!back) {
      // apron: red ribbon waistband, lit left edge, shaded right edge, a two-tone hem shadow and a sprinkle of dots
      const ax = side ? 14 : 11, aw = side ? 8 : 10;
      px(g, ax, 31, aw, 8, APRON);
      px(g, ax, 32, 1, 5, APRON_L); px(g, ax + aw - 1, 32, 1, 5, APRON_D);
      px(g, ax, 37, aw, 1, APRON_D); px(g, ax, 38, aw, 1, APRON_X);
      px(g, ax, 31, aw, 1, RED); px(g, ax, 31, 1, 1, RED_D); px(g, ax + aw - 1, 31, 1, 1, RED_D);
      for (let y = 33; y < 37; y += 3) for (let x = ax + 2; x < ax + aw - 1; x += 3) px(g, x, y, 1, 1, APRON_DOT);
    } else {
      // the ribbon's tails hang down the back, showing under the hair
      px(g, 14, 32, 2, 6, RED); px(g, 14, 37, 2, 1, RED_D); px(g, 17, 32, 2, 5, RED); px(g, 17, 36, 2, 1, RED_D);
    }
  }
  // --- arms (raised overhead when carrying something to plant)
  const armL = boy ? ARM_BOY_L : ARM_GIRL_L, armR = boy ? ARM_BOY_R : ARM_GIRL_R;
  if (armsUp) {
    // front and back: the arms rise beside the head. Bare-headed the hands end level with the brow; under a hat the taller arm
    // starts higher so the hands show above the brim beside the crown (the side view's raised arm is drawn after the head, below)
    if (!side) {
      const up = hat ? (boy ? ARM_UP_BOY_HAT : ARM_UP_GIRL_HAT) : boy ? ARM_UP_BOY_L : ARM_UP_GIRL_L, uy = hat ? 4 : 9;
      blit(g, 5, uy, up, P); blit(g, 24, uy, mirrorRows(up), P); px(g, 8, 22, 1, 2, shirt); px(g, 23, 22, 1, 2, shirtD);
    }
  } else if (!side) {
    blit(g, 6, 23 + swing, back ? mirrorRows(armR) : armL, P);
    blit(g, 23, 23 - swing, back ? mirrorRows(armL) : armR, P);
  } else blit(g, 17 + swing, 23, boy ? ARM_BOY_SIDE : ARM_GIRL_SIDE, P);
  // --- the girl's hair falls down her back
  if (!boy && back) blit(g, 7, 23, HAIR_BACK_LONG, P);
  // --- head (hair rows above the brim are skipped when a hat is worn; the row under the brim sits in its shadow)
  const head = side ? (boy ? HEAD_SIDE_BOY : HEAD_SIDE_GIRL) : back ? (boy ? HEAD_BACK_BOY : HEAD_BACK_GIRL) : boy ? HEAD_FRONT_BOY : HEAD_FRONT_GIRL;
  if (!hat) blit(g, 7, 3, head, P);
  else { blit(g, 7, 11, head.slice(HAIRLINE, HAIRLINE + 1), PSHADOW); blit(g, 7, 12, head.slice(HAIRLINE + 1), P); }
  if (!hat) {
    if (!boy) {
      if (front) blit(g, 17, 3, BOW_BIG, P);
      else if (back) blit(g, 6, 3, BOW_BIG, P);
      else blit(g, 6, 4, BOW_SMALL, P);
    }
  } else if (boy) {
    if (side) blit(g, 5, 7, BRIM_COWBOY_SIDE, HAT); else blit(g, 2, 7, BRIM_COWBOY_FRONT, HAT);
    blit(g, 8, 3, CROWN_COWBOY, HAT);
  } else {
    if (side) blit(g, 4, 7, BRIM_STRAW_SIDE, HAT); else blit(g, 1, 7, BRIM_STRAW_FRONT, HAT);
    blit(g, 8, 3, CROWN_STRAW, HAT);
    if (!back) blit(g, 22, 4, BOW_TINY, P);
  }
  // --- side view, arms up: the near arm rises in front of the ear and the hat with the hand near the top of the head. It sits inside
  //     the head's silhouette, so a dark rim is drawn under it by hand to keep it apart from the face and the straw hat
  if (armsUp && side) { px(g, 15, 4, 5, 19, OUT); blit(g, 16, 5, boy ? ARM_UP_BOY_SIDE : ARM_UP_GIRL_SIDE, P); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  outline(c, OUT);
  const done = facing === "left" ? mirrored(key, c) : c;
  cache.set(key, done);
  return done;
}

// ------------------------------------------------------------ held tools
function heldTool(tool, flip) {
  /* a tool as carried: rotated a quarter turn so the grip sits at the hand and the head points outward and down */
  return cached("held:" + tool + flip, A, A, (g, c) => {
    const icon = ART.iconCanvas(tool, null);
    g.translate(A / 2, A / 2); g.rotate(Math.PI / 2); if (flip) g.scale(1, -1); g.drawImage(icon, -A / 2, -A / 2);
  });
}

// ------------------------------------------------------------ cow 32x32 (faces right; the game mirrors it)
const COW_BODY = grid("cowBody", [
  "....WWWWWWWWWWWWWW.....",
  "..WWWWWWKKKWWWWWWWWWW..",
  ".WWWWWWKKkkKWWWWWWWWWWW",
  ".WWWWWKKKKKKWWWWWKKWWWW",
  ".WWWWWKKKKKWWWWWKkKKWWW",
  ".WWWWWWKKKWWWWWWKKKKWWW",
  ".WWWWWWWWWWWWWWWWKKKWWW",
  ".WWWWWWWWWWWWWWWWWWWWWW",
  ".WWKKWWWWWWWWWWWWWWWWWW",
  ".WKKKKWWWWWWWWWWWWWWWWS",
  ".WKKKWWWWWWWWWWWWWWWWSS",
  ".SWWWWWWWWWWWWWWWWWWSSS",
  "..SSSSSSSSSuuuuSSSSSSS.",
  "...WWW.SSS.uuuu.WWW.SSS",
  "...WWW.SSS.upup.WWW.SSS",
  "...WWS.SSs......WWS.SSs",
  "...WWS.SSs......WWS.SSs",
  "...SSS.sss......SSS.sss",
  "...KKK.KKK......KKK.KKK",
  "...KKK.KKK......KKK.KKK",
]);
const COW_HEAD = grid("cowHead", [
  "...H....H...",
  "..hH....Hh..",
  "..WWWWWWWW..",
  ".WWWWKKWWWW.",
  "PPWWKKKWWWWW",
  "pPWWKKKWWEeW",
  ".WWWWKKWWEEW",
  ".WWWWWWWWWWW",
  "..WWWWWPPPPP",
  "..WWWWPPpPpP",
  "..SWWWPPPPPP",
  "...SSWpppppp",
  "....SSSS....",
]);
const MILK_BOTTLE = grid("milkBottle", [".cccc.", ".cccc.", "WWWWWW", "WeeWWS", "WeWWWS", "SWWWWS", ".SSSS."]);   // 7 rows, blitted at y = 1 so outline() can edge the cap
/* walking legs, redrawn over the standing ones: near legs in white, far legs in shadow */
const COW_LEG_NEAR = grid("cowLegNear", ["WWW", "WWW", "WWS", "WWS", "SSS", "KKK", "KKK"]);
const COW_LEG_FAR = grid("cowLegFar", ["SSS", "SSS", "SSs", "SSs", "sss", "KKK", "KKK"]);
function cowSprite(frame, milk, walk) {
  /* frame 0/1: idle head bob and tail flick; walk 1..4: a slow trot (diagonal leg pairs swing together) */
  walk = walk | 0;
  return cached("cow:" + frame + milk + ":" + walk, A, A, (g, c) => {
    const P = { W: "#f7f2ea", S: "#e6ddd0", s: "#d5cbbc", K: "#2b2118", k: "#3d3128", P: "#f2a6b8", p: "#d98aa0", u: "#f4b8c8",
      H: "#e8d9b8", h: "#c2ae86", E: "#2b2118", e: "#ffffff", c: "#8fb0d8" };
    const bob = walk ? walk % 2 : frame ? 1 : 0;
    blit(g, 2, 9, COW_BODY, P);
    if (walk) {
      const sh = walk === 1 ? 1 : walk === 3 ? -1 : 0, lift = walk % 2;   // legs swing forward/back, hooves lift on the passing frames
      g.clearRect(5, 22, 7, 7); g.clearRect(18, 22, 7, 7);                  // the standing legs
      blit(g, 9 - sh, 22 - (sh < 0 ? lift : 0), COW_LEG_FAR, P); blit(g, 22 + sh, 22 - (sh > 0 ? lift : 0), COW_LEG_FAR, P);
      px(g, 5, 22, 7, 1, P.S); px(g, 18, 22, 7, 1, P.S);                    // belly line behind the legs
      blit(g, 5 + sh, 22 - (sh > 0 ? lift : 0), COW_LEG_NEAR, P); blit(g, 18 - sh, 22 - (sh < 0 ? lift : 0), COW_LEG_NEAR, P);
    }
    // tail: hangs at rest, flicks out on the second frame (kept off column 0 so outline() can edge its left side)
    if (!frame) { px(g, 2, 10, 2, 8, P.W); px(g, 1, 17, 3, 3, P.K); px(g, 2, 17, 1, 1, P.k); }
    else { px(g, 2, 10, 2, 3, P.W); px(g, 1, 12, 2, 3, P.W); px(g, 1, 14, 3, 3, P.K); px(g, 2, 14, 1, 1, P.k); }
    blit(g, 19, 4 + bob, COW_HEAD, P);
    // red collar with a brass bell under the chin
    px(g, 20, 16 + bob, 6, 1, "#c94a5a"); px(g, 21, 17 + bob, 3, 2, "#f2c744"); px(g, 21, 17 + bob, 1, 1, "#fff0a0"); px(g, 22, 19 + bob, 1, 1, "#8a6a1a");
    if (milk) blit(g, 13, 1, MILK_BOTTLE, P);
    outline(c, OUT);
  });
}

// ------------------------------------------------------------ Father TongTong 32x48
/* Father TongTong: grey hair combed back from a high forehead (a darker hairline where it meets the skin, a sheen at the
   top-left, shadow on the right), bushy brows, laugh lines, ears peeking out */
const PRIEST_HEAD = grid("priestHead", [
  ".....GGGGGGGG.....",
  "...GGGgggGGGGGG...",
  "..GGgggGGGGGGGGG..",
  ".GGGjjjjjjjjjjGGj.",
  ".GGGkkkkkkkkkkGGj.",
  "GGkkkkkkkkkkkkkkGj",
  "GGkkkkkkkkkkkkkkGj",
  "GGkkkkkkkkkkkkkkGj",
  "GGkdddkkkkkkdddkGj",
  "GGkkkkkkkkkkkkkkGj",
  "GkkkweekkkkweekkkG",
  "GkkkeeekkkkeeekkkG",
  "GGkKKkkkkkkkkKKkGj",
  "GGkbbkkkkkkkkbbkGj",
  ".GGkkkkkkkkkkkkGG.",
  "..kkkkkkKmmKkkkk..",
  "...kkkkkkkkkkkk...",
  "....kkkkkkkkkk....",
  ".....KKKKKKKK.....",
]);
/* black cassock with a button placket, a lit top edge across the shoulders, lit left edge and shadowed right, folds at the hem
   (dark creases with a lit ridge beside each); a purple stole with gold crosses
   and a gold fringe hangs over it; the red prayer book shows its cream page edges */
const PRIEST_BODY = grid("priestBody", [
  "...TTTTTrrrrrrrrr...",
  "..rRRRWWWWWWWWRRRQ..",
  "..rVVVRRWWWWRRVVVQ..",
  ".rRVVVRRRWWRRRVVVRQ.",
  ".rRVVVRRRuRRRRVVVRQ.",
  ".rRVYVRRRuRRRRVYVRQ.",
  ".rRYYYRRRuRRRRYYYRQ.",
  ".rRVYVRRRuRRRRVYVRQ.",
  ".rRVVVRRRuRRRRVVVRQ.",
  ".rRVVVRRRuRRRRVVVRQ.",
  ".rRVkkBBBBBBBBkkVRQ.",
  ".rRVkkBBBYBBBBkkVRQ.",
  ".rRVkkBBYYYBBBkkVRQ.",
  ".rRVKKBBBYBBBBKKVRQ.",
  ".rRVVVPPPPPPPPVVVRQ.",
  ".rRVVVQQQQQQQQVVVRQ.",
  ".rRVVVRRRuRRRRVVVRQ.",
  "rrRVVVRRRuRRRRVVVRQQ",
  "rrRVYVRRRuRRRRVYVRQQ",
  "rrRYYYRRRuRRRRYYYRQQ",
  "rrRVYVQrRuRrQRVYVRQQ",
  "rrRVVVQrRRRrQRVVVRQQ",
  "rrRVVVQrRRRrQRVVVRQQ",
  "rrRYYYQrRRRrQRYYYRQQ",
  "QQQQQQQQQQQQQQQQQQQQ",
]);
function priestSprite(frame) {
  return cached("priest:" + frame, 32, 48, (g, c) => {
    const P = { R: "#2f2a3a", r: "#443c52", T: "#5a516c", Q: "#221e2b", W: "#f8f4ea", V: "#6a3f8f", Y: "#f2c744", k: SKIN, K: SKIN_S, u: "#8a8494",
      G: "#cfcac0", g: "#e6e1d8", j: "#a8a094", d: "#8a8078", e: EYE, w: EYE_W, b: "#e8b0a0", m: MOUTH, B: "#8a2e2e", P: "#f4e6c4", o: "#2b2118", z: "#1a120c" };
    const bob = frame ? 1 : 0;
    blit(g, 8, 45, ["ooooo", "zzzzz"], P); blit(g, 19, 45, ["ooooo", "zzzzz"], P);
    blit(g, 6, 20 - bob, PRIEST_BODY, P);
    if (bob) px(g, 6, 44, 20, 1, P.Q);
    blit(g, 7, 2 - bob, PRIEST_HEAD, P);
    outline(c, OUT);
  });
}

// ------------------------------------------------------------ wedding arch 96x80
function archSprite() {
  return cached("arch", 96, 80, (g, c) => {
    const W = "#fbf7f0", L = "#e8e0d2", D = "#cfc5b4", X = "#b3a78f", G = "#5fb04a", GD = "#3f8a30", GL = "#8ad46a";   // painted wood: light, mid, lattice, shadow
    const ROSE = [["#ff9ccf", "#ffd0e8", "#d86aa0"], ["#ffffff", "#ffffff", "#d9d0c0"], ["#ffe066", "#fff4b0", "#d4b23a"], ["#ff7eb6", "#ffb8d8", "#c9508a"]];
    const arcTop = (x) => { const t = (x - 48) / 42; return Math.round(20 - 16 * (1 - t * t)); };
    // pillars with plinths and a trellis lattice (the plinth stops on row 78 so outline() can edge its base)
    for (const x0 of [6, 82]) {
      px(g, x0 - 2, 74, 12, 5, L); px(g, x0 - 2, 74, 12, 1, W); px(g, x0 - 2, 77, 12, 2, D); px(g, x0 - 2, 78, 12, 1, X);
      px(g, x0, 20, 8, 54, W); px(g, x0 + 6, 20, 2, 54, L); px(g, x0 + 7, 20, 1, 54, X);
      for (let y = 22; y < 72; y++) { const k = (y - 22) % 6; px(g, x0 + 1 + k, y, 1, 1, D); px(g, x0 + 6 - k, y, 1, 1, D); }
      px(g, x0 - 1, 19, 10, 2, W); px(g, x0 - 1, 21, 10, 1, D);                         // capital
    }
    // the arch band with a lattice of diamonds inside it; the underside carries a shadow row, deeper on the right
    for (let x = 6; x < 90; x++) {
      const y = arcTop(x);
      px(g, x, y, 1, 8, W); px(g, x, y + 6, 1, 1, x > 48 ? D : L); px(g, x, y + 7, 1, 1, X);
      const k = (x - 6) % 8, d1 = k < 4 ? k : 7 - k;
      px(g, x, y + 2 + d1, 1, 1, D); px(g, x, y + 5 - d1, 1, 1, D);
    }
    // vines climbing the pillars
    for (const x0 of [6, 82]) for (let y = 24; y < 72; y++) {
      const vx = x0 + 3 + Math.round(2 * Math.sin(y / 4));
      px(g, vx, y, 1, 1, y % 3 ? G : GD);
      if (y % 7 === 0) { px(g, vx - 2, y, 2, 1, G); px(g, vx - 2, y - 1, 1, 1, GL); }
      if (y % 7 === 4) { px(g, vx + 1, y, 2, 1, G); px(g, vx + 2, y + 1, 1, 1, GD); }
    }
    // flower clusters along the arch and down the pillars; a cluster spans x - 7 .. x + 6 and y - 2 .. y + 5 around its spot, and every
    // spot keeps that inside x 1..94, y 1..78 (the helpers clamp to the same box) so outline() can close the dark edge all round
    const spots = [[10, 18], [19, 10], [30, 5], [48, 3], [66, 5], [77, 10], [86, 18], [8, 36], [88, 36], [8, 56], [88, 56], [8, 46], [88, 46]];
    const pc = (x, y, w, h, col) => { const x0 = Math.max(1, x), y0 = Math.max(1, y), x1 = Math.min(95, x + w), y1 = Math.min(79, y + h); if (x1 > x0 && y1 > y0) px(g, x0, y0, x1 - x0, y1 - y0, col); };
    const leaf = (lx, ly, flip) => { pc(lx, ly, 3, 1, G); pc(lx + (flip ? -1 : 1), ly + 1, 3, 1, GD); pc(lx + (flip ? 2 : 0), ly, 1, 1, GL); };
    const rose = (rx, ry, [base, hi, lo]) => { pc(rx + 1, ry, 2, 1, base); pc(rx, ry + 1, 4, 2, base); pc(rx + 1, ry + 3, 2, 1, lo); pc(rx + 1, ry + 1, 1, 1, hi); pc(rx + 3, ry + 2, 1, 1, lo); pc(rx + 2, ry + 2, 1, 1, lo); };
    spots.forEach(([x, y], i) => {
      const r = rng(hash(x, y) + 7);
      leaf(x - 6, y + 2, true); leaf(x + 3, y + 2, false); leaf(x - 2, y + 4, false); leaf(x + 1, y - 2, true); leaf(x - 4, y - 1, false);
      for (let k = 0; k < 3; k++) {
        const fx = x - 5 + k * 3 + Math.floor(r() * 2), fy = y - 1 + Math.floor(r() * 3);
        rose(fx, fy, ROSE[(i + k) % 4]);
      }
    });
    // ribbon bows on the capitals
    for (const x0 of [6, 82]) {
      blit(g, x0, 15, [".RR.RR.", "RRRpRRR", "RRRDRRR", ".D...D."], { R: "#ffa8c8", p: "#ffe0ee", D: "#d86aa0" });
      px(g, x0 + 1, 19, 1, 5, "#ffa8c8"); px(g, x0 + 5, 19, 1, 6, "#ffa8c8");
    }
    outline(c, OUT);
  });
}

Object.assign(window.ART, { cowSprite, priestSprite, archSprite, heldTool, farmerSprite, blitGrid: blit });
})();
