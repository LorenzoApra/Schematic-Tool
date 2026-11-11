import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createDefaultProject, projectFile } from '../../src/lib/project'

async function demo(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page
    .getByRole('button', { name: 'Esplora uno schema di esempio' })
    .click()
  await expect(page.locator('.device-node')).toHaveCount(3)
  await expect(page.locator('.connection-line')).toHaveCount(2)
}

test('example, cable focus, collapsed ports, compact view and zoom remain coherent', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await demo(page)
  await page.getByRole('button', { name: 'Ordina per flusso' }).click()
  await page
    .getByRole('button', { name: 'Adatta lo schema allo schermo' })
    .click()
  await expect(page.locator('.connection-hit').first()).toBeVisible()
  await page.locator('.connection-hit').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.cable-inspector')).toContainText('Camera 01')
  await expect(page.locator('.cable-group.dimmed')).toHaveCount(1)
  await page
    .getByRole('button', { name: 'Chiudi dettaglio collegamento' })
    .click()
  await page.getByRole('checkbox', { name: 'Solo porte collegate' }).check()
  await expect(page.locator('.port-button')).toHaveCount(4)
  await page
    .getByRole('button', { name: 'Comprimi Camera 01', exact: true })
    .click()
  await expect(page.locator('.connection-line')).toHaveCount(2)
  await page
    .getByRole('button', { name: 'Espandi Camera 01', exact: true })
    .click()
  await page.getByRole('checkbox', { name: 'Solo porte collegate' }).uncheck()
  const initial = await page
    .locator('.canvas-zoom-surface')
    .evaluate((el) => el.getBoundingClientRect().width)
  for (let i = 0; i < 4; i++)
    await page
      .getByRole('button', { name: 'Aumenta zoom', exact: true })
      .click()
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Riduci zoom', exact: true }).click()
  expect(
    await page
      .locator('.canvas-zoom-surface')
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeCloseTo(initial, 0)
  await page
    .getByRole('button', { name: 'Adatta lo schema allo schermo' })
    .click()
  await page.screenshot({ path: info.outputPath('workspace.png') })
  expect(errors).toEqual([])
})

test('dragging, keyboard moves, duplicate, delete and undo are reversible', async ({
  page,
}) => {
  await demo(page)
  const node = page.locator('.device-node').first(),
    header = node.locator('.node-header')
  await header.focus()
  const before = await node.evaluate((el) => (el as HTMLElement).offsetLeft)
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(() => node.evaluate((el) => (el as HTMLElement).offsetLeft))
    .toBe(before + 24)
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  await expect
    .poll(() => node.evaluate((el) => (el as HTMLElement).offsetLeft))
    .toBe(before)
  const box = await header.boundingBox()
  await page.mouse.move(box!.x + 45, box!.y + 30)
  await page.mouse.down()
  await page.mouse.move(box!.x + 95, box!.y + 78, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(() => node.evaluate((el) => (el as HTMLElement).offsetTop))
    .not.toBe(96)
  await page
    .getByRole('button', { name: 'Duplica dispositivo selezionato' })
    .click()
  await expect(page.locator('.device-node')).toHaveCount(4)
  await page
    .getByRole('button', { name: 'Elimina dispositivo selezionato' })
    .click()
  await expect(page.locator('.device-node')).toHaveCount(3)
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  await expect(page.locator('.device-node')).toHaveCount(4)
})

test('project round-trip, CSV, PNG and PDF exports work', async ({ page }) => {
  await demo(page)
  let downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Esporta progetto' }).click()
  const project = await downloadPromise
  const content = await readFile((await project.path())!, 'utf8')
  const parsed = JSON.parse(content)
  expect(parsed.state.connections).toHaveLength(2)
  await page.getByRole('button', { name: 'Svuota schema', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Svuota schema', exact: true })
    .click()
  await expect(page.locator('.device-node')).toHaveCount(0)
  await page.getByLabel('Importa progetto JSON').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  })
  await expect(page.locator('.device-node')).toHaveCount(3)
  downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PNG', exact: true }).click()
  const png = await readFile((await (await downloadPromise).path())!)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  expect(
    (await readFile((await (await downloadPromise).path())!))
      .subarray(0, 4)
      .toString(),
  ).toBe('%PDF')
  await page.getByRole('button', { name: 'Patch list', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Esporta CSV' }).click()
  const csv = await readFile((await (await downloadPromise).path())!, 'utf8')
  expect(csv).toContain('Camera 01')
  await page.getByRole('button', { name: 'Materiali', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(5)
})

test('invalid imports and unavailable storage do not crash the workspace', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Unavailable', 'QuotaExceededError')
    }
  })
  await page.goto('./')
  await expect(
    page.getByText('Salvataggio non disponibile · esporta il progetto'),
  ).toBeVisible()
  await page.getByLabel('Importa progetto JSON').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      '{"deviceList":[null],"nodes":[],"connections":[],"categories":[]}',
    ),
  })
  await expect(page.getByRole('status')).toContainText('File non valido')
  await expect(
    page.getByRole('button', { name: 'Esplora uno schema di esempio' }),
  ).toBeVisible()
})

