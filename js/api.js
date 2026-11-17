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

// Generate a picture and shrink it to a small pixel-art tile (data URL), so it
// matches the playground and fits in localStorage.
export async function paint(key, model, prompt, width = 192, height = 162) {
    const url = new URL(`${GEN}/image/${encodeURIComponent(prompt)}`);
    url.search = new URLSearchParams({
        model,
        width: "384",
        height: "320",
        seed: String(Math.floor(Math.random() * 1e9)),
    }).toString();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw Object.assign(new Error(`${res.status}: image failed`), { status: res.status });
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/png");
}
