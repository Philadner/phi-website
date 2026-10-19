import { CATEGORIES, MODEL, matchedCategories, validateResult } from './core.mjs'

const $ = id => document.getElementById(id)
const storageKey = 'phi-moderation-lab-thresholds-v1'
let thresholds = Object.fromEntries(CATEGORIES.map(category => [category, .5]))
let rows = []
let scoredInput = ''
let token = ''
try {
  const saved = JSON.parse(localStorage.getItem(storageKey))
  if (validThresholds(saved)) thresholds = saved
} catch { /* Storage may be unavailable. The lab still works. */ }

function validThresholds(value) {
  return value && CATEGORIES.every(category => typeof value[category] === 'number' && Number.isFinite(value[category]) && value[category] >= 0 && value[category] <= 1)
}
function status(message, error = false) {
  $('status').textContent = message
  $('status').className = error ? 'error' : ''
}
function node(tag, text, className) {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  if (className) element.className = className
  return element
}
function remember() {
  try { localStorage.setItem(storageKey, JSON.stringify(thresholds)) } catch { /* Optional persistence. */ }
}
function renderSliders() {
  $('sliders').replaceChildren(...CATEGORIES.map(category => {
    const wrapper = node('div', undefined, 'slider')
    const heading = node('div', undefined, 'slider-label')
    const label = node('label', category)
    label.htmlFor = `range-${category}`
    const number = node('input')
    number.type = 'number'
    number.min = '0'
    number.max = '1'
    number.step = '.0001'
    number.value = thresholds[category]
    number.setAttribute('aria-label', `${category} exact threshold`)
    const range = node('input')
    range.id = label.htmlFor
    range.type = 'range'
    range.min = '0'
    range.max = '1'
    range.step = '.0001'
    range.value = thresholds[category]
    const update = value => {
      thresholds[category] = Number(value)
      remember()
      renderResults()
    }
    range.addEventListener('input', () => { number.value = range.value; update(range.value) })
    number.addEventListener('input', () => {
      if (!number.value || !number.validity.valid) return
      range.value = number.value
      update(number.value)
    })
    number.addEventListener('change', () => { number.value = thresholds[category] })
    heading.append(label, number)
    wrapper.append(heading, range, node('small', 'Stricter ← → More permissive'))
    return wrapper
  }))
}
function renderResults() {
  const flagged = rows.filter(row => matchedCategories(row.hatefulness, thresholds).length).length
  $('summary').textContent = rows.length ? `${flagged} hidden by default · ${rows.length - flagged} visible · ${rows.length} scored` : 'Run moderation to see your results.'
  $('session').disabled = !rows.length
  $('stale').hidden = !rows.length || $('samples').value === scoredInput
  const fragment = document.createDocumentFragment()
  for (const [index, row] of rows.entries()) {
    const matches = matchedCategories(row.hatefulness, thresholds)
    if ($('view').value === 'flagged' && !matches.length || $('view').value === 'clear' && matches.length) continue
    const article = node('article', undefined, `result${matches.length ? ' flagged' : ''}`)
    article.append(node('p', row.text, 'phrase'))
    article.append(node('div', `#${index + 1} · Your filter: ${matches.length ? 'hidden' : 'visible'} · OpenAI flag: ${row.hatefulness.flagged ? 'yes' : 'no'}`, 'meta'))
    if (matches.length) article.append(node('p', `Your message will be hidden by default unless people turn moderation off. This is because it contains ${matches.join(', ')}.`, 'reason'))
    const details = node('details')
    details.append(node('summary', 'Inspect category scores'))
    for (const category of CATEGORIES) {
      const score = node('div', undefined, `score-row${matches.includes(category) ? ' above' : ''}`)
      score.append(node('span', category), node('span', `${row.hatefulness.category_scores[category].toPrecision(5)} / ${thresholds[category]}`))
      details.append(score)
    }
    article.append(details)
    fragment.append(article)
  }
  $('results').replaceChildren(fragment)
}
function download(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }))
  const anchor = node('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function configuration() { return { version: 1, model: MODEL, comparison: '>=', thresholds } }

$('run').addEventListener('click', async () => {
  const input = $('samples').value
  const key = $('key').value.trim()
  if (!key) { status('Enter your OpenAI API key first.', true); $('key').focus(); return }
  $('run').disabled = true
  $('load').disabled = true
  status('Running moderation… Larger lists are sent in batches. Keep this page open.')
  try {
    const response = await fetch('/moderate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lab-Token': token },
      body: JSON.stringify({ key, samples: input }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'Moderation failed.')
    rows = data.rows
    scoredInput = input
    renderResults()
    status(`Scored ${rows.length} samples. Adjust the sliders to preview your filter instantly.`)
  } catch (error) { status(error.message, true) }
  finally { $('run').disabled = false; $('load').disabled = false }
})
$('load').addEventListener('click', async () => {
  if ($('samples').value.trim() && !confirm('Replace the text in your sample editor with the current phrase list? Your scored results will remain available.')) return
  $('load').disabled = true
  try {
    const response = await fetch('/phrases')
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'Could not load phrases.')
    $('samples').value = JSON.stringify(data.phrases, null, 2)
    renderResults()
    status(`Loaded ${data.phrases.length} phrases. Click Run moderation to score them.`)
  } catch (error) { status(error.message, true) }
  finally { $('load').disabled = false }
})
$('export').addEventListener('click', () => download('phi-moderation-thresholds.json', configuration()))
$('session').addEventListener('click', () => download('phi-moderation-samples.json', { ...configuration(), rows }))
$('reset').addEventListener('click', () => {
  thresholds = Object.fromEntries(CATEGORIES.map(category => [category, .5]))
  remember(); renderSliders(); renderResults()
})
$('view').addEventListener('change', renderResults)
$('samples').addEventListener('input', () => { $('stale').hidden = !rows.length || $('samples').value === scoredInput })
$('import').addEventListener('change', async () => {
  const file = $('import').files[0]
  if (!file) return
  try {
    if (file.size > 15000000) throw new Error('That file is too large.')
    const data = JSON.parse(await file.text())
    if (data.version !== 1 || data.model !== MODEL || data.comparison !== '>=' || !validThresholds(data.thresholds)) throw new Error('Invalid threshold export.')
    if (data.rows !== undefined && (!Array.isArray(data.rows) || data.rows.length > 1000 || data.rows.some(row => typeof row.text !== 'string' || row.text.length > 10000 || !validateResult(row.hatefulness)))) throw new Error('Invalid scored samples.')
    thresholds = Object.fromEntries(CATEGORIES.map(category => [category, data.thresholds[category]]))
    if (data.rows) {
      rows = data.rows
      scoredInput = JSON.stringify(rows.map(row => row.text), null, 2)
      $('samples').value = scoredInput
    }
    remember(); renderSliders(); renderResults()
    status('Restored your export. No API call was made.')
  } catch (error) { status(error.message, true) }
  finally { $('import').value = '' }
})

renderSliders()
fetch('/config').then(response => {
  if (!response.ok) throw new Error('Could not initialise the local server.')
  return response.json()
}).then(config => {
  token = config.token
  $('run').disabled = false
  $('load').disabled = false
  $('export').disabled = false
  status('Ready. Paste samples or load the current list.')
}).catch(error => status(error.message, true))