test('many devices can be arranged without overlap and routes remain interactive', async ({
  page,
}) => {
  const state = createDefaultProject()
  for (let i = 0; i < 20; i++) {
    state.nodes.push(
      { id: `source-${i}`, deviceId: 'panasonic-Aw-UE80', x: 32, y: 32 },
      { id: `sink-${i}`, deviceId: 'sdi-hdmi-converter', x: 32, y: 32 },
    )
    state.connections.push({
      id: `cable-${i}`,
      from: { nodeId: `source-${i}`, portId: 'sdi-out', kind: 'output' },
      to: { nodeId: `sink-${i}`, portId: 'sdi-in', kind: 'input' },
    })
  }
  await page.goto('./')
  await page.getByLabel('Importa progetto JSON').setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(projectFile(state))),
  })
  await expect(page.locator('.device-node')).toHaveCount(40)
  await page.getByRole('button', { name: 'Ordina per flusso' }).click()
  await expect(page.locator('.connection-line')).toHaveCount(20)
  const rectangles = await page
    .locator('.device-node')
    .evaluateAll((elements) =>
      elements.map((el) => {
        const n = el as HTMLElement
        return {
          x: n.offsetLeft,
          y: n.offsetTop,
          w: n.offsetWidth,
          h: n.offsetHeight,
        }
      }),
    )
  for (let i = 0; i < rectangles.length; i++)
    for (let j = i + 1; j < rectangles.length; j++) {
      const a = rectangles[i],
        b = rectangles[j]
      expect(
        a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y,
      ).toBe(false)
    }
  await page.locator('.connection-hit').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.cable-inspector')).toBeVisible()
})

