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
assert.equal(themes.length, 19)
assert.equal(new Set(themes.map(theme => theme.id)).size, 19)
assert.equal(themes.at(-1).id, 'hub')
assert.equal(themes[0].highlight, '#FFD700')
assert.equal(getSavedTheme().id, 'phi')
saved = 'invalid'
assert.equal(getSavedTheme().id, 'phi')
saved = 'igor'
assert.equal(getSavedTheme().id, 'igor')
assert.equal(contrast('#000000', '#FFFFFF'), 21)
const report = ['# Album theme contrast audit', '', 'Ratios use WCAG relative luminance. AA targets: 4.5:1 normal text, 3:1 large text. The 17 album palettes are preserved exactly. hub adds a black/white/grey/orange palette (#FF9900 highlight) as the final option. phi retains the original labs CSS gold theme (#FFD700), with its original surface and text colours. Its swatch represents the original dark background, white foreground, darkgoldenrod detail and CSS gold accent. The label on filled highlight controls uses whichever existing palette token offers the highest contrast. Currents, 808s & Heartbreak, DAMN. and CALL ME IF YOU GET LOST have no available 4.5:1 button foreground, so the new picker Apply button uses bold text at 19px (the 3:1 large-text threshold). Existing control typography is preserved; the ratios below identify limitations in smaller existing controls.', '', '| Theme | Primary / background | Secondary / background | Button / highlight |', '|---|---:|---:|---:|']
for (const theme of themes) {
  paintTheme(theme)
  assert.equal(document.documentElement.dataset.theme, theme.id)
  if (theme.id !== 'phi') assert.equal(document.documentElement.style.colorScheme, theme.mode)
  assert.equal(properties.get('--background'), theme.background)
  const foreground = properties.get('--highlight-text')
  assert.ok([theme.background, theme.primary, theme.secondary, theme.highlight].includes(foreground))
  assert.ok(contrast(foreground, theme.highlight) >= 3, theme.name)
  report.push(`| ${theme.name} | ${contrast(theme.primary, theme.background).toFixed(2)} | ${contrast(theme.secondary, theme.background).toFixed(2)} | ${contrast(foreground, theme.highlight).toFixed(2)} |`)
}
document.documentElement.dataset = {}
localStorage.getItem = () => { throw new Error('Storage disabled') }
assert.equal(getSavedTheme().id, 'phi')
report.push('', 'channel ORANGE primary text fails even the large-text target. MBDTF primary text and several secondary colours fail normal-text AA. These are palette limitations, not silently adjusted colours. Proposed accessible alternatives can use the highlight token for body text in channel ORANGE and primary for supporting text where primary reaches 4.5:1; these require design review before changing the approved visual semantics.', '', '1998 mode retains its separate stylesheet. Album themes apply to the modern site, including shared music and chat chrome; game pieces, chart signals and media artwork retain their semantic colours.', '')
if (process.argv.includes('--write-audit')) writeFileSync(new URL('../docs/theme-contrast.md', import.meta.url), report.join('\n'))
console.log('PASS: 19 palettes, unknown/stored/blocked-storage fallback, paint/mode updates, and AA large-text button foregrounds for every theme')

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
  console.log('PASS: production before-paint bootstrap restores all 19 themes and handles invalid/unavailable storage')
}
