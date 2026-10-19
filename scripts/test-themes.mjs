import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

const palettes = JSON.parse(readFileSync(new URL('../src/lib/themes.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('../src/lib/themes.ts', import.meta.url), 'utf8')
  .replace("import palettes from './themes.json'", `const palettes = ${JSON.stringify(palettes)}`)
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
const { themes, contrast, paintTheme, getSavedTheme, themeVisible } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const properties = new Map()
globalThis.document = { documentElement: { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) } } }
let saved = null
globalThis.localStorage = { getItem: () => saved }
assert.equal(themes.length, 23)
assert.equal(new Set(themes.map(theme => theme.id)).size, themes.length)
assert.equal(themes.at(-1).id, 'hub')
assert.equal(themes.at(-2).id, 'mycp')
assert.equal(themes[0].highlight, '#FFD700')
assert.equal(getSavedTheme().id, 'phi')
saved = 'invalid'
assert.equal(getSavedTheme().id, 'phi')
saved = 'igor'
assert.equal(getSavedTheme().id, 'igor')
assert.equal(contrast('#000000', '#FFFFFF'), 21)
assert.equal(themes.filter(theme => themeVisible(theme, false)).length, 21)
for (const id of ['mycp', 'hub']) {
  saved = id
  localStorage.getItem = key => key === 'phi.theme' ? saved : null
  assert.equal(getSavedTheme().id, 'phi', `${id} requires offensive content enabled`)
  localStorage.getItem = key => key === 'phi.theme' ? saved : JSON.stringify({ showOffensive: true })
  assert.equal(getSavedTheme().id, id)
}

const report = ['# Theme contrast audit', '', 'Each theme has four palette colours plus an independent text colour. Body text must meet 4.5:1 contrast against its background. Existing readable primary text colours are retained; other themes use black or white. MyCP preserves its original white, green, dark green and pink palette with black body text. Control labels can also use the text colour for contrast. phi retains its original CSS styling.', '', '| Theme | Body / background | Primary / background | Secondary / background | Button / highlight |', '|---|---:|---:|---:|---:|']
for (const theme of themes) {
  paintTheme(theme)
  assert.equal(document.documentElement.dataset.theme, theme.id)
  if (theme.id !== 'phi') assert.equal(document.documentElement.style.colorScheme, theme.mode)
  assert.equal(properties.get('--background'), theme.background)
  const foreground = properties.get('--highlight-text')
  assert.ok([theme.background, theme.primary, theme.secondary, theme.highlight, theme.text].includes(foreground))
  assert.ok(contrast(foreground, theme.highlight) >= 3, theme.name)
  const colours = [theme.background, theme.primary, theme.secondary, theme.highlight, theme.text]
  for (const token of ['--theme-text', '--theme-muted', '--theme-border', '--theme-accent', '--action-background', '--action-text']) assert.ok(colours.includes(properties.get(token)), token)
  assert.equal(properties.get('--theme-text'), theme.text)
  assert.ok(contrast(theme.text, theme.background) >= 4.5, `${theme.name} body text`)
  // Controls must use an AA pair whenever the palette and text colour provide one.
  const bestPair = Math.max(...colours.flatMap(background => colours.map(text => contrast(text, background))))
  assert.ok(contrast(properties.get('--action-text'), properties.get('--action-background')) >= Math.min(4.5, bestPair), theme.name)
  report.push(`| ${theme.name} | ${contrast(theme.text, theme.background).toFixed(2)} | ${contrast(theme.primary, theme.background).toFixed(2)} | ${contrast(theme.secondary, theme.background).toFixed(2)} | ${contrast(foreground, theme.highlight).toFixed(2)} |`)
}
document.documentElement.dataset = {}
localStorage.getItem = () => { throw new Error('Storage disabled') }
assert.equal(getSavedTheme().id, 'phi')
report.push('', 'The four palette colours remain unchanged. Readable body text is independent of primary and secondary accents. Supporting text uses secondary when readable, otherwise the body text colour. The retired 1998 mode no longer overrides saved themes. Game pieces, chart signals and media artwork retain their semantic colours.', '')
if (process.argv.includes('--write-audit')) writeFileSync(new URL('../docs/theme-contrast.md', import.meta.url), report.join('\n'))
console.log(`PASS: ${themes.length} palettes, unknown/stored/blocked-storage fallback, paint/mode updates, and AA large-text button foregrounds for every theme`)

if (process.argv.includes('--check-build')) {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
  const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(bootstrap, 'blocking head script exists')
  for (const showOffensive of [false, true]) for (const id of [...themes.map(theme => theme.id), 'unknown', null, 'blocked']) {
    const values = new Map()
    const root = { dataset: {}, style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) } }
    vm.runInNewContext(bootstrap, {
      document: { documentElement: root },
      localStorage: { getItem: key => {
        if (id === 'blocked') throw new Error('blocked')
        return key === 'phi.theme' ? id : JSON.stringify({ showOffensive })
      } },
    })
    const expected = themes.find(theme => theme.id === id && themeVisible(theme, showOffensive)) ?? themes[0]
    assert.equal(root.dataset.theme, expected.id)
    assert.equal(values.get('--background'), expected.background)
    assert.equal(values.get('--theme-text'), expected.text)
  }
  console.log(`PASS: production before-paint bootstrap restores all ${themes.length} themes and handles invalid/unavailable storage`)
}
