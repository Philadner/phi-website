// /api/stats.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const authHeader = (bearer?: string): Record<string, string> =>
  bearer ? { Authorization: `Bearer ${bearer}` } : {};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const VERCEL_TOKEN  = process.env.VERCEL_TOKEN;
    const VERCEL_PROJECT = process.env.VERCEL_PROJECT;   // e.g. "phi-website"
    const GITHUB_REPO   = process.env.GITHUB_REPO;       // e.g. "Philadner/phi-website"
    const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;      // optional (rate limit)

    // Validate required envs up front
    const missing: string[] = [];
    if (!VERCEL_TOKEN)  missing.push("VERCEL_TOKEN");
    if (!VERCEL_PROJECT) missing.push("VERCEL_PROJECT");
    if (missing.length) {
      return res.status(200).json({ error: `Missing env vars: ${missing.join(", ")}` });
    }

    // --- Vercel: deployments
    const vRes = await fetch(
      `https://api.vercel.com/v6/deployments?app=${encodeURIComponent(VERCEL_PROJECT!)}&limit=20`,
      { headers: authHeader(VERCEL_TOKEN!) }
    );
    if (!vRes.ok) {
      const txt = await vRes.text();
      return res.status(200).json({ error: `Vercel API ${vRes.status}: ${txt.slice(0,200)}` });
    }
    const vd = await vRes.json();
    const deployments = (vd?.deployments ?? []).map((d: any) => ({
      id: d.uid, createdAt: d.createdAt, url: d.url, state: d.state, target: d.target
    }));
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    const deploymentsToday = deployments.filter(
      (d:any) => d.state === "READY" && d.createdAt >= startOfToday.getTime()
    ).length;
    const lastReady = deployments.find((d:any) => d.state === "READY");

    // --- GitHub: latest commit on labs (optional)
    let lastCommitMessage: string | null = null;
    let lastCommitAt: string | null = null;
    const branch = "labs";

    if (GITHUB_REPO) {
      const gRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/commits?sha=${branch}&per_page=1`,
        { headers: { ...authHeader(GITHUB_TOKEN), "User-Agent": "phi-stats" } }
      );
      if (!gRes.ok) {
        const txt = await gRes.text();
        // Still return JSON, just include the error
        return res.status(200).json({
          deploymentsToday,
          lastDeploymentAt: lastReady ? new Date(lastReady.createdAt).toISOString() : null,
          lastDeploymentUrl: lastReady?.url ?? null,
          lastCommitMessage, lastCommitAt, branch,
          now: new Date().toISOString(),
          githubError: `GitHub API ${gRes.status}: ${txt.slice(0,200)}`
        });
      }
      const gh = await gRes.json();
      if (Array.isArray(gh) && gh[0]) {
        lastCommitMessage = gh[0].commit?.message ?? null;
        lastCommitAt = gh[0].commit?.committer?.date ?? gh[0].commit?.author?.date ?? null;
      }
    }

    return res.status(200).json({
      deploymentsToday,
      lastDeploymentAt: lastReady ? new Date(lastReady.createdAt).toISOString() : null,
      lastDeploymentUrl: lastReady?.url ?? null,
      lastCommitMessage, lastCommitAt, branch,
      now: new Date().toISOString(),
    });
  } catch (e:any) {
    console.error("stats error:", e);
    return res.status(200).json({ error: String(e?.message ?? e) }); // never crash
  }
}
