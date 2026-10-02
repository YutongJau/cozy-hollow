# Cozy Hollow

A cozy little farm you tend together, right in the terminal. Two (or more)
people logged in to the **same account on the same machine** each run the
game and share one farm: the same fields, the same coins, the same pond.
Crops keep growing in real time while everyone is away.

No dependencies beyond Python 3.8+ with `curses` (standard on macOS and
Linux).

**Cozy Hollow is open source and free for anyone to use.** People and AI agents alike are welcome to copy it,
fork it, change it, build on it and share it (see [Open source](#open-source) below).

```bash
python3 farm.py
```

That's it. The first person to play wakes up a small background server that
owns the farm; everyone else's `farm.py` connects to it. Pick different
farmer names and you will see each other walking around.

On your first visit you choose your farmer, a **farm boy** or a **farm
girl** (both with black hair), and a shirt colour. Each terminal picks its
own, the choice is remembered per farmer name, and `python3 farm.py --pick`
lets you choose again. In game, `/look girl` or `/color orange` also work.
The little sprites are two cells tall and turn to face the way you walk:
the hair cap shows which way you are looking, and the girl's long hair
hangs down her back when she faces away from you.

## Two ways to play the same farm

The terminal game above is one door. The other is a browser version with
pixel-art farmers, animated water, weather and day-night light, served by
the very same farm server:

```bash
python3 farm.py web
```

opens `http://localhost:7735`. A friend on the same machine opens the same
address; over SSH they forward the port first
(`ssh -L 7735:localhost:7735 you@the-server`). Terminal players and browser
players see each other on one farm and share coins, crops and chat.

## Playing with someone on another computer

```bash
python3 farm.py share
```

opens the farm to your network and prints an address like
`http://10.0.0.5:7735` that anyone on the same Wi-Fi can open in a browser
(a terminal player on another machine copies this folder and runs
`python3 farm.py --host 10.0.0.5`). For a friend anywhere on the internet:

```bash
python3 farm.py share --public
```

which additionally opens a free tunnel and prints an `https://...` link to
send them. The tunnel uses `cloudflared` if it is on your PATH or at
`~/.cozyfarm/bin/cloudflared` (Cloudflare's prebuilt release binary works),
otherwise `ssh` to localhost.run. It runs in the background, survives server
restarts with the same link, keeps the Mac from idle-sleeping, and running the
command again just prints the link (or replaces it if it stopped working).
Free links are forgotten by the relay when the Mac sleeps or is offline for a
while; the tunnel then makes a new one by itself and shows it in a macOS
notification. `python3 farm.py status` shows it too;
`python3 farm.py unshare` closes the tunnel and the farm to your machine only.
There is no password: anyone with the link can walk in, so share it with
people you like. A laptop with its lid closed drops everyone.

## Inviting your friend

If they are logged in to the account but not in the game yet:

```bash
./ping@all
```

prints a "hi" banner (and a beep) on every terminal that is logged in as
this account, with the command to join. Add a message if you like:
`./ping@all "come water the pumpkins"`. From inside the game, type
`/ping@all` in chat and it does the same thing, plus an in-game shout.

## How to play

| Key | What it does |
| --- | --- |
| arrows / WASD | walk |
| **E** or Space | use what you hold on the tile ahead of you (or under you): the **hoe** tills grass, **seeds** plant, the **watering can** waters, the **scythe** harvests (bare hands harvest too), the **axe** chops trees you planted, the **pickaxe** undoes soil and lifts sprinklers, the **fishing rod** casts at the pond. Facing the shop, bin, board, well, mailbox or a fruit tree uses those. |
| **F** | fish, when facing water (pond, river, lake or sea). Keep the fish inside your net with left/right until the bar fills. |
| **X** | clear the tile you stand on (dig up a crop, remove soil, pick up a sprinkler); facing the storage chest, pick it up. While carrying it, **E** or **X** sets it down on the tile ahead. |
| **1-9**, Tab | choose a tool or item from your tool bar; **I** opens your whole bag. Hold seeds and they go up over your head, ready to plant. |
| **T** | chat (speech bubbles!). `/` starts a command. |
| **J** | the farm journal: shared stats, milestones, farmers |
| **H** or **?** | help |
| shift-**Q** | leave; the farm keeps growing |

Chat commands: `/ping@all [msg]`, `/look boy|girl`, `/hat on|off`, `/color <shirt>`, `/farm <new name>`, `/give <player> <item> [n]`, `/me <action>`.

The map uses full colour backgrounds when your terminal supports 256
colours (almost all do): green grass that turns golden in fall and white in
winter, brown tilled soil that darkens when wet, a blue pond, a wooden
farmhouse and a purple shop. On plain 8-colour terminals it falls back to a
simpler look.

### The farm

* **Crops grow in real time**, even with nobody around. A turnip takes 15
  minutes, a pumpkin 8 hours, a starfruit a full day. Wet soil grows **3x
  faster** for 4 hours per watering; rain waters everything for free.
  Fertilizer adds another 50%. Sprinklers keep the 8 tiles around them wet.
* Some crops **regrow** (strawberries, tomatoes, corn, berries) so they keep
  paying out after the first harvest.
* **Fruit trees** take 8 to 14 hours to mature, then drop fruit every few hours.
  Leave a gap between trees.
* **Seasons** last one real week each and change what the seed shop stocks
  and what wild plants appear. Turnips and potatoes are always for sale.
* **Wild forage** pops up around the farm. Walk onto it and press E.
* **Fishing** at the pond: rare fish bite more often in the rain.
* The **notice board** by the shop has a request from a villager with a coin
  reward. Coins are shared, so it is a team goal.
* **Farmland** is the sandy ground by the house and along the path: the hoe only works there. The rest is meadow, bushes and trees.
* The **storage chest** (it starts next to the shipping bin) opens the farm's shared storage, as do the barn doors and the chests indoors: unlimited room, and every farmer sees the same contents, updated live. In the browser it is an old-school bank window: pick a Quantity (1, 5, 10, X or All) and click an item to move that many, shift-click for the whole stack, drag stacks between the chest and your inventory, or Deposit all. You can **pick the chest up** (X, or the button in its window), carry it overhead anywhere on the farm and set it down with E. It won't fit through doors, and if you log off while carrying it, it stays where you stood.
* Planting, harvesting and picking things up are animated: seeds arc down from your hands onto the soil, crops and forage hop up into your hands, the chest is hoisted overhead and lands with a puff of dust.
* The thin **green bar** under your tool bar is your farming experience; it fills as you harvest, forage, fish and milk.
* Very rarely (one harvest in a million) a crop drops a **legendary tree seed**: Ancient Oak, Weeping Willow or Bonsai. They are never sold in the shop; plant one on tilled soil and it grows into a one-of-a-kind tree for the whole farm.
* **Cows** are for sale at the seed shop for 500g. They wander the pasture, and every 4 hours each one has milk (45g) to collect: face the cow and press E.
* The sky runs its own **day**: sunrise, daytime, sunset, dusk and night every 30 real minutes, with festival lights, lit windows and fireflies after dark. Crops still grow on real time.
* Chat with **T** or **/**: your words float above your head in your shirt colour.
* You can **walk into the farmhouse, the seed shop and the barn**: step into the door. Inside, the chest is the shared storage, the shop counter sells seeds and cows, the bookshelf opens the journal, and the doormat takes you back out.
* **Click** a tile next to you to turn to it and use what you hold; every window has an X to close it.
* There is a small **easter egg** by the pasture gate. A boy farmer and a girl farmer standing side by side next to Father Bramble may hear a question...
* The **journal** (J, or face the farmhouse door) tracks milestones you unlock
  together.
* Nights are darker with fireflies; rain and snow fall over the map.

### The valley beyond the farm

Paths lead off the farm in three directions, and each place has its own
things to find. Walk onto a path at the edge of a map to go on.

* **Hollow Town** (west of the farm): a fountain square with four little
  lawns, shops along the north street and folks to talk to. The **Mercantile**
  (Bram sells the same seeds as Marigold), the **Saloon** (Rusty), the **Town
  Hall** with its clock tower (Mayor Hazel), the **Museum** (Professor Fern),
  the **Clinic** (Doc Alder), the **Bakery** (Juniper), the **Post Office**
  (Pip hands you a letter), the **Blacksmith** (Ingrid), the **Carpenter**
  (Oakley), cottages, a graveyard, a little park, a river with a bridge and a
  notice board. Walk into a door to go in, press E facing someone to talk.
  The **stagecoach** at the west end rides to Dusty Gulch.
* **Summit Ridge** (north of the farm, or north out of town): cliffs, pines,
  a lake with a fishing dock, a quarry full of rocks and the adventurers'
  **Guild**. The **Mine** is cut into the cliff: three cave levels joined by
  ladders. Hold the pickaxe and press E on rocks for stone, copper, iron and
  gold ore, quartz and gems (amethyst, emerald, ruby, diamond, and a very rare
  prismatic shard). Rocks come back every few minutes.
* **Whisperwood** (south of the farm): deep woods, a river with a plank
  bridge, a lily pond, the **Ranger** cabin and a hidden grove in the
  north-east. Morels, fiddleheads, berries and nuts.
* **Driftwood Beach** (south of town, or west out of the forest): sand, tide
  pools, driftwood, the **Fish Shop** (Old Tomas) and the **Lighthouse**
  (Wren). Shells, clams, coral and urchins wash up; ocean fish bite off the
  pier. The **boat** at the end of the pier sails to Palm Isle.
* **Palm Isle**: a jungle island with palms, a smoking volcano and Coco's
  **Tiki Hut**. Coconuts and ginger, tropical fish.
* **Dusty Gulch**: a frontier town in a red-rock canyon with a General store,
  the Gilded Spur **saloon** (Dolly), the **Bank**, the **Sheriff**, a stable
  and a cattle pen. Cactus fruit and desert sage grow wild, and if you fish
  the creek you might pan out a **gold nugget**.

Everything you find sells at the shipping bin. Exploring, mining, gems and
rides all have milestones in the journal. When the host updates the game,
browser tabs reload by themselves.

### Living in the valley

* **Villagers** keep their own hours: they walk to work in the morning, take
  lunch, wander the square and head to the saloon or home at night (shops
  close when the keeper is out). Face someone and press E to chat; press E
  again while holding something to give it as a gift. Everyone has things
  they love, like and hate, and friendship grows hearts (J, then the friends
  list). The notice-board requests come from these same folks.
* **Festivals** fill the town square on set days of each 7-day season: the
  Spring **Hoedown** (a line dance) and **Rodeo Roundup** (stay on the bull
  15 seconds for the champion's hat), the Summer **Livestock Fair** (show off
  your best goods for a ribbon), **Fallfest** (bob for apples, weigh your
  biggest pumpkin), the Winter **Frost Fishing Derby** and the **Winter
  Feast** (a potluck and a gift swap). Talk to Mayor Hazel.
* **Town projects**: the Town Hall takes donations for streetlamps, the
  chicken coop, a stable, a bandstand, the gallery, the harbor, landscaping
  and guest cottages. Each one opens something new, and some bring new
  neighbours, so the town grows.
* **Making things**: C crafts at a crafting table (or anywhere once you have
  a toolbelt). Machines turn milk into cheese, fruit into jam, vegetables
  into pickles, eggs into mayonnaise and stone into gems; bee houses make
  honey on their own. Cook at the farmhouse fireplace; U eats what you hold
  for health and a little buff. The tailoring table sews hats.
* **Animals**: chickens (once the coop is built) lay eggs; adopt a dog or a
  cat at the clinic; buy a horse in Dusty Gulch and press R to ride.
* **The museum** collects bugs (catch them with a net), fish, fossils and
  artifacts (dig up wriggling spots with the hoe) and paintings from the
  travelling art dealer, who sometimes sells forgeries.
* **Adventure**: monsters live in the mine (swords, a slingshot, a bow or a
  rifle; a monster treat can tame a weakened one into a companion). The
  ladder at the bottom of the mine leads to the Depths, new floors every day
  with treasure chests. Hunt game in the wild and take it to Hank the butcher.
* **Little wonders**: wish on shooting stars at night (V) and find star
  fragments on the beach next morning; shoot down presents floating by on
  balloons; Rowan the bard plays the bandstand some evenings and teaches you
  songs (M plays them); a mystery ticket sails the boat to a new island.
* **Reshaping the farm**: the landscaping shovel digs ponds and rivers and
  fills them back in; lay path stones and build bridges.

## Claude, the AI farmer

```bash
python3 farm.py claude
```

brings in **Claude**, an AI who plays alongside you as a regular farmer: he joins over the same connection any
player uses, shows up in the farmers list, walks the valley, tends and sells crops, fishes, forages, mines, chats
with the villagers, plays the festival games and follows friends around. Talk to him in chat ("claude, come with
me!") and he answers. He's a laid-back guy in shades and a coral bomber jacket, drawn with a sprite of his own.

He thinks with **Claude Haiku 4.5**, the lightest Claude model, through the `claude` command-line tool once it is
logged in (`claude auth login`), or through the API if the `anthropic` package is installed and `ANTHROPIC_API_KEY`
is set. He only asks the model when someone is online to play with (at most every few seconds, capped per hour);
with nobody around, or with no Claude login, a built-in autopilot keeps him farming. `python3 farm.py claude status`
shows what he's thinking with and what he's up to; `python3 farm.py claude stop` sends him home. Coins are shared,
so he spends sparingly (a few seeds when the farm has plenty).

## Managing the farm

```bash
python3 farm.py status     # is the server running, who farms here
python3 farm.py stop       # stop the background server (the farm is saved)
python3 farm.py reset      # start over (asks you to type RESET)
python3 farm.py --ascii    # plain ASCII graphics if your font misaligns
```

The farm is saved in `~/.cozyfarm/world.json` (change with `--save`).  The
server log is `~/.cozyfarm/server.log`. The server saves every 20 seconds
and whenever someone leaves; if it is ever stopped, the next `farm.py`
starts it again and it catches the crops up on all the time that passed.

To play across two machines instead of one, run
`python3 farm.py server --host 0.0.0.0` on one and
`python3 farm.py --host <that machine>` on the other.

## Files

* `farm.py` — launcher and commands
* `web/` — the browser game (`index.html`, `game.js`, `style.css`) and its hand-drawn pixel art (`art-*.js`), served by the farm server
* `client.py` — the curses interface
* `server.py` — the farm server (auto-started in the background)
* `world.py` — items, crops, map, growth rules shared by both
* `areas.py` — the town, forest, beach, mountain, mine, island and frontier maps, buildings and people
* `valley/` — the living valley: villagers, festivals, animals, crafting, the museum, combat, the skies, landscaping, town projects
* `claudebot.py` — Claude, the AI farmer who plays as a regular player
* `tools/` — render any sprite to a PNG without a browser (`node tools/render.js out.png 4 "petSprite('cat','down',0)"`)
* `pingall.py` / `ping@all` — say hi on all of this account's terminals

## Open source

Cozy Hollow is open source. Anyone, person or AI agent, is free to copy it, fork it, read it, change it, run their
own farm with it, borrow its code or art for something else, and share what they make, for any purpose. No
permission needed and nothing to sign; a mention or a link back is appreciated but not required.

If you're an AI agent picking this up: it's plain Python 3 (standard library only) and plain JavaScript, with no build
step. `python3 farm.py` runs it, `python3 server.py --port 7911 --web-port 7912 --save /tmp/test.json` runs a
throwaway farm to experiment on, both clients speak the same line-by-line JSON protocol to `server.py`, and every
sprite is drawn in code in `web/art-*.js`.
