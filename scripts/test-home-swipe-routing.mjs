import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/homeNavigation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { homeSwipeTarget, CATEGORIES, SETTINGS_SUBTABS, NAVIGATION } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
assert.equal(CATEGORIES.includes('Theme'), false)
assert.deepEqual(SETTINGS_SUBTABS.map(tab => tab.id), ['theme', 'hate-speech'])
assert.equal(NAVIGATION.find(item => item.id === 'theme').category, 'Settings')
assert.equal(NAVIGATION.find(item => item.id === 'theme').settingsTab, 'theme')
const move = changes => homeSwipeTarget({ surface: 'items', mainIndex: 2, mainCount: 6, subIndex: 1, subCount: 3, direction: 1, ...changes })
assert.deepEqual(move({}), { mainIndex: 2, subIndex: 2 }, 'global gestures visit the next subtab first')
assert.deepEqual(move({ subIndex: 2 }), { mainIndex: 3, subIndex: 0 }, 'next gesture past last subtab advances the main section')
assert.deepEqual(move({ direction: -1 }), { mainIndex: 2, subIndex: 0 })
assert.deepEqual(move({ direction: -1, subIndex: 0 }), { mainIndex: 1, subIndex: 0 }, 'past first subtab goes to previous main section')
assert.deepEqual(move({ surface: 'main' }), { mainIndex: 3, subIndex: 0 }, 'main scroller ignores subtabs')
assert.deepEqual(move({ surface: 'main', direction: -1 }), { mainIndex: 1, subIndex: 0 })
for (let subIndex = 0; subIndex < 3; subIndex++) {
  for (const direction of [-1, 1]) {
    const result = move({ surface: 'subtabs', subIndex, direction })
    assert.equal(result.mainIndex, 2, 'subtab scroller never changes the main section')
    assert.equal(result.subIndex, Math.max(0, Math.min(2, subIndex + direction)))
  }
}
assert.deepEqual(move({ mainIndex: 5, subIndex: 2 }), { mainIndex: 5, subIndex: 2 }, 'outer boundary never wraps back to the first subtab')
assert.deepEqual(move({ mainIndex: 0, subIndex: 0, direction: -1 }), { mainIndex: 0, subIndex: 0 })
assert.deepEqual(move({ subCount: 0, subIndex: 0 }), { mainIndex: 3, subIndex: 0 }, 'no subtabs preserves existing global navigation')
assert.deepEqual(move({ subCount: 1, subIndex: 0, direction: -1 }), { mainIndex: 1, subIndex: 0 }, 'single-subtab boundary works in Settings')
assert.deepEqual(move({ surface: 'subtabs', subCount: 1, subIndex: 0, direction: -1 }), { mainIndex: 2, subIndex: 0 })
assert.deepEqual(move({ direction: 0 }), { mainIndex: 2, subIndex: 1 })
console.log('PASS: global subtab traversal, main-section fallback, isolated scrollers, outer boundaries and single-subtab navigation')
