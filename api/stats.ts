// /api/stats.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// tiny helper
const h = (bearer?: string) =>
  bearer ? { Authorization: `Bearer ${bearer}` } : {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN!;
    const VERCEL_PROJECT = process.env.VERCEL_PROJECT!; // your vercel project “app” name/slug
    const GITHUB_REPO = process.env.GITHUB_REPO;        // e.g. "phil82/phi.me.uk"
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    // --- Vercel: deployments (latest + today count)
    const h = (bearer?: string): Record<string, string> =>
      bearer ? { Authorization: `Bearer ${bearer}` } : {};    
    const vd = await fetch(
      `https://api.vercel.com/v13/deployments?app=${encodeURIComponent(VERCEL_PROJECT)}&limit=20`,
      { headers: h(VERCEL_TOKEN) }
    ).then(r => r.json());

    const deployments = (vd?.deployments ?? []).map((d: any) => ({
      id: d.uid,
      createdAt: d.createdAt,
      url: d.url,
      meta: d.meta,
      state: d.state,
      target: d.target, // "production" | "preview"
    }));

    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const deploymentsToday = deployments.filter(
      (d: any) => d.state === 'READY' && d.createdAt >= startOfToday.getTime()
    ).length;

    const lastReady = deployments.find((d: any) => d.state === 'READY');
    const lastDeploymentAt = lastReady ? new Date(lastReady.createdAt).toISOString() : null;

    // --- GitHub: latest commit on labs
    let lastCommitMessage: string | null = null;
    let lastCommitAt: string | null = null;
    let branch = "labs";

    if (GITHUB_REPO) {
      const gh = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/commits?sha=${branch}&per_page=1`,
        { headers: { ...h(GITHUB_TOKEN), 'User-Agent': 'phi-stats' } }
      ).then(r => r.json());

      if (Array.isArray(gh) && gh[0]) {
        lastCommitMessage = gh[0].commit?.message ?? null;
        lastCommitAt = gh[0].commit?.committer?.date ?? gh[0].commit?.author?.date ?? null;
      }
    }

    res.status(200).json({
      deploymentsToday,
      lastDeploymentAt,
      lastDeploymentUrl: lastReady?.url ?? null,
      lastCommitMessage,
      lastCommitAt,
      branch,
      now: new Date(now).toISOString(),
    });
  } catch (e:any) {
    res.status(500).json({ error: e?.message ?? 'unknown error' });
  }
}
