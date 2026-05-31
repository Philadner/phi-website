type SteamPlayer = {
  steamid: string
  personaname?: string
  personastate?: number
  gameid?: string
  gameextrainfo?: string
  lastlogoff?: number
  avatarfull?: string
}

type DylanSampleRow = {
  recorded_at: string
  steam_id: string
  persona_state: number
  game_id: string | null
  game_name: string | null
  is_game: boolean
  is_online: boolean
  is_apex: boolean
  is_elden: boolean
  tightness: number
  projected_tightness: number
}

type DylanMetaRow = {
  key: string
  value: string
  updated_at: string
}

type DylanSteamStatus =
  | {
      configured: false
      setup: string
    }
  | {
      configured: true
      player: SteamPlayer
      state: ReturnType<typeof statusFor>
    }

export type DylanTightnessSample = {
  at: string
  tightness: number
  projectedTightness: number
  online: boolean
    apex: boolean
    elden: boolean
    game: boolean
    gameName: string | null
}

export type DylanTightnessPayload = {
  ok: boolean
  configured: boolean
  now: string
  source: "steam" | "demo"
  error?: string
  setup?: string
  current?: {
    steamId: string
    name: string | null
    avatarUrl: string | null
    online: boolean
    apex: boolean
    elden: boolean
    game: boolean
    gameId: string | null
    gameName: string | null
    tightness: number
    projectedTightness: number
    statusLabel: string
  }
  lastSeen: {
    online: string | null
    game: string | null
    apex: string | null
    elden: string | null
  }
  history: DylanTightnessSample[]
}

const APEX_APP_ID = "1172470"
const ELDEN_RING_APP_ID = "1245620"
const HISTORY_HOURS = 24
const ACTIVE_VIEWER_WINDOW_MS = 5 * 60 * 1000
const localSamples: DylanSampleRow[] = []
const localMeta = new Map<string, DylanMetaRow>()

function cleanEnv(value: string | undefined) {
  const cleaned = value?.trim()
  if (!cleaned || cleaned === "\"\"" || cleaned === "''") return null
  return cleaned
}

function steamKey() {
  return cleanEnv(process.env.STEAM_API_KEY)
}

function configuredSteamId() {
  return cleanEnv(process.env.DYLAN_STEAM_ID) || cleanEnv(process.env.STEAM_DYLAN_ID)
}

function configuredSteamVanity() {
  return cleanEnv(process.env.DYLAN_STEAM_VANITY) || cleanEnv(process.env.STEAM_DYLAN_VANITY)
}

function supabaseConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL)?.replace(/\/$/, "")
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !serviceRoleKey) return null
  return { url, serviceRoleKey }
}

function statusFor(player: SteamPlayer) {
  const gameId = player.gameid || null
  const game = Boolean(gameId)
  const online = (player.personastate ?? 0) > 0 || Boolean(gameId)
  const apex = gameId === APEX_APP_ID
  const elden = gameId === ELDEN_RING_APP_ID

  if (elden) return { online, game, apex, elden, tightness: 98, statusLabel: "really really tight" }
  if (apex) return { online, game, apex, elden, tightness: 72, statusLabel: "tighter" }
  if (game) return { online, game, apex, elden, tightness: 55, statusLabel: "playing a game" }
  if (online) return { online, game, apex, elden, tightness: 38, statusLabel: "slightly tight" }
  return { online, game, apex, elden, tightness: 8, statusLabel: "hella loose" }
}

function sampleFromRow(row: DylanSampleRow): DylanTightnessSample {
  return {
    at: row.recorded_at,
    tightness: row.tightness,
    online: row.is_online,
    game: row.is_game,
    apex: row.is_apex,
    elden: row.is_elden,
    gameName: row.game_name,
    projectedTightness: row.projected_tightness,
  }
}

function currentFromRow(row: DylanSampleRow) {
  const statusLabel = row.is_elden
    ? "really really tight"
    : row.is_apex
      ? "tighter"
      : row.is_game
        ? "playing a game"
      : row.is_online
        ? "slightly tight"
        : "hella loose"

  return {
    steamId: row.steam_id,
    name: null,
    avatarUrl: null,
    online: row.is_online,
    game: row.is_game,
    apex: row.is_apex,
    elden: row.is_elden,
    gameId: row.game_id,
    gameName: row.game_name,
    tightness: row.tightness,
    projectedTightness: row.projected_tightness,
    statusLabel,
  }
}

function moveTowardProjected(current: number, projected: number) {
  const distance = Math.abs(projected - current)
  const factor = Math.min(0.72, Math.max(0.08, distance / 120))
  return current + (projected - current) * factor
}

