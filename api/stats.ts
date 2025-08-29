// /api/stats.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* ----------------------------- helpers ----------------------------- */

const bearer = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : {});

const ghHeaders = (token?: string) => ({
  ...(token ? { Authorization: `token ${token}` } : {}),
  "User-Agent": "phi-stats",
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  const text = await res.text(); // keep raw for better error detail
  if (!res.ok) {
    const rateLeft = res.headers.get("x-ratelimit-remaining");
    const msg = text.slice(0, 200);
    throw new Error(`${url} -> ${res.status} ${res.statusText} :: ${msg} (rateLeft=${rateLeft ?? "?"})`);
  }
  return JSON.parse(text);
}

/* ----------------------------- env ----------------------------- */

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT = process.env.VERCEL_PROJECT; // e.g. "phi-website"

const GITHUB_REPO = process.env.GITHUB_REPO;       // e.g. "Philadner/phi-website"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;     // needs Contents:Read (or classic PAT repo scope)
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "labs";

/* ----------------------------- cache ----------------------------- */

type CacheShape = {
  json: any;
  at: number;
};
let _cache: CacheShape | null = null;
const CACHE_MS = 60_000; // 60s

/* ----------------------------- handler ----------------------------- */

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Fast path: serve warm cache
    if (_cache && Date.now() - _cache.at < CACHE_MS) {
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
      return res.status(200).json(_cache.json);
    }

    // Validate required envs for the Vercel section
    const missing: string[] = [];
    if (!VERCEL_TOKEN) missing.push("VERCEL_TOKEN");
    if (!VERCEL_PROJECT) missing.push("VERCEL_PROJECT");
    if (missing.length) {
      const out = { error: `Missing env vars: ${missing.join(", ")}`, now: new Date().toISOString() };
      _cache = { json: out, at: Date.now() };
      return res.status(200).json(out);
    }

    /* ----------------------------- Vercel deployments ----------------------------- */
    const bearer = (token?: string): Record<string, string> =>
      token ? { Authorization: `Bearer ${token}` } : {};

    const deploymentsData = await fetchJson(
      `https://api.vercel.com/v6/deployments?app=${encodeURIComponent(VERCEL_PROJECT!)}&limit=20`,
      bearer(VERCEL_TOKEN!)
    );

    const deployments = Array.isArray(deploymentsData?.deployments)
      ? deploymentsData.deployments.map((d: any) => ({
          id: d.uid,
          createdAt: d.createdAt as number,
          url: d.url as string,
          state: d.state as string,
          target: d.target as string | undefined, // production / preview
        }))
      : [];

    // newest first just in case
    deployments.sort((a, b) => b.createdAt - a.createdAt);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const deploymentsToday = deployments.filter(
      (d) => d.state === "READY" && d.createdAt >= startOfToday.getTime()
    ).length;

    const lastReady = deployments.find((d) => d.state === "READY");
    const vercel = {
      deploymentsToday,
      lastDeploymentAt: lastReady ? new Date(lastReady.createdAt).toISOString() : null,
      lastDeploymentUrl: lastReady?.url ?? null,
      lastDeploymentTarget: lastReady?.target ?? null,
    };

    /* ----------------------------- GitHub commit (optional) ----------------------------- */

    let githubError: string | undefined;
    let github:
      | {
          repo: string | null;
          branch: string | null;
          lastCommitMessage: string | null;
          lastCommitAt: string | null;
          source: "branches" | "commits" | null;
        }
      | undefined;

    if (GITHUB_REPO && GITHUB_TOKEN) {
      github = {
        repo: GITHUB_REPO,
        branch: GITHUB_BRANCH,
        lastCommitMessage: null,
        lastCommitAt: null,
        source: null,
      };

      try {
        // Preferred: branches endpoint (fast, minimal)
        const b = await fetchJson(
          `https://api.github.com/repos/${GITHUB_REPO}/branches/${encodeURIComponent(GITHUB_BRANCH)}`,
          ghHeaders(GITHUB_TOKEN)
        );
        const commit = b?.commit?.commit;
        github.lastCommitMessage = commit?.message ?? null;
        github.lastCommitAt = commit?.committer?.date ?? commit?.author?.date ?? null;
        github.source = "branches";
      } catch (e: any) {
        githubError = String(e?.message ?? e);
        // Fallback: commits endpoint scoped to branch
        try {
          const c = await fetchJson(
            `https://api.github.com/repos/${GITHUB_REPO}/commits?sha=${encodeURIComponent(GITHUB_BRANCH)}&per_page=1`,
            ghHeaders(GITHUB_TOKEN)
          );
          const top = Array.isArray(c) ? c[0] : undefined;
          github.lastCommitMessage = top?.commit?.message ?? null;
          github.lastCommitAt = top?.commit?.committer?.date ?? top?.commit?.author?.date ?? null;
          github.source = "commits";
        } catch (e2: any) {
          githubError += ` | ${String(e2?.message ?? e2)}`;
        }
      }
    } else {
      // Provide a gentle hint if GH info was omitted
      if (GITHUB_REPO && !GITHUB_TOKEN) {
        githubError = "GITHUB_TOKEN missing; supply a PAT with Contents:read (or classic PAT with repo scope).";
      }
    }

    /* ----------------------------- response ----------------------------- */

    const out = {
      now: new Date().toISOString(),
      vercel,
      github,
      githubError,
    };

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    _cache = { json: out, at: Date.now() };
    return res.status(200).json(out);
  } catch (err: any) {
    const out = { error: String(err?.message ?? err), now: new Date().toISOString() };
    // still cache the error briefly to avoid thundering herd
    _cache = { json: out, at: Date.now() };
    return res.status(200).json(out);
  }
}
