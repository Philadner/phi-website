export const AI_AUTHOR_ID = '00000000-0000-4000-8000-000000000001'
export type ReplyPreview = { id: number; authorId: string; username: string; content: string; isAi: boolean }
export type ChatRoomState = { cleared_through: number; clear_revision: number; ai_name: string }
export type ClearVote = { id: string; electorate: string[]; yes: string[]; no: string[]; expires_at: string; status: 'active' | 'passed' | 'rejected' | 'expired' }
export type AiRequest = { id: string; trigger_id: number; status: 'queued' | 'processing' | 'awaiting_context' | 'done' | 'error' | 'declined'; error: string | null }

export function mentionNames(text: string) {
  const prose = text.replace(/```[\s\S]*?(?:```|$)|`[^`\n]*`/g, '')
  const names = new Set<string>()
  for (const match of prose.matchAll(/(?:^|[\s(])@(?:"([A-Za-z0-9_ -]{2,24})"|([A-Za-z0-9_-]{2,24}))(?=$|[\s.,!?;:)\]])/g)) names.add((match[1] || match[2]).toLowerCase())
  return [...names]
}

export function mentionsAi(text: string, name = 'AI') {
  const names = mentionNames(text)
  return names.includes('ai') || names.includes(name.toLowerCase())
}

export function mentionText(name: string) { return name.includes(' ') ? `@"${name}" ` : `@${name} ` }

export function parseChatCommand(text: string) {
  const raw = text.trim()
  if (raw.startsWith('//')) return { kind: 'message' as const, content: raw.slice(1) }
  if (!raw.startsWith('/')) return { kind: 'message' as const, content: raw }
  const [command] = raw.split(/\s+/, 1)
  const argument = raw.slice(command.length).trim()
  if (command === '/ai') return { kind: 'ai' as const, content: argument }
  if (command === '/me') return { kind: 'action' as const, content: argument }
  if (command === '/nick') return { kind: 'nick' as const, content: argument }
  if (['/help', '/format', '/emoji', '/upload'].includes(command) && !argument) return { kind: 'local' as const, content: command }
  if (command === '/clear' && !argument) return { kind: 'clear' as const, content: '' }
  if (command === '/bigahhclear' && !argument) return { kind: 'vote' as const, content: '' }
  if (command === '/badabingbadaboomforceclear' && !argument) return { kind: 'force' as const, content: '' }
  if (['/game', '/games', '/gif'].includes(command)) return { kind: 'unavailable' as const, content: command }
  return { kind: 'invalid' as const, content: command }
}