function rowFromSteam(
  player: SteamPlayer,
  state: ReturnType<typeof statusFor>,
  previous: DylanSampleRow | null
): DylanSampleRow {
  const previousTightness = previous?.tightness ?? state.tightness
  const tightness = moveTowardProjected(previousTightness, state.tightness)

  return {
    recorded_at: new Date().toISOString(),
    steam_id: player.steamid,
    persona_state: player.personastate ?? 0,
    game_id: player.gameid || null,
    game_name: player.gameextrainfo || null,
    is_game: state.game,
    is_online: state.online,
    is_apex: state.apex,
    is_elden: state.elden,
    tightness,
    projected_tightness: state.tightness,
  }
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url)
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 180)}`)
  }
  return JSON.parse(text) as T
}

async function resolveSteamId() {
  const id = configuredSteamId()
  if (id) return id

  const key = steamKey()
  const vanity = configuredSteamVanity()
  if (!key || !vanity) return null

  const payload = await fetchJson<{ response?: { success?: number; steamid?: string; message?: string } }>(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(key)}&vanityurl=${encodeURIComponent(vanity)}`
  )

  if (payload.response?.success === 1 && payload.response.steamid) {
    return payload.response.steamid
  }

  throw new Error(payload.response?.message || "Steam vanity URL could not be resolved")
}

export async function fetchDylanSteamStatus(): Promise<DylanSteamStatus> {
  const key = steamKey()
  if (!key) throw new Error("Missing STEAM_API_KEY")

  const steamId = await resolveSteamId()
  if (!steamId) {
    return {
      configured: false,
      setup: "Add DYLAN_STEAM_ID or DYLAN_STEAM_VANITY to Vercel production env vars.",
    }
  }

  const payload = await fetchJson<{ response?: { players?: SteamPlayer[] } }>(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${encodeURIComponent(steamId)}`
  )
  const player = payload.response?.players?.[0]
  if (!player) throw new Error("Steam returned no player for Dylan")

  return {
    configured: true,
    player,
    state: statusFor(player),
  }
}

async function supabaseRequest<T>(path: string, init?: RequestInit) {
  const config = supabaseConfig()
  if (!config) throw new Error("Supabase is not configured")

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Supabase request failed: ${response.status} ${detail.slice(0, 220)}`)
  }

  if (response.status === 204) return null as T
  return (await response.json()) as T
}

async function insertSample(row: DylanSampleRow) {
  if (!supabaseConfig()) {
    localSamples.push(row)
    return
  }

  await supabaseRequest<DylanSampleRow[]>("dylan_tightness_samples", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  })
}

async function upsertMeta(key: string, value: string) {
  const row: DylanMetaRow = {
    key,
    value,
    updated_at: new Date().toISOString(),
  }

  if (!supabaseConfig()) {
    localMeta.set(key, row)
    return row
  }

  const rows = await supabaseRequest<DylanMetaRow[]>("dylan_tightness_meta?on_conflict=key", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  })

  return rows[0] || row
}

async function readMeta(key: string) {
  if (!supabaseConfig()) {
    return localMeta.get(key) || null
  }

  const rows = await supabaseRequest<DylanMetaRow[]>(
    `dylan_tightness_meta?key=eq.${encodeURIComponent(key)}&select=*`
  )
  return rows[0] || null
}

async function readHistory() {
  const since = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString()

  if (!supabaseConfig()) {
    return localSamples
      .filter((sample) => sample.recorded_at >= since)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map(sampleFromRow)
  }

  const rows = await supabaseRequest<DylanSampleRow[]>(
    `dylan_tightness_samples?recorded_at=gte.${encodeURIComponent(since)}&select=*&order=recorded_at.asc`
  )
  return rows.map(sampleFromRow)
}

async function readLastSeen(column: "is_online" | "is_game" | "is_apex" | "is_elden") {
  if (!supabaseConfig()) {
    const latest = [...localSamples]
      .reverse()
      .find((sample) => sample[column])
    return latest?.recorded_at || null
  }

  const rows = await supabaseRequest<Array<{ recorded_at: string }>>(
    `dylan_tightness_samples?${column}=eq.true&select=recorded_at&order=recorded_at.desc&limit=1`
  )
  return rows[0]?.recorded_at || null
}

async function readLatestSample() {
  if (!supabaseConfig()) {
    return [...localSamples].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0] || null
  }

  const rows = await supabaseRequest<DylanSampleRow[]>(
    "dylan_tightness_samples?select=*&order=recorded_at.desc&limit=1"
  )
  return rows[0] || null
}

