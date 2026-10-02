# Cozy Hollow roadmap

Where the game is headed, in the order it will be built. Each milestone ships on its own: server tests, a check in the
browser and the terminal, a deploy with a save backup, then a commit and push. Nothing that players already have is ever
taken away; existing farms carry their progress into every new system.

**The end goal:** together, bring Cozy Hollow back to life. Every system feeds that shared goal; your own level, your
friendships and your story with each villager are the personal threads running through it.

---

## Milestone 1 - Progress you can feel (done)

**Levels unlock things.** A single unlock table drives everything, and leveling up announces what just opened.
- Seeds by level: turnip and potato from the start; radish, sunflower and snowdrop at 1; strawberry 2; tomato and winter
  root 3; corn 4; cauliflower 5; blueberry 6; cranberry 7; melon 8; pumpkin 9; starfruit 14.
- Saplings: apple 2, cherry 4, peach 7, plum 11; the legendary trees need 18.
- Crafting recipes and cooking recipes unlock across levels 0-16 (simple tools first, the rock tumbler and gold sword late).
- The mine: level 2 of the mine at Lv4, level 3 at Lv8, the Depths at Lv12.
- The shop, crafting and cooking menus show locked things greyed with "Lv N"; the XP bar and the quest log show what's next.

**Tree spots.** Fruit trees grow only in marked tree spots in the orchard meadow south of the fields: 15 spots in tiers
that open at levels 1, 3, 6, 10, 15 and 25 (the last two are grand spots). Locked spots show a little sign with their level.
Trees already planted elsewhere stay where they are.

**Villager quests.**
- *Favors* (borrowed from Stardew's help-wanted board and Animal Crossing's requests): each in-game morning a few
  villagers have a "!" over their heads. Talk to them for a small job sized to your level: fetch something, deliver a
  parcel to another villager, catch a bug. Rewards: coins, friendship, xp.
- *Story questlines* (borrowed from heart events and special orders): 15 villagers each have a 1-3 chapter story of their
  own that opens with friendship and level - Mayor Hazel's stopped town clock, Old Tomas's forty-year hunt for the Golden
  Koi, Juniper's grandma's recipe box, Ingrid's forge (she makes your better swords), Captain Ash's push into the Depths,
  Ranger Moss's tree planting, Wren's lighthouse lens, and more. Chapters finished by anyone are announced to the whole farm.
- *Unique to Cozy Hollow:* the farm is shared, so favors and stories are personal but their rewards land in the shared
  purse and their news in everyone's log; delivery favors send you across the valley and into villagers' days.
- A "?" over a villager means you have what they asked for; L opens your quest log.

**Tests live in the repo** (`tests/`), runnable by anyone: `for t in tests/test_*.py; do python3 $t; done`.

## Milestone 2 - The Valley Revival (done)
A shared progress meter at the Town Hall with five stages: Quiet, Waking, Bustling, Thriving, In Bloom. Each stage asks for
goals across six threads: town projects, the museum, friendships, festivals, the farm (kinds of crops shipped) and
exploration (Depths floors, islands). Contributions are credited by name. Existing farms start at the stage their
progress has already earned.
- Stages 1-3 need any five of the six threads, so one stubborn thread never blocks the valley; In Bloom needs all six.
- The meter sits in the side panel (browser) and the sidebar (terminal); K opens the Valley Book, where the Revival page
  lists each goal, what the next stage brings, the crops shipped so far and the credits.
- Tests: `python3 tests/test_revival.py`.

## Milestone 3 - The world reacts (done)
Early stages look a little worn (boarded windows, weeds, a dry fountain, dim lamps). Each stage-up brings visible change:
new neighbours, a shop reopening, decorations, a new area or activity, and a ceremony with Mayor Hazel.
- Quiet: weeds in the cobbles, wilted planters, a dry fountain full of leaves, boarded windows, flickering lamps (some
  out), a shuttered market stall.
