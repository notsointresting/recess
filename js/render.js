// Pixel-art playground and kids, drawn in code (no image assets).
import { H, W } from "./world.js";

export const SCALE = 4; // logical px -> canvas px; keeps text and lines crisp

const INK = "#2b2140";
const BASE = [
    "...oooooo...",
    "..ohhhhhho..",
    ".ohhhhhhhho.",
    ".ohhhhhhhho.",
    ".ohhsssshho.",
    ".ossessesso.",
    ".ossessesso.",
    ".obssssssbo.",
    "..ossmmsso..",
    "...occcco...",
    "..occcccco..",
    ".osccccccso.",
    "..occcccco..",
    "..oppppppo..",
    "..opo..opo..",
    "..oko..oko..",
];
const STRIDE = ["...opoopo...", "...okooko..."];

// Extra pixels per hairstyle: [x, y, code]; negative y sits above the head.
const STYLES = {
    pigtails: [
        ...rect(-2, 2, 3, 5, "o"),
        ...rect(-1, 3, 2, 3, "h"),
        ...rect(11, 2, 3, 5, "o"),
        ...rect(11, 3, 2, 3, "h"),
        [0, 2, "x"],
        [11, 2, "x"],
    ],
    spiky: [
        [3, -1, "o"],
        [4, -1, "h"],
        [5, -1, "h"],
        [6, -1, "h"],
        [7, -1, "h"],
        [8, -1, "o"],
        [4, -2, "o"],
        [6, -2, "o"],
        [7, -2, "o"],
        [5, -2, "h"],
        [5, -3, "o"],
        ...rect(4, 0, 4, 1, "h"),
    ],
    bun: [
        ...rect(4, -3, 4, 1, "o"),
        [3, -2, "o"],
        [8, -2, "o"],
        [3, -1, "o"],
        [8, -1, "o"],
        ...rect(4, -2, 4, 2, "h"),
        ...rect(4, 0, 4, 1, "x"),
    ],
    cap: [
        ...rect(2, 1, 6, 1, "x"),
        ...rect(2, 2, 8, 2, "x"),
        ...rect(7, 4, 4, 1, "x"),
        [11, 4, "o"],
        [6, 2, "w"],
    ],
};

function rect(x, y, w, h, code) {
    const out = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j, code]);
    return out;
}

function palette(kid) {
    const c = kid.colors;
    return {
        o: INK,
        e: INK,
        s: c.skin,
        h: c.hair,
        c: c.shirt,
        p: c.pants,
        x: c.extra,
        b: "#ff8fa3",
        m: "#b8405e",
        k: "#3a3049",
        w: "#ffffff",
    };
}

// Draw a kid with feet at (fx, fy). `size` is logical px per art pixel;
// 1.5 maps to exactly 6 canvas px at SCALE 4, so the art stays crisp.
export function drawKid(ctx, kid, fx, fy, { walking, blink, frame, size = 1.5 }) {
    const pal = palette(kid);
    const snap = (v) => Math.round(v * SCALE) / SCALE;
    const ox = snap(fx - 6 * size);
    const oy = snap(fy - 16 * size);
    ctx.fillStyle = "rgba(43,33,64,.22)";
    ctx.beginPath();
    ctx.ellipse(fx, fy, 6 * size, 2 * size, 0, 0, Math.PI * 2);
    ctx.fill();
    const dot = (x, y, code) => {
        ctx.fillStyle = pal[code];
        ctx.fillRect(ox + x * size, oy + y * size, size, size);
    };
    BASE.forEach((row, y) => {
        const line = walking && frame && y >= 14 ? STRIDE[y - 14] : row;
        for (let x = 0; x < 12; x++) {
            let code = line[x];
            if (code === ".") continue;
            if (code === "e" && blink) code = y === 6 ? "e" : "s";
            dot(x, y, code);
        }
    });
    for (const [x, y, code] of STYLES[kid.style]) dot(x, y, code);
}

