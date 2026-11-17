// The playground: plain data plus pure-ish functions that change it.
// Logical canvas is 288x162 (16:9); every coordinate below lives in that space.

export const W = 288;
export const H = 162;
export const RECESS_TICKS = 40;

export const ZONES = {
    wall: { x: 58, y: 54, label: "the ball wall" },
    swings: { x: 238, y: 76, label: "the swings" },
    chalk: { x: 144, y: 92, label: "the chalk court" },
    sandbox: { x: 48, y: 130, label: "the sandbox" },
    tree: { x: 238, y: 140, label: "the big tree" },
    field: { x: 144, y: 140, label: "the open grass" },
};

// Small per-kid offsets so four kids in one zone do not stand on each other.
const SPREAD = [
    [-19, -6],
    [18, -8],
    [-8, 9],
    [12, 10],
];

export const KIDS = [
    {
        id: "juno",
        name: "Juno",
        personality:
            "bold and bossy in a fun way, loves inventing rules and keeping score",
        style: "pigtails",
        colors: {
            skin: "#f6c9a4",
            hair: "#3d2a52",
            shirt: "#ff6f91",
            pants: "#4b5bd6",
            extra: "#ffd23f",
        },
    },
    {
        id: "ravi",
        name: "Ravi",
        personality:
            "a curious builder who loves digging, making things and asking why",
        style: "spiky",
        colors: {
            skin: "#c08259",
            hair: "#1f1b2e",
            shirt: "#2ec4a6",
            pants: "#2e3d6b",
            extra: "#ff9f1c",
        },
    },
    {
        id: "mia",
        name: "Mia",
        personality:
            "a dreamy artist who draws on everything and turns games into stories",
        style: "bun",
        colors: {
            skin: "#ffdcc2",
            hair: "#f0932b",
            shirt: "#ffd23f",
            pants: "#7b5ce1",
            extra: "#ff6f91",
        },
    },
    {
        id: "toby",
        name: "Toby",
        personality:
            "shy at first, likes watching and copying, warms up when someone invites him",
        style: "cap",
        colors: {
            skin: "#eab48d",
            hair: "#7a4b2f",
            shirt: "#8fd16a",
            pants: "#5a4535",
            extra: "#3fa7ff",
        },
    },
];

const SOLO_ACTIONS = {
    go_wall: "walk over to the ball wall",
    go_swings: "walk over to the swings",
    go_chalk: "walk over to the chalk court",
    go_sandbox: "walk over to the sandbox",
    go_tree: "walk over to the big tree",
    go_field: "wander onto the open grass",
    kick_ball: "kick the ball (to someone or against the wall)",
    draw_chalk: "draw something with chalk on the court",
    dig_sand: "dig and build in the sandbox",
    swing: "swing on the swings",
    make_rule: "make up a rule for everyone to follow",
    sit_and_watch: "sit down and watch the others",
};

const FRIEND_ACTIONS = {
    invite: (n) => `invite ${n} to play together`,
    copy: (n) => `copy whatever ${n} just did`,
    chase: (n) => `chase ${n}`,
};

export function actionsFor(kid) {
    const out = { ...SOLO_ACTIONS };
    for (const other of KIDS)
        if (other.id !== kid.id)
            for (const [verb, text] of Object.entries(FRIEND_ACTIONS))
                out[`${verb}_${other.id}`] = text(other.name);
    return out;
}

export function newWorld() {
    const kids = KIDS.map((k, i) => {
        const x = 144 + SPREAD[i][0] * 1.4;
        const y = 150 + SPREAD[i][1] * 0.4;
        return {
            ...k,
            x,
            y,
            tx: x,
            ty: y,
            zone: "field",
            history: [],
            probs: null,
            emote: null,
            swinging: false,
        };
    });
    return {
        tick: 0,
        kids,
        ball: { x: 150, y: 128, tx: 150, ty: 128 },
        chalk: [],
        sand: [],
        rules: [],
        log: [],
        invites: {},
        lastGameTick: -99,
    };
}

export const kidById = (world, id) => world.kids.find((k) => k.id === id);

function moveTo(kid, zone, i) {
    const z = ZONES[zone];
    kid.zone = zone;
    kid.tx = z.x + SPREAD[i][0];
    kid.ty = z.y + SPREAD[i][1];
    kid.swinging = false;
}

function nearestZone(x, y) {
    let best = "field";
    let dist = Infinity;
    for (const [name, z] of Object.entries(ZONES)) {
        const d = (z.x - x) ** 2 + (z.y - y) ** 2;
        if (d < dist) [best, dist] = [name, d];
    }
    return best;
}

const CHALK_KINDS = ["hop", "star", "circle", "sun", "heart", "swirl"];
const EMOTES = {
    invite: "♥",
    make_rule: "!",
    swing: "♪",
    sit_and_watch: "…",
    chase: "»",
    copy: "=",
    kick_ball: "★",
    draw_chalk: "✎",
    dig_sand: "⛏",
};

// Apply one chosen action. Returns the log event (without the spoken line).
export function applyAction(world, kid, action, depth = 0) {
    const i = world.kids.indexOf(kid);
    const [head, ...rest] = action.split("_");
    const verb = head in FRIEND_ACTIONS ? head : action;
    const targetId = head in FRIEND_ACTIONS ? rest.join("_") : null;
    const target = targetId ? kidById(world, targetId) : null;
    const event = { tick: world.tick, kid: kid.id, action, verb, target: targetId };

    if (verb.startsWith("go")) moveTo(kid, action.slice(3), i);
    else if (verb === "kick_ball") {
        kid.tx = world.ball.x + (i % 2 ? 6 : -6);
        kid.ty = world.ball.y + 2;
        kid.zone = nearestZone(world.ball.x, world.ball.y);
        const near = world.kids.filter((k) => k !== kid && k.zone === kid.zone);
        const to = near.length ? near[(world.tick + i) % near.length] : null;
        const dest = to ? { x: to.tx, y: to.ty } : ZONES.wall;
        world.ball.tx = dest.x + (to ? 0 : (world.tick % 3) * 8 - 8);
        world.ball.ty = dest.y + (to ? -2 : 4);
        event.target = to ? to.id : "wall";
    } else if (verb === "draw_chalk") {
        if (kid.zone !== "chalk") moveTo(kid, "chalk", i);
        world.chalk.push({
            kind: CHALK_KINDS[(world.chalk.length + i) % CHALK_KINDS.length],
            x: 106 + ((world.chalk.length * 23 + i * 11) % 70),
            y: 70 + ((world.chalk.length * 13 + i * 7) % 36),
            color: kid.colors.extra,
            by: kid.id,
        });
        if (world.chalk.length > 14) world.chalk.shift();
        event.object = world.chalk.at(-1).kind;
    } else if (verb === "dig_sand") {
        if (kid.zone !== "sandbox") moveTo(kid, "sandbox", i);
        const prev = world.sand.find((s) => s.by === kid.id);
        if (prev) prev.h = Math.min(prev.h + 2, 9);
        else
            world.sand.push({
                x: 26 + ((world.sand.length * 17 + i * 9) % 44),
                y: 124 + ((i * 5) % 14),
                h: 3,
                by: kid.id,
            });
    } else if (verb === "swing") {
        if (kid.zone !== "swings") moveTo(kid, "swings", i);
        kid.swinging = true;
    } else if (verb === "invite") {
        kid.tx = target.tx + (kid.tx < target.tx ? -12 : 12);
        kid.ty = target.ty;
        kid.zone = target.zone;
        world.invites[target.id] = kid.id;
    } else if (verb === "chase") {
        kid.tx = target.x + 8;
        kid.ty = target.y + 3;
        kid.zone = target.zone;
        target.chasedBy = kid.id;
    } else if (verb === "copy") {
        const theirs = target.history.at(-1);
        const copyable =
            theirs && !theirs.startsWith("copy") && !theirs.startsWith("invite");
        if (depth === 0 && copyable) {
            const inner = applyAction(world, kid, theirs, 1);
            event.copied = inner.action;
            event.target = targetId;
            event.object = inner.object;
        } else {
            kid.tx = target.tx + 10;
            kid.ty = target.ty + 4;
            kid.zone = target.zone;
        }
    }

    // Someone who was invited and walks into the inviter's zone has joined them.
    const inviter = world.invites[kid.id];
    if (inviter && kidById(world, inviter).zone === kid.zone) {
        event.joined = inviter;
        delete world.invites[kid.id];
    }
    if (depth === 0) {
        kid.history.push(event.copied ?? action);
        if (kid.history.length > 12) kid.history.shift();
        kid.emote = { icon: EMOTES[verb] ?? null, until: performance.now() + 2200 };
    }
    return event;
}