- Waking: Fennel comes back and reopens the market stall (next season's seeds; she pays double for one crop each day).
- Bustling: the fountain flows again (toss in 10g once a day for luck), pastel bunting over the square, windows mended.
- Thriving: Sol restores the old hot spring above the mountain lake (a soak heals you and quickens your step); paper
  lanterns over the square glow after dark.
- Every stage-up: a banner and petals for everyone online, and Mayor Hazel speaks by the fountain while the townsfolk
  gather round. Tests: `python3 tests/test_bloom.py`.

## Milestone 4 - The finale (done)
Reaching In Bloom starts the Valley Bloom Festival: every villager in the square, fireworks, a monument with every
farmer's name, credits listing what each person did, and rewards nobody can get any other way. Then the farm goes on.
- The festival lasts one real day: everyone in the valley (even from the island and the gulch) gathers in the square
  from 8am to 10pm, and fireworks go up every night. Everyone online sees the credits roll in.
- The Bloom monument (a golden sprout on a stone plinth) stands in the south plaza; E reads every farmer's name.
- Mayor Hazel gives each farmer the Bloom Crown and the Valley Medal (also later, for anyone who missed the day).
- The valley's blessing: crops grow 10% faster from then on. Tests: `python3 tests/test_finale.py`.

## Milestone 5 - Coins that matter (done)
A rebalance from real data (an economy log of coins in and out by source), and things worth saving for: farm expansions,
farmhouse upgrades (kitchen, cellar for aging cheese), coop and barn upgrades, a furniture and decoration shop, tool
upgrades at Ingrid's forge (a can or hoe that works on several tiles), and big town projects (a bridge to a new area, a
hot spring). One evening of play should afford one meaningful purchase, never everything.
- The ledger records every coin in and out of the shared purse by the action that moved it (`/ledger`, or K).
- Ingrid: copper, iron and golden hoes and cans (1500g / 4000g / 10000g plus 5 ore): 3 tiles, 5 tiles, then a 3x3
  square; the can holds 40, 60, then 100.
- Oakley: three farm expansions (2500g, 6000g, 12000g), a farmhouse kitchen (every dish comes out as two) and cellar
  (six casks: aged cheese, vintage jam, aged pickles, golden honey), a Big Coop (20 chickens) and Big Barn (12 cows), and
  a furniture catalogue of nine decorations once the valley is Bustling (lamp posts and stone lanterns light up at night).
- Town Hall: the Minecart Line (town, mine, beach) and the Hollow Observatory (twice the shooting stars, a telescope on
  Summit Ridge). The hot spring came with the Revival (M3). Tests: `python3 tests/test_economy.py`.

## Milestone 6 - Festivals with depth (done)
Two or three activities per festival, a shared farm score, villagers joining in with festival-day lines, and prizes worth
winning (hats, decorations, rare seeds).
- Every festival: its own event, a hunt for things hidden around town (painted eggs, lucky horseshoes, lost rosettes,
  candy corn, lost mittens, glass ornaments) and Mayor Hazel's valley quiz (questions made from the valley itself: who
  works where, who loves what, which season a crop grows in). The Winter Feast adds carols from your song book.
- Everything earns festival points (your best counts for repeatable events); everyone's points make the farm's score:
  Bronze 500g, Silver a decoration only that festival gives (Maypole, Wagon Wheel, Trophy Cup, Jack-o'-Lantern, Ice Swan,
  Festive Tree), Gold rare starfruit seeds for everyone who joined in.
- At midnight the day's top scorer wins that festival's hat (Bunny Ears, Rodeo Champion Hat, Rosette Hat, Witch Hat,
  Earmuffs, Holly Crown). Villagers have lines for each festival. Tests: `python3 tests/test_festivals.py`.

## Milestone 7 - Collections and achievements (done)
Bundles in the spirit of Stardew's Community Center (a basket of spring forage, a fisherman's chest), a full
collections page (every crop, fish, bug, fossil, dish ever made), and achievements with small permanent rewards.
- The Valley Pantry (Town Hall, or K): five rooms, thirteen bundles. Each bundle pays the purse and gives a prize; each
  finished room gives the farm a lasting perk (wild things grow twice as often, soil stays wet longer, two-fish
  catches, rocks come back twice as fast, food heals more); all five add 5000g. Bundles count for the Revival.
- Collections (K): 144 things in ten categories, each with who found it first. Older farms start with what they had.
- Twelve achievements of your own, each with a reward that lasts (extra health, friendlier chats, a bonus-crop chance,
  better prices, cheaper upgrades, three new hats). Tests: `python3 tests/test_collections.py`.

## Milestone 8 - Yearly chapters and the scrapbook (done)
Each in-game year (about a real month) gets a chapter goal - Year 2 restores the lighthouse, Year 3 builds an island
resort - and the journal grows a scrapbook that records firsts, festival winners, record catches and stage-ups with
dates and names.
- Year One: bring the Revival to Bustling (2000g). Year Two: bring Wren what she needs and the lighthouse shines again
  (its beam sweeps the sea at night, and glowfish bite off the beach after dark). Year Three: build the Palm Resort with
  Coco (guests pay the farm every day; hammocks and tropical drinks). Every year after: a Year of Plenty (earn 50,000g
  and win Gold at two festivals, 5000g). A chapter stays open until it's done, so nobody is locked out.
- The scrapbook (J then the button or S, or K): arrivals, the farm's firsts, rare finds, festival champions and Gold
  scores, records (derby, pumpkin, dance, Depths), stage-ups, town projects, pantry rooms, achievements, weddings,
  levels and chapters, by season with dates and names. Older farms start it from their log.
  Tests: `python3 tests/test_chapters.py`.
