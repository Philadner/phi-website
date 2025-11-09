# Instructions for how to overhaul revise.tsx

## Features wanted
- Card Structure for questions, must be animated (When you click next question, the current card falls off the page and the next one under it goes forwards) 
- Questions must be consise, but easy to answer
    - Text answers must be checked using keywords, and have a 70% threshold for matching. For example, You could have a question which requires 2 keywords to match and has 4 keywords in total, so any 2 of those keywords could be in there and spelt 70% correctly
    - Any question should not give any negative feedback. Only give positive feedback when a correct answer is supplied
    For multiple choice questions:
        - If there's one correct answer, Dot radio buttons
        - If there's mutiple correct answer, checkboxes. 
        - For true or false, a big switch with 2 squircle buttons that say true and false on them
- The ability to select multiple subjects and have their questions automatically interleaved
- Make a question template at the bottom of this doc. The questions will be in (relative path from revise.tsx) ../data/questions.json


## Question template (for ../data/questions.json)
Copy the structure below for every entry inside `src/data/questions.json`. Keep the JSON array flat and make sure each `id` is unique.

```json
{
  "id": "re-101",
  "subject": { "id": "rs_christianity", "label": "RE", "icon": "?" },
  "topic": "1.1 Nature of God",
  "type": "short",
  "prompt": "Give two qualities of God.",
  "keywords": ["omnipotent", "omnibenevolent", "omniscient", "just"],
  "matchRequired": 2,
  "answer": ["Omnipotent", "Omnibenevolent"],
  "explanation": "Any two of the classic attributes score.",
  "scripture": "John 3:16"
}
```

Field rules:
- `subject`: keep `id`, `label`, and `icon` so the UI can group and decorate cards. The icon can be any short text/emoji.
- `type`: one of `short`, `mcq`, `multi`, or `tf`.
- `short`/text prompts should always include `keywords` plus `matchRequired` (how many keywords must be present). Optional `keywordThreshold` overrides the default 0.7 fuzzy match.
- `mcq`: provide a `choices` array of strings and set `answer` to the single correct string.
- `multi`: provide `choices` and set `answer` to an array of every correct choice (order does not matter).
- `tf`: set `answer` to `true` or `false`.
- Keep `answer`, `explanation`, and `scripture` concise—the reveal panel shows them verbatim.
- Store every question inside `src/data/questions.json` (relative to `revise.tsx`, this is `../data/questions.json`).
