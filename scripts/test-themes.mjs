import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

const palettes = JSON.parse(readFileSync(new URL('../src/lib/themes.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('../src/lib/themes.ts', import.meta.url), 'utf8')
  .replace("import palettes from './themes.json'", `const palettes = ${JSON.stringify(palettes)}`)
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
const { themes, contrast, paintTheme, getSavedTheme } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const properties = new Map()
globalThis.document = { documentElement: { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) } } }
let saved = null
globalThis.localStorage = { getItem: () => saved }
assert.equal(themes.length, 22)
assert.equal(new Set(themes.map(theme => theme.id)).size, themes.length)
assert.equal(themes.at(-1).id, 'hub')
assert.equal(themes[0].highlight, '#FFD700')
assert.equal(getSavedTheme().id, 'phi')
saved = 'invalid'
assert.equal(getSavedTheme().id, 'phi')
saved = 'igor'
assert.equal(getSavedTheme().id, 'igor')
assert.equal(contrast('#000000', '#FFFFFF'), 21)
const report = ['# Album theme contrast audit', '', 'Ratios use WCAG relative luminance. AA targets: 4.5:1 normal text, 3:1 large text. The 20 album palettes are preserved exactly. hub adds a black/white/grey/orange palette (#FF9900 highlight) as the final option. phi retains the original labs CSS gold theme (#FFD700), with its original surface and text colours. Its swatch represents the original dark background, white foreground, darkgoldenrod detail and CSS gold accent. The label on filled highlight controls uses whichever existing palette token offers the highest contrast. Currents, 808s & Heartbreak, DAMN. and CALL ME IF YOU GET LOST have no available 4.5:1 button foreground, so highlight controls require the 3:1 large-text threshold; theme names in the homepage wheel use the readable foreground roles. Existing control typography is preserved. Themed page actions use highlight when it supports normal-text AA, otherwise primary with the best palette foreground.', '', '| Theme | Primary / background | Secondary / background | Button / highlight |', '|---|---:|---:|---:|']
for (const theme of themes) {
  paintTheme(theme)
  assert.equal(document.documentElement.dataset.theme, theme.id)
  if (theme.id !== 'phi') assert.equal(document.documentElement.style.colorScheme, theme.mode)
  assert.equal(properties.get('--background'), theme.background)
  const foreground = properties.get('--highlight-text')
  assert.ok([theme.background, theme.primary, theme.secondary, theme.highlight].includes(foreground))
  assert.ok(contrast(foreground, theme.highlight) >= 3, theme.name)
  const colours = [theme.background, theme.primary, theme.secondary, theme.highlight]
  for (const token of ['--theme-text', '--theme-muted', '--theme-border', '--theme-accent', '--action-background', '--action-text']) assert.ok(colours.includes(properties.get(token)), token)
  assert.ok(contrast(properties.get('--theme-text'), theme.background) >= Math.min(4.5, Math.max(...colours.map(colour => contrast(colour, theme.background)))))
  // Preserve supplied palettes with no AA pair, while requiring their best available contrast.
  const bestPair = Math.max(...colours.flatMap(background => colours.map(text => contrast(text, background))))
  assert.ok(contrast(properties.get('--action-text'), properties.get('--action-background')) >= Math.min(4.5, bestPair), theme.name)
  report.push(`| ${theme.name} | ${contrast(theme.primary, theme.background).toFixed(2)} | ${contrast(theme.secondary, theme.background).toFixed(2)} | ${contrast(foreground, theme.highlight).toFixed(2)} |`)
}
document.documentElement.dataset = {}
localStorage.getItem = () => { throw new Error('Storage disabled') }
assert.equal(getSavedTheme().id, 'phi')
report.push('', 'channel ORANGE primary text fails even the large-text target. MBDTF primary text and several secondary colours fail normal-text AA. These are palette limitations, not silently adjusted colours. Themed pages now derive readable text roles from the existing four colours: primary when it passes normal-text AA, otherwise the best colour against the background; supporting text falls back to that role. No palette values are changed. MBDTF has no normal-text AA foreground against its specified background, so it retains the highest available contrast. A Broken Frame preserves the four supplied swatches: its best body-text contrast is 3.78:1 and its best control pair is 4.18:1, so it meets the large-text threshold but cannot reach normal-text AA using only these colours.', '', 'The retired 1998 mode no longer overrides saved themes. Album themes apply to the site, including shared music and chat chrome; game pieces, chart signals and media artwork retain their semantic colours.', '')
if (process.argv.includes('--write-audit')) writeFileSync(new URL('../docs/theme-contrast.md', import.meta.url), report.join('\n'))
console.log(`PASS: ${themes.length} palettes, unknown/stored/blocked-storage fallback, paint/mode updates, and AA large-text button foregrounds for every theme`)

if (process.argv.includes('--check-build')) {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
  const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(bootstrap, 'blocking head script exists')
  for (const id of [...themes.map(theme => theme.id), 'unknown', null, 'blocked']) {
    const values = new Map()
    const root = { dataset: {}, style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) } }
    vm.runInNewContext(bootstrap, {
      document: { documentElement: root },
      localStorage: { getItem: key => {
        if (id === 'blocked') throw new Error('blocked')
        return key === 'phi.theme' ? id : null
      } },
    })
    const expected = themes.find(theme => theme.id === id) ?? themes[0]
    assert.equal(root.dataset.theme, expected.id)
    assert.equal(values.get('--background'), expected.background)
  }
  console.log(`PASS: production before-paint bootstrap restores all ${themes.length} themes and handles invalid/unavailable storage`)
}
