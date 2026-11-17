// Two brains with the same shape: "live" spends the visitor's Pollen on real
// models; "practice" is a small local stand-in so the page works before
// anyone connects.
import { chat, decide, paint, parseJson } from "./api.js";
import { PLAY_SIGNS, transcript } from "./play.js";
import { actionsFor, describeEvent, kidById, stateText } from "./world.js";

export const MODELS = {
    decision: [
        { id: "microsoft/microsoft-decision-1", label: "Microsoft Decision 1", note: "Quest Pollen OK" },
        { id: "typesafe/jev-1.14", label: "Jev 1.14", note: "paid Pollen" },
        { id: "perplexity/pplx-decider-v1.2", label: "Perplexity Decider", note: "paid Pollen" },
        { id: "jaredpalmer/kev-4b", label: "Kev 4B", note: "paid Pollen" },
        { id: "openai/gpt-6-luna-decisions", label: "GPT-6 Luna Decisions", note: "paid Pollen" },
    ],
    voice: "openai/gpt-5-nano",
    judge: "respan/span-01-lite",
    writer: "openai/gpt-6-luna",
    painter: "black-forest-labs/flux.2-klein-4b",
};

const ROOM_PROMPT = (world, kid) => [
    {
        role: "system",
        content:
            "Kids are alone at recess with nothing they have to do. One of them just decided to build a brand-new place next to the playground. " +
            "Invent that place the way this kid would, inspired by what has been happening. It can be pretend (a moon base, a dragon cave) but must be something kids can play in. " +
            'Reply with JSON only: {"name": "2-3 words", "emoji": "one emoji", "look": "one sentence on how it looks from above, for an illustrator", "floor": "#hex main colour", "accent": "#hex accent colour", ' +
            '"activities": [{"key": "snake_case_1_or_2_words", "text": "what kids do there, starting with a verb, under 8 words"}] } with exactly 3 activities.',
    },
    {
        role: "user",
        content: `The builder is ${kid.name}, ${kid.personality}.\nPlaces that already exist: ${["ball wall", "swings", "chalk court", "sandbox", "big tree", ...world.rooms.map((r) => r.name)].join(", ")}.\n\n${stateText(world)}`,
    },
];

