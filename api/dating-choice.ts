import type { VercelRequest, VercelResponse } from "@vercel/node"

type ChoiceRow = {
  question_key?: string
  option_key: string
  votes: number
}

const QUESTION_OPTIONS = {
  "intro:jay:scratching": ["confused", "watching"],
  "intro:oscar:tree": ["slowly", "quickly", "what-to"],
  "intro:oscar:artist": ["write-it-down", "leave"],
  "intro:phil:placeholder": ["continue"],
  "intro:dylan:placeholder": ["continue"],
  "intro:benjamin:direction": ["left", "right", "rebuke"],
  "route:jay-invite": ["1", "2"],
  "route:jay-date": ["1", "2", "3"],
  "route:phil-confrontation": ["1", "2", "3"],
  "route:phil-date": ["1", "2", "3"],
  "route:dylan-roof": ["1", "2", "3"],
  "route:dylan-records": ["1", "2", "3"],
  "route:oscar-art": ["1", "2", "3"],
  "route:oscar-chips": ["1", "2", "3"],
  "route:benjamin-motorcade": ["1", "2", "3"],
  "route:benjamin-brunch": ["1", "2", "3"],
} as const

type QuestionKey = keyof typeof QUESTION_OPTIONS

function cleanEnv(value: string | undefined) {
  const cleaned = value?.trim()
  if (!cleaned || cleaned === "\"\"" || cleaned === "''") return null
  return cleaned
}

function supabaseConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL)?.replace(/\/$/, "")
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !serviceRoleKey) return null
  return { url, serviceRoleKey }
}

function isQuestionKey(value: unknown): value is QuestionKey {
  return typeof value === "string" && value in QUESTION_OPTIONS
}

function statsFor(question: QuestionKey, rows: ChoiceRow[]) {
  const allowed = QUESTION_OPTIONS[question] as readonly string[]
  const votesByOption = Object.fromEntries(
    allowed.map((option) => [
      option,
      Number(rows.find((row) => row.option_key === option)?.votes ?? 0),
    ]),
  )
  const total = Object.values(votesByOption).reduce((sum, votes) => sum + votes, 0)
  const options = Object.fromEntries(
    allowed.map((option) => {
      const votes = votesByOption[option]
      return [option, { votes, percent: total === 0 ? 0 : Math.round((votes / total) * 100) }]
    }),
  )

  return { question, total, options }
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

  return (await response.json()) as T
}

async function recordChoice(question: QuestionKey, option: string) {
  const rows = await supabaseRequest<ChoiceRow[]>("rpc/record_dating_choice", {
    method: "POST",
    body: JSON.stringify({
      p_question_key: question,
      p_option_key: option,
    }),
  })
  return statsFor(question, rows)
}

async function readStats(question?: QuestionKey) {
  const path = question
    ? `dating_choice_totals?question_key=eq.${encodeURIComponent(question)}&select=question_key,option_key,votes`
    : "dating_choice_totals?select=question_key,option_key,votes&order=question_key.asc,option_key.asc"
  const rows = await supabaseRequest<ChoiceRow[]>(path)

  if (question) return statsFor(question, rows)

  return Object.fromEntries(
    (Object.keys(QUESTION_OPTIONS) as QuestionKey[]).map((key) => [
      key,
      statsFor(key, rows.filter((row) => row.question_key === key)),
    ]),
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      const requestedQuestion = Array.isArray(req.query.question) ? req.query.question[0] : req.query.question
      if (requestedQuestion && !isQuestionKey(requestedQuestion)) {
        return res.status(400).json({ error: "Unknown question" })
      }

      const question = requestedQuestion && isQuestionKey(requestedQuestion) ? requestedQuestion : undefined
      const stats = await readStats(question)
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120")
      return res.status(200).json(stats)
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST")
      return res.status(405).json({ error: "Method not allowed" })
    }

    const question = req.body?.question
    const option = req.body?.option
    if (!isQuestionKey(question)) {
      return res.status(400).json({ error: "Unknown question" })
    }
    if (typeof option !== "string" || !(QUESTION_OPTIONS[question] as readonly string[]).includes(option)) {
      return res.status(400).json({ error: "Unknown option" })
    }

    const stats = await recordChoice(question, option)
    res.setHeader("Cache-Control", "no-store")
    return res.status(200).json(stats)
  } catch (error) {
    return res.status(503).json({
      error: error instanceof Error ? error.message : "Dating choice tally failed",
    })
  }
}
