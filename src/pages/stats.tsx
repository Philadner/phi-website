// /src/pages/Stats.tsx
import { useEffect, useMemo, useState } from "react";

type Stats = {
  deploymentsToday: number;
  lastDeploymentAt: string | null;
  lastDeploymentUrl: string | null;
  lastCommitMessage: string | null;
  lastCommitAt: string | null;
  branch: string;
  now: string;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Stats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/stats")
      .then(r => r.json())
      .then(j => { if (alive) setStats(j); })
      .catch(e => setErr(String(e)));
    return () => { alive = false; };
  }, []);

  const workMode = typeof window !== 'undefined' && localStorage.getItem("workMode") === "1";

  const verdict = useMemo(() => {
    if (!stats) return "…";
    const recentCommit = stats.lastCommitAt ? (Date.now() - new Date(stats.lastCommitAt).getTime()) < 24*60*60*1000 : false;
    const active = (stats.deploymentsToday ?? 0) > 0 || recentCommit || workMode;
    return active ? "WORKIN' HARD" : "HARDLY WORKIN'?";
  }, [stats, workMode]);

  return (
    <main id="main-site" style={{display:"grid", gap:"12px"}}>
      <div className="gameshow-banner">
        <span className="gameshow-text">PHIL IS IN FACT</span>
        <span className="gameshow-divider">(drumroll please)</span>
        <span className="gameshow-text">{verdict}</span>
        <small style={{opacity:.8}}>
          {workMode ? "Work Mode override is ON" : "Based on deploys + commits in last 24h"}
        </small>
      </div>

      {err && <p style={{color:"tomato"}}>Failed to load stats: {err}</p>}

      <section style={{display:"grid", gap:"8px"}}>
        <StatCard label="Deploys today" value={stats?.deploymentsToday ?? "—"} />
        <StatCard label="Last deploy" value={timeAgo(stats?.lastDeploymentAt)} sub={stats?.lastDeploymentUrl ? `vercel.app/${stats.lastDeploymentUrl}` : ""} />
        <StatCard label={`Last commit (${stats?.branch ?? "labs"})`} value={stats?.lastCommitMessage ?? "—"} sub={timeAgo(stats?.lastCommitAt)} />
      </section>
    </main>
  );
}

function StatCard({label, value, sub}:{label:string; value:any; sub?:string}) {
  return (
    <div className="statcard">
      <div className="statlabel">{label}</div>
      <div className="statvalue">{String(value)}</div>
      {sub ? <div className="statsub">{sub}</div> : null}
    </div>
  );
}
