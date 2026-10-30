import assert from 'node:assert/strict'

// Uses the same optional Playwright setup as test-theme-pages.mjs.
const { chromium } = await import(process.env.PHI_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PHI_TEST_URL || 'http://localhost:5173'
const browser = await chromium.launch({ executablePath: process.env.PHI_CHROMIUM || undefined, args: ['--no-sandbox'] })

try {
  for (const viewport of [{ width: 1280, height: 700 }, { width: 390, height: 700 }]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('phi.theme', '808s-heartbreak'))
    await page.route('**/*', request => {
      const url = request.request().url()
      return url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:') ? request.continue() : request.abort()
    })
    await page.goto(`${base}/quickl?theme-demo=1`)
    const header = page.locator('.loaded .site-header')
    await header.waitFor()
    await page.waitForFunction(() => document.querySelector('.site-header').getBoundingClientRect().height === 80)
    assert.equal(await header.evaluate(el => getComputedStyle(el, '::after').top), '0px')
    assert.equal(await header.evaluate(el => getComputedStyle(el, '::after').height), '12px')
    assert.equal(await header.evaluate(el => getComputedStyle(el).backdropFilter), 'blur(12px)')

    if (viewport.width > 900) {
      // A real navigation click leaves pointer focus in the header.
      await page.locator('.topnav a[href="/quickl"]').click()
      assert.equal(await header.evaluate(el => el.contains(document.activeElement)), true)
    }
    await page.mouse.move(viewport.width - 20, viewport.height - 20)
    await page.mouse.wheel(0, 300)
    await page.waitForFunction(() => scrollY >= 50 && document.querySelector('.site-header').getBoundingClientRect().height === 12)
    assert.equal(await header.locator('.titlebar-content').first().evaluate(el => getComputedStyle(el).opacity), '0')

    await page.mouse.wheel(0, -80)
    await page.waitForFunction(() => document.querySelector('.site-header').getBoundingClientRect().height === 80)
    await page.mouse.wheel(0, 160)
    await page.waitForFunction(() => document.querySelector('.site-header').getBoundingClientRect().height === 12)

    // Keyboard users can still reveal and reach the collapsed controls.
    await page.keyboard.press('Tab')
    await page.waitForFunction(() => document.querySelector('.site-header').getBoundingClientRect().height === 80)
    assert.equal(await header.evaluate(el => el.matches(':has(:focus-visible)')), true)
    await page.evaluate(() => document.activeElement.blur())

    await page.mouse.move(10, 5)
    await page.waitForFunction(() => document.querySelector('.site-header').getBoundingClientRect().height === 80)

    // Compare actual rendered pixels with and without blur, using a striped backdrop.
    await page.evaluate(() => {
      const backdrop = document.createElement('div')
      backdrop.id = 'header-blur-test'
      Object.assign(backdrop.style, { position: 'fixed', inset: '0 auto auto 0', width: '80px', height: '80px', zIndex: '999', background: 'repeating-linear-gradient(to right, black 0 2px, white 2px 4px)', pointerEvents: 'none' })
      document.body.append(backdrop)
    })
    const roughness = async clip => {
      const png = await page.screenshot({ clip })
      return page.evaluate(async data => {
        const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob())
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(0, 0, image.width, image.height).data
        let difference = 0
        for (let y = 0; y < image.height; y++) for (let x = 1; x < image.width; x++) {
          const offset = (y * image.width + x) * 4
          difference += Math.abs(pixels[offset] - pixels[offset - 4])
        }
        return difference / (image.height * (image.width - 1))
      }, png.toString('base64'))
    }
    for (const collapsed of [false, true]) {
      if (collapsed) {
        await page.mouse.move(viewport.width - 20, viewport.height - 20)
        await page.waitForFunction(() => document.querySelector('.site-header').getBoundingClientRect().height === 12)
      }
      const clips = collapsed ? [{ x: 8, y: 2, width: 20, height: 8 }] : [{ x: 8, y: 28, width: 32, height: 24 }, { x: 8, y: 2, width: 20, height: 8 }]
      for (const clip of clips) {
        const blurred = await roughness(clip)
        await header.evaluate(el => el.style.setProperty('backdrop-filter', 'none'))
        const sharp = await roughness(clip)
        await header.evaluate(el => el.style.removeProperty('backdrop-filter'))
        assert.ok(sharp > 2 && blurred < sharp / 4, `collapsed=${collapsed} backdrop at y=${clip.y}: blurred=${blurred}, sharp=${sharp}`)
      }
    }
    await page.locator('#header-blur-test').evaluate(el => el.remove())
    assert.deepEqual(errors, [])
    console.log(`PASS ${viewport.width}px: top strip, pointer-focus collapse, scroll reveal/collapse, keyboard reveal, rendered backdrop blur`)
    await page.close()
  }
} finally {
  await browser.close()
}
