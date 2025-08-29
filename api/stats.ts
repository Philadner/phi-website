import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    res.status(200).json({
      ok: true,
      envs: {
        VERCEL_TOKEN: !!process.env.VERCEL_TOKEN,
        VERCEL_PROJECT: process.env.VERCEL_PROJECT,
        GITHUB_REPO: process.env.GITHUB_REPO,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ? true : false,
      }
    });
  } catch (e: any) {
    res.status(200).json({ error: String(e?.message ?? e) });
  }
}
