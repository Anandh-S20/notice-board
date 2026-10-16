/* Vercel serverless function: syncs the notice board config to GitHub.
   The admin page POSTs the config here; this function commits it to config.json.
   The GitHub token lives in the VERCEL env var GITHUB_TOKEN (never in the page). */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: "GITHUB_TOKEN not configured" });

  const cfg = req.body;
  if (!cfg || typeof cfg !== "object" || !Array.isArray(cfg.notices)) {
    return res.status(400).json({ error: "Invalid config" });
  }
  /* Never store the PIN in the public repo — it lives in ADMIN_PIN env var only */
  if ("pin" in cfg) delete cfg.pin;

  const repo = "Anandh-S20/notice-board";
  const path = "config.json";
  const apiBase = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "notice-board-sync"
  };

  try {
    /* Get current SHA */
    let sha = null;
    const getRes = await fetch(apiBase, { headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "User-Agent": "notice-board-sync" } });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }

    const content = Buffer.from(JSON.stringify(cfg, null, 2)).toString("base64");
    const payload = { message: "Sync config from admin", content, branch: "main" };
    if (sha) payload.sha = sha;

    const putRes = await fetch(apiBase, { method: "PUT", headers, body: JSON.stringify(payload) });
    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(putRes.status).json({ error: "GitHub commit failed", detail: err });
    }
    const result = await putRes.json();
    /* Purge CDN caches so the display picks up the change immediately */
    try {
      await fetch("https://purge.jsdelivr.net/gh/Anandh-S20/notice-board@main/config.json");
    } catch (e) { /* purge failure shouldn't fail the sync */ }
    return res.status(200).json({ ok: true, sha: result.commit.sha.substring(0, 7) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
