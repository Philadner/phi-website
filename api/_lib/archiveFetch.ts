const ARCHIVE_REQUEST_GAP_MS = 450
const ARCHIVE_REQUEST_TIMEOUT_MS = 10_000
const ARCHIVE_RETRY_DELAY_MS = 1_500

let archiveQueue = Promise.resolve()
let lastArchiveRequestAt = 0

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitTurn() {
  const elapsed = Date.now() - lastArchiveRequestAt
  if (elapsed < ARCHIVE_REQUEST_GAP_MS) {
    await sleep(ARCHIVE_REQUEST_GAP_MS - elapsed)
  }
  lastArchiveRequestAt = Date.now()
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true })
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  }
}

async function executeArchiveFetch(url: string, init?: RequestInit, attempt = 0): Promise<Response> {
  await waitTurn()
  const timed = withTimeout(init?.signal ?? undefined, ARCHIVE_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...init,
      signal: timed.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "phi-music-player",
        ...(init?.headers || {}),
      },
    })

    if (response.status === 429 && attempt < 1) {
      await sleep(ARCHIVE_RETRY_DELAY_MS)
      return executeArchiveFetch(url, init, attempt + 1)
    }

    return response
  } finally {
    timed.clear()
  }
}

export function archiveFetch(url: string, init?: RequestInit) {
  const run = archiveQueue.then(() => executeArchiveFetch(url, init))
  archiveQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}
