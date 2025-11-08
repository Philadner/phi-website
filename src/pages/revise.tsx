import React, { useMemo, useState, useEffect } from "react";
import "../stylesheets/revise.css";
import questions from "../data/questions.json";

const DEFAULT_BANK = questions;
/**
 * PhiQuiz - RS Unit 1: Card Stack Quiz with Seneca-style instant feedback
 */

const KEYWORD_THRESHOLD = 0.8;

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

function extractKeywords(answer) {
  if (Array.isArray(answer)) {
    return answer.map((part) => String(part));
  }
  return String(answer)
    .split(/(?:,|;|\/|&| and | or )/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

function keywordMatches(input, keyword) {
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
      if (similarity(segment, normalizedKeyword) >= KEYWORD_THRESHOLD) {
        return true;
      }
    }
  }

  return inputWords.some((word) => similarity(word, normalizedKeyword) >= KEYWORD_THRESHOLD);
}

function normalizeSubjectMeta(subject) {
  if (subject && typeof subject === "object") {
    const id = subject.id || subject.label || "general";
    return {
      id,
      label: subject.label || subject.id || "General",
      icon: subject.icon || "📘",
    };
  }
  if (typeof subject === "string") {
    return { id: subject, label: subject, icon: "📘" };
  }
  return { id: "general", label: "General", icon: "📘" };
}

