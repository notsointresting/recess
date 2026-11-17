// Thin wrappers around the Pollinations API. The key is the visitor's own sk_
// key from Pollinations Connect, so every call spends their Pollen, not ours.
const GEN = "https://gen.pollinations.ai";

async function post(key, path, body) {
    const res = await fetch(`${GEN}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
        let message = text.slice(0, 300);
        try {
            const data = JSON.parse(text);
            message = data.error?.message ?? data.message ?? message;
        } catch {}
        const error = new Error(`${res.status}: ${message}`);
        error.status = res.status;
        throw error;
    }
    return JSON.parse(text);
}

// Typed decisions: calibrated choice + probabilities per question.
export function decide(key, model, state, questions) {
    return post(key, "/alpha/decisions", { model, state, questions });
}

export async function chat(key, model, messages) {
    const data = await post(key, "/v1/chat/completions", { model, messages });
    return data.choices?.[0]?.message?.content ?? "";
}

// Models answer "JSON" in many wrappings; take the first {...} block.
export function parseJson(text) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("The model did not answer with JSON");
    return JSON.parse(match[0]);
}