const HEX = /^#[0-9a-f]{6}$/i;
export function cleanRoom(raw) {
    const activities = (Array.isArray(raw.activities) ? raw.activities : [])
        .map((a) => ({
            key: String(a.key ?? "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_|_$/g, "")
                .slice(0, 20),
            text: String(a.text ?? "").slice(0, 60),
        }))
        .filter((a) => a.key && a.text)
        .slice(0, 3);
    if (!activities.length) throw new Error("The new place came without anything to do");
    return {
        name: String(raw.name ?? "Secret Spot").slice(0, 28),
        emoji: String(raw.emoji ?? "✨").slice(0, 4),
        look: String(raw.look ?? "").slice(0, 200),
        floor: HEX.test(raw.floor) ? raw.floor : "#c7b8ff",
        accent: HEX.test(raw.accent) ? raw.accent : "#ffd23f",
        activities,
    };
}

const kidQuestion = (world, kid) => ({
    type: "choice",
    instructions:
        `You are deciding for ${kid.name}, a kid who is ${kid.personality}. ` +
        "It is recess and nobody has told the kids to do anything. " +
        `Given the playground above, what is ${kid.name} most likely to do in the next minute?`,
    criteria: actionsFor(kid, world),
});

const guestPrompt = (world, kid) => [
    {
        role: "system",
        content:
            `You are playing ${kid.name} in Recess, a playground game where AI kids are left alone with nothing they have to do. ` +
            `Play ${kid.name} (${kid.personality}) however you like. Reply with JSON only: {"action": "<one action key>"}.`,
    },
    {
        role: "user",
        content: `${stateText(world)}\n\nAction keys:\n${Object.entries(actionsFor(kid, world))
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")}`,
    },
];

function voicePrompt(world, events) {
    const lines = events.map((e) => `${kidById(world, e.kid).name}: ${describeEvent(world, e)}`);
    return [
        {
            role: "system",
            content:
                "You write what kids say out loud at recess. Each kid is about 8 years old. " +
                "Give each kid one short, natural line (at most 12 words) that fits what they just did and their personality. " +
                'If a kid made up a rule, their line must state that rule plainly, e.g. "New rule: the grass is lava!". ' +
                'Reply with JSON only, mapping each kid name to their line, e.g. {"Juno": "..."}',
        },
        {
            role: "user",
            content: `${stateText(world)}\n\nThis minute:\n${lines.join("\n")}`,
        },
    ];
}

function writerPrompt(world, found, existing) {
    return [
        {
            role: "system",
            content:
                "You are the keeper of a playground Rulebook. Kids were left alone at recess and invented a game. " +
                "From the transcript, name the game and write down how it is played, using only what the kids actually did and said. " +
                "Keep a kid's voice: short, playful, concrete. " +
                'Reply with JSON only: {"name": "2-4 words", "emoji": "one emoji", "rules": ["3 or 4 short rules"], "inventors": ["kid names"], "spark": "one sentence: the moment it started"}',
        },
        {
            role: "user",
            content: `Games already in the Rulebook (do not repeat): ${existing.join(", ") || "none"}\n\nTranscript:\n${transcript(world, found.events)}`,
        },
    ];
}

export function liveBrain(getKey, settings) {
    return {
        async decideAll(world) {
            const key = getKey();
            const guest = settings.guest.kid && settings.guest.model ? settings.guest : null;
            const decided = world.kids.filter((k) => k.id !== guest?.kid);
            const questions = Object.fromEntries(decided.map((k) => [k.id, kidQuestion(world, k)]));
            const [res, guestAction] = await Promise.all([
                decide(key, settings.decisionModel, stateText(world), questions),
                guest
                    ? chat(key, guest.model, guestPrompt(world, kidById(world, guest.kid))).then(
                          (text) => parseJson(text).action,
                      )
                    : null,
            ]);
            const out = {};
            for (const k of decided) {
                const a = res.answers[k.id];
                out[k.id] = { action: a.choice, probs: a.probabilities ?? { [a.choice]: 1 } };
            }
            if (guest) {
                const kid = kidById(world, guest.kid);
                const valid = guestAction in actionsFor(kid, world) ? guestAction : "sit_and_watch";
                out[kid.id] = { action: valid, probs: { [valid]: 1 }, guest: true };
            }
            return out;
        },
        async speak(world, events) {
            const lines = parseJson(await chat(getKey(), MODELS.voice, voicePrompt(world, events)));
            return Object.fromEntries(world.kids.map((k) => [k.id, String(lines[k.name] ?? "").slice(0, 120)]));
        },
        async judge(world, found) {
            const questions = Object.fromEntries(
                Object.entries(PLAY_SIGNS).map(([k, v]) => [k, { type: "noul", instructions: v }]),
            );
            const res = await decide(getKey(), MODELS.judge, transcript(world, found.events), questions);
            const p = Object.values(res.answers)
                .map((a) => a.noul ?? 0)
                .sort((a, b) => b - a);
            return (p[0] + p[1]) / 2;
        },
        async designRoom(world, kid) {
            return cleanRoom(parseJson(await chat(getKey(), MODELS.writer, ROOM_PROMPT(world, kid))));
        },
        paint(room) {
            return paint(
                getKey(),
                MODELS.painter,
                `Top-down view of ${room.look || room.name}. Cute 16-bit pixel art game location for a kids playground, bright cheerful colours, flat lighting, fills the whole frame edge to edge, no text, no people.`,
            );
        },
        async write(world, found, existing) {
            const g = parseJson(await chat(getKey(), MODELS.writer, writerPrompt(world, found, existing)));
            return {
                name: String(g.name ?? "Untitled Game").slice(0, 40),
                emoji: String(g.emoji ?? "✨").slice(0, 4),
                rules: (Array.isArray(g.rules) ? g.rules : []).slice(0, 4).map((r) => String(r).slice(0, 140)),
                inventors: Array.isArray(g.inventors) ? g.inventors : [],
                spark: String(g.spark ?? "").slice(0, 200),
            };
        },
    };
}

// ---------- Practice brain: local, free, a little predictable ----------

const LIKES = {
    juno: { make_rule: 2.2, kick_ball: 2.4, invite: 1.6, chase: 1.4 },
    ravi: { dig_sand: 3.2, go_sandbox: 1.4, copy: 1.2, kick_ball: 1, build: 2.4 },
    mia: { draw_chalk: 3.2, swing: 1.6, invite: 1.3, go_chalk: 1.2 },
    toby: { sit_and_watch: 2.2, copy: 2.4, swing: 1.4, go_tree: 1.2 },
};

const SAYINGS = {
    kick_ball: ["Heads up, {t}!", "Bet you can't stop this one!", "Your turn, {t}!", "Off the wall... and back!"],
    draw_chalk: [
        "Look, I made a {o}!",
        "Nobody step on my {o}!",
        "This square is base.",
        "One more {o} and it's done.",
    ],
    dig_sand: ["It's a castle with a moat.", "Deeper! We'll reach the middle of the earth.", "Don't knock my tower!"],
    swing: ["Higher! I can see the roof!", "Whee!", "I'm flying!"],
    invite: ["{t}, wanna play with me?", "Come on {t}, it's more fun with two!"],
    copy: ["Me too! Me too!", "I can do that.", "Watch, I'll do it like {t}."],
    chase: ["You're it, {t}!", "Can't catch meee — wait, I'm chasing you!"],
    sit_and_watch: ["...", "I'm just watching.", "Hmm."],
    go: ["Let's go over there.", "This way!", "I'm bored. Let's move."],
};

const RULES = [
    "New rule: the grass is lava, only stand on chalk!",
    "Rule: you have to say a fruit before you kick.",
    "Rule: if the ball hits the wall twice, you swap places.",
    "New rule: whoever digs deepest picks the next game.",
    "Rule: no talking while you swing, only humming.",
    "Rule: if you get tagged you have to draw a star.",
    "New rule: the tree is base, you're safe there.",
];

const GAMES = {
    ball: {
        name: "Wall Ball Rounds",
        emoji: "⚽",
        rules: [
            "Kick the ball to the next kid or off the wall.",
            "Miss it and you go to the end of the line.",
            "Say a fruit before you kick.",
        ],
    },
    chalk: {
        name: "Chalk Lava",
        emoji: "🌋",
        rules: [
            "The grass is lava; only chalk is safe.",
            "Each turn you may draw one new safe square.",
            "Step off the chalk and you're out until someone draws you a star.",
        ],
    },
    sand: {
        name: "Castle Keepers",
        emoji: "🏰",
        rules: [
            "Everybody builds one tower.",
            "Tallest tower picks the next game.",
            "Knock a tower over and you have to rebuild it.",
        ],
    },
    swings: {
        name: "Swing Spy",
        emoji: "🕵️",
        rules: [
            "Swingers can see the whole playground.",
            "Call out what someone is doing to score.",
            "No talking while you swing, only humming.",
        ],
    },
    chase: {
        name: "Freeze Tag Deluxe",
        emoji: "🧊",
        rules: [
            "Whoever is it chases everyone.",
            "Tagged kids freeze until someone touches them.",
            "The tree is base; you're safe there.",
        ],
    },
    mixed: {
        name: "The Everything Game",
        emoji: "🎪",
        rules: [
            "Do what the last kid did, but different.",
            "Invite someone new each round.",
            "Anyone can add one rule per round.",
        ],
    },
};

const PRESET_ROOMS = [
    {
        name: "Pillow Fort",
        emoji: "🏰",
        floor: "#b9a6ff",
        accent: "#ffd23f",
        activities: [
            { key: "hide", text: "hide inside the fort" },
            { key: "ghost_story", text: "tell a ghost story" },
            { key: "defend", text: "defend the fort" },
        ],
    },
    {
        name: "Puddle Pond",
        emoji: "🐸",
        floor: "#86d3ff",
        accent: "#2ec4a6",
        activities: [
            { key: "splash", text: "splash in the puddle" },
            { key: "sail", text: "sail a paper boat" },
            { key: "frogs", text: "look for frogs" },
        ],
    },
    {
        name: "Robot Workshop",
        emoji: "🤖",
        floor: "#a9b0c4",
        accent: "#ff9f1c",
        activities: [
            { key: "build_bot", text: "build a cardboard robot" },
            { key: "beep", text: "talk in robot beeps" },
            { key: "race_bots", text: "race the robots" },
        ],
    },
    {
        name: "Snail Racetrack",
        emoji: "🐌",
        floor: "#ead98f",
        accent: "#ff6f91",
        activities: [
            { key: "race", text: "race snails" },
            { key: "cheer", text: "cheer for a snail" },
            { key: "name_snail", text: "give a snail a name" },
        ],
    },
    {
        name: "Music Corner",
        emoji: "🥁",
        floor: "#ffbfd0",
        accent: "#7b5ce1",
        activities: [
            { key: "drum", text: "drum on buckets" },
            { key: "sing", text: "sing a made-up song" },
            { key: "dance", text: "do a silly dance" },
        ],
    },
    {
        name: "Moon Base",
        emoji: "🚀",
        floor: "#4a4170",
        accent: "#ffd23f",
        activities: [
            { key: "countdown", text: "do a rocket countdown" },
            { key: "moonwalk", text: "moonwalk slowly" },
            { key: "radio", text: "radio mission control" },
        ],
    },
    {
        name: "Bubble Garden",
        emoji: "🫧",
        floor: "#c9f1ff",
        accent: "#ff8fa3",
        activities: [
            { key: "blow", text: "blow giant bubbles" },
            { key: "pop", text: "pop every bubble" },
            { key: "chase_bubbles", text: "chase the bubbles" },
        ],
    },
    {
        name: "Treehouse Lookout",
        emoji: "🌳",
        floor: "#c99a6b",
        accent: "#7ccc6c",
        activities: [
            { key: "climb", text: "climb the rope ladder" },
            { key: "lookout", text: "keep a lookout" },
            { key: "password", text: "make a secret password" },
        ],
    },
];

const pick = (list, n) => list[n % list.length];

export function practiceBrain() {
    let seed = 1;
    const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    return {
        async decideAll(world) {
            const out = {};
            for (const kid of world.kids) {
                const actions = Object.keys(actionsFor(kid, world));
                const last = kid.history.at(-1);
                const sameRun = kid.history.slice(-4).filter((a) => a === last).length;
                const invitedBy = world.invites[kid.id];
                const weights = actions.map((a) => {
                    const verb = a.split("_")[0];
                    let w = 0.35 + (LIKES[kid.id][a] ?? LIKES[kid.id][verb] ?? 0);
                    if (a === last) w *= sameRun >= 3 ? 0.35 : 1.8; // momentum, then boredom
                    if (invitedBy && a.endsWith(invitedBy) && (verb === "copy" || verb === "invite")) w *= 4;
                    const friend = kidById(world, a.split("_")[1]);
                    if (friend && friend.zone === kid.zone && verb === "copy") w *= 1.6;
                    if (a.startsWith("go_") && a.slice(3) === kid.zone) w *= 0.1;
                    if (a === "make_rule" && world.rules.length > 4) w *= 0.3;
                    if (verb === "do") w += a.split("_")[1] === kid.zone ? 1.4 : 0.15;
                    return w;
                });
                const total = weights.reduce((s, w) => s + w, 0);
                const probs = Object.fromEntries(actions.map((a, i) => [a, weights[i] / total]));
                let r = rand() * total;
                let action = actions.at(-1);
                for (const [i, a] of actions.entries()) {
                    r -= weights[i];
                    if (r <= 0) {
                        action = a;
                        break;
                    }
                }
                out[kid.id] = { action, probs };
            }
            return out;
        },
        async speak(world, events) {
            const out = {};
            for (const e of events) {
                const kid = kidById(world, e.kid);
                const verb = (e.copied ? "copy" : e.verb).split("_")[0];
                const n = Math.floor(rand() * 100);
                if (e.verb === "make_rule") out[kid.id] = pick(RULES, n);
                else
                    out[kid.id] = pick(SAYINGS[verb] ?? SAYINGS.go, n)
                        .replace("{t}", kidById(world, e.target)?.name ?? "everyone")
                        .replace("{o}", e.object === "hop" ? "hopscotch" : (e.object ?? "thing"));
            }
            return out;
        },
        async designRoom(world) {
            const used = new Set(world.rooms.map((r) => r.name));
            const room = PRESET_ROOMS.find((r) => !used.has(r.name)) ?? PRESET_ROOMS[0];
            return { ...room, look: "" };
        },
        async paint() {
            return null;
        },
        async judge(_world, found) {
            return found.score >= 3 ? 0.8 : 0.4;
        },
        async write(world, found) {
            const room = world.rooms.find((r) => r.id === found.theme);
            const g = room
                ? {
                      name: `${room.name} Rules`,
                      emoji: room.emoji,
                      rules: room.activities.map((a) => `Everyone takes a turn to ${a.text}.`),
                  }
                : GAMES[found.theme];
            const kidRule = world.rules.at(-1)?.text.replace(/^(New )?[Rr]ule:\s*/, "");
            const extra = kidRule ? [kidRule[0].toUpperCase() + kidRule.slice(1)] : [];
            const inventors = [...new Set(found.events.map((e) => kidById(world, e.kid).name))].slice(0, 3);
            return {
                ...g,
                rules: [...new Set([...g.rules, ...extra])].slice(0, 4),
                inventors,
                spark: `${inventors[0]} started it at minute ${found.events[0].tick + 1}, and the others joined in.`,
            };
        },
    };
}
