export const MODERATION_MODEL = 'omni-moderation-latest'
export const MODERATION_VERSION = 1
export const PHRASE_MAX_LENGTH = 500
export const MODERATION_THRESHOLDS = {
  hate: 0.4, 'hate/threatening': 0.3, harassment: 0.8, 'harassment/threatening': 0.35,
  sexual: 0.65, 'sexual/minors': 0.2, violence: 0.75, 'violence/graphic': 0.4,
  'self-harm': 0.4, 'self-harm/intent': 0.3, 'self-harm/instructions': 0.2,
  illicit: 0.6, 'illicit/violent': 0.3,
} as const
export type ModerationCategory = keyof typeof MODERATION_THRESHOLDS
export const MODERATION_CATEGORIES = Object.keys(MODERATION_THRESHOLDS) as ModerationCategory[]
export const HARD_BLOCKED_CATEGORIES: readonly ModerationCategory[] = ['sexual/minors', 'violence/graphic', 'illicit/violent', 'self-harm/instructions']
export const MODERATION_PREFERENCE_CATEGORIES = MODERATION_CATEGORIES.filter(category => !HARD_BLOCKED_CATEGORIES.includes(category))
export const MODERATION_LABELS: Record<ModerationCategory, string> = {
  hate: 'hate speech', 'hate/threatening': 'threatening hate speech',
  harassment: 'harassment', 'harassment/threatening': 'threatening harassment',
  sexual: 'sexual content', 'sexual/minors': 'sexual content involving minors',
  violence: 'violence', 'violence/graphic': 'graphic violence',
  'self-harm': 'self-harm content', 'self-harm/intent': 'self-harm intent',
  'self-harm/instructions': 'self-harm instructions', illicit: 'illicit activity',
  'illicit/violent': 'violent illicit activity',
}
export type ModerationResult = {
  flagged: boolean
  categories: Record<ModerationCategory, boolean>
  category_scores: Record<ModerationCategory, number>
  category_applied_input_types?: Partial<Record<ModerationCategory, string[]>>
  model?: string
  reviewed_at?: string
  threshold_version?: number
}
export type PhraseRecord = { id: number; text: string; hatefulness: ModerationResult }
export function isModerationResult(value: unknown): value is ModerationResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<ModerationResult>
  return typeof result.flagged === 'boolean' && MODERATION_CATEGORIES.every(category => {
    const score = result.category_scores?.[category]
    return typeof result.categories?.[category] === 'boolean' && typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1
  })
}
export function phraseIssues(result: ModerationResult): ModerationCategory[] {
  return MODERATION_CATEGORIES.filter(category => result.category_scores[category] >= MODERATION_THRESHOLDS[category])
}
export function hardBlockedIssues(result: ModerationResult): ModerationCategory[] {
  return HARD_BLOCKED_CATEGORIES.filter(category => result.category_scores[category] >= MODERATION_THRESHOLDS[category])
}
export function phraseAllowed(result: unknown): result is ModerationResult {
  return isModerationResult(result) && hardBlockedIssues(result).length === 0
}
export function moderationNotice(issues: ModerationCategory[]) {
  return issues.length ? `your message will be hidden by default unless people turn moderation off. this is because it contains ${issues.map(issue => MODERATION_LABELS[issue]).join(', ')}` : ''
}
export type PhrasePreferences = { showFiltered: boolean; moderated: ModerationCategory[] }
export const DEFAULT_PHRASE_PREFERENCES: PhrasePreferences = { showFiltered: false, moderated: [] }
export function parsePhrasePreferences(value: unknown): PhrasePreferences {
  if (!value || typeof value !== 'object') return DEFAULT_PHRASE_PREFERENCES
  const prefs = value as Partial<PhrasePreferences>
  return { showFiltered: prefs.showFiltered === true, moderated: Array.isArray(prefs.moderated) ? MODERATION_PREFERENCE_CATEGORIES.filter(category => prefs.moderated!.includes(category)) : [] }
}
export function phraseVisible(phrase: PhraseRecord, preferences: PhrasePreferences) {
  if (!phraseAllowed(phrase.hatefulness)) return false
  return !phraseIssues(phrase.hatefulness).some(category => !preferences.showFiltered || preferences.moderated.includes(category))
}
