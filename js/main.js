import { MODELS, liveBrain, practiceBrain } from "./brains.js";
import { countSigns } from "./play.js";
import { burst, drawBackground, portrait, render, stepParticles } from "./render.js";
import {
    H,
    RECESS_TICKS,
    W,
    ZONES,
    applyAction,
    describeEvent,
    kidById,
    newWorld,
    step,
} from "./world.js";

// Publishable App Key for Pollinations Connect. Empty = practice mode only.
const APP_KEY = "pk_EcBDwMXedCjliq99";
const CONNECT_SRC = "https://cdn.jsdelivr.net/npm/@pollinations/ui@0.1.0-alpha.31/dist/connect.js";

const $ = (id) => document.getElementById(id);
const store = {
    get(name, fallback) {
        try {
            return JSON.parse(localStorage.getItem(`recess.${name}`)) ?? fallback;
        } catch {
            return fallback;
        }
    },
    set(name, value) {
        try {
            localStorage.setItem(`recess.${name}`, JSON.stringify(value));
        } catch {}
    },
};

const settings = {
    decisionModel: MODELS.decision[0].id,
    guest: { kid: "", model: "" },
    ...store.get("settings", {}),
};
let apiKey = null;
let speed = 1;
let world = newWorld();
let running = false;
let paused = false;
let rulebook = store.get("rulebook", []);
const fx = { particles: [], ringingUntil: 0 };
const brains = { live: liveBrain(() => apiKey, settings), practice: practiceBrain() };
const lines = {}; // kid id -> { text, until }

// ---------- Canvas ----------
const canvas = $("world");
const bg = drawBackground(document.createElement("canvas"));
canvas.width = bg.width;
canvas.height = bg.height;
const ctx = canvas.getContext("2d");

const bubbleEls = Object.fromEntries(
    world.kids.map((k) => {
        const el = document.createElement("div");
        el.className = "bubble";
        el.style.setProperty("--kid", k.colors.shirt);
        $("bubbles").append(el);
        return [k.id, el];
    }),
);

let last = performance.now();
function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused) {
        step(world, dt * speed);
        stepParticles(fx, dt);
    }
    render(ctx, bg, world, now / 1000, fx);
    placeBubbles(now);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Keep speech bubbles above their kid without covering each other.
function placeBubbles(now) {
    const stage = $("stage");
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const placed = [];
    const shown = world.kids
        .filter((k) => lines[k.id]?.until > now)
        .sort((a, b) => b.y - a.y);
    for (const kid of world.kids) bubbleEls[kid.id].classList.toggle("show", shown.includes(kid));
    for (const kid of shown) {
        const el = bubbleEls[kid.id];
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const x = Math.min(Math.max((kid.x / W) * sw, w / 2 + 4), sw - w / 2 - 4);
        let bottom = ((kid.y - 27) / H) * sh;
        for (const p of placed)
            if (Math.abs(p.x - x) < (p.w + w) / 2 + 4 && bottom > p.top - 4 && bottom - h < p.bottom + 4)
                bottom = p.top - 6;
        bottom = Math.max(bottom, h + 4);
        placed.push({ x, w, top: bottom - h, bottom });
        el.style.left = `${x}px`;
        el.style.top = `${bottom}px`;
    }
}

// ---------- Cast cards ----------
const label = (action) =>
    action
        .replace(/_(juno|ravi|mia|toby)$/, (_, id) => ` ${kidById(world, id).name}`)
        .replace(/^go_/, "go to ")
        .replaceAll("_", " ");