async function getStoredState() {
  try {
    const [history, latest, online, game, apex, elden] = await Promise.all([
      readHistory(),
      readLatestSample(),
      readLastSeen("is_online"),
      readLastSeen("is_game"),
      readLastSeen("is_apex"),
      readLastSeen("is_elden"),
    ])

    return {
      history,
      latest,
      lastSeen: { online, game, apex, elden },
      error: null,
    }
  } catch (error) {
    return {
      history: [] as DylanTightnessSample[],
      latest: null,
      lastSeen: { online: null, game: null, apex: null, elden: null },
      error: error instanceof Error ? error.message : "History lookup failed",
    }
  }
}

export async function createDylanTightnessPayload(): Promise<DylanTightnessPayload> {
  const now = new Date().toISOString()
  const stored = await getStoredState()

  try {
    const steam = await fetchDylanSteamStatus()
    if (!steam.configured || !("player" in steam)) {
      return {
        ok: false,
        configured: false,
        source: "demo",
        now,
        setup: steam.setup,
        error: stored.error || undefined,
        lastSeen: stored.lastSeen,
        history: stored.history,
      }
    }

    const { player, state } = steam
    const row = rowFromSteam(player, state, stored.latest)
    let writeError = stored.error
    try {
      await insertSample(row)
    } catch (error) {
      writeError = error instanceof Error ? error.message : "Dylan sample write failed"
    }

    return {
      ok: true,
      configured: true,
      source: "steam",
      now,
      error: writeError || undefined,
      current: {
        steamId: player.steamid,
        name: player.personaname || null,
        avatarUrl: player.avatarfull || null,
        online: state.online,
        game: state.game,
        apex: state.apex,
        elden: state.elden,
        gameId: player.gameid || null,
        gameName: player.gameextrainfo || null,
        tightness: row.tightness,
        projectedTightness: state.tightness,
        statusLabel: state.statusLabel,
      },
      lastSeen: {
        online: state.online ? now : stored.lastSeen.online,
        game: state.game ? now : stored.lastSeen.game,
        apex: state.apex ? now : stored.lastSeen.apex,
        elden: state.elden ? now : stored.lastSeen.elden,
      },
      history: stored.history,
    }
  } catch (error) {
    if (stored.latest) {
      return {
        ok: true,
        configured: true,
        source: "steam",
        now,
        error: error instanceof Error ? error.message : "Steam lookup failed",
        current: currentFromRow(stored.latest),
        lastSeen: {
          online: stored.latest.is_online ? stored.latest.recorded_at : stored.lastSeen.online,
          game: stored.latest.is_game ? stored.latest.recorded_at : stored.lastSeen.game,
          apex: stored.latest.is_apex ? stored.latest.recorded_at : stored.lastSeen.apex,
          elden: stored.latest.is_elden ? stored.latest.recorded_at : stored.lastSeen.elden,
        },
        history: stored.history,
      }
    }

    return {
      ok: false,
      configured: Boolean(steamKey()),
      source: "demo",
      now,
      error: error instanceof Error ? error.message : "Steam lookup failed",
      lastSeen: stored.lastSeen,
      history: stored.history,
    }
  }
}

export async function markDylanPageSeen() {
  const now = new Date().toISOString()
  await upsertMeta("last_page_seen_at", now)
  return { ok: true, lastPageSeenAt: now }
}

export async function hasRecentDylanPageView() {
  const row = await readMeta("last_page_seen_at")
  if (!row) return { recent: false, lastPageSeenAt: null }

  const seenAt = new Date(row.value)
  if (!Number.isFinite(seenAt.getTime())) return { recent: false, lastPageSeenAt: row.value }

  return {
    recent: Date.now() - seenAt.getTime() <= ACTIVE_VIEWER_WINDOW_MS,
    lastPageSeenAt: row.value,
  }
}

export async function recordDylanTightnessSample() {
  const viewer = await hasRecentDylanPageView()
  if (viewer.recent) {
    return {
      ok: true,
      configured: true,
      skipped: true,
      reason: "Dylan tracker was loaded in the last 5 minutes; frontend checks are active",
      lastPageSeenAt: viewer.lastPageSeenAt,
    }
  }

  const steam = await fetchDylanSteamStatus()
  if (!steam.configured || !("player" in steam)) {
    return {
      ok: false,
      configured: false,
      setup: steam.setup,
    }
  }

  const { player, state } = steam
  const latest = await readLatestSample()
  const row = rowFromSteam(player, state, latest)

  await insertSample(row)
  return {
    ok: true,
    configured: true,
    sample: sampleFromRow(row),
  }
}
