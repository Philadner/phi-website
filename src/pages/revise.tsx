import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import "../stylesheets/revise.css";
import liveQuestions from "../data/questions.json";
import legacyQuestions from "../data/questions.old.json";

type QuestionType = "short" | "text" | "mcq" | "multi" | "tf" | "boolean";

type SubjectMeta = {
  id: string;
  label: string;
  icon?: string;
};

type Question = {
  id: string;
  subject?: SubjectMeta | string;
  topic?: string;
  type: QuestionType;
  prompt: string;
  answer?: string | string[] | boolean;
  choices?: string[];
  keywords?: string[];
  matchRequired?: number;
  requiredKeywords?: number;
  keywordThreshold?: number;
  explanation?: string;
  scripture?: string;
};

type AnswerValue = string | string[] | boolean | undefined;
type AnswerMap = Record<string, AnswerValue>;
type PraiseMap = Record<string, string>;
type RevealMap = Record<string, boolean>;
type CardLayerState = "active" | "ghost" | "incoming" | "leaving";
type TransitionPayload =
  | { direction: "next" | "prev"; leaving: Question; incoming: Question }
  | null;

const LIVE_BANK: Question[] = Array.isArray(liveQuestions) ? (liveQuestions as Question[]) : [];
const LEGACY_BANK: Question[] = Array.isArray(legacyQuestions) ? (legacyQuestions as Question[]) : [];
const DEFAULT_BANK: Question[] = LIVE_BANK.length ? LIVE_BANK : LEGACY_BANK;

const KEYWORD_THRESHOLD = 0.7;
const CARD_TRANSITION_MS = 440;

const PRAISE_PHRASES = [
  "Abolutely tekkers",
  "Great Work, Hoe.",
  "You will NOT be failing.",
  "Goon mate!",
  "Wowzers! Adequate!",
  "Get Crackin!", 
  "Bitchin'! (the fuck does that even mean😭)",
]; 

const FALLBACK_SUBJECT: SubjectMeta = { id: "general", label: "General", icon: "?" };

function normalizeSubjectMeta(subject?: Question["subject"]): SubjectMeta {
  if (!subject) return FALLBACK_SUBJECT;
  if (typeof subject === "string") {
    return { id: subject, label: subject, icon: "?" };
  }
  const id = subject.id || subject.label || FALLBACK_SUBJECT.id;
  return {
    id,
    label: subject.label || id || FALLBACK_SUBJECT.label,
    icon: subject.icon || FALLBACK_SUBJECT.icon,
  };
}

function normalizeText(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a = "", b = "") {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, () => 0);
  for (let j = 0; j <= b.length; j += 1) dp[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev, dp[j - 1], dp[j]) + 1;
      }
      prev = temp;
    }
  }
  return dp[b.length];
}

