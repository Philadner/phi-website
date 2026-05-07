export type RemoteCommandType = "next" | "previous" | "ping"

export type RemoteCommand = {
  id: string
  type: RemoteCommandType
  at: string
}

export type RoomState = {
  room: string
  createdAt: string
  pairedAt: string | null
  lastRemoteSeenAt: string | null
  command: RemoteCommand | null
  slideIndex: number
}

type PresentationRoomRow = {
  room: string
  created_at: string
  paired_at: string | null
  last_remote_seen_at: string | null
  command_id: string | null
  command_type: RemoteCommandType | null
  command_at: string | null
}

const localRooms = new Map<string, RoomState>()

function supabaseConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL)?.replace(/\/$/, "")
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !serviceRoleKey) return null
  return { url, serviceRoleKey }
}

function cleanEnv(value: string | undefined) {
  const cleaned = value?.trim()
  if (!cleaned || cleaned === "\"\"" || cleaned === "''") return null
  return cleaned
}

function createState(room: string): RoomState {
  return {
    room,
    createdAt: new Date().toISOString(),
    pairedAt: null,
    lastRemoteSeenAt: null,
    command: null,
    slideIndex: 0,
  }
}

function rowFromState(state: RoomState): PresentationRoomRow {
  return {
    room: state.room,
    created_at: state.createdAt,
    paired_at: state.pairedAt,
    last_remote_seen_at: state.lastRemoteSeenAt,
    command_id: state.command?.id || null,
    command_type: state.command?.type || null,
    command_at: state.command?.at || null,
  }
}

function stateFromRow(row: PresentationRoomRow): RoomState {
  const slideIndex = row.command_id?.startsWith("slide:")
    ? Number(row.command_id.split(":")[1])
    : 0

  return {
    room: row.room,
    createdAt: row.created_at,
    pairedAt: row.paired_at,
    lastRemoteSeenAt: row.last_remote_seen_at,
    command:
      row.command_id && row.command_type && row.command_at
        ? {
            id: row.command_id,
            type: row.command_type,
            at: row.command_at,
          }
        : null,
    slideIndex: Number.isFinite(slideIndex) ? slideIndex : 0,
  }
}

function getLocalRoom(room: string) {
  const state = localRooms.get(room) || createState(room)
  localRooms.set(room, state)
  return state
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
    throw new Error(`Supabase request failed: ${response.status} ${detail}`)
  }

  return (await response.json()) as T
}

async function upsertSupabaseState(state: RoomState) {
  const rows = await supabaseRequest<PresentationRoomRow[]>(
    "presentation_rooms?on_conflict=room",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(rowFromState(state)),
    }
  )

  return rows[0] ? stateFromRow(rows[0]) : state
}

async function readSupabaseRoom(room: string) {
  const rows = await supabaseRequest<PresentationRoomRow[]>(
    `presentation_rooms?room=eq.${encodeURIComponent(room)}&select=*`
  )

  if (rows[0]) return stateFromRow(rows[0])
  return await upsertSupabaseState(createState(room))
}

export function isSupabasePresentationRemoteConfigured() {
  return Boolean(supabaseConfig())
}

export async function readRoomState(room: string) {
  if (supabaseConfig()) {
    return await readSupabaseRoom(room)
  }

  return getLocalRoom(room)
}

export async function writeRoomState(state: RoomState) {
  if (supabaseConfig()) {
    return await upsertSupabaseState(state)
  }

  localRooms.set(state.room, state)
  return state
}

export function createCommand(type: RemoteCommandType): RemoteCommand {
  return {
    id: crypto.randomUUID(),
    type,
    at: new Date().toISOString(),
  }
}

export function createSlideSyncCommand(slideIndex: number): RemoteCommand {
  return {
    id: `slide:${Math.max(0, Math.floor(slideIndex))}:${crypto.randomUUID()}`,
    type: "ping",
    at: new Date().toISOString(),
  }
}
