import assert from 'node:assert/strict'
import palettes from '../src/lib/themes.json' with { type: 'json' }

// Optional browser check: install Playwright separately or set PHI_PLAYWRIGHT_MODULE.
const { chromium } = await import(process.env.PHI_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PHI_TEST_URL || 'http://localhost:5173'
const browser = await chromium.launch({ executablePath: process.env.PHI_CHROMIUM || undefined, args: ['--no-sandbox'] })
let checked = 0
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    for (const theme of palettes) {
      for (const [route, ready] of [['/chat?theme-demo=1', '.chat-composer'], ['/musicpl/demo-album?theme-demo=1', '.music-track-row']]) {
        const page = await browser.newPage({ viewport })
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.addInitScript(id => localStorage.setItem('phi.theme', id), theme.id)
        await page.route('**/*', request => { const url = request.request().url(); return url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:') ? request.continue() : request.abort() })
        await page.goto(base + route, { waitUntil: 'domcontentloaded' })
        await page.locator(ready).first().waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme.id)
        assert.equal(await page.evaluate(() => document.documentElement.dataset.themeDemo), 'true')
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme.id} ${route}: horizontal overflow`)
        if (theme.id !== 'phi') {
          const selector = route.startsWith('/chat') ? '.chat-game-card' : '.music-bottom-bar'
          const colours = await page.locator(selector).evaluate(el => ({ actual: getComputedStyle(el).backgroundColor, expected: getComputedStyle(document.documentElement).backgroundColor }))
          assert.equal(colours.actual, colours.expected, `${theme.id}: unthemed surface`)
        }
        if (route.startsWith('/chat')) {
          await page.getByRole('button', { name: 'Open menu', exact: true }).click()
          await page.locator('.theme-trigger').click()
          const actions = await page.getByRole('button', { name: 'Apply', exact: true }).boundingBox()
          assert.ok(actions.y >= 0 && actions.y + actions.height < viewport.height, `${theme.id}: clipped picker actions`)
          if (theme.id !== 'phi') assert.equal(await page.locator('.close-btn').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
        }
        assert.deepEqual(errors, [], `${theme.id} ${route}`)
        await page.close()
        checked++
        if (checked % 10 === 0) console.log(`Checked ${checked} combinations`)
      }
    }
    console.log(`Checked ${checked} populated theme/page/viewport combinations`)
  }
  // Real pointer taps must play tracks; capture should begin only for a swipe.
  const player = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await player.goto(base + '/musicpl/demo-album?theme-demo=1', { waitUntil: 'domcontentloaded' })
  await player.locator('.music-track-row').first().waitFor()
  await player.waitForTimeout(500) // Let the existing page entrance animation settle.
  await player.locator('.music-track-row').first().click({ position: { x: 80, y: 20 } })
  await player.waitForFunction(() => [...document.querySelectorAll('audio')].some(audio => audio.currentTime > 0))
  assert.equal(await player.locator('.music-bottom-track-tile--current .music-bottom-title').innerText(), 'First Light')
  const second = player.locator('.music-track-row').nth(1)
  await second.scrollIntoViewIfNeeded()
  const row = await second.boundingBox()
  await player.mouse.move(row.x + 250, row.y + 20)
  await player.mouse.down()
  await player.mouse.move(row.x + 130, row.y + 20, { steps: 8 })
  await player.mouse.up()
  assert.equal(await player.locator('.music-bottom-track-tile--current .music-bottom-title').innerText(), 'First Light', 'swiping must not activate the track')
  await player.close()
  // Mobile picker actions must remain visible even with a short landscape viewport.
  for (const viewport of [{width:320,height:568}, {width:844,height:390}, {width:390,height:500}]) {
    const page = await browser.newPage({viewport})
    await page.goto(base)
    await page.getByRole('button', {name:'Open menu', exact:true}).click()
    await page.locator('.theme-trigger').click()
    assert.equal(await page.getByRole('button', {name:'Preview', exact:true}).count(), 0)
    await page.locator('input[value="hub"]').check()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'hub')
    assert.equal(await page.evaluate(() => localStorage.getItem('phi.theme')), null)
    const apply = page.getByRole('button', {name:'Apply', exact:true})
    const bounds = await apply.boundingBox()
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height < viewport.height)
    await apply.click()
    await page.locator('input[value="igor"]').check()
    await page.getByRole('button', {name:'Cancel', exact:true}).click()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'hub')
    await page.close()
  }
  const legacy = await browser.newPage()
  await legacy.addInitScript(() => { localStorage.setItem('phi.mode.1998', '1'); localStorage.setItem('phi.theme', 'igor') })
  await legacy.goto(base + '/1998', { waitUntil: 'domcontentloaded' })
  await legacy.waitForURL(base + '/')
  await legacy.getByRole('button', { name: 'Open menu', exact: true }).click()
  assert.equal(await legacy.evaluate(() => document.documentElement.dataset.theme), 'igor')
  assert.equal(await legacy.evaluate(() => document.documentElement.hasAttribute('data-1998')), false)
  assert.equal(await legacy.locator('.mode-1998-btn, #phi-1998-css').count(), 0)
  await legacy.close()
  console.log('PASS: all 19 themes on populated chat/music at mobile and desktop sizes; mobile picker preview, visibility and cancellation')
} finally {
  await browser.close()
}
