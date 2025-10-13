// /api/commits.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
    committer?: { name?: string; date?: string };
  };
  html_url: string;
  author?: { login?: string };
  committer?: { login?: string };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPO; // "owner/repo"
  if (!token || !repoFull || !repoFull.includes("/")) {
    res.status(500).json({ error: "Missing or invalid GITHUB_TOKEN / GITHUB_REPO (expected owner/repo)" });
    return;
  }
  const [owner, repo] = repoFull.split("/");

  const {
    sha = "labs",
    per_page = "50",
    page = "1",
    include_merges = "false",
    since, // optional ISO date
  } = req.query as Record<string, string>;

  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
  url.searchParams.set("sha", sha);
  url.searchParams.set("per_page", per_page);
  url.searchParams.set("page", page);
  if (since) url.searchParams.set("since", since);

  const gh = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "phi.me.uk",
    },
  });

  if (!gh.ok) {
    const text = await gh.text();
    res.status(gh.status).json({ error: "GitHub API error", details: text });
    return;
  }

  const data = (await gh.json()) as GitHubCommit[];

  const hideMerges = include_merges !== "true";
  const boring = /^(chore|ci|docs|style|refactor|test)(\(|:)/i; // optional: hide noise
  const mapped = data
    .filter((c) => (hideMerges ? !/^merge/i.test(c.commit.message) : true))
    // .filter((c) => !boring.test(c.commit.message)) // uncomment if you want to hide “boring” commits
    .map((c) => {
      const [title, ...rest] = c.commit.message.split("\n");
      const body = rest.join("\n").trim();
      return {
        sha: c.sha,
        title: title.trim(),
        body,
        url: c.html_url,
        author: c.commit.author?.name ?? c.author?.login ?? "unknown",
        date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
      };
    });

  // Cache at edge for 10 min; allow stale for a day while revalidating
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");
  res.status(200).json(mapped);
}