function renderCast() {
    $("cast").replaceChildren(
        ...world.kids.map((kid) => {
            const li = document.createElement("li");
            li.className = "kid";
            li.style.setProperty("--kid", kid.colors.shirt);
            const guest = settings.guest.kid === kid.id && settings.guest.model;
            li.innerHTML = `<div class="kid-name"></div><div class="kid-where"></div>`;
            li.prepend(portrait(kid, 88));
            li.querySelector(".kid-name").textContent = kid.name;
            if (guest) {
                const tag = document.createElement("span");
                tag.className = "guest-tag";
                tag.textContent = "guest";
                tag.title = settings.guest.model;
                li.querySelector(".kid-name").append(tag);
            }
            li.querySelector(".kid-where").textContent = `at ${ZONES[kid.zone].label}`;
            if (!kid.probs) {
                const p = document.createElement("p");
                p.className = "intent-empty";
                p.textContent = kid.personality;
                li.append(p);
                return li;
            }
            const ul = document.createElement("ul");
            ul.className = "intent";
            ul.setAttribute("aria-label", `What ${kid.name} considered`);
            const top = Object.entries(kid.probs)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            for (const [action, p] of top) {
                const row = document.createElement("li");
                if (action === kid.chosen) row.className = "chosen";
                row.innerHTML = `<div class="bar"><i></i><span></span></div><span class="pct"></span>`;
                row.querySelector("i").style.width = `${Math.max(p * 100, 3)}%`;
                row.querySelector(".bar span").textContent = label(action);
                row.querySelector(".pct").textContent = `${Math.round(p * 100)}%`;
                ul.append(row);
            }
            li.append(ul);
            return li;
        }),
    );
}

// ---------- Chatter ----------
function addChatter(events) {
    const list = $("chatter");
    const head = document.createElement("li");
    head.className = "minute";
    head.textContent = `Minute ${world.tick + 1}`;
    list.append(head);
    for (const e of events) {
        const kid = kidById(world, e.kid);
        const li = document.createElement("li");
        li.append(portrait(kid, 60));
        const body = document.createElement("div");
        const what = document.createElement("div");
        what.className = "what";
        what.textContent = describeEvent(world, e);
        body.append(what);
        if (e.line) {
            const said = document.createElement("div");
            said.className = "said";
            said.textContent = `“${e.line}”`;
            body.append(said);
        }
        li.append(body);
        list.append(li);
    }
    list.scrollTop = list.scrollHeight;
}

function chatterNote(text) {
    const li = document.createElement("li");
    li.className = "game-note";
    li.textContent = text;
    $("chatter").append(li);
    $("chatter").scrollTop = $("chatter").scrollHeight;
}

// ---------- Rulebook ----------
function renderRulebook() {
    $("rule-count").textContent = rulebook.length;
    $("rulebook-empty").classList.toggle("hidden", rulebook.length > 0);
    $("games").replaceChildren(
        ...rulebook.map((g) => {
            const li = document.createElement("li");
            li.className = "game";
            const h = document.createElement("h3");
            h.textContent = `${g.emoji} ${g.name}`;
            const meta = document.createElement("div");
            meta.className = "meta";
            for (const name of g.inventors) {
                const kid = world.kids.find((k) => k.name === name);
                if (kid) meta.append(portrait(kid, 44));
            }
            meta.append(
                ` invented by ${g.inventors.join(", ") || "the kids"} · minute ${g.minute} · ${g.mode === "live" ? g.model : "practice"}`,
            );
            const ol = document.createElement("ol");
            for (const r of g.rules) {
                const item = document.createElement("li");
                item.textContent = r;
                ol.append(item);
            }
            const spark = document.createElement("p");
            spark.className = "spark";
            spark.textContent = g.spark;
            li.append(h, meta, ol, spark);
            return li;
        }),
    );
}

