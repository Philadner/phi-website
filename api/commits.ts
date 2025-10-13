import type { VercelRequest, VercelResponse } from "@vercel/node";

type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  html_url: string;
  author?: { login?: string };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPO; // e.g. "Philadner/phi-website"
  if (!token || !repoFull || !repoFull.includes("/")) {
    return res.status(500).json({ error: "Missing GITHUB_TOKEN or GITHUB_REPO" });
  }

  const [owner, repo] = repoFull.split("/");
  const branch = (req.query.sha as string) || "labs";
  const includeMerges = req.query.include_merges === "true";

  const allCommits: any[] = [];
  let page = 1;
  const per_page = 100;

  try {
    while (true) {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
      url.searchParams.set("sha", branch);
      url.searchParams.set("per_page", String(per_page));
      url.searchParams.set("page", String(page));

      const gh = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "phi.me.uk",
        },
      });

      if (!gh.ok) {
        const text = await gh.text();
        return res.status(gh.status).json({ error: "GitHub API error", details: text });
      }

      const data = (await gh.json()) as GitHubCommit[];
      if (!data.length) break; // done when empty

      allCommits.push(...data);
      page++;
    }

    const mapped = allCommits
      .filter((c) => (includeMerges ? true : !/^merge/i.test(c.commit.message)))
      .map((c) => {
        const [title, ...rest] = c.commit.message.split("\n");
        return {
          sha: c.sha,
          title: title.trim(),
          body: rest.join("\n").trim(),
          url: c.html_url,
          author: c.commit.author?.name ?? c.author?.login ?? "unknown",
          date: c.commit.author?.date ?? "",
        };
      });

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: "Unhandled server error", message: err?.message });
  }
}
