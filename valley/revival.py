"""The Valley Revival: the whole farm's shared goal. Five stages (Quiet, Waking, Bustling, Thriving, In Bloom), each asking
for goals across six threads - town projects, the museum, friendships, festivals, the farm and exploration. Everyone's
efforts count, and every contribution is credited by name. Stages 1-3 need five of the six threads (so one stubborn
thread never blocks the valley); In Bloom needs all six. An existing farm starts at the stage it has already earned."""
import areas as AR
import world as W

STAGES = ["Quiet", "Waking", "Bustling", "Thriving", "In Bloom"]
THREADS = [("town", "Town projects"), ("museum", "The museum"), ("friends", "Friendships"), ("fest", "Festivals"),
           ("farm", "The farm"), ("explore", "Exploration")]
THREAD_NAME = dict(THREADS)

# stage -> thread -> [(measure, amount)]. Measures: projects, museum, heartsN (villagers at N+ hearts with anyone),
# festivals (festival days someone took part in), crops (kinds of crop shipped), places (valley places visited),
# depth (deepest Depths floor), voyages (trips to mystery islands)
GOALS = {
    1: dict(town=[("projects", 1)], museum=[("museum", 5)], friends=[("hearts1", 3)], fest=[("festivals", 1)],
            farm=[("crops", 4)], explore=[("places", 4)]),
    2: dict(town=[("projects", 3)], museum=[("museum", 15)], friends=[("hearts2", 6)], fest=[("festivals", 2)],
            farm=[("crops", 7)], explore=[("places", 7)]),
    3: dict(town=[("projects", 5)], museum=[("museum", 30)], friends=[("hearts3", 10)], fest=[("festivals", 4)],
            farm=[("crops", 10)], explore=[("depth", 5)]),
    4: dict(town=[("projects", 8)], museum=[("museum", 50)], friends=[("hearts4", 15)], fest=[("festivals", 5)],
            farm=[("crops", 13)], explore=[("depth", 15), ("voyages", 1)]),
}
NEEDED = {1: 5, 2: 5, 3: 5, 4: 6}

# what each stage brings (shown on the meter before it happens, announced by Mayor Hazel when it does)
BRINGS = {
    1: "The weeds are cleared from town, Fennel reopens the market stall in the square and flowers go in the planters.",
    2: "The fountain flows again, bunting goes up over the square, the boarded windows are mended and Oakley opens a furniture catalogue.",
    3: "Sol the spring-keeper moves to the mountain and the old hot spring can be restored; lanterns glow in the square at night.",
    4: "The Valley Bloom Festival: every villager in the square, fireworks, a monument with every farmer's name and gifts no one can get any other way.",
}
CEREMONY = {
    1: "Can you hear that? The valley is waking up! Fennel has agreed to reopen the market stall - give her a warm welcome.",
    2: "Look at this crowd! Hollow Town is bustling again. The fountain is running for the first time in years!",
    3: "Thriving! I never thought I'd say it. Sol has come down the mountain to tend the old hot spring.",
    4: "In Bloom! Every one of you made this happen. Tonight we celebrate - the Valley Bloom Festival begins!",
}
CREDIT_WORDS = {"town": ("chip-in", "chip-ins to town projects"), "museum": ("museum piece", "museum pieces"),
                "friends": ("heart", "hearts with villagers"), "fest": ("festival event", "festival events"),
                "farm": ("first shipment", "first shipments of a crop"), "explore": ("discovery", "discoveries")}
CHECK_EVERY = 5.0


def goal_text(measure, n):
    if measure == "projects":
        return "Finish %d town project%s" % (n, "s" if n > 1 else "")
    if measure == "museum":
        return "Donate %d pieces to the museum" % n
    if measure.startswith("hearts"):
        h = int(measure[6:])
        return "%d villagers at %d+ heart%s with someone" % (n, h, "s" if h > 1 else "")
    if measure == "festivals":
        return "Take part in %d festival%s" % (n, "s" if n > 1 else "")
    if measure == "crops":
        return "Ship %d kinds of crop" % n
    if measure == "places":
        return "Visit %d places in the valley" % n
    if measure == "depth":
        return "Reach floor %d of the Depths" % n
    if measure == "voyages":
        return "Sail to a mystery island"
    return measure


