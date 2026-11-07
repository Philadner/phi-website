import { isSchoolSafetyResult, phraseAllowed, phraseIssues, phraseVisible } from './phraseModeration.js'
import type { ModerationResult, PhrasePreferences, SchoolSafetyResult } from './phraseModeration.js'

export type NewsInput = { title: string; content: string; author?: string }
export type NewsArticle = NewsInput & { id: string; createdAt: string; hatefulness: ModerationResult; school_safety?: SchoolSafetyResult | null }

export function parseNewsInput(value: unknown): NewsInput | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.title !== 'string' || typeof row.content !== 'string' || (row.author !== undefined && typeof row.author !== 'string')) return null
  const title = row.title.trim(), content = row.content.trim(), author = (row.author as string | undefined)?.trim() || undefined
  if (!title || title.length > 120 || !content || content.length > 10_000 || (author?.length ?? 0) > 60) return null
  return { title, content, author }
}

export function newsReviewText(article: NewsInput) {
  return JSON.stringify({ title: article.title, content: article.content, author: article.author ?? '' })
}

export function newsReviewed(article: NewsArticle) {
  return phraseAllowed(article.hatefulness) && (phraseIssues(article.hatefulness).length > 0 || isSchoolSafetyResult(article.school_safety))
}

export function newsVisible(article: NewsArticle, preferences: PhrasePreferences) {
  return phraseVisible({ id: 0, text: newsReviewText(article), hatefulness: article.hatefulness, school_safety: article.school_safety }, preferences)
}
