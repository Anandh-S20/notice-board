/* Vercel serverless function: uploads a video file to the GitHub repo
   and returns its public URL. The admin page POSTs { filename, content }
   where content is a base64 data URL. Keeps videos out of config.json. */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: "GITHUB_TOKEN not configured" });

  const { filename, content } = req.body || {};
  if (!filename || !content) return res.status(400).json({ error: "filename and content required" });

  /* Sanitize filename: keep it URL-safe and inside /videos/ */
  const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  if (!/\.(mp4|webm|mov)$/i.test(safe)) return res.status(400).json({ error: "Only mp4/webm/mov allowed" });
  const repoPath = "videos/" + Date.now() + "_" + safe;

  /* Strip data-URL prefix if present */
  const b64 = String(content).replace(/^data:video\/\w+;base64,/, "");

  const repo = "Anandh-S20/notice-board";
  const apiBase = `https://api.github.com/repos/${repo}/contents/${repoPath}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "notice-board-upload"
  };

  try {
    const putRes = await fetch(apiBase, {
      method: "PUT", headers,
      body: JSON.stringify({ message: "Upload video " + safe, content: b64, branch: "main" })
    });
    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(putRes.status).json({ error: "GitHub upload failed", detail: err.slice(0, 200) });
    }
    /* Purge CDN so the video URL works immediately */
    try {
      await fetch("https://purge.jsdelivr.net/gh/Anandh-S20/notice-board@main/" + repoPath);
    } catch (e) {}
    return res.status(200).json({
      ok: true,
      url: "https://anandh-s20.github.io/notice-board/" + repoPath
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