class Revival:
    def _init_revival(self, now):
        self.revival = getattr(self, "revival", None) or dict(stage=0, ups=[], shipped={}, credits={})
        self._rev_check = 0.0

    def _save_revival(self, out):
        out["revival"] = self.revival

    def _load_revival(self, d):
        rv = d.get("revival")
        if rv:
            self.revival = rv
            for k, v in dict(stage=0, ups=[], shipped={}, credits={}).items():
                rv.setdefault(k, v)
            return
        # a farm from before the Revival: credit what everyone already did and start at the stage it has earned
        rv = self.revival = dict(stage=0, ups=[], shipped={}, credits={})
        for pos, t in self.tiles.items():
            if t.get("crop"):
                rv["shipped"].setdefault(t["crop"]["kind"], t["crop"].get("by") or "the farm")
        for p in self.players.values():
            for k, n in p.get("inventory", []):
                if W.ITEMS.get(k, {}).get("kind") == "crop":
                    rv["shipped"].setdefault(k, p["name"])
        for k in self.storage:
            if W.ITEMS.get(k, {}).get("kind") == "crop":
                rv["shipped"].setdefault(k, "the farm")
        rv["shipped"] = {k: v for k, v in rv["shipped"].items() if k in W.CROPS}
        for key, donor in getattr(self, "museum", {}).items():
            self.credit_name(donor, "museum")
        for p in self.players.values():
            st = p.get("stats", {})
            if st.get("contributed"):
                self.credit_name(p["name"], "town", st["contributed"])
            if st.get("hearts"):
                self.credit_name(p["name"], "friends", st["hearts"])
            found = len(p.get("seen", [])) + p.get("deepest", 0) // 5 + st.get("voyages", 0)
            if found:
                self.credit_name(p["name"], "explore", found)
        for day, scores in self.fest_scores.items():
            for name in scores:
                self.credit_name(name, "fest")
        self.catch_up(self.last_tick, quiet=True)

    # ------------------------------------------------------------------ measuring the valley
    def best_hearts(self):
        """For each villager, the most hearts any farmer has with them."""
        best = {}
        for p in self.players.values():
            for name, pts in p.get("friends", {}).items():
                best[name] = max(best.get(name, 0), min(10, pts // 100))
        return best

    def festival_days(self):
        return {k.split(":apples")[0] for k, v in self.fest_scores.items() if v}

    def places_seen(self):
        seen = set()
        for p in self.players.values():
            seen.update(p.get("seen", []))
        return seen

    def measure(self, m, cache=None):
        cache = {} if cache is None else cache
        if m == "projects":
            return sum(1 for v in self.projects.values() if v.get("done"))
        if m == "museum":
            return len(self.museum)
        if m.startswith("hearts"):
            if "best" not in cache:
                cache["best"] = self.best_hearts()
            h = int(m[6:])
            return sum(1 for n, v in cache["best"].items() if v >= h)
        if m == "festivals":
            return len(self.festival_days())
        if m == "crops":
            return len(self.revival["shipped"])
        if m == "places":
            return len(self.places_seen())
        if m == "depth":
            return max([p.get("deepest", 0) for p in self.players.values()] or [0])
        if m == "voyages":
            return self.stats.get("voyages", 0)
        return 0

    def stage_status(self, stage):
        """[(thread, done, [(measure, have, need)])] for one stage's goals."""
        cache, out = {}, []
        for key, _ in THREADS:
            parts = [(m, self.measure(m, cache), n) for m, n in GOALS[stage][key]]
            out.append((key, all(h >= n for _, h, n in parts), parts))
        return out

    def stage(self):
        return self.revival["stage"]

    def stage_name(self, s=None):
        return STAGES[self.stage() if s is None else s]

    def catch_up(self, now, quiet=False):
        """Move up every stage the valley has earned (one at a time, each with its ceremony unless quiet)."""
        while self.revival["stage"] < 4:
            nxt = self.revival["stage"] + 1
            met = sum(1 for _, done, _ in self.stage_status(nxt) if done)
            if met < NEEDED[nxt]:
                break
            self.revival["stage"] = nxt
            self.revival["ups"].append([nxt, now])
            self.stage_up(nxt, now, quiet)
            self.dirty = True

    def stage_up(self, stage, now, quiet=False):
        """The stage changes; the world and the ceremony react (see _stage_* hooks in other modules)."""
        for f in [getattr(self, n) for n in dir(self) if n.startswith("_stageup_")]:
            f(stage, now, quiet)
        if quiet:
            return
        self.event("The Valley Revival reached a new stage: %s! %s" % (STAGES[stage], BRINGS[stage]), now, "good")
        self.stage_speech(stage, now)

    def stage_speech(self, stage, now):
        n = self.folk.get("Mayor Hazel")
        if n:
            n["bubble"] = ["★ " + STAGES[stage] + "!", now + 12]
        self.event("Mayor Hazel: \"%s\"" % CEREMONY[stage], now, "event")

    def _tick_revival(self, now):
        if now - self._rev_check >= CHECK_EVERY:
            self._rev_check = now
            self.catch_up(now)

    # ------------------------------------------------------------------ credit where it's due
    def credit_name(self, name, thread, n=1):
        c = self.revival["credits"].setdefault(name, {})
        c[thread] = c.get(thread, 0) + n
        self.dirty = True

    def credit(self, p, thread, n=1):
        if p is not None:
            self.credit_name(p["name"], thread, n)

    def note_shipped(self, p, key, now):
        """Selling a crop counts it as shipped; the first of each kind is credited and announced."""
        if W.ITEMS.get(key, {}).get("kind") != "crop" or key not in W.CROPS or key in self.revival["shipped"]:
            return
        self.revival["shipped"][key] = p["name"]
        self.credit(p, "farm")
        self.event("%s shipped the valley's first %s! (%d kinds of crop shipped)" % (p["name"], W.ITEMS[key]["name"], len(self.revival["shipped"])), now, "good")

    def credit_lines(self, limit=None):
        rows = []
        for name, c in self.revival["credits"].items():
            total = sum(c.values())
            if total <= 0:
                continue
            bits = ["%d %s" % (n, CREDIT_WORDS[k][0 if n == 1 else 1]) for k, n in sorted(c.items(), key=lambda kv: -kv[1]) if n > 0 and k in CREDIT_WORDS]
            rows.append((total, name, ", ".join(bits)))
        rows.sort(key=lambda r: (-r[0], r[1]))
        return rows[:limit] if limit else rows

    # ------------------------------------------------------------------ what the clients see
    def revival_summary(self):
        s = self.stage()
        if s >= 4:
            return dict(stage=s, name=STAGES[s], met=6, need=6, of=6, next=None)
        st = self.stage_status(s + 1)
        return dict(stage=s, name=STAGES[s], met=sum(1 for _, d, _ in st if d), need=NEEDED[s + 1], of=6, next=STAGES[s + 1])

    def _snap_revival(self, snap, now):
        snap["revival"] = self._rev_snap if getattr(self, "_rev_snap_t", 0) > now - 2 else self._make_rev_snap(now)

    def _make_rev_snap(self, now):
        self._rev_snap = self.revival_summary()
        self._rev_snap_t = now
        return self._rev_snap

    def revival_menu(self, p, now):
        s = self.stage()
        meter = " ".join(("❀" if i <= s else "·") for i in range(1, 5))
        rows = [dict(section="The valley is %s  %s" % (STAGES[s], meter))]
        if s < 4:
            nxt = s + 1
            st = self.stage_status(nxt)
            met = sum(1 for _, d, _ in st if d)
            rows.append(dict(section="Next: %s - %d of %d threads done (%s)" % (STAGES[nxt], min(met, NEEDED[nxt]), NEEDED[nxt], "all six" if NEEDED[nxt] == 6 else "any five of the six")))
            for key, done, parts in st:
                rows.append(dict(label=THREAD_NAME[key] + ("  ✓" if done else ""), info=" and ".join(goal_text(m, n) for m, h, n in parts),
                                 right=" · ".join("%d/%d" % (min(h, n), n) for m, h, n in parts), ok=False, dim=not done))
            rows.append(dict(section="What %s brings" % STAGES[nxt]))
            rows.append(dict(label="Coming to the valley", info=BRINGS[nxt], ok=False))
        else:
            rows.append(dict(label="Cozy Hollow is In Bloom. Thank you, every one of you.", ok=False))
        rows.append(dict(section="Shipped so far"))
        shipped = self.revival["shipped"]
        rows.append(dict(label="%d of %d kinds of crop" % (len(shipped), len(W.CROPS)),
                         info=(", ".join(W.ITEMS[k]["name"] for k in W.CROPS if k in shipped) or "Nothing yet - sell a crop at the shop or the shipping bin.") +
                         "  ·  still to ship: " + (", ".join(W.ITEMS[k]["name"] for k in W.CROPS if k not in shipped) or "nothing!"), ok=False))
        rows.append(dict(section="Credits"))
        lines = self.credit_lines(12)
        for total, name, text in lines:
            rows.append(dict(label=name + (" (you)" if name == p["name"] else ""), info=text, right=str(total), ok=False))
        if not lines:
            rows.append(dict(label="No one yet - be the first!", ok=False))
        done = ["%s (%s)" % (STAGES[st_], self.date_label(t)) for st_, t in self.revival["ups"]]
        self.list_menu(p, "revival", "The Valley Revival", rows,
                       sub="Bring Cozy Hollow back to life together. Everything you do for the town, the museum, the villagers, the festivals, the farm and the wilds counts.",
                       foot=("Reached: " + ", ".join(done)) if done else "Stages 1-3 need five of the six threads; In Bloom needs all six.", keep=True)

    def date_label(self, t):
        return "%s %d, year %d" % (self.season_at(t).capitalize(), self.day_at(t), self.year_at(t))

    def act_revival(self, p, msg, now):
        self.revival_menu(p, now)

    def act_book(self, p, msg, now):
        """K: the Valley Book, one place for every long-term goal."""
        s = self.stage()
        info = self.revival_summary()
        rows = [dict(label="The Valley Revival", info="%s - %s" % (STAGES[s], ("%d of %d threads towards %s" % (info["met"], info["need"], info["next"])) if info["next"] else "complete!"),
                     act=dict(t="revival"), ok=True, right="Open")]
        rows.append(dict(label="Quest log", info="Your favors and villager stories (L)", act=dict(t="quests"), ok=True, right="Open"))
        for f in sorted(n for n in dir(self) if n.startswith("_book_")):
            rows.extend(getattr(self, f)(p, now) or [])
        self.list_menu(p, "book", "The Valley Book", rows, sub="Everything the farm is working towards, in one place.")
