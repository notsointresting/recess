// Spotting play. The paper behind this quest ("Is this machine playing?")
// describes play as self-chosen, rule-bound, repeated with variation and
// social. Counting belongs in code; judging the transcript goes to a model.
import { describeEvent } from "./world.js";

const WINDOW = 10;

export const PLAY_SIGNS = {
    rules: "The kids follow or enforce a rule that nobody required them to have.",
    repetition: "The kids repeat the same activity several times with small variations.",
    turns: "The kids take turns or pass something back and forth.",
    together: "One kid invites or joins another and they do something together.",
};

export function recent(world) {
    return world.log.filter((e) => e.tick > world.tick - WINDOW);
}

// Returns which signs of play the raw event log shows, plus the dominant toy.
export function countSigns(world) {
    const events = recent(world);
    const verbOf = (e) => {
        const a = e.copied ?? e.action;
        return a.startsWith("do_") ? a : a.split("_").slice(0, 2).join("_");
    };
    const counts = {};
    const doers = {};
    for (const e of events) {
        const v = verbOf(e);
        if (v.startsWith("go") || v.startsWith("sit") || v.startsWith("invite") || v === "build") continue;
        counts[v] = (counts[v] ?? 0) + 1;
        doers[v] ??= new Set();
        doers[v].add(e.kid);
    }
    const [topVerb = null, topCount = 0] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
    const kicks = events.filter((e) => verbOf(e) === "kick_ball" && e.target !== "wall");
    const kickers = new Set(kicks.map((e) => e.kid));
    const signs = {
        repetition: topCount >= 4 && doers[topVerb].size >= 2,
        turns: kicks.length >= 3 && kickers.size >= 2,
        together: events.some((e) => e.joined) || events.filter((e) => e.copied).length >= 2,
        rules: world.rules.some((r) => r.tick > world.tick - WINDOW),
    };
    const theme = topVerb?.startsWith("do_")
        ? topVerb.split("_")[1]
        : ({ kick_ball: "ball", draw_chalk: "chalk", dig_sand: "sand", swing: "swings", chase: "chase" }[
              topVerb?.startsWith("chase") ? "chase" : topVerb
          ] ?? "mixed");
    return { signs, score: Object.values(signs).filter(Boolean).length, theme, events };
}

export function transcript(world, events) {
    return events
        .map((e) => `Minute ${e.tick + 1}: ${describeEvent(world, e)}${e.line ? `, saying "${e.line}"` : ""}`)
        .join("\n");
}