test('mobile layout and dialog keyboard focus are usable', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('./')
  await expect(page.locator('.library-panel')).toBeHidden()
  await page.getByRole('button', { name: 'Mostra libreria' }).click()
  await expect(page.locator('.library-panel')).toBeVisible()
  await page.getByRole('button', { name: 'Gestisci libreria' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Chiudi libreria', exact: true })
    .click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await expect(
    page.getByRole('button', { name: 'Nuovo progetto', exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: info.outputPath('mobile.png'),
    animations: 'disabled',
  })
})

test('creating routes and editing library ports keeps connections consistent', async ({
  page,
}) => {
  await demo(page)
  await page.getByRole('button', { name: 'Patch list', exact: true }).click()
  await page.getByRole('button', { name: 'Rimuovi C01', exact: true }).click()
  await page.getByRole('button', { name: 'Schema', exact: true }).click()
  await page
    .locator('.device-node')
    .filter({ hasText: 'Camera 01' })
    .locator('[data-port-id="sdi-out"]')
    .click()
  await page
    .locator('.device-node')
    .filter({ hasText: 'Conversione SDI' })
    .locator('[data-port-id="sdi-in"]')
    .click()
  await expect(page.locator('.connection-line')).toHaveCount(2)
  await page.getByRole('button', { name: 'Gestisci libreria' }).click()
  const camera = page.locator('.manager-device').filter({
    has: page.locator('.manager-row-main > span', {
      hasText: 'Panasonic AW-UE80',
    }),
  })
  await camera
    .getByRole('button', { name: 'Mostra porte', exact: true })
    .click()
  const port = camera.locator('.port-row').filter({ hasText: 'SDI Out (' })
  await port.getByRole('button', { name: 'Modifica', exact: true }).click()
  await camera
    .getByRole('textbox', { name: 'Nome porta', exact: true })
    .fill('Main SDI')
  await camera.getByRole('button', { name: 'Salva', exact: true }).click()
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click()
  await expect(page.locator('.connection-line')).toHaveCount(2)
  await page.getByRole('button', { name: 'Patch list', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('Main SDI')
  await page.getByRole('button', { name: 'Schema', exact: true }).click()
  await page.getByRole('button', { name: 'Gestisci libreria' }).click()
  await camera
    .locator('.port-row')
    .filter({ hasText: 'Main SDI (' })
    .getByRole('button', { name: 'Elimina', exact: true })
    .click()
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click()
  await expect(page.locator('.connection-line')).toHaveCount(1)
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  await expect(page.locator('.connection-line')).toHaveCount(2)
})

test('new project requires confirmation, resets the workspace and preserves the device library', async ({
  page,
}) => {
  await demo(page)
  await page
    .getByLabel('Titolo del progetto', { exact: true })
    .fill('Evento live')
  await page
    .getByLabel('Descrizione del progetto', { exact: true })
    .fill('Note della regia')
  await page.getByRole('button', { name: 'Gestisci libreria' }).click()
  await page
    .getByRole('textbox', { name: 'Nome nuova categoria', exact: true })
    .fill('Personale')
  await page
    .getByRole('button', { name: 'Crea categoria', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Nome nuovo dispositivo', exact: true })
    .fill('Mixer personale')
  await page
    .getByRole('combobox', { name: 'Categoria nuovo dispositivo', exact: true })
    .selectOption('personale')
  await page
    .getByRole('button', { name: 'Crea dispositivo', exact: true })
    .click()
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click()

  const newProject = page.getByRole('button', {
    name: 'Nuovo progetto',
    exact: true,
  })
  const confirmation = page.getByRole('dialog', {
    name: 'Creare un nuovo progetto?',
  })
  await newProject.click()
  await expect(confirmation).toBeVisible()
  await expect(page.locator('.device-node')).toHaveCount(3)
  await confirmation
    .getByRole('button', { name: 'Annulla', exact: true })
    .click()
  await expect(confirmation).toHaveCount(0)
  await expect(
    page.getByLabel('Titolo del progetto', { exact: true }),
  ).toHaveValue('Evento live')
  await expect(page.locator('.device-node')).toHaveCount(3)

  await newProject.click()
  await page.keyboard.press('Escape')
  await expect(confirmation).toHaveCount(0)
  await expect(page.locator('.connection-line')).toHaveCount(2)
  await page.getByRole('button', { name: 'Patch list', exact: true }).click()
  await newProject.click()
  await confirmation
    .getByRole('button', { name: 'Crea nuovo progetto', exact: true })
    .click()
  await expect(confirmation).toHaveCount(0)
  await expect(
    page.getByLabel('Titolo del progetto', { exact: true }),
  ).toHaveValue('Progetto senza titolo')
  await expect(
    page.getByLabel('Descrizione del progetto', { exact: true }),
  ).toHaveValue('')
  await expect(page.locator('.device-node')).toHaveCount(0)
  await expect(page.locator('.connection-line')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Esplora uno schema di esempio' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Schema', exact: true }),
  ).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  await expect(
    page.getByLabel('Titolo del progetto', { exact: true }),
  ).toHaveValue('Evento live')
  await expect(
    page.getByLabel('Descrizione del progetto', { exact: true }),
  ).toHaveValue('Note della regia')
  await expect(page.locator('.device-node')).toHaveCount(3)
  await expect(page.locator('.connection-line')).toHaveCount(2)
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click()
  await expect(page.locator('.device-node')).toHaveCount(0)
  await expect(
    page.getByText('Salvato su questo browser', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByLabel('Titolo del progetto', { exact: true }),
  ).toHaveValue('Progetto senza titolo')
  await expect(page.locator('.device-node')).toHaveCount(0)
  await page
    .getByRole('textbox', { name: 'Cerca nella libreria', exact: true })
    .fill('Mixer personale')
  await expect(
    page.getByRole('button', { name: /Mixer personale/ }),
  ).toBeVisible()
})

for (const scheme of ['light', 'dark'] as const) {
  test(`theme follows the device from ${scheme} and updates without reloading`, async ({
    page,
  }) => {
    const other = scheme === 'dark' ? 'light' : 'dark'
    await page.emulateMedia({ colorScheme: scheme })
    await page.addInitScript(
      (value) => localStorage.setItem('schematic-theme', value),
      other,
    )
    await page.goto('./')
    const background = { light: 'rgb(247, 248, 250)', dark: 'rgb(19, 25, 35)' }
    await expect(page.locator('html')).toHaveCSS('color-scheme', scheme)
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      background[scheme],
    )
    await page.emulateMedia({ colorScheme: other })
    await expect(page.locator('html')).toHaveCSS('color-scheme', other)
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      background[other],
    )
    await expect(page.locator('.canvas-empty .primary')).toHaveCSS(
      'color',
      other === 'dark' ? 'rgb(17, 53, 46)' : 'rgb(255, 255, 255)',
    )
    await page.emulateMedia({ colorScheme: scheme })
    await expect(page.locator('html')).toHaveCSS('color-scheme', scheme)
    await page.reload()
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      background[scheme],
    )
  })
}
