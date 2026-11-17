import { test, expect } from '@playwright/test'

const api =
  'https://api.github.com/repos/LorenzoApra/Schematic-Tool/releases/latest'
const assetURL =
  'https://github.com/LorenzoApra/Schematic-Tool/releases/download/v0.1.0/Schematic-macOS-universal.zip'
const release = {
  tag_name: 'v0.1.0',
  assets: [
    {
      name: 'Schematic-macOS-universal.zip',
      browser_download_url: assetURL,
      size: 5_242_880,
    },
  ],
}

test('Mac download offers the published universal ZIP and explains project transfer', async ({
  page,
}) => {
  await page.route(api, (route) => route.fulfill({ json: release }))
  await page.goto('./')
  await page.getByRole('button', { name: 'Scarica per Mac' }).click()
  const dialog = page.getByRole('dialog', { name: 'Schematic per Mac' })
  await expect(
    dialog.getByRole('link', { name: 'Scarica per Mac v0.1.0' }),
  ).toHaveAttribute('href', assetURL)
  await expect(dialog).toContainText('Apple Silicon e Intel')
  await expect(dialog).toContainText('5.0 MB')
  await expect(dialog).toContainText('Esporta progetto')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('an unpublished Mac build never presents a broken download link', async ({
  page,
}) => {
  await page.route(api, (route) =>
    route.fulfill({ status: 404, json: { message: 'Not Found' } }),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await page.getByRole('button', { name: 'Scarica per Mac' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('prima pubblicazione')
  await expect(
    dialog.getByRole('link', { name: 'Scarica per Mac' }),
  ).toHaveCount(0)
  await expect(
    dialog.getByRole('link', { name: 'Tutte le versioni e note di rilascio' }),
  ).toHaveAttribute(
    'href',
    'https://github.com/LorenzoApra/Schematic-Tool/releases',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('release lookup errors can be retried without leaving the editor', async ({
  page,
}) => {
  let attempts = 0
  await page.route(api, (route) =>
    route.fulfill(
      ++attempts === 1
        ? { status: 403, json: { message: 'rate limited' } }
        : { json: release },
    ),
  )
  await page.goto('./')
  await page.getByRole('button', { name: 'Scarica per Mac' }).click()
  await expect(page.getByRole('dialog')).toContainText('Non è stato possibile')
  await page.getByRole('button', { name: 'Riprova', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Scarica per Mac v0.1.0' }),
  ).toHaveAttribute('href', assetURL)
})
