export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
  
    try {
      const { phrase } = req.body;
  
      if (!phrase || phrase.trim().length === 0) {
        return res.status(400).json({ error: "Phrase required" });
      }
  
      // Forward the request to your Cloudflare Worker
      const workerRes = await fetch("https://api.phi.me.uk/append", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.WORKER_TOKEN}`,
        },
        body: JSON.stringify({ phrase }),
      });
  
      const data = await workerRes.json();
      return res.status(workerRes.status).json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Something went wrong" });
    }
  }
  