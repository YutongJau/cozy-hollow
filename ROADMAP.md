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

**Tests live in the repo** (`tests/`), runnable by anyone.

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

## Milestone 4 - The finale
Reaching In Bloom starts the Valley Bloom Festival: every villager in the square, fireworks, a monument with every
farmer's name, credits listing what each person did, and rewards nobody can get any other way. Then the farm goes on.

## Milestone 5 - Coins that matter
A rebalance from real data (an economy log of coins in and out by source), and things worth saving for: farm expansions,
farmhouse upgrades (kitchen, cellar for aging cheese), coop and barn upgrades, a furniture and decoration shop, tool
upgrades at Ingrid's forge (a can or hoe that works on several tiles), and big town projects (a bridge to a new area, a
hot spring). One evening of play should afford one meaningful purchase, never everything.

## Milestone 6 - Festivals with depth
Two or three activities per festival, a shared farm score, villagers joining in with festival-day lines, and prizes worth
winning (hats, decorations, rare seeds).

## Milestone 7 - Collections and achievements
Bundles in the spirit of Stardew's Community Center (a basket of spring forage, a fisherman's chest), a full
collections page (every crop, fish, bug, fossil, dish ever made), and achievements with small permanent rewards.

## Milestone 8 - Yearly chapters and the scrapbook
Each in-game year (about a real month) gets a chapter goal - Year 2 restores the lighthouse, Year 3 builds an island
resort - and the journal grows a scrapbook that records firsts, festival winners, record catches and stage-ups with
dates and names.