function brickWall(ctx) {
    ctx.fillStyle = "#e07a5f";
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = "#c9654c";
    for (let y = 4; y < 34; y += 4)
        for (let x = (y / 4) % 2 ? 0 : 4; x < W; x += 8) ctx.fillRect(x, y, 1, 4);
    for (let y = 4; y < 34; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = "#8c3f3a";
    ctx.fillRect(0, 0, W, 4);
    ctx.fillStyle = "#6f2f2e";
    ctx.fillRect(0, 33, W, 2);
    // Windows
    for (const wx of [92, 176, 210, 244]) {
        ctx.fillStyle = "#fff4d6";
        ctx.fillRect(wx - 1, 9, 20, 15);
        ctx.fillStyle = "#9fd8ff";
        ctx.fillRect(wx, 10, 18, 13);
        ctx.fillStyle = "#c7ecff";
        ctx.fillRect(wx + 2, 11, 4, 6);
        ctx.fillStyle = "#fff4d6";
        ctx.fillRect(wx + 8, 10, 1, 13);
        ctx.fillRect(wx, 16, 18, 1);
    }
    // Door
    ctx.fillStyle = "#5b3a29";
    ctx.fillRect(134, 13, 20, 21);
    ctx.fillStyle = "#7a5038";
    ctx.fillRect(136, 15, 7, 19);
    ctx.fillRect(145, 15, 7, 19);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(142, 24, 1, 2);
    // Ball-wall target
    ctx.strokeStyle = "#fff4d6";
    ctx.lineWidth = 1;
    for (const r of [9, 5]) {
        ctx.beginPath();
        ctx.arc(58, 20, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.fillStyle = "#fff4d6";
    ctx.fillRect(57, 19, 2, 2);
}

function grass(ctx) {
    for (let y = 34; y < H; y += 6)
        for (let x = 0; x < W; x += 6) {
            ctx.fillStyle = (x / 6 + y / 6) % 2 ? "#93d067" : "#8ac75f";
            ctx.fillRect(x, y, 6, 6);
        }
    // Flowers and tufts, placed deterministically so the scene is stable.
    const flowers = ["#fff4d6", "#ffd23f", "#ff8fa3"];
    for (let i = 0; i < 46; i++) {
        const x = (i * 97) % W;
        const y = 38 + ((i * 53) % (H - 40));
        if (x > 96 && x < 192 && y > 60 && y < 118) continue;
        ctx.fillStyle = i % 3 ? "#6fae4c" : flowers[i % flowers.length];
        ctx.fillRect(x, y, 1, 1);
        if (i % 3 === 0) {
            ctx.fillStyle = "#6fae4c";
            ctx.fillRect(x, y + 1, 1, 1);
        }
    }
    // Path from the door
    ctx.fillStyle = "#ead7a4";
    ctx.fillRect(134, 34, 20, 30);
    ctx.fillStyle = "#dcc58c";
    for (let y = 36; y < 64; y += 5) ctx.fillRect(136 + (y % 3) * 4, y, 3, 1);
}

function court(ctx) {
    ctx.fillStyle = "#7d8197";
    roundRect(ctx, 98, 62, 92, 54, 5);
    ctx.fillStyle = "#8f93a8";
    roundRect(ctx, 100, 64, 88, 50, 4);
    ctx.fillStyle = "#9a9eb2";
    for (let i = 0; i < 40; i++) ctx.fillRect(101 + ((i * 37) % 86), 65 + ((i * 19) % 48), 1, 1);
}

function sandbox(ctx) {
    ctx.fillStyle = "#9b6338";
    ctx.fillRect(14, 110, 70, 44);
    ctx.fillStyle = "#b9804c";
    ctx.fillRect(15, 111, 68, 2);
    ctx.fillStyle = "#f4d68d";
    ctx.fillRect(17, 114, 64, 37);
    ctx.fillStyle = "#e8c674";
    for (let i = 0; i < 30; i++) ctx.fillRect(18 + ((i * 29) % 62), 115 + ((i * 17) % 34), 1, 1);
    // Bucket and spade
    ctx.fillStyle = "#ff6f91";
    ctx.fillRect(72, 142, 5, 5);
    ctx.fillStyle = "#d94f73";
    ctx.fillRect(72, 142, 5, 1);
    ctx.fillStyle = "#3fa7ff";
    ctx.fillRect(66, 146, 1, 4);
    ctx.fillRect(65, 150, 3, 2);
}

function swings(ctx) {
    ctx.fillStyle = "#6b4f3a";
    ctx.fillRect(214, 40, 3, 34);
    ctx.fillRect(262, 40, 3, 34);
    ctx.fillStyle = "#8a6748";
    ctx.fillRect(212, 39, 55, 3);
    ctx.fillStyle = "#bfb6a8";
    for (const x of [226, 231, 245, 250]) ctx.fillRect(x, 42, 1, 24);
    ctx.fillStyle = "#ff6f91";
    ctx.fillRect(224, 66, 9, 2);
    ctx.fillStyle = "#3fa7ff";
    ctx.fillRect(243, 66, 9, 2);
}

function tree(ctx) {
    ctx.fillStyle = "rgba(43,33,64,.15)";
    ctx.beginPath();
    ctx.ellipse(252, 130, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a5038";
    ctx.fillRect(248, 112, 7, 18);
    ctx.fillStyle = "#5c3b28";
    ctx.fillRect(248, 112, 2, 18);
    for (const [x, y, r, c] of [
        [252, 104, 17, "#4f9d4a"],
        [240, 108, 11, "#4f9d4a"],
        [264, 108, 11, "#4f9d4a"],
        [252, 100, 13, "#63b55a"],
        [245, 104, 7, "#7ccc6c"],
    ]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = "#ff6f91";
    for (const [x, y] of [
        [244, 98],
        [258, 106],
        [252, 92],
        [264, 100],
    ])
        ctx.fillRect(x, y, 2, 2);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
}

export function drawBackground(canvas) {
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.scale(SCALE, SCALE);
    grass(ctx);
    brickWall(ctx);
    court(ctx);
    sandbox(ctx);
    swings(ctx);
    tree(ctx);
    return canvas;
}

function chalkMark(ctx, m) {
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 0.9;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    const { x, y } = m;
    if (m.kind === "hop") {
        for (let i = 0; i < 3; i++) ctx.rect(x - 3, y - 9 + i * 6, 6, 6);
    } else if (m.kind === "star") {
        for (let i = 0; i <= 10; i++) {
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            const r = i % 2 ? 2.2 : 5;
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
    } else if (m.kind === "circle") {
        ctx.arc(x, y, 5, 0, Math.PI * 2);
    } else if (m.kind === "sun") {
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            ctx.moveTo(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5);
            ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
        }
    } else if (m.kind === "heart") {
        ctx.moveTo(x, y + 4);
        ctx.bezierCurveTo(x - 7, y - 1, x - 3, y - 6, x, y - 2);
        ctx.bezierCurveTo(x + 3, y - 6, x + 7, y - 1, x, y + 4);
    } else {
        for (let i = 0; i < 26; i++) {
            const a = i * 0.5;
            ctx.lineTo(x + Math.cos(a) * a * 0.45, y + Math.sin(a) * a * 0.45);
        }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function sandCastle(ctx, s) {
    ctx.fillStyle = "#d9b25e";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (s.h < 4) return;
    ctx.fillStyle = "#e6c06a";
    ctx.fillRect(s.x - 4, s.y - s.h, 8, s.h);
    ctx.fillStyle = "#cfa34f";
    ctx.fillRect(s.x - 4, s.y - s.h, 8, 1);
    for (const dx of [-4, -1, 2]) ctx.fillRect(s.x + dx, s.y - s.h - 2, 2, 2);
    if (s.h >= 7) {
        ctx.fillStyle = "#6b4f3a";
        ctx.fillRect(s.x, s.y - s.h - 7, 1, 5);
        ctx.fillStyle = "#ff6f91";
        ctx.fillRect(s.x + 1, s.y - s.h - 7, 3, 2);
    }
}

function ball(ctx, b) {
    ctx.fillStyle = "rgba(43,33,64,.25)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 3, 3, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6f91";
    ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
}

function bell(ctx, ringing, t) {
    const a = ringing ? Math.sin(t * 22) * 0.5 : 0;
    ctx.save();
    ctx.translate(144, 2);
    ctx.rotate(a);
    ctx.fillStyle = "#8a6748";
    ctx.fillRect(-1, 0, 2, 2);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(-5, 9);
    ctx.quadraticCurveTo(-5, 1, 0, 1);
    ctx.quadraticCurveTo(5, 1, 5, 9);
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.moveTo(-4, 8.5);
    ctx.quadraticCurveTo(-4, 2, 0, 2);
    ctx.quadraticCurveTo(4, 2, 4, 8.5);
    ctx.fill();
    ctx.fillStyle = "#fff4d6";
    ctx.fillRect(-2, 3, 1, 3);
    ctx.restore();
}

function emote(ctx, x, y, icon) {
    ctx.fillStyle = "#fffaf0";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.roundRect(x - 5, y - 9, 10, 9, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = "bold 7px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x, y - 4.2);
}

export function render(ctx, bg, world, t, fx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    for (const m of world.chalk) chalkMark(ctx, m);
    for (const s of world.sand) sandCastle(ctx, s);
    bell(ctx, fx.ringingUntil > t * 1000, t);

    const now = performance.now();
    const drawables = [
        { y: world.ball.y + 1, draw: () => ball(ctx, world.ball) },
        ...world.kids.map((kid, i) => ({
            y: kid.y,
            draw: () => {
                const walking = Math.hypot(kid.tx - kid.x, kid.ty - kid.y) > 0.6;
                const sway = kid.swinging && !walking ? Math.sin(t * 3 + i) * 4 : 0;
                const bob = walking ? Math.floor(t * 10) % 2 : Math.floor(t * 1.6 + i) % 2 ? 0 : 0.5;
                const x = kid.x + sway;
                const y = kid.y - bob - (kid.swinging && !walking ? 8 : 0);
                drawKid(ctx, kid, x, y, {
                    walking,
                    frame: Math.floor(t * 8 + i) % 2,
                    blink: (t + i * 0.9) % 3.4 < 0.14,
                });
                if (kid.emote?.icon && kid.emote.until > now) emote(ctx, x + 10, y - 22, kid.emote.icon);
            },
        })),
    ].sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Confetti for newly invented games
    for (const p of fx.particles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
    }
}

export function burst(fx, x, y) {
    const colors = ["#ff6f91", "#ffd23f", "#2ec4a6", "#3fa7ff", "#7b5ce1"];
    for (let i = 0; i < 46; i++)
        fx.particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 70,
            vy: -Math.random() * 70 - 20,
            life: 1.4 + Math.random(),
            color: colors[i % colors.length],
        });
}

export function stepParticles(fx, dt) {
    for (const p of fx.particles) {
        p.vy += 90 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
}

// A tiny portrait for cards and the cast list.
export function portrait(kid, size = 48) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const s = size / 20;
    ctx.scale(s, s);
    drawKid(ctx, kid, 10, 18.5, { walking: false, blink: false, frame: 0, size: 1 });
    return c;
}