function phrase(world, verb, action, target, object) {
    const name = (id) => kidById(world, id)?.name ?? id;
    switch (verb) {
        case "kick_ball":
            return `kicked the ball ${target === "wall" ? "at the wall" : `to ${name(target)}`}`;
        case "draw_chalk":
            return `drew a chalk ${object === "hop" ? "hopscotch square" : object}`;
        case "dig_sand":
            return "dug in the sandbox";
        case "swing":
            return "swung on the swings";
        case "invite":
            return `invited ${name(target)} to play`;
        case "chase":
            return `chased ${name(target)}`;
        case "copy":
            return `tried to copy ${name(target)}`;
        case "make_rule":
            return "made up a rule";
        case "sit_and_watch":
            return "sat and watched";
        default:
            return `went to ${ZONES[action.slice(3)]?.label ?? "somewhere"}`;
    }
}

export function describeEvent(world, e) {
    const who = kidById(world, e.kid).name;
    if (!e.copied) return `${who} ${phrase(world, e.verb, e.action, e.target, e.object)}`;
    const [head, ...rest] = e.copied.split("_");
    const verb = head in FRIEND_ACTIONS ? head : e.copied;
    const inner = phrase(world, verb, e.copied, rest.join("_") || e.target, e.object);
    return `${who} copied ${kidById(world, e.target).name} and ${inner}`;
}

// The facts a model needs to decide, kept short so calls stay cheap.
export function stateText(world) {
    const lines = [
        `Recess minute ${world.tick + 1} of ${RECESS_TICKS}. No teacher, no task: the kids can do anything or nothing.`,
        `Places: ${Object.values(ZONES)
            .map((z) => z.label)
            .join(", ")}. There is one ball.`,
    ];
    for (const k of world.kids) {
        const recent = k.history.slice(-3).map((a) => a.replaceAll("_", " ")).join(", ");
        lines.push(
            `${k.name} (${k.personality}) is at ${ZONES[k.zone].label}. Recently: ${recent || "nothing yet"}.`,
        );
    }
    if (world.rules.length)
        lines.push(`Rules the kids made up: ${world.rules.map((r) => `"${r.text}" (${kidById(world, r.by).name})`).join("; ")}.`);
    if (world.chalk.length)
        lines.push(`Chalk drawings on the court: ${world.chalk.map((c) => c.kind).join(", ")}.`);
    const pending = Object.entries(world.invites).map(
        ([to, from]) => `${kidById(world, from).name} invited ${kidById(world, to).name}`,
    );
    if (pending.length) lines.push(`Open invitations: ${pending.join("; ")}.`);
    const recentLog = world.log.slice(-8).map((e) => `- ${describeEvent(world, e)}${e.line ? `: "${e.line}"` : ""}`);
    if (recentLog.length) lines.push("What just happened:", ...recentLog);
    return lines.join("\n");
}

// Move kids and the ball toward their targets; returns true while anything moves.
export function step(world, dt) {
    let moving = false;
    const advance = (o, speed) => {
        const dx = o.tx - o.x;
        const dy = o.ty - o.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.5) {
            o.x = o.tx;
            o.y = o.ty;
            return false;
        }
        const s = Math.min(d, speed * dt);
        o.x += (dx / d) * s;
        o.y += (dy / d) * s;
        return true;
    };
    for (const k of world.kids) if (advance(k, 42)) moving = true;
    if (advance(world.ball, 90)) moving = true;
    return moving;
}