function exportMarkdown() {
    const md = [
        "# Recess Rulebook",
        "",
        "Games AI kids invented when nobody told them what to do.",
        "",
        ...rulebook.flatMap((g) => [
            `## ${g.emoji} ${g.name}`,
            "",
            `*Invented by ${g.inventors.join(", ")} at minute ${g.minute} (${g.mode === "live" ? g.model : "practice"})*`,
            "",
            ...g.rules.map((r, i) => `${i + 1}. ${r}`),
            "",
            `> ${g.spark}`,
            "",
        ]),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "recess-rulebook.md";
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---------- Toasts ----------
function toast(text, kind = "") {
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = text;
    $("toasts").append(el);
    setTimeout(() => el.remove(), kind === "error" ? 7000 : 3800);
}

// ---------- The recess loop ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mode = () => (apiKey ? "live" : "practice");

async function tick() {
    const brain = brains[mode()];
    const started = performance.now();
    const decisions = await brain.decideAll(world);
    const events = [];
    for (const kid of world.kids) {
        const d = decisions[kid.id];
        kid.probs = d.probs;
        kid.chosen = d.action;
        events.push(applyAction(world, kid, d.action));
    }
    renderCast();
    const said = await brain.speak(world, events).catch(() => ({}));
    const now = performance.now();
    events.forEach((e, i) => {
        e.line = said[e.kid] || "";
        if (e.line) {
            lines[e.kid] = { until: now + 2600 / speed + i * 250 };
            bubbleEls[e.kid].innerHTML = `<b></b> `;
            bubbleEls[e.kid].querySelector("b").textContent = `${kidById(world, e.kid).name}:`;
            bubbleEls[e.kid].append(e.line);
        }
        if (e.verb === "make_rule" && e.line)
            world.rules.push({ text: e.line, by: e.kid, tick: world.tick });
    });
    world.rules = world.rules.slice(-6);
    world.log.push(...events);
    addChatter(events);
    await spotGame(brain);
    world.tick++;
    $("minute").textContent = `Minute ${Math.min(world.tick + 1, RECESS_TICKS)} of ${RECESS_TICKS}`;
    await sleep(Math.max(0, 3200 / speed - (performance.now() - started)));
}

async function spotGame(brain) {
    if (world.tick < 4 || world.tick - world.lastGameTick < 6) return;
    const found = countSigns(world);
    if (found.score < 2) return;
    const p = await brain.judge(world, found);
    if (p < 0.55) return;
    const game = await brain.write(
        world,
        found,
        rulebook.map((g) => g.name),
    );
    if (rulebook.some((g) => g.name.toLowerCase() === game.name.toLowerCase())) return;
    world.lastGameTick = world.tick;
    rulebook.unshift({
        ...game,
        minute: world.tick + 1,
        mode: mode(),
        model: mode() === "live" ? settings.decisionModel : "practice",
        signs: Object.keys(found.signs).filter((k) => found.signs[k]),
        playScore: Math.round(p * 100) / 100,
        at: new Date().toISOString(),
    });
    store.set("rulebook", rulebook);
    renderRulebook();
    const center = found.events.length ? kidById(world, found.events.at(-1).kid) : world.kids[0];
    burst(fx, center.x, center.y - 18);
    toast(`📖 New game in the Rulebook: ${game.emoji} ${game.name}`);
    chatterNote(`📖 They invented “${game.name}”!`);
}

async function runRecess() {
    if (running) return;
    world = newWorld();
    for (const k of Object.keys(lines)) delete lines[k];
    renderCast();
    $("minute").textContent = `Minute 1 of ${RECESS_TICKS}`;
    running = true;
    paused = false;
    $("intro").classList.add("hidden");
    $("ending").classList.add("hidden");
    $("pause-btn").disabled = false;
    $("pause-btn").textContent = "⏸ Pause";
    $("chatter").replaceChildren();
    fx.ringingUntil = performance.now() + 1800;
    chatterNote(`🔔 The bell rang. Recess starts (${mode() === "live" ? "live AI" : "practice brain"}).`);
    const before = rulebook.length;
    try {
        while (world.tick < RECESS_TICKS && running) {
            while (paused) await sleep(200);
            await tick();
        }
        fx.ringingUntil = performance.now() + 1800;
        const found = rulebook.length - before;
        $("ending-text").textContent =
            found > 0
                ? `The kids invented ${found} new game${found > 1 ? "s" : ""}. Open the Rulebook to read ${found > 1 ? "them" : "it"}.`
                : "No new games this time. Sometimes kids just hang out. Try again, or let a different model decide.";
        $("ending").classList.remove("hidden");
    } catch (err) {
        console.error(err);
        toast(errorText(err), "error");
        $("intro").classList.remove("hidden");
        $("start-btn").textContent = "🔔 Try again";
    } finally {
        running = false;
        $("pause-btn").disabled = true;
    }
}

function errorText(err) {
    if (err.status === 401) return "Your Pollinations connection expired. Connect again to keep playing.";
    if (err.status === 402) return "Out of Pollen for this app. Top up or raise the app's budget, then ring the bell again.";
    if (err.status === 403) return "This key can't use one of the models. Pick Microsoft Decision 1 in Brains & guests, or reconnect.";
    return `Something went wrong: ${err.message}`;
}

// ---------- Connect & settings ----------
function setMode() {
    const live = mode() === "live";
    $("mode").textContent = live
        ? `Live · ${MODELS.decision.find((m) => m.id === settings.decisionModel)?.label ?? settings.decisionModel}`
        : "Practice";
    $("mode").classList.toggle("live", live);
    $("intro-mode").textContent = live
        ? "Connected: real AI models decide, and each recess costs you about 0.03 Pollen."
        : APP_KEY
          ? "Practice mode uses a small built-in brain. Connect Pollinations (top right) to let real AI models decide."
          : "Practice mode uses a small built-in brain. Live AI mode is coming soon.";
    $("cost").textContent = live ? "≈ 0.03 Pollen per recess, paid from your own Pollen" : "Practice mode is free";
}

function mountConnect() {
    if (!APP_KEY) return;
    const script = document.createElement("script");
    script.src = CONNECT_SRC;
    script.defer = true;
    document.head.append(script);
    const el = document.createElement("polli-connect");
    el.setAttribute("app-key", APP_KEY);
    el.setAttribute("budget", "5");
    el.setAttribute("expiry", "7");
    el.setAttribute("models", "decision,text");
    el.addEventListener("change", () => {
        apiKey = el.apiKey ?? null;
        setMode();
        toast(apiKey ? "Connected. Real AI kids are ready." : "Disconnected. Back to practice mode.");
    });
    $("connect-slot").append(el);
}

function fillSettings() {
    $("decision-model").replaceChildren(
        ...MODELS.decision.map((m) => new Option(`${m.label} (${m.note})`, m.id, false, m.id === settings.decisionModel)),
    );
    $("guest-kid").replaceChildren(
        new Option("Nobody", ""),
        ...world.kids.map((k) => new Option(k.name, k.id, false, k.id === settings.guest.kid)),
    );
    $("guest-model").value = settings.guest.model;
}

$("settings-btn").addEventListener("click", () => {
    fillSettings();
    $("settings").showModal();
});
$("settings").addEventListener("close", () => {
    settings.decisionModel = $("decision-model").value;
    settings.guest = { kid: $("guest-kid").value, model: $("guest-model").value.trim() };
    store.set("settings", settings);
    setMode();
    renderCast();
});

$("start-btn").addEventListener("click", runRecess);
$("again-btn").addEventListener("click", runRecess);
$("pause-btn").addEventListener("click", () => {
    paused = !paused;
    $("pause-btn").textContent = paused ? "▶ Resume" : "⏸ Pause";
});
for (const b of document.querySelectorAll(".seg-btn"))
    b.addEventListener("click", () => {
        speed = Number(b.dataset.speed);
        for (const o of document.querySelectorAll(".seg-btn")) o.classList.toggle("active", o === b);
    });
for (const t of document.querySelectorAll(".tab"))
    t.addEventListener("click", () => {
        for (const o of document.querySelectorAll(".tab")) {
            o.classList.toggle("active", o === t);
            o.setAttribute("aria-selected", String(o === t));
        }
        $("chatter").classList.toggle("hidden", t.dataset.tab !== "chatter");
        $("rulebook").classList.toggle("hidden", t.dataset.tab !== "rulebook");
    });
$("export-btn").addEventListener("click", exportMarkdown);
$("clear-btn").addEventListener("click", () => {
    rulebook = [];
    store.set("rulebook", rulebook);
    renderRulebook();
});
$("theme-btn").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("theme", root.dataset.theme);
});
const savedTheme = store.get("theme", null);
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

mountConnect();
setMode();
renderCast();
renderRulebook();
