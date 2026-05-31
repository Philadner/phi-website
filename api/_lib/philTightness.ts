type SteamPlayer = {
  steamid: string
  personaname?: string
  personastate?: number
  gameid?: string
  gameextrainfo?: string
  avatarfull?: string
}

type PhilSampleRow = {
  recorded_at: string
  steam_id: string
  persona_state: number
  game_id: string | null
  game_name: string | null
  is_online: boolean
  is_game: boolean
  is_nubby: boolean
  is_spicy: boolean
  is_celeste: boolean
  tightness: number
}

type PhilMetaRow = {
  key: string
  value: string
  updated_at: string
}

type PhilSteamStatus =
  | {
      configured: false
      setup: string
    }
  | {
      configured: true
      player: SteamPlayer
      state: ReturnType<typeof statusFor>
    }

export type PhilTightnessSample = {
  at: string
  tightness: number
  online: boolean
  game: boolean
  nubby: boolean
  spicy: boolean
  celeste: boolean
  gameName: string | null
}

export type PhilTightnessPayload = {
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
    game: boolean
    nubby: boolean
    spicy: boolean
    celeste: boolean
    gameId: string | null
    gameName: string | null
    tightness: number
    statusLabel: string
  }
  lastSeen: {
    online: string | null
    game: string | null
    nubby: string | null
    spicy: string | null
    celeste: string | null
  }
  history: PhilTightnessSample[]
}

const APEX_APP_ID = "1172470"
const NUBBY_APP_ID = "3191030"
const HASTE_APP_ID = "1796470"
const TYRONE_APP_ID = "1853200"
const CELESTE_APP_ID = "504230"
const SPICY_APP_IDS = new Set([HASTE_APP_ID, APEX_APP_ID, TYRONE_APP_ID])
const HISTORY_HOURS = 24
const ACTIVE_VIEWER_WINDOW_MS = 5 * 60 * 1000
const localSamples: PhilSampleRow[] = []
const localMeta = new Map<string, PhilMetaRow>()

function cleanEnv(value: string | undefined) {
  const cleaned = value?.trim()
  if (!cleaned || cleaned === "\"\"" || cleaned === "''") return null
  return cleaned
}

function steamKey() {
  return cleanEnv(process.env.STEAM_API_KEY)
}

function configuredSteamId() {
  return cleanEnv(process.env.PHIL_STEAM_ID) || cleanEnv(process.env.STEAM_PHIL_ID)
}

function configuredSteamVanity() {
  return cleanEnv(process.env.PHIL_STEAM_VANITY) || cleanEnv(process.env.STEAM_PHIL_VANITY) || "Philander82"
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
  const online = (player.personastate ?? 0) > 0 || game
  const nubby = gameId === NUBBY_APP_ID
  const spicy = gameId ? SPICY_APP_IDS.has(gameId) : false
  const celeste = gameId === CELESTE_APP_ID

  if (celeste) return { online, game, nubby, spicy, celeste, tightness: 98, statusLabel: "maximum tightness" }
  if (spicy) return { online, game, nubby, spicy, celeste, tightness: 84, statusLabel: "highly tight" }
  if (nubby) return { online, game, nubby, spicy, celeste, tightness: 70, statusLabel: "number factory tight" }
  if (game) return { online, game, nubby, spicy, celeste, tightness: 55, statusLabel: "playing any game" }
  if (online) return { online, game, nubby, spicy, celeste, tightness: 38, statusLabel: "online" }
  return { online, game, nubby, spicy, celeste, tightness: 8, statusLabel: "hella loose" }
}

function sampleFromRow(row: PhilSampleRow): PhilTightnessSample {
  return {
    at: row.recorded_at,
    tightness: row.tightness,
    online: row.is_online,
    game: row.is_game,
    nubby: row.is_nubby,
    spicy: row.is_spicy,
    celeste: row.is_celeste,
    gameName: row.game_name,
  }
}

function currentFromRow(row: PhilSampleRow) {
  const statusLabel = row.is_celeste
    ? "maximum tightness"
    : row.is_spicy
      ? "highly tight"
      : row.is_nubby
        ? "number factory tight"
        : row.is_game
          ? "playing any game"
          : row.is_online
            ? "online"
            : "hella loose"

  return {
    steamId: row.steam_id,
    name: null,
    avatarUrl: null,
    online: row.is_online,
    game: row.is_game,
    nubby: row.is_nubby,
    spicy: row.is_spicy,
    celeste: row.is_celeste,
    gameId: row.game_id,
    gameName: row.game_name,
    tightness: row.tightness,
    statusLabel,
  }
}

