// /api/append.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { phrase } = (req.body as any) || {};
    if (!phrase || !String(phrase).trim()) {
      return res.status(400).json({ error: "Phrase required" });
    }
    if (!process.env.SITE_TOKEN) {
      return res.status(500).json({ error: "SITE_TOKEN missing" });
    }

    const workerRes = await fetch("https://api.phi.me.uk/kv/phrases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SITE_TOKEN}`,
      },
      body: JSON.stringify({ phrase }),
    });

    const text = await workerRes.text();
    let body: any;
    try { body = text ? JSON.parse(text) : {}; } catch { body = { ok: true }; }
    return res.status(workerRes.status).json(body);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
