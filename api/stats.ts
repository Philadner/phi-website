// /api/stats.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const authHeader = (bearer?: string): Record<string, string> =>
  bearer ? { Authorization: `Bearer ${bearer}` } : {};

// GitHub prefers PATs sent as `token <PAT>`; also include modern headers
const githubHeaders = (token?: string): Record<string, string> => ({
  ...(token ? { Authorization: `token ${token}` } : {}),
  "User-Agent": "phi-stats",
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

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

    // --- GitHub: latest commit on labs (optional, must be labs)
    let lastCommitMessage: string | null = null;
    let lastCommitAt: string | null = null;
    const branch = process.env.GITHUB_BRANCH || "labs";
    let githubError: string | null = null;

    if (GITHUB_REPO) {
      // Try branches endpoint first
      const branchUrl = `https://api.github.com/repos/${GITHUB_REPO}/branches/${encodeURIComponent(branch)}`;
      let gRes = await fetch(branchUrl, { headers: githubHeaders(GITHUB_TOKEN) });
      if (gRes.ok) {
        const gh = await gRes.json();
        const commit = gh?.commit?.commit;
        if (commit) {
          lastCommitMessage = commit.message ?? null;
          lastCommitAt = commit?.committer?.date ?? commit?.author?.date ?? null;
        }
      } else {
        const txt = await gRes.text();
        githubError = `Branches API ${gRes.status}: ${txt.slice(0,200)}`;
        // Fallback: commits endpoint filtered to this branch (still 'labs', not main)
        const commitsUrl = `https://api.github.com/repos/${GITHUB_REPO}/commits?sha=${encodeURIComponent(branch)}&per_page=1`;
        gRes = await fetch(commitsUrl, { headers: githubHeaders(GITHUB_TOKEN) });
        if (gRes.ok) {
          const gh = await gRes.json();
          if (Array.isArray(gh) && gh[0]) {
            lastCommitMessage = gh[0].commit?.message ?? null;
            lastCommitAt = gh[0].commit?.committer?.date ?? gh[0].commit?.author?.date ?? null;
            // Keep previous githubError for visibility but still return data
          }
        } else {
          const txt2 = await gRes.text();
          githubError += ` | Commits API ${gRes.status}: ${txt2.slice(0,200)}`;
        }
      }
    }

    return res.status(200).json({
      deploymentsToday,
      lastDeploymentAt: lastReady ? new Date(lastReady.createdAt).toISOString() : null,
      lastDeploymentUrl: lastReady?.url ?? null,
      lastCommitMessage, lastCommitAt, branch,
      now: new Date().toISOString(),
      githubError: githubError ?? undefined,
    });
  } catch (e:any) {
    console.error("stats error:", e);
    return res.status(200).json({ error: String(e?.message ?? e) }); // never crash
  }
}