function rowFromSteam(player: SteamPlayer, state: ReturnType<typeof statusFor>): PhilSampleRow {
  return {
    recorded_at: new Date().toISOString(),
    steam_id: player.steamid,
    persona_state: player.personastate ?? 0,
    game_id: player.gameid || null,
    game_name: player.gameextrainfo || null,
    is_online: state.online,
    is_game: state.game,
    is_nubby: state.nubby,
    is_spicy: state.spicy,
    is_celeste: state.celeste,
    tightness: state.tightness,
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

  if (payload.response?.success === 1 && payload.response.steamid) return payload.response.steamid
  throw new Error(payload.response?.message || "Steam vanity URL could not be resolved")
}

export async function fetchPhilSteamStatus(): Promise<PhilSteamStatus> {
  const key = steamKey()
  if (!key) throw new Error("Missing STEAM_API_KEY")

  const steamId = await resolveSteamId()
  if (!steamId) {
    return {
      configured: false,
      setup: "Add PHIL_STEAM_ID or PHIL_STEAM_VANITY to Vercel production env vars.",
    }
  }

  const payload = await fetchJson<{ response?: { players?: SteamPlayer[] } }>(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${encodeURIComponent(steamId)}`
  )
  const player = payload.response?.players?.[0]
  if (!player) throw new Error("Steam returned no player for Phil")

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

async function insertSample(row: PhilSampleRow) {
  if (!supabaseConfig()) {
    localSamples.push(row)
    return
  }

  await supabaseRequest<PhilSampleRow[]>("phil_tightness_samples", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  })
}

async function upsertMeta(key: string, value: string) {
  const row: PhilMetaRow = {
    key,
    value,
    updated_at: new Date().toISOString(),
  }

  if (!supabaseConfig()) {
    localMeta.set(key, row)
    return row
  }

  const rows = await supabaseRequest<PhilMetaRow[]>("phil_tightness_meta?on_conflict=key", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  })

  return rows[0] || row
}

async function readMeta(key: string) {
  if (!supabaseConfig()) return localMeta.get(key) || null

  const rows = await supabaseRequest<PhilMetaRow[]>(
    `phil_tightness_meta?key=eq.${encodeURIComponent(key)}&select=*`
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

  const rows = await supabaseRequest<PhilSampleRow[]>(
    `phil_tightness_samples?recorded_at=gte.${encodeURIComponent(since)}&select=*&order=recorded_at.asc`
  )
  return rows.map(sampleFromRow)
}

async function readLastSeen(column: "is_online" | "is_game" | "is_nubby" | "is_spicy" | "is_celeste") {
  if (!supabaseConfig()) {
    const latest = [...localSamples].reverse().find((sample) => sample[column])
    return latest?.recorded_at || null
  }

  const rows = await supabaseRequest<Array<{ recorded_at: string }>>(
    `phil_tightness_samples?${column}=eq.true&select=recorded_at&order=recorded_at.desc&limit=1`
  )
  return rows[0]?.recorded_at || null
}

async function readLatestSample() {
  if (!supabaseConfig()) {
    return [...localSamples].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0] || null
  }

  const rows = await supabaseRequest<PhilSampleRow[]>(
    "phil_tightness_samples?select=*&order=recorded_at.desc&limit=1"
  )
  return rows[0] || null
}

async function getStoredState() {
  try {
    const [history, latest, online, game, nubby, spicy, celeste] = await Promise.all([
      readHistory(),
      readLatestSample(),
      readLastSeen("is_online"),
      readLastSeen("is_game"),
      readLastSeen("is_nubby"),
      readLastSeen("is_spicy"),
      readLastSeen("is_celeste"),
    ])

    return {
      history,
      latest,
      lastSeen: { online, game, nubby, spicy, celeste },
      error: null,
    }
  } catch (error) {
    return {
      history: [] as PhilTightnessSample[],
      latest: null,
      lastSeen: { online: null, game: null, nubby: null, spicy: null, celeste: null },
      error: error instanceof Error ? error.message : "History lookup failed",
    }
  }
}

export async function createPhilTightnessPayload(): Promise<PhilTightnessPayload> {
  const now = new Date().toISOString()
  const stored = await getStoredState()

  try {
    const steam = await fetchPhilSteamStatus()
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
    const row = rowFromSteam(player, state)
    let writeError = stored.error
    try {
      await insertSample(row)
    } catch (error) {
      writeError = error instanceof Error ? error.message : "Phil sample write failed"
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
        nubby: state.nubby,
        spicy: state.spicy,
        celeste: state.celeste,
        gameId: player.gameid || null,
        gameName: player.gameextrainfo || null,
        tightness: state.tightness,
        statusLabel: state.statusLabel,
      },
      lastSeen: {
        online: state.online ? now : stored.lastSeen.online,
        game: state.game ? now : stored.lastSeen.game,
        nubby: state.nubby ? now : stored.lastSeen.nubby,
        spicy: state.spicy ? now : stored.lastSeen.spicy,
        celeste: state.celeste ? now : stored.lastSeen.celeste,
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
          nubby: stored.latest.is_nubby ? stored.latest.recorded_at : stored.lastSeen.nubby,
          spicy: stored.latest.is_spicy ? stored.latest.recorded_at : stored.lastSeen.spicy,
          celeste: stored.latest.is_celeste ? stored.latest.recorded_at : stored.lastSeen.celeste,
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

export async function markPhilPageSeen() {
  const now = new Date().toISOString()
  await upsertMeta("last_page_seen_at", now)
  return { ok: true, lastPageSeenAt: now }
}

export async function hasRecentPhilPageView() {
  const row = await readMeta("last_page_seen_at")
  if (!row) return { recent: false, lastPageSeenAt: null }

  const seenAt = new Date(row.value)
  if (!Number.isFinite(seenAt.getTime())) return { recent: false, lastPageSeenAt: row.value }

  return {
    recent: Date.now() - seenAt.getTime() <= ACTIVE_VIEWER_WINDOW_MS,
    lastPageSeenAt: row.value,
  }
}

export async function recordPhilTightnessSample() {
  const viewer = await hasRecentPhilPageView()
  if (viewer.recent) {
    return {
      ok: true,
      configured: true,
      skipped: true,
      reason: "Phil tracker was loaded in the last 5 minutes; frontend checks are active",
      lastPageSeenAt: viewer.lastPageSeenAt,
    }
  }

  const steam = await fetchPhilSteamStatus()
  if (!steam.configured || !("player" in steam)) {
    return {
      ok: false,
      configured: false,
      setup: steam.setup,
    }
  }

  const { player, state } = steam
  const row = rowFromSteam(player, state)

  await insertSample(row)
  return {
    ok: true,
    configured: true,
    sample: sampleFromRow(row),
  }
}
