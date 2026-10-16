/* Verify admin PIN server-side. The PIN lives in Vercel env var ADMIN_PIN,
   never in the repo or the page. */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const correctPin = process.env.ADMIN_PIN || "1234";
  const { pin } = req.body || {};
  if (pin === correctPin) {
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ ok: false });
}