function shuffleQuestions(list) {
  const array = [...list];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default function PhiQuiz({ title = "Unit 1 - Christianity Quiz", questions = [] }) {
  const rawBank = useMemo(() => (questions.length ? questions : DEFAULT_BANK), [questions]);
  const subjects = useMemo(() => {
    const map = new Map();
    rawBank.forEach((q) => {
      const meta = normalizeSubjectMeta(q.subject);
      map.set(meta.id, meta);
    });
    return Array.from(map.values());
  }, [rawBank]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [quizBank, setQuizBank] = useState(rawBank);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!subjects.length) return;
    setSelectedSubjects((prev) => {
      if (!prev.length) return subjects.map((subject) => subject.id);
      const next = subjects.filter((subject) => prev.includes(subject.id)).map((subject) => subject.id);
      return next.length ? next : subjects.map((subject) => subject.id);
    });
  }, [subjects]);

  useEffect(() => {
    if (!rawBank.length) {
      setQuizBank([]);
      return;
    }
    const ids = new Set(selectedSubjects);
    const filtered = rawBank.filter((q) => {
      if (!ids.size) return true;
      const meta = normalizeSubjectMeta(q.subject);
      return ids.has(meta.id);
    });
    const pool = filtered.length ? filtered : rawBank;
    setQuizBank(shuffleQuestions(pool));
    setIndex(0);
    setAnswers({});
    setFeedback({});
    setRevealed(false);
  }, [rawBank, selectedSubjects]);

  const current = quizBank[index];
  const total = quizBank.length;

  useEffect(() => {
    document.title = title;
  }, [title]);

  function toggleSubject(subjectId) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return Array.from(next);
    });
  }

  function handleNext() {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setRevealed(false);
    }
  }

  function handlePrev() {
    if (index > 0) {
      setIndex((i) => i - 1);
      setRevealed(false);
    }
  }

  function updateFeedback(q, status) {
    setFeedback((prev) => {
      const next = { ...prev };
      if (!status) {
        delete next[q.id];
      } else {
        next[q.id] = status;
      }
      return next;
    });
  }

  function checkAnswer(value, q) {
    if (q.type === "mcq") {
      const correct =
        String(value).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
      updateFeedback(q, correct ? "correct" : "wrong");
      return;
    }

    if (q.type === "tf") {
      updateFeedback(q, value === q.answer ? "correct" : "wrong");
      return;
    }

    if (q.type === "multi") {
      const selections = Array.isArray(value) ? value : [];
      if (!selections.length) {
        updateFeedback(q, null);
        return;
      }
      const userSet = new Set(selections);
      const ansSet = new Set(q.answer);
      const hasInvalid = selections.some((choice) => !ansSet.has(choice));
      if (hasInvalid || selections.length > ansSet.size) {
        updateFeedback(q, "wrong");
        return;
      }
      if (selections.length === ansSet.size && [...userSet].every((choice) => ansSet.has(choice))) {
        updateFeedback(q, "correct");
      } else {
        updateFeedback(q, null);
      }
      return;
    }

    if (q.type === "short") {
      const userText = String(value);
      const normalizedInput = normalizeText(userText);
      if (!normalizedInput) {
        updateFeedback(q, null);
        return;
      }
      const keywords = extractKeywords(q.answer);
      const meetsKeywords = keywords.length
        ? keywords.every((keyword) => keywordMatches(userText, keyword))
        : similarity(normalizedInput, normalizeText(String(q.answer))) >= KEYWORD_THRESHOLD;
      updateFeedback(q, meetsKeywords ? "correct" : null);
    }
  }

  return (
    <div className="revise-container">
      {subjects.length > 0 && (
        <div className="subject-scroller">
          {subjects.map((subject) => {
            const isSelected = selectedSubjects.includes(subject.id);
            return (
              <button
                key={subject.id}
                type="button"
                className={`subject-pill ${isSelected ? "active" : ""}`}
                onClick={() => toggleSubject(subject.id)}
                aria-pressed={isSelected}
              >
                <span className="subject-icon" aria-hidden="true">
                  {subject.icon}
                </span>
                <span className="subject-label">{subject.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <h1 className="revise-title">{title}</h1>
      <div className="revise-progress">
        <div
          className="revise-progress-bar"
          style={{ width: total ? `${((index + 1) / total) * 100}%` : "0%" }}
        ></div>
      </div>

      {current && (
        <div className={`revise-card ${feedback[current.id]}`}> 
          <h2 className="revise-topic">{current.topic}</h2>
          <p className="revise-prompt">{current.prompt}</p>

          {current.type === "mcq" && (
            <div className="revise-choices">
              {current.choices.map((choice) => (
                <label key={choice} className="revise-choice">
                  <input
                    type="radio"
                    name={current.id}
                    value={choice}
                    checked={answers[current.id] === choice}
                    onChange={(e) => {
                      setAnswers({ ...answers, [current.id]: choice });
                      checkAnswer(choice, current);
                    }}
                  />
                  {choice}
                </label>
              ))}
            </div>
          )}

          {current.type === "multi" && (
            <div className="revise-choices">
              {current.choices.map((choice) => {
                const selected = Array.isArray(answers[current.id]) && answers[current.id].includes(choice);
                return (
                  <label key={choice} className="revise-choice">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        let newAns = Array.isArray(answers[current.id]) ? [...answers[current.id]] : [];
                        if (e.target.checked) newAns.push(choice);
                        else newAns = newAns.filter((c) => c !== choice);
                        setAnswers({ ...answers, [current.id]: newAns });
                        checkAnswer(newAns, current);
                      }}
                    />
                    {choice}
                  </label>
                );
              })}
            </div>
          )}

          {current.type === "short" && (
            <input
              className="revise-input"
              type="text"
              placeholder="Type your answer"
              value={answers[current.id] || ""}
              onChange={(e) => {
                setAnswers({ ...answers, [current.id]: e.target.value });
                checkAnswer(e.target.value, current);
              }}
            />
          )}

          {current.type === "tf" && (
            <div className="revise-choices">
              {[true, false].map((val) => (
                <label key={String(val)} className="revise-choice">
                  <input
                    type="radio"
                    name={current.id}
                    checked={answers[current.id] === val}
                    onChange={() => {
                      setAnswers({ ...answers, [current.id]: val });
                      checkAnswer(val, current);
                    }}
                  />
                  {val ? "True" : "False"}
                </label>
              ))}
            </div>
          )}

          <div className="revise-controls">
            <button onClick={handlePrev} disabled={index === 0}>Previous</button>
            <button onClick={() => setRevealed(!revealed)}>Reveal</button>
            <button onClick={handleNext} disabled={index === total - 1}>Next</button>
          </div>

          {(revealed || feedback[current.id]) && (
            <div className="revise-answer">
              <p><strong>Answer:</strong> {Array.isArray(current.answer) ? current.answer.join(", ") : String(current.answer)}</p>
              {feedback[current.id] === "correct" && <p className="feedback-correct">✅ Correct!</p>}
              {feedback[current.id] === "wrong" && <p className="feedback-wrong">❌ Wrong, try again.</p>}
              {current.explanation && <p>{current.explanation}</p>}
              {current.scripture && <p><em>{current.scripture}</em></p>}
            </div>
          )}
        </div>
      )}

      <p className="revise-footer">Card {total ? index + 1 : 0} / {total}</p>
    </div>
  );
}