function similarity(a = "", b = "") {
  if (!a.length && !b.length) return 1;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function keywordMatches(input: string | undefined, keyword: string, threshold = KEYWORD_THRESHOLD): boolean {
  const normalizedInput = normalizeText(input);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return true;
  if (!normalizedInput) return false;
  if (normalizedInput.includes(normalizedKeyword)) return true;

  const inputWords = normalizedInput.split(" ").filter(Boolean);
  const keywordWords = normalizedKeyword.split(" ").filter(Boolean);

  if (keywordWords.length > 1) {
    for (let i = 0; i <= inputWords.length - keywordWords.length; i += 1) {
      const segment = inputWords.slice(i, i + keywordWords.length).join(" ");
      if (similarity(segment, normalizedKeyword) >= threshold) {
        return true;
      }
    }
  }

  return inputWords.some((word) => similarity(word, normalizedKeyword) >= threshold);
}

function extractKeywords(answer: unknown): string[] {
  if (Array.isArray(answer)) {
    return answer.map((part) => String(part));
  }
  return String(answer || "")
    .split(/(?:,|;|\/|&|\band\b|\bor\b)/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getQuestionKeywords(question?: Question): string[] {
  if (!question) return [];
  if (Array.isArray(question.keywords) && question.keywords.length) {
    return question.keywords.map((kw) => String(kw));
  }
  return extractKeywords(question.answer);
}

function getKeywordRequirement(question: Question | undefined, keywords: string[]): number {
  const configured = question && (question.matchRequired ?? question.requiredKeywords);
  if (typeof configured === "number" && configured > 0) {
    return Math.min(configured, keywords.length || configured);
  }
  return keywords.length ? 1 : 0;
}

function isShortAnswerCorrect(value: string, question?: Question): boolean {
  if (!value) return false;
  const keywords = getQuestionKeywords(question);
  if (!keywords.length) {
    return normalizeText(value) === normalizeText(formatAnswer(question?.answer));
  }
  const required = getKeywordRequirement(question, keywords);
  if (!required) return false;
  const threshold = typeof question?.keywordThreshold === "number" ? question.keywordThreshold : KEYWORD_THRESHOLD;
  const matches = keywords.reduce(
    (count, keyword) => count + (keywordMatches(value, keyword, threshold) ? 1 : 0),
    0
  );
  return matches >= required;
}

function areMultiAnswersCorrect(selected: string[], expected: string[]): boolean {
  if (selected.length !== expected.length) return false;
  const normalizedExpected = [...expected].map((choice) => String(choice)).sort();
  const normalizedSelected = [...selected].map((choice) => String(choice)).sort();
  return normalizedExpected.every((choice, index) => choice === normalizedSelected[index]);
}

function isAnswerCorrect(question: Question, value: AnswerValue): boolean {
  if (!question) return false;
  const type = String(question.type || "").toLowerCase();
  if (type === "short" || type === "text") {
    return isShortAnswerCorrect(typeof value === "string" ? value : "", question);
  }
  if (type === "mcq") {
    if (value === undefined || value === null) return false;
    return String(value) === String(question.answer);
  }
  if (type === "multi") {
    const expected = Array.isArray(question.answer) ? question.answer.map((choice) => String(choice)) : [];
    const selection = Array.isArray(value) ? (value as string[]) : [];
    return areMultiAnswersCorrect(selection, expected);
  }
  if (type === "tf" || type === "boolean") {
    const expected = typeof question.answer === "boolean" ? question.answer : String(question.answer).toLowerCase() === "true";
    return value === expected;
  }
  return false;
}

function pickPraise(): string {
  const index = Math.floor(Math.random() * PRAISE_PHRASES.length);
  return PRAISE_PHRASES[index];
}

function interleaveQuestions(list: Question[], rotation: string[]): Question[] {
  if (!rotation.length) return list;
  const buckets = new Map<string, Question[]>();
  rotation.forEach((subjectId) => {
    if (!buckets.has(subjectId)) buckets.set(subjectId, []);
  });
  list.forEach((question) => {
    const subjectId = normalizeSubjectMeta(question.subject).id;
    const bucket = buckets.get(subjectId);
    if (bucket) {
      bucket.push(question);
    }
  });
  const queues: Question[][] = rotation.map((subjectId) => [...(buckets.get(subjectId) || [])]);
  const output: Question[] = [];
  let exhausted = false;
  while (!exhausted) {
    exhausted = true;
    queues.forEach((queue) => {
      if (queue.length) {
        const nextCard = queue.shift();
        if (nextCard) {
          output.push(nextCard);
          exhausted = false;
        }
      }
    });
  }
  return output.length ? output : list;
}

function formatAnswer(answer: Question["answer"] | undefined): string {
  if (Array.isArray(answer)) {
    return answer.join(", ");
  }
  if (typeof answer === "boolean") {
    return answer ? "True" : "False";
  }
  return String(answer || "");
}

function CardLayer({ state, children }: { state: CardLayerState; children: ReactNode }) {
  return <div className={`card-layer card-layer--${state}`}>{children}</div>;
}

type QuestionCardProps = {
  question: Question;
  value: AnswerValue;
  disabled?: boolean;
  praise?: string | null;
  revealed?: boolean;
  onRevealToggle?: () => void;
  onAnswerChange?: (value: AnswerValue) => void;
  ghost?: boolean;
};

function QuestionCard({
  question,
  value,
  disabled = false,
  praise,
  revealed,
  onRevealToggle,
  onAnswerChange,
  ghost = false,
}: QuestionCardProps) {
  if (!question) return null;
  const subject = normalizeSubjectMeta(question.subject);
  const keywords = getQuestionKeywords(question);
  const required = getKeywordRequirement(question, keywords);
  const type = String(question.type || "").toLowerCase();
  const canReveal = typeof onRevealToggle === "function";
  const cardId = question.id || question.prompt;

  const handleAnswerChange = (nextValue: AnswerValue) => {
    if (typeof onAnswerChange === "function" && !disabled) {
      onAnswerChange(nextValue);
    }
  };

  const renderChoices = () => {
    const choices: string[] = Array.isArray(question.choices) ? question.choices : [];
    if (type === "mcq") {
      const mcqValue = typeof value === "string" ? value : "";
      return (
        <div className="choice-list">
          {choices.map((choice) => {
            const checked = mcqValue === choice;
            return (
              <label key={choice} className={`choice-row ${checked ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name={cardId}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => handleAnswerChange(choice)}
                />
                <span className="choice-mark" />
                <span className="choice-text">{choice}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (type === "multi") {
      const selection = Array.isArray(value) ? (value as string[]) : [];
      const toggleChoice = (choice: string) => {
        if (disabled) return;
        let next: string[] = [];
        if (selection.includes(choice)) {
          next = selection.filter((item) => item !== choice);
        } else {
          next = [...selection, choice];
        }
        handleAnswerChange(next);
      };

      return (
        <div className="choice-list choice-list--grid">
          {choices.map((choice) => {
            const checked = selection.includes(choice);
            return (
              <label key={choice} className={`choice-row choice-row--checkbox ${checked ? "is-selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleChoice(choice)}
                />
                <span className="choice-mark" />
                <span className="choice-text">{choice}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (type === "tf" || type === "boolean") {
      const active = typeof value === "boolean" ? value : null;
      return (
        <div className="tf-switch">
          {[true, false].map((option) => (
            <button
              type="button"
              key={String(option)}
              className={`tf-option ${active === option ? "is-active" : ""}`}
              onClick={() => handleAnswerChange(option)}
              disabled={disabled}
            >
              {option ? "True" : "False"}
            </button>
          ))}
        </div>
      );
    }

    const textValue = typeof value === "string" ? value : "";
    return (
      <input
        type="text"
        className="revise-input"
        placeholder="Type your answer"
        value={textValue}
        disabled={disabled}
        onChange={(event) => handleAnswerChange(event.target.value)}
      />
    );
  };

  if (ghost) {
    return (
      <article className="revise-card revise-card--ghost" aria-hidden="true">
        <div className="card-meta">
          <span className="card-subject">
            <span className="card-icon" aria-hidden="true">
              {subject.icon}
            </span>
            <span>{subject.label}</span>
          </span>
          <span className="card-topic">{question.topic || subject.label}</span>
        </div>
        <p className="card-prompt card-prompt--ghost">{question.prompt}</p>
        <p className="card-ghost-copy">Coming up next...</p>
      </article>
    );
  }

  return (
    <article className={`revise-card ${disabled ? "is-disabled" : ""}`}>
      <div className="card-meta">
        <span className="card-subject">
          <span className="card-icon" aria-hidden="true">
            {subject.icon}
          </span>
          <span>{subject.label}</span>
        </span>
        <span className="card-topic">{question.topic || subject.label}</span>
      </div>

      <h2 className="card-prompt">{question.prompt}</h2>

      <div className="card-body">
        {renderChoices()}
        {(type === "short" || type === "text") && keywords.length > 0 && (
          <p className="keyword-hint">
            Hit {required} of {keywords.length} keywords. Spelling can be rough as long as you are close.
          </p>
        )}
      </div>

      {praise && <div className="card-praise">{praise}</div>}

      {canReveal && (
        <div className="card-actions">
          <button type="button" className="ghost-button" onClick={onRevealToggle}>
            {revealed ? "Hide answer" : "Reveal model answer"}
          </button>
        </div>
      )}

      {revealed && (
        <div className="card-reveal">
          <p className="card-reveal__heading">Model answer</p>
          <p className="card-reveal__body">{formatAnswer(question.answer)}</p>
          {question.explanation && <p className="card-reveal__note">{question.explanation}</p>}
          {question.scripture && (
            <p className="card-reveal__note">
              <em>{question.scripture}</em>
            </p>
          )}
          {keywords.length > 0 && (
            <p className="card-reveal__keywords">
              Keywords:{" "}
              <span>
                {keywords.map((kw, index) => (
                  <span key={kw}>
                    {kw}
                    {index < keywords.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
            </p>
          )}
        </div>
      )}
    </article>
  );
}

type ReviseProps = {
  title?: string;
  questions?: Question[];
};

export default function Revise({ title = "Revise", questions = DEFAULT_BANK }: ReviseProps) {
  const rawBank = useMemo<Question[]>(
    () => (Array.isArray(questions) && questions.length ? questions : DEFAULT_BANK),
    [questions]
  );
  const subjects = useMemo<SubjectMeta[]>(() => {
    const map = new Map<string, SubjectMeta>();
    rawBank.forEach((question) => {
      const meta = normalizeSubjectMeta(question.subject);
      if (!map.has(meta.id)) map.set(meta.id, meta);
    });
    return Array.from(map.values());
  }, [rawBank]);

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [praiseMap, setPraiseMap] = useState<PraiseMap>({});
  const [revealedMap, setRevealedMap] = useState<RevealMap>({});
  const [transition, setTransition] = useState<TransitionPayload>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedSubjects((prev) => {
      if (!subjects.length) return [];
      if (!prev.length) return subjects.map((subject) => subject.id);
      const next = prev.filter((id) => subjects.some((subject) => subject.id === id));
      return next.length ? next : subjects.map((subject) => subject.id);
    });
  }, [subjects]);

  const filteredBank = useMemo<Question[]>(() => {
    if (!selectedSubjects.length) return [];
    const allowed = new Set<string>(selectedSubjects);
    return rawBank.filter((question) => allowed.has(normalizeSubjectMeta(question.subject).id));
  }, [rawBank, selectedSubjects]);

  const quizBank = useMemo<Question[]>(
    () => interleaveQuestions(filteredBank, selectedSubjects),
    [filteredBank, selectedSubjects]
  );

  useEffect(() => {
    setIndex(0);
    setTransition(null);
  }, [quizBank.length]);

  useEffect(
    () => () => {
      if (animationRef.current !== null) {
        window.clearTimeout(animationRef.current);
      }
    },
    []
  );

  const currentQuestion = quizBank[index] || null;
  const nextQuestion = quizBank[index + 1] || null;
  const total = quizBank.length;
  const progress = total ? ((index + 1) / total) * 100 : 0;

  const handleAnswerChange = (question: Question, value: AnswerValue) => {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    const satisfied = isAnswerCorrect(question, value);
    setPraiseMap((prev) => {
      if (satisfied) {
        if (prev[question.id]) return prev;
        return { ...prev, [question.id]: pickPraise() };
      }
      if (!prev[question.id]) return prev;
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
  };

  const handleRevealToggle = (questionId: string) => {
    setRevealedMap((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const beginTransition = (direction: "next" | "prev") => {
    if (!currentQuestion || transition) return;
    const delta = direction === "next" ? 1 : -1;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= quizBank.length) return;
    const payload = {
      direction,
      leaving: currentQuestion,
      incoming: quizBank[targetIndex],
    };
    setTransition(payload);
    const finishTransition = () => {
      setIndex(targetIndex);
      setTransition(null);
      animationRef.current = null;
    };
    if (typeof window === "undefined") {
      finishTransition();
      return;
    }
    animationRef.current = window.setTimeout(finishTransition, CARD_TRANSITION_MS);
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subjectId)) {
        return prev.filter((id) => id !== subjectId);
      }
      return [...prev, subjectId];
    });
  };

  const selectAllSubjects = () => {
    setSelectedSubjects(subjects.map((subject) => subject.id));
  };

  const clearSubjects = () => {
    setSelectedSubjects([]);
  };

  const isAnimating = Boolean(transition);

  return (
    <div className="revise-container">
      <div className="revise-shell">
        <header className="revise-header">
          <p className="revise-eyebrow">Flash stack</p>
          <h1 className="revise-title">{title}</h1>
          <p className="revise-subtitle">Pick any subjects. Cards automatically interleave in the order you toggle.</p>
        </header>

        {subjects.length > 0 && (
          <section className="subject-panel">
            <div className="subject-panel__row">
              <span className="subject-panel__label">Subjects</span>
              <div className="subject-panel__controls">
                <button type="button" className="chip-control" onClick={selectAllSubjects}>
                  All
                </button>
                <button
                  type="button"
                  className="chip-control"
                  onClick={clearSubjects}
                  disabled={!selectedSubjects.length}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="subject-chip-row">
              {subjects.map((subject) => {
                const active = selectedSubjects.includes(subject.id);
                return (
                  <button
                    type="button"
                    key={subject.id}
                    className={`subject-pill ${active ? "active" : ""}`}
                    onClick={() => toggleSubject(subject.id)}
                    aria-pressed={active}
                  >
                    <span className="subject-icon" aria-hidden="true">
                      {subject.icon}
                    </span>
                    <span className="subject-label">{subject.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="subject-panel__hint">
              Keep multiple pills lit to mix topics. The stack cycles through them in pill order for spaced retrieval.
            </p>
          </section>
        )}

        <div className="revise-progress">
          <div className="revise-progress__text">
            {total ? `Card ${index + 1} / ${total}` : "No cards yet"}
          </div>
          <div className="revise-progress__track" aria-hidden="true">
            <div className="revise-progress__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="card-stage">
          {transition ? (
            <>
              {transition.leaving && (
                <CardLayer state="leaving" key={`leaving-${transition.leaving.id}`}>
                  <QuestionCard
                    question={transition.leaving}
                    value={answers[transition.leaving.id]}
                    disabled
                    praise={null}
                    revealed={!!revealedMap[transition.leaving.id]}
                  />
                </CardLayer>
              )}
              {transition.incoming && (
                <CardLayer state="incoming" key={`incoming-${transition.incoming.id}`}>
                  <QuestionCard
                    question={transition.incoming}
                    value={answers[transition.incoming.id]}
                    disabled
                    praise={praiseMap[transition.incoming.id]}
                    revealed={!!revealedMap[transition.incoming.id]}
                  />
                </CardLayer>
              )}
            </>
          ) : (
            <>
              {nextQuestion && (
                <CardLayer state="ghost" key={`ghost-${nextQuestion.id}`}>
                  <QuestionCard question={nextQuestion} value={answers[nextQuestion.id]} ghost />
                </CardLayer>
              )}
              {currentQuestion && (
                <CardLayer state="active" key={currentQuestion.id}>
                  <QuestionCard
                    question={currentQuestion}
                    value={answers[currentQuestion.id]}
                    praise={praiseMap[currentQuestion.id]}
                    revealed={!!revealedMap[currentQuestion.id]}
                    onRevealToggle={() => handleRevealToggle(currentQuestion.id)}
                    onAnswerChange={(value) => handleAnswerChange(currentQuestion, value)}
                  />
                </CardLayer>
              )}
            </>
          )}

          {!currentQuestion && !transition && (
            <div className="revise-empty">
              <p>Select at least one subject to start interleaving cards.</p>
            </div>
          )}
        </div>

        <div className="revise-nav">
          <button
            type="button"
            className="nav-button"
            onClick={() => beginTransition("prev")}
            disabled={isAnimating || index === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="nav-button nav-button--primary"
            onClick={() => beginTransition("next")}
            disabled={isAnimating || index >= total - 1}
          >
            Next card
          </button>
        </div>
      </div>
    </div>
  );
}
