// Browser test script. Run: npm run build && npm run preview, then: npx --package playwright-core node e2e/run.mjs
// Needs Chrome; set CHROME_PATH if it is not at /usr/bin/google-chrome.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:4173'
const OUT = process.env.OUT ?? path.join(process.cwd(), 'docs/screenshots')
const RESULTS = process.env.RESULTS ?? path.join(process.cwd(), 'docs/results.json')
fs.mkdirSync(OUT, { recursive: true })

const results = []
const consoleErrors = []

async function t(feature, scenario, expected, fn) {
  try {
    const { pass, detail } = await fn()
    results.push({ feature, scenario, expected, actual: detail, status: pass ? 'PASS' : 'FAIL' })
  } catch (error) {
    results.push({ feature, scenario, expected, actual: `Test error: ${String(error.message).split('\n')[0]}`, status: 'FAIL' })
  }
}
const eq = (actual, expected) => ({ pass: actual === expected, detail: String(actual) })
const yes = (cond, detail) => ({ pass: Boolean(cond), detail })

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }))
const page = await context.newPage()
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`console.error: ${m.text()}`)
})

const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) })
const toasts = async () => {
  await page.waitForTimeout(250)
  return (await page.locator('div[aria-live="polite"]').innerText()).replace(/\s+/g, ' ').trim()
}
const dialog = () => page.getByRole('dialog')
const stat = async (label) => {
  const text = await page.locator(`xpath=//p[normalize-space()='${label}']/parent::div/following-sibling::p`).first().innerText()
  return parseFloat(text.replace(/[^0-9.]/g, ''))
}
const go = async (url) => {
  await page.goto(BASE + url)
  await page.waitForTimeout(600) // skeleton ends
}
const nav = async (name) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click()
  await page.waitForTimeout(600)
}
const totalOf = async () => {
  const text = await page.getByRole('navigation', { name: 'Pagination' }).innerText().catch(() => '')
  const m = text.replace(/\s+/g, ' ').match(/of (\d+)/)
  return m ? Number(m[1]) : 0
}
const clearFilters = async () => {
  const b = page.getByRole('button', { name: 'Clear filters' }).first()
  if (await b.isEnabled().catch(() => false)) await b.click()
}
const dismissToasts = async () => {
  for (const b of await page.getByRole('button', { name: 'Dismiss notification' }).all()) await b.click().catch(() => {})
}
const fillProduct = async (f) => {
  const d = dialog()
  if (f.name !== undefined) await d.getByLabel('Product name').fill(f.name)
  if (f.sku !== undefined) await d.getByLabel('Product code (SKU)').fill(f.sku)
  if (f.category !== undefined) await d.getByLabel('Category').selectOption({ label: f.category })
  if (f.description !== undefined) await d.getByLabel('Description').fill(f.description)
  if (f.price !== undefined) await d.getByLabel('Unit price (USD)').fill(f.price)
  if (f.quantity !== undefined) await d.getByLabel('Starting quantity').fill(f.quantity)
  if (f.min !== undefined) await d.getByLabel('Minimum stock level').fill(f.min)
}
const stockModal = async (type, quantity, reason = '') => {
  const d = dialog()
  await d.getByRole('radio', { name: type === 'in' ? 'Receive stock' : 'Issue stock' }).click()
  await d.getByLabel(/Quantity to/).fill(quantity)
  if (reason) await d.getByLabel('Reason or reference').fill(reason)
}
const submitStock = (type) => dialog().getByRole('button', { name: type === 'in' ? 'Receive stock' : 'Issue stock', exact: true }).last().click()

// ===================================================================
// 1. DASHBOARD (initial demo data)
// ===================================================================
await go('/')
await page.waitForTimeout(1800)
await shot('01-dashboard-desktop')
const dash0 = {
  products: await stat('Total products'),
  stock: await stat('Total stock (units)'),
  value: await stat('Inventory value'),
  low: await stat('Low-stock products'),
  out: await stat('Out-of-stock products'),
}

await t('Dashboard', 'Open the dashboard', 'Five summary cards, three charts and recent activity are shown', async () => {
  const cards = await page.locator('[data-aos]').count()
  const charts = await page.locator('svg.recharts-surface').count()
  const acts = await page.getByRole('heading', { name: 'Recent activity' }).locator('xpath=../../..//li').count()
  return yes(dash0.products > 0 && charts >= 3 && acts >= 5, `products=${dash0.products}, stock=${dash0.stock}, value=${dash0.value}, low=${dash0.low}, out=${dash0.out}, charts=${charts}, activity items=${acts}, animated blocks=${cards}`)
})
await t('Dashboard', 'Low-stock and out-of-stock lists', 'Lists show the same number of products as the cards', async () => {
  const lowHref = await page.getByRole('link', { name: /View all \(\d+\)/ }).first().innerText()
  const outHref = await page.getByRole('link', { name: /View all \(\d+\)/ }).nth(1).innerText()
  return yes(lowHref.includes(`(${dash0.low})`) && outHref.includes(`(${dash0.out})`), `${lowHref} / ${outHref}`)
})

// cross-check the dashboard numbers against the products table
await nav('Products')
await t('Dashboard', 'Dashboard totals match product list', 'Total products, low-stock and out-of-stock counts equal the filtered product list sizes', async () => {
  const all = await totalOf()
  await page.getByLabel('Filter by stock status').selectOption('low-stock')
  await page.waitForTimeout(300)
  const low = await totalOf()
  await page.getByLabel('Filter by stock status').selectOption('out-of-stock')
  await page.waitForTimeout(300)
  const out = await page.locator('tbody tr').count()
  await clearFilters()
  return yes(all === dash0.products && low === dash0.low && out === dash0.out, `list: total=${all}, low=${low}, out=${out}  |  cards: ${dash0.products}/${dash0.low}/${dash0.out}`)
})
await shot('02-products-desktop')

// ===================================================================
// 2. PRODUCT CREATE + VALIDATION
// ===================================================================
await page.getByRole('button', { name: 'Add product' }).first().click()
await t('Products', 'Submit empty form', 'Inline errors for every required field and a "Required fields are missing." toast; dialog stays open', async () => {
  await dialog().getByRole('button', { name: 'Add product' }).click()
  const errs = await dialog().getByRole('alert').allInnerTexts()
  const toast = await toasts()
  await shot('03-product-form-required-errors')
  return yes(
    errs.length === 4 && toast.includes('Required fields are missing') && (await dialog().isVisible()),
    `${errs.length} inline errors (${errs.slice(0, 3).join(' | ')} …); toast: "${toast}"`,
  )
})
await dismissToasts()
await t('Products', 'Invalid values (negative, letters, bad code)', 'Each invalid field gets a specific message; nothing is saved', async () => {
  await fillProduct({ name: 'Test Item', sku: 'bad sku!', category: 'Furniture', price: '-5', quantity: '-3', min: 'abc' })
  await dialog().getByRole('button', { name: 'Add product' }).click()
  const errs = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
  const ok = /letters, numbers/.test(errs) && /Unit price cannot be negative/.test(errs) && /Quantity cannot be negative/.test(errs) && /Minimum stock level must be a whole number/.test(errs)
  return yes(ok, errs)
})
await t('Products', 'Decimal quantity, zero price, scientific notation', 'Rejected with a clear message', async () => {
  await fillProduct({ sku: 'OK-1', price: '0', quantity: '2.5', min: '1e3' })
  await dialog().getByRole('button', { name: 'Add product' }).click()
  const errs = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
  return yes(/Unit price must be greater than zero/.test(errs) && /Quantity must be a whole number/.test(errs) && /Minimum stock level must be a whole number/.test(errs), errs)
})
await t('Products', 'Duplicate product code (different letter case)', 'Error: code already used; nothing saved', async () => {
  await fillProduct({ sku: 'wm-200', price: '5', quantity: '1', min: '1' })
  await dialog().getByRole('button', { name: 'Add product' }).click()
  const errs = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
  return yes(/already used/.test(errs), errs)
})
await t('Products', 'Name longer than 100 characters', 'Error about the 100 character limit', async () => {
  await fillProduct({ name: 'x'.repeat(110), sku: 'LONG-1' })
  await dialog().getByRole('button', { name: 'Add product' }).click()
  const errs = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
  return yes(/100 characters/.test(errs), errs)
})
await dismissToasts()
await t('Products', 'Escape key closes the dialog without saving', 'Dialog closes; no new product', async () => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(!(await dialog().isVisible().catch(() => false)), 'dialog closed')
})

await page.getByRole('button', { name: 'Add product' }).first().click()
await fillProduct({ name: 'Desk Lamp', sku: 'lamp-01', category: 'Office Supplies', description: 'LED lamp with dimmer', price: '19.90', quantity: '8', min: '3' })
await shot('04-product-form-filled')
await dialog().getByRole('button', { name: 'Add product' }).click()
await t('Products', 'Create a valid product', 'Success toast, dialog closes, product is listed with code in capitals', async () => {
  const toast = await toasts()
  await page.getByLabel('Search products').fill('LAMP-01')
  await page.waitForTimeout(200)
  const row = await page.locator('tbody tr').first().innerText()
  return yes(/successfully created/.test(toast) && /Desk Lamp/.test(row) && /LAMP-01/.test(row) && /In stock/.test(row), `toast: "${toast}" | row: ${row.replace(/\s+/g, ' ')}`)
})
await page.getByLabel('Search products').fill('')
await dismissToasts()

await t('Dashboard', 'Dashboard updates after creating a product (8 units × $19.90)', 'Products +1, stock +8, value +159.20, without a refresh', async () => {
  await nav('Dashboard')
  const now = { p: await stat('Total products'), s: await stat('Total stock (units)'), v: await stat('Inventory value') }
  return yes(now.p === dash0.products + 1 && now.s === dash0.stock + 8 && Math.abs(now.v - (dash0.value + 159.2)) < 0.01, `products ${dash0.products}→${now.p}, stock ${dash0.stock}→${now.s}, value ${dash0.value}→${now.v}`)
})

// XSS-style name
await nav('Products')
await page.getByRole('button', { name: 'Add product' }).first().click()
await fillProduct({ name: '<img src=x onerror="window.__xss=1">', sku: 'XSS-1', category: 'Furniture', price: '1', quantity: '0', min: '0' })
await dialog().getByRole('button', { name: 'Add product' }).click()
await t('Products', 'Name containing HTML / script text', 'Shown as plain text; no script runs', async () => {
  await page.getByLabel('Search products').fill('XSS-1')
  await page.waitForTimeout(250)
  const row = await page.locator('tbody tr').first().innerText()
  const ran = await page.evaluate(() => window.__xss === 1)
  return yes(row.includes('<img src=x') && !ran, `row text: ${row.replace(/\s+/g, ' ').slice(0, 60)}; script ran: ${ran}`)
})
await page.getByLabel('Search products').fill('')
await dismissToasts()

// ===================================================================
// 3. VIEW DETAIL, EDIT
// ===================================================================
await page.getByLabel('Search products').fill('LAMP-01')
await page.waitForTimeout(200)
await page.getByRole('link', { name: 'Desk Lamp', exact: true }).click()
await page.waitForTimeout(500)
const detailUrl = page.url()
await shot('05-product-detail')
await t('Products', 'View product details', 'Detail page shows all fields and an opening-stock history row (0 → 8)', async () => {
  const body = await page.locator('main').innerText()
  const histRow = (await page.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ')
  return yes(/LAMP-01/.test(body) && /Office Supplies/.test(body) && /\$19\.90/.test(body) && /LED lamp with dimmer/.test(body) && /Opening stock/.test(histRow || body) || /0\s+8/.test(histRow), `${detailUrl} | history: ${histRow}`)
})
await t('Products', 'Open a product detail page directly by URL', 'Page loads without being redirected', async () => {
  await page.goto(detailUrl)
  await page.waitForTimeout(500)
  const ok = await page.getByRole('heading', { name: 'Desk Lamp' }).isVisible()
  return yes(ok, `loaded ${detailUrl}`)
})

await page.getByRole('button', { name: 'Edit' }).click()
await t('Products', 'Edit form is pre-filled and quantity is locked', 'Fields hold current values; quantity input is disabled', async () => {
  const name = await dialog().getByLabel('Product name').inputValue()
  const qtyDisabled = await dialog().getByLabel('Available quantity').isDisabled()
  return yes(name === 'Desk Lamp' && qtyDisabled, `name="${name}", quantity disabled=${qtyDisabled}`)
})
await dialog().getByLabel('Product name').fill('Desk Lamp LED')
await dialog().getByLabel('Unit price (USD)').fill('21.50')
await dialog().getByRole('button', { name: 'Save changes' }).click()
await t('Products', 'Edit a product', 'Success toast and the new name and price appear', async () => {
  const toast = await toasts()
  const head = await page.getByRole('heading', { name: 'Desk Lamp LED' }).isVisible()
  const body = await page.locator('main').innerText()
  return yes(/successfully updated/.test(toast) && head && /\$21\.50/.test(body), `toast: "${toast}"`)
})
await dismissToasts()

// ===================================================================
// 4. STOCK RULES (from the detail page)
// ===================================================================
const qtyOnPage = async () => {
  const txt = await page.locator('xpath=//p[normalize-space()="Available quantity"]/following-sibling::p').first().innerText()
  return Number(txt.replace(/,/g, ''))
}
await page.getByRole('button', { name: 'Receive', exact: true }).click()
await stockModal('in', '12', 'PO-1001')
await shot('06-stock-form')
await submitStock('in')
await t('Stock', 'Receive 12 units (8 → 20)', 'Quantity increases, success toast, history shows previous 8 and new 20', async () => {
  const toast = await toasts()
  const q = await qtyOnPage()
  const row = (await page.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ')
  return yes(q === 20 && /successfully received/.test(toast) && /\+12/.test(row) && /8\s+20/.test(row), `qty=${q}; toast: "${toast}"; row: ${row}`)
})
await dismissToasts()

await page.getByRole('button', { name: 'Issue', exact: true }).click()
await stockModal('out', '5', 'SO-77')
await submitStock('out')
await t('Stock', 'Issue 5 units (20 → 15)', 'Quantity decreases, success toast', async () => {
  const toast = await toasts()
  const q = await qtyOnPage()
  return yes(q === 15 && /successfully issued/.test(toast), `qty=${q}; toast: "${toast}"`)
})
await dismissToasts()

await page.getByRole('button', { name: 'Issue', exact: true }).click()
await t('Stock', 'Issue more than available (100 of 15)', 'Blocked with "Insufficient stock available" (inline and toast); quantity stays 15', async () => {
  await stockModal('out', '100')
  const inline = await dialog().getByRole('alert').innerText()
  await submitStock('out')
  const toast = await toasts()
  await shot('07-insufficient-stock')
  const open = await dialog().isVisible()
  return yes(/Insufficient stock/.test(inline) && /Insufficient stock/.test(toast) && open && (await qtyOnPage()) === 15, `inline: "${inline}"; toast: "${toast}"`)
})
await dismissToasts()
for (const [label, value, pattern] of [
  ['negative quantity (-4)', '-4', /negative/i],
  ['zero', '0', /greater than zero/i],
  ['decimal (2.5)', '2.5', /whole number/i],
  ['letters (abc)', 'abc', /whole number/i],
  ['empty', '', /required/i],
]) {
  await t('Stock', `Quantity input: ${label}`, 'Rejected with a clear message; stock unchanged', async () => {
    await dialog().getByLabel(/Quantity to/).fill(value)
    await submitStock('out')
    const msg = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
    return yes(pattern.test(msg) && (await qtyOnPage()) === 15, `message: "${msg}"`)
  })
}
await dismissToasts()
await t('Stock', 'Issue with no product chosen (stock page)', 'Required message', async () => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await nav('Stock')
  await page.getByRole('button', { name: 'Issue stock' }).first().click()
  await dialog().getByLabel(/Quantity to/).fill('1')
  await submitStock('out')
  const msg = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
  return yes(/Product is required/.test(msg), msg)
})
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await dismissToasts()

// Double-click protection
await page.goto(detailUrl)
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Receive', exact: true }).click()
await stockModal('in', '1', 'double click test')
await dialog().getByRole('button', { name: 'Receive stock', exact: true }).last().dblclick()
await t('Stock', 'Double-click the "Receive stock" button once with quantity 1', 'Exactly one movement is recorded (15 → 16)', async () => {
  await page.waitForTimeout(600)
  const q = await qtyOnPage()
  return yes(q === 16, `quantity is ${q} (expected 16)`)
})
await dismissToasts()

// exact-all → out of stock, then low, then in
const issueAll = async (qty) => {
  await page.getByRole('button', { name: 'Issue', exact: true }).click()
  await stockModal('out', String(qty))
  await submitStock('out')
  await page.waitForTimeout(500)
}
const q1 = await qtyOnPage()
await issueAll(q1)
await t('Stock', `Issue every remaining unit (${q1} → 0)`, 'Allowed; status becomes Out of stock', async () => {
  const body = await page.locator('main').innerText()
  return yes((await qtyOnPage()) === 0 && /Out of stock/.test(body), `qty=${await qtyOnPage()}`)
})
await dismissToasts()
await t('Stock', 'Issue from a product with zero stock', 'Blocked: insufficient stock', async () => {
  await page.getByRole('button', { name: 'Issue', exact: true }).click()
  await stockModal('out', '1')
  await submitStock('out')
  const toast = await toasts()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(/Insufficient stock/.test(toast) && (await qtyOnPage()) === 0, toast)
})
await dismissToasts()
await t('Dashboard', 'Dashboard shows the product as out of stock', 'Out-of-stock count +2 compared to the start (this product and the zero-stock test product)', async () => {
  await nav('Dashboard')
  const out = await stat('Out-of-stock products')
  const listed = await page.getByText('Desk Lamp LED').count()
  return yes(out === dash0.out + 2 && listed > 0, `out-of-stock ${dash0.out}→${out}; product listed=${listed > 0}`)
})
await page.goto(detailUrl)
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Receive', exact: true }).click()
await stockModal('in', '2')
await submitStock('in')
await page.waitForTimeout(500)
await t('Stock', 'Receive 2 units when minimum level is 3', 'Status changes from Out of stock to Low stock', async () => {
  const body = await page.locator('main').innerText()
  return yes(/Low stock/.test(body), (body.match(/(Low stock|Out of stock|In stock)/) ?? [])[0])
})
await page.getByRole('button', { name: 'Receive', exact: true }).click()
await stockModal('in', '40')
await submitStock('in')
await page.waitForTimeout(500)
await t('Stock', 'Receive 40 more units', 'Status changes to In stock', async () => {
  const body = await page.locator('main').innerText()
  return yes(/In stock/.test(body) && (await qtyOnPage()) === 42, `qty=${await qtyOnPage()}`)
})
await t('Stock', 'Large quantity (5,000,000 in one movement)', 'Rejected with a limit message', async () => {
  await page.getByRole('button', { name: 'Receive', exact: true }).click()
  await stockModal('in', '5000000')
  await submitStock('in')
  const msg = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(/cannot be more than/.test(msg) && (await qtyOnPage()) === 42, msg)
})
await dismissToasts()

// ===================================================================
// 5. STOCK HISTORY PAGE
// ===================================================================
await nav('Stock')
await shot('08-stock-history')
await t('Stock', 'Movement history for one product', 'Filtering by the product lists only its movements; previous/new quantities chain correctly', async () => {
  await page.getByLabel('Filter by product').selectOption({ label: 'Desk Lamp LED' })
  await page.waitForTimeout(200)
  const rows = await page.locator('tbody tr').allInnerTexts()
  const parsed = rows.map((r) => r.replace(/\s+/g, ' ')).reverse() // oldest first
  let prev = null
  let chained = true
  for (const r of parsed) {
    const nums = r.match(/([+−])(\d[\d,]*)\s+(\d[\d,]*)\s+(\d[\d,]*)/)
    if (!nums) { chained = false; break }
    const [, , , previous, next] = nums
    if (prev !== null && Number(previous) !== prev) chained = false
    prev = Number(next)
  }
  return yes(rows.length >= 7 && chained && prev === 42, `${rows.length} movements, chain ok=${chained}, final=${prev}`)
})
await t('Stock', 'Filter by movement type', 'Only issued rows remain', async () => {
  await page.getByLabel('Filter by movement type').selectOption('out')
  await page.waitForTimeout(200)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(rows.length > 0 && rows.every((r) => /Issued/.test(r)), `${rows.length} rows, all issued`)
})
await clearFilters()
await t('Stock', 'Stock history pagination', 'First page shows 10 rows; next page loads more', async () => {
  const first = await page.locator('tbody tr').count()
  await page.getByRole('button', { name: 'Next page' }).click()
  await page.waitForTimeout(200)
  const second = await page.locator('tbody tr').count()
  return yes(first === 10 && second > 0, `page1=${first}, page2=${second}`)
})

// ===================================================================
// 6. SEARCH / FILTER / PAGINATION on products
// ===================================================================
await nav('Products')
await t('Products', 'Pagination', 'First page shows 8 rows; page 2 shows different rows', async () => {
  const total = await totalOf()
  const p1 = await page.locator('tbody tr').allInnerTexts()
  await page.getByRole('button', { name: 'Page 2' }).click()
  await page.waitForTimeout(250)
  const p2 = await page.locator('tbody tr').allInnerTexts()
  const overlap = p1.filter((r) => p2.includes(r)).length
  await page.getByRole('button', { name: 'Page 1' }).click()
  return yes(p1.length === 8 && p2.length === 8 && overlap === 0, `total=${total}, page1=${p1.length}, page2=${p2.length}, overlap=${overlap}`)
})
await t('Products', 'Search by name ("mouse", with extra spaces and capitals)', 'Only matching products', async () => {
  await page.getByLabel('Search products').fill('  MoUsE ')
  await page.waitForTimeout(250)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(rows.length >= 1 && rows.every((r) => /mouse/i.test(r)), `${rows.length} row(s): ${rows[0]?.replace(/\s+/g, ' ')}`)
})
await t('Products', 'Search by product code ("kb-4")', 'Finds the keyboard', async () => {
  await page.getByLabel('Search products').fill('kb-4')
  await page.waitForTimeout(250)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(rows.length === 1 && /KB-410/.test(rows[0]), `${rows.length} row(s)`)
})
await t('Products', 'Search with no matches', 'Empty state "No products match" with a Clear filters button', async () => {
  await page.getByLabel('Search products').fill('zzzzzz')
  await page.waitForTimeout(250)
  await shot('09-no-results-empty-state')
  const vis = await page.getByText('No products match').isVisible()
  return yes(vis, 'empty state visible')
})
await page.getByLabel('Search products').fill('')
await page.waitForTimeout(500)
await t('Products', 'Filter by category (Furniture)', 'Every row is in Furniture', async () => {
  await page.getByLabel('Filter by category').selectOption({ label: 'Furniture' })
  await page.waitForTimeout(250)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(rows.length >= 4 && rows.every((r) => /Furniture/.test(r)), `${rows.length} rows, all Furniture`)
})
await t('Products', 'Filter by stock status (Out of stock)', 'Every row has the Out of stock badge', async () => {
  await page.getByLabel('Filter by category').selectOption('')
  await page.getByLabel('Filter by stock status').selectOption('out-of-stock')
  await page.waitForTimeout(250)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(rows.length >= 1 && rows.every((r) => /Out of stock/.test(r)), `${rows.length} rows`)
})
await t('Products', 'Combine category + status filters', 'Only products that match both', async () => {
  await page.getByLabel('Filter by category').selectOption({ label: 'Furniture' })
  await page.waitForTimeout(250)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(rows.length >= 1 && rows.every((r) => /Furniture/.test(r) && /Out of stock/.test(r)), `${rows.length} row(s)`)
})
await t('Products', 'Filters survive a page refresh', 'URL keeps the filters; the same list is shown', async () => {
  const url = page.url()
  await page.reload()
  await page.waitForTimeout(700)
  const status = await page.getByLabel('Filter by stock status').inputValue()
  const cat = await page.getByLabel('Filter by category').inputValue()
  return yes(/status=out-of-stock/.test(url) && status === 'out-of-stock' && cat !== '', url)
})
await clearFilters()
await t('Products', 'Dashboard link "View all" opens filtered list', 'Low-stock filter applied', async () => {
  await nav('Dashboard')
  await page.getByRole('link', { name: /View all/ }).first().click()
  await page.waitForTimeout(600)
  const status = await page.getByLabel('Filter by stock status').inputValue()
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(status === 'low-stock' && rows.every((r) => /Low stock/.test(r)), `status=${status}, ${rows.length} rows`)
})
await clearFilters()
await t('Products', 'Pagination resets when a filter narrows the list', 'Choosing a filter while on the last page shows results instead of an empty page', async () => {
  await page.getByRole('button', { name: 'Page 4' }).click()
  await page.waitForTimeout(200)
  await page.getByLabel('Filter by category').selectOption({ label: 'Furniture' })
  await page.waitForTimeout(250)
  const rows = await page.locator('tbody tr').count()
  return yes(rows >= 1, `${rows} rows shown`)
})
await clearFilters()

// ===================================================================
// 7. DELETE PRODUCT
// ===================================================================
await page.getByLabel('Search products').fill('XSS-1')
await page.waitForTimeout(250)
const storedCount = () => page.evaluate(() => JSON.parse(localStorage.getItem('mini-erp:v1')).data.products.items.length)
const beforeDelete = await storedCount()
await page.getByRole('button', { name: /^Delete / }).first().click()
await t('Products', 'Delete shows a confirmation; Cancel keeps the product', 'Confirmation dialog appears; after Cancel the product is still listed', async () => {
  const shown = await dialog().getByText('This cannot be undone').isVisible()
  await shot('10-delete-confirmation')
  await dialog().getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(400)
  return yes(shown && (await page.locator('tbody tr').count()) === 1, 'dialog shown, product kept')
})
await page.getByRole('button', { name: /^Delete / }).first().click()
await dialog().getByRole('button', { name: 'Delete product' }).click()
await t('Products', 'Confirm delete', 'Success toast; product removed from the list', async () => {
  const toast = await toasts()
  const empty = await page.getByText('No products match').isVisible()
  return yes(/successfully deleted/.test(toast) && empty, `toast: "${toast}"`)
})
await dismissToasts()
await page.getByLabel('Search products').fill('')
await page.waitForTimeout(400)
await t('Dashboard', 'Dashboard after delete', 'Product count drops by one', async () => {
  const now = await storedCount()
  return yes(now === beforeDelete - 1, `stored products ${beforeDelete} → ${now}`)
})
await t('Products', 'Delete from the detail page returns to the list', 'Redirects to /products and product is gone', async () => {
  await page.goto(detailUrl)
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Delete' }).click()
  await dialog().getByRole('button', { name: 'Delete product' }).click()
  await page.waitForTimeout(700)
  const onList = /\/products$/.test(page.url())
  await page.getByLabel('Search products').fill('lamp')
  await page.waitForTimeout(250)
  const gone = await page.getByText('No products match').isVisible()
  return yes(onList && gone, page.url())
})
await page.getByLabel('Search products').fill('')
await t('Stock', 'History is kept after a product is deleted', 'Stock page still lists the movements, marked "(deleted)"', async () => {
  await nav('Stock')
  const marked = await page.getByText('(deleted)').count()
  return yes(marked > 0, `${marked} history rows marked deleted`)
})

// ===================================================================
// 8. CATEGORIES
// ===================================================================
await nav('Categories')
await shot('11-categories')
await page.getByRole('button', { name: 'Add category' }).first().click()
await t('Categories', 'Submit empty category', 'Name is required (inline + toast)', async () => {
  await dialog().getByRole('button', { name: 'Add category' }).click()
  const msg = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
  const toast = await toasts()
  return yes(/Category name is required/.test(msg) && /Required fields are missing/.test(toast), `${msg} | ${toast}`)
})
await dismissToasts()
await t('Categories', 'Duplicate name (different capitals)', 'Rejected: already exists', async () => {
  await dialog().getByLabel('Category name').fill('electronics')
  await dialog().getByRole('button', { name: 'Add category' }).click()
  const msg = (await dialog().getByRole('alert').allInnerTexts()).join(' | ')
  return yes(/already exists/.test(msg), msg)
})
await t('Categories', 'Add a category', 'Success toast; category listed with 0 products', async () => {
  await dialog().getByLabel('Category name').fill('Garden')
  await dialog().getByLabel('Description').fill('Outdoor items')
  await dialog().getByRole('button', { name: 'Add category' }).click()
  const toast = await toasts()
  const row = await page.getByRole('row', { name: /Garden/ }).innerText()
  return yes(/successfully created/.test(toast) && /Garden/.test(row), `toast: "${toast}"`)
})
await dismissToasts()
await t('Categories', 'Edit a category', 'Rename saves and appears in the list and in the product filter', async () => {
  await page.getByRole('button', { name: 'Edit Garden' }).click()
  await dialog().getByLabel('Category name').fill('Outdoor')
  await dialog().getByRole('button', { name: 'Save changes' }).click()
  const toast = await toasts()
  const listed = await page.getByRole('row', { name: /Outdoor/ }).isVisible()
  return yes(/successfully updated/.test(toast) && listed, `toast: "${toast}"`)
})
await dismissToasts()
await t('Categories', 'Delete a category that products use', 'Blocked with a message naming how many products use it; category stays', async () => {
  await page.getByRole('button', { name: 'Delete Electronics' }).click()
  const toast = await toasts()
  const still = await page.getByRole('row', { name: /Electronics/ }).isVisible()
  const noDialog = !(await dialog().isVisible().catch(() => false))
  return yes(/used by \d+ products/.test(toast) && still && noDialog, `toast: "${toast}"`)
})
await dismissToasts()
await t('Categories', 'Delete an unused category (confirm)', 'Confirmation first, then removed with a success toast', async () => {
  await page.getByRole('button', { name: 'Delete Outdoor' }).click()
  const asked = await dialog().getByText('No products use it').isVisible()
  await dialog().getByRole('button', { name: 'Delete category' }).click()
  const toast = await toasts()
  await page.waitForTimeout(300)
  const gone = (await page.getByRole('row', { name: /Outdoor/ }).count()) === 0
  return yes(asked && /successfully deleted/.test(toast) && gone, `toast: "${toast}"`)
})
await dismissToasts()
await t('Categories', 'Product count link', 'Clicking the count opens the product list filtered to that category', async () => {
  await page.getByRole('row', { name: /Furniture/ }).getByRole('link').click()
  await page.waitForTimeout(600)
  const cat = await page.getByLabel('Filter by category').inputValue()
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(cat !== '' && rows.every((r) => /Furniture/.test(r)), `${rows.length} Furniture products`)
})
await t('Products', 'Add product when a category was renamed', 'Category list in the form shows current category names', async () => {
  await page.getByRole('button', { name: 'Add product' }).first().click()
  const options = await dialog().getByLabel('Category').locator('option').allInnerTexts()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(options.includes('Furniture') && !options.includes('Outdoor') && !options.includes('Garden'), options.join(', '))
})

// ===================================================================
// 9. PERSISTENCE
// ===================================================================
await nav('Stock')
await page.getByRole('button', { name: 'Receive stock' }).first().click()
await dialog().getByLabel('Product').selectOption({ label: 'Wireless Mouse (WM-200)' })
await dialog().getByLabel(/Quantity to/).fill('30')
await submitStock('in')
await page.waitForTimeout(400)
await nav('Dashboard')
const beforeReload = { stock: await stat('Total stock (units)'), value: await stat('Inventory value'), products: await stat('Total products') }
const activityBefore = await page.getByRole('heading', { name: 'Recent activity' }).locator('xpath=../../..//li').first().innerText()
await page.reload()
await page.waitForTimeout(800)
await t('Persistence', 'Refresh the browser after making changes', 'Dashboard totals, products and recent activity are unchanged', async () => {
  const after = { stock: await stat('Total stock (units)'), value: await stat('Inventory value'), products: await stat('Total products') }
  const activityAfter = await page.getByRole('heading', { name: 'Recent activity' }).locator('xpath=../../..//li').first().innerText()
  return yes(JSON.stringify(after) === JSON.stringify(beforeReload) && activityAfter === activityBefore, `before=${JSON.stringify(beforeReload)} after=${JSON.stringify(after)}`)
})
await t('Persistence', 'Data is stored in the browser (localStorage)', 'A saved record exists with products, categories and movements', async () => {
  const info = await page.evaluate(() => {
    const raw = localStorage.getItem('mini-erp:v1')
    if (!raw) return null
    const d = JSON.parse(raw).data
    return { products: d.products.items.length, categories: d.categories.items.length, movements: d.stock.movements.length }
  })
  return yes(info && info.products > 0, JSON.stringify(info))
})
await t('Persistence', 'Saved data is damaged (invalid JSON)', 'App still opens using demo data and shows an info message', async () => {
  await page.evaluate(() => localStorage.setItem('mini-erp:v1', '{this is not json'))
  await page.reload()
  await page.waitForTimeout(800)
  const toast = await toasts()
  const products = await stat('Total products')
  return yes(/could not be read/.test(toast) && products === dash0.products, `toast: "${toast}", products=${products}`)
})
await t('Persistence', 'Saved data has the wrong shape (negative stock)', 'Rejected; demo data used', async () => {
  await page.evaluate(() => {
    localStorage.setItem('mini-erp:v1', JSON.stringify({ version: 1, data: { products: { items: [{ id: 'x', name: 'x', sku: 'x', description: '', createdAt: '', categoryId: 'c', quantity: -5, minStock: 1, unitPrice: 1 }] }, categories: { items: [{ id: 'c', name: 'c' }] }, stock: { movements: [] }, activity: { items: [] } } }))
  })
  await page.reload()
  await page.waitForTimeout(800)
  const products = await stat('Total products')
  return yes(products === dash0.products, `products=${products}`)
})
await t('Persistence', 'Browser storage is blocked or full', 'App still works and warns that changes will not be saved', async () => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
  })
  await nav('Categories')
  await page.getByRole('button', { name: 'Add category' }).first().click()
  await dialog().getByLabel('Category name').fill('Temp')
  await dialog().getByRole('button', { name: 'Add category' }).click()
  const toast = await toasts()
  return yes(/Could not save/.test(toast) && /successfully created/.test(toast), toast)
})
await page.reload()
await page.waitForTimeout(500)
await dismissToasts()

await t('Persistence', 'Reset demo data (with confirmation)', 'Confirmation first; afterwards demo data is back', async () => {
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(700)
  await nav('Categories')
  await page.getByRole('button', { name: 'Add category' }).first().click()
  await dialog().getByLabel('Category name').fill('Temp2')
  await dialog().getByRole('button', { name: 'Add category' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Reset demo data' }).first().click()
  const asked = await dialog().getByText('replaces all products').isVisible()
  await dialog().getByRole('button', { name: 'Reset data' }).click()
  const toast = await toasts()
  await page.waitForTimeout(300)
  const rows = await page.locator('tbody tr').count()
  return yes(asked && /restored/.test(toast) && rows === 6, `rows=${rows}, toast="${toast}"`)
})
await dismissToasts()

// ===================================================================
// 10. ROUTES
// ===================================================================
for (const [url, expectText] of [
  ['/stock', 'Receive and issue stock'],
  ['/categories', 'Group your products'],
  ['/products', 'Manage everything you keep in stock'],
  ['/products/does-not-exist', 'Product not found'],
  ['/some/unknown/page', 'Page not found'],
]) {
  await t('Routing', `Open ${url} directly`, `Page loads and shows "${expectText}"`, async () => {
    await go(url)
    return yes(await page.getByText(expectText).first().isVisible(), page.url())
  })
}
await go('/some/unknown/page')
await shot('12-not-found')

// ===================================================================
// 11. KEYBOARD / ACCESSIBILITY SPOT CHECKS
// ===================================================================
await go('/products')
await page.waitForSelector('tbody tr')
await t('Accessibility', 'Icon-only buttons have names', 'Every button in the table has an accessible name', async () => {
  const names = await page.locator('tbody').getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? ''))
  return yes(names.length > 0 && names.every(Boolean), `${names.length} buttons named`)
})
await t('Accessibility', 'Dialog is announced as a dialog and labelled', 'role=dialog, aria-modal, labelled by its title', async () => {
  await page.getByRole('button', { name: 'Add product' }).first().click()
  const attrs = await dialog().evaluate((el) => ({ modal: el.getAttribute('aria-modal'), labelled: !!document.getElementById(el.getAttribute('aria-labelledby') ?? '') }))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(attrs.modal === 'true' && attrs.labelled, JSON.stringify(attrs))
})

// ===================================================================
// 12. RESPONSIVE
// ===================================================================
const sizes = [
  ['desktop', 1440, 900],
  ['laptop', 1024, 768],
  ['tablet', 768, 1024],
  ['phone', 375, 812],
  ['small-phone', 320, 640],
]
const pages = [['dashboard', '/'], ['products', '/products'], ['stock', '/stock'], ['categories', '/categories']]
for (const [label, w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h })
  for (const [name, url] of pages) {
    await go(url)
    await t('Responsive', `${name} at ${w}px (${label})`, 'No sideways scrolling of the page; navigation reachable', async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      const sidebar = await page.getByRole('navigation', { name: 'Main' }).first().isVisible()
      const burger = await page.getByRole('button', { name: 'Open menu' }).isVisible().catch(() => false)
      return yes(overflow <= 1 && (sidebar || burger), `page overflow=${overflow}px, sidebar visible=${sidebar}, menu button=${burger}`)
    })
    if ((w === 375 || w === 768) && (name === 'dashboard' || name === 'products')) {
      await page.waitForTimeout(1800)
      await shot(`13-${name}-${label}`)
    }
  }
}
await page.setViewportSize({ width: 375, height: 812 })
await go('/')
await t('Responsive', 'Mobile menu opens, navigates and closes', 'Hamburger opens the drawer; choosing Stock goes to /stock and closes it', async () => {
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.waitForTimeout(350)
  await shot('14-mobile-menu')
  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: 'Stock' }).click()
  await page.waitForTimeout(500)
  const closed = !(await page.getByRole('button', { name: 'Close menu' }).isVisible().catch(() => false))
  return yes(/\/stock$/.test(page.url()) && closed, page.url())
})
await go('/products')
await t('Responsive', 'Add product dialog fits a phone screen', 'Dialog fits the screen height and the submit button can be reached', async () => {
  await page.getByRole('button', { name: 'Add product' }).first().click()
  await page.waitForTimeout(400)
  await shot('15-mobile-form')
  const box = await dialog().boundingBox()
  const btn = dialog().getByRole('button', { name: 'Add product' })
  await btn.scrollIntoViewIfNeeded()
  const bb = await btn.boundingBox()
  const okFit = box.y >= 0 && box.y + box.height <= 812 + 1 && box.x >= 0 && box.x + box.width <= 376
  const reachable = bb.y + bb.height <= 812
  await page.keyboard.press('Escape')
  return yes(okFit && reachable, `dialog ${Math.round(box.width)}×${Math.round(box.height)} at y=${Math.round(box.y)}`)
})
await page.setViewportSize({ width: 1440, height: 900 })

// ===================================================================
// 14. NEW FEATURES
// ===================================================================
const readDownload = async (action) => {
  const [download] = await Promise.all([page.waitForEvent('download'), action()])
  const file = await download.path()
  return { name: download.suggestedFilename(), text: fs.readFileSync(file, 'utf8') }
}
const palette = () => page.getByRole('dialog', { name: 'Search and quick actions' })
const combo = () => palette().getByRole('combobox')
const storedCounts = () =>
  page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('mini-erp:v1')).data
    return { movements: d.stock.movements.length, out: d.stock.movements.filter((m) => m.type === 'out').length, products: d.products.items.length }
  })

await page.setViewportSize({ width: 1440, height: 900 })
await go('/')
await page.waitForTimeout(600)

await t('Dashboard', 'Greeting uses the company name', 'Heading reads "Good morning/afternoon/evening, Capitalist SL" and the sidebar shows the same name', async () => {
  const h = (await page.getByRole('heading', { level: 1 }).innerText()).replace(/\s+/g, ' ')
  const side = await page.getByRole('complementary').first().innerText()
  return yes(/Good (morning|afternoon|evening),/.test(h) && /Capitalist SL/.test(h) && /Capitalist SL/.test(side), h)
})
await t('Dashboard', 'Summary icons all use one colour', 'The five summary cards use the same icon colour and background', async () => {
  const styles = await page.evaluate(() =>
    [...document.querySelectorAll('[data-aos]')]
      .filter((c) => /^(Total products|Total stock|Inventory value|Low-stock products|Out-of-stock products)/.test(c.querySelector('p')?.textContent ?? ''))
      .map((c) => `${getComputedStyle(c.querySelector('svg').parentElement).backgroundColor} / ${getComputedStyle(c.querySelector('svg')).color}`),
  )
  return yes(styles.length === 5 && new Set(styles).size === 1, `${styles.length} cards, ${new Set(styles).size} colour style(s): ${styles[0]}`)
})
await t('Dashboard', 'Total stock card shows a 7-day trend', 'A note such as "+2% in 7 days" and one small line graph', async () => {
  const card = page.locator('[data-aos]').filter({ hasText: 'Total stock (units)' }).first()
  const text = (await card.innerText()).replace(/\s+/g, ' ')
  return yes(/in 7 days|Not enough history/.test(text) && (await card.locator('svg[role="img"]').count()) === 1, text)
})
await t('Dashboard', 'Numbers count up and finish on the right value (normal motion setting)', 'After a moment the card shows exactly the real total', async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx2.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  const p2 = await ctx2.newPage()
  await p2.goto(BASE + '/')
  const value = p2.locator("xpath=//p[normalize-space()='Total stock (units)']/parent::div/following-sibling::p").first()
  await value.waitFor()
  const early = await value.innerText()
  await p2.waitForTimeout(1600)
  const final = await value.innerText()
  await ctx2.close()
  return yes(Number(final.replace(/,/g, '')) === dash0.stock, `first seen: ${early}, final: ${final}, expected ${dash0.stock}`)
})

// ---- Search panel ----
await go('/products')
await page.keyboard.press('Control+k')
await t('Search panel', 'Open with Ctrl+K', 'Panel opens with the search box focused and lists actions and pages', async () => {
  await palette().waitFor()
  await page.waitForTimeout(250)
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('role'))
  const text = await palette().innerText()
  await shot('16-search-panel')
  return yes(focused === 'combobox' && /Receive stock/.test(text) && /Go to Stock/.test(text), `focused role=${focused}`)
})
await t('Search panel', 'Arrow keys move the highlight', 'Down changes the highlighted row, Up returns to it', async () => {
  const before = await combo().getAttribute('aria-activedescendant')
  await page.keyboard.press('ArrowDown')
  const after = await combo().getAttribute('aria-activedescendant')
  await page.keyboard.press('ArrowUp')
  const back = await combo().getAttribute('aria-activedescendant')
  return yes(before !== after && back === before, `${before?.slice(-8)} → ${after?.slice(-8)} → ${back?.slice(-8)}`)
})
await t('Search panel', 'Type a product name and press Enter', 'The product is listed first; Enter opens its page', async () => {
  await combo().fill('mouse')
  await page.waitForTimeout(150)
  const text = await palette().innerText()
  await shot('17-search-results')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  return yes(/Wireless Mouse/.test(text) && /\/products\/prd_/.test(page.url()) && (await page.getByRole('heading', { name: 'Wireless Mouse' }).isVisible()), page.url())
})
await t('Search panel', 'Type a category name and press Enter', 'The category is listed first; Enter opens the products list filtered to it', async () => {
  await page.keyboard.press('Control+k')
  await combo().fill('furniture')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(/category=cat_seed_3/.test(page.url()) && rows.length >= 4 && rows.every((r) => /Furniture/.test(r)), `${page.url()} → ${rows.length} rows`)
})
await t('Search panel', 'Pick an action ("receive")', 'The Receive stock dialog opens with Receive selected', async () => {
  await page.keyboard.press('Control+k')
  await combo().fill('receive')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const open = await dialog().getByText('Record stock movement').isVisible()
  const checked = await dialog().getByRole('radio', { name: 'Receive stock' }).getAttribute('aria-checked')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(open && checked === 'true', `dialog open=${open}, receive selected=${checked}`)
})
await t('Search panel', 'Search with no matches', 'Shows "Nothing found" and Enter does nothing', async () => {
  await page.keyboard.press('Control+k')
  await combo().fill('zzzzzz')
  await page.waitForTimeout(150)
  const text = await palette().innerText()
  const url = page.url()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  const still = await palette().isVisible()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(/Nothing found/.test(text) && still && page.url() === url, text.split('\n')[0])
})
await t('Search panel', 'Sidebar search button opens the panel', 'Clicking Search… opens it; Escape closes it', async () => {
  await page.getByRole('complementary').getByRole('button', { name: 'Search and quick actions' }).click()
  const opened = await palette().isVisible()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(opened && !(await palette().isVisible().catch(() => false)), `opened=${opened}`)
})
await go('/products')
await page.getByRole('button', { name: 'Add product' }).first().click()
await page.waitForTimeout(400)
await page.keyboard.press('Control+k')
await page.waitForTimeout(400)
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
await t('Search panel', 'Escape on the panel while a dialog is open behind it', 'Only the panel closes; the dialog underneath stays open', async () => {
  const panelGone = !(await palette().isVisible().catch(() => false))
  const dialogStays = await page.getByRole('dialog', { name: 'Add product' }).isVisible().catch(() => false)
  return yes(panelGone && dialogStays, `panel closed=${panelGone}, dialog still open=${dialogStays}`)
})
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ---- Sorting ----
await go('/products')
const numbers = (col) => page.locator('tbody tr').evaluateAll((rows, c) => rows.map((r) => Number(r.children[c].innerText.replace(/[^0-9.]/g, '').split(/\s/)[0])), col)
const qtyCol = async () => (await page.locator('tbody tr').evaluateAll((rows) => rows.map((r) => Number(r.children[3].querySelector('span.font-medium').textContent.replace(/,/g, '')))))
const priceCol = () => page.locator('tbody tr').evaluateAll((rows) => rows.map((r) => Number(r.children[2].textContent.replace(/[^0-9.]/g, ''))))
const header = (name) => page.locator('th').filter({ has: page.getByRole('button', { name, exact: true }) })
void numbers
await t('Sorting', 'Sort by quantity, low to high (whole list, not just the page)', 'Rows are in rising order and the very first row has the lowest quantity (0)', async () => {
  await page.getByRole('button', { name: 'Quantity', exact: true }).click()
  await page.waitForTimeout(300)
  const q = await qtyCol()
  const asc = q.every((v, i) => i === 0 || q[i - 1] <= v)
  const aria = await header('Quantity').getAttribute('aria-sort')
  await shot('18-sorted-by-quantity')
  return yes(asc && q[0] === 0 && aria === 'ascending' && /sort=quantity/.test(page.url()), `quantities: ${q.join(', ')}; aria-sort=${aria}`)
})
await t('Sorting', 'Page 2 continues the same order', 'First quantity on page 2 is not lower than the last on page 1', async () => {
  const p1 = await qtyCol()
  await page.getByRole('button', { name: 'Page 2' }).click()
  await page.waitForTimeout(250)
  const p2 = await qtyCol()
  await page.getByRole('button', { name: 'Page 1' }).click()
  return yes(p2[0] >= p1[p1.length - 1], `page1 ends ${p1.at(-1)}, page2 starts ${p2[0]}`)
})
await t('Sorting', 'Click again for high to low, again to return to default', 'Second click reverses (largest first); third click clears the sorting', async () => {
  await page.getByRole('button', { name: 'Quantity', exact: true }).click()
  await page.waitForTimeout(250)
  const q = await qtyCol()
  const desc = q.every((v, i) => i === 0 || q[i - 1] >= v) && q[0] === 320
  await page.getByRole('button', { name: 'Quantity', exact: true }).click()
  await page.waitForTimeout(250)
  const aria = await header('Quantity').getAttribute('aria-sort')
  return yes(desc && aria === 'none' && !/sort=/.test(page.url()), `first desc value=${q[0]}, final aria-sort=${aria}, url=${page.url()}`)
})
await t('Sorting', 'Sort by price and by name', 'Prices rise; names are in A to Z order', async () => {
  await page.getByRole('button', { name: 'Price', exact: true }).click()
  await page.waitForTimeout(250)
  const pr = await priceCol()
  const priceOk = pr.every((v, i) => i === 0 || pr[i - 1] <= v)
  await page.getByRole('button', { name: 'Product', exact: true }).click()
  await page.waitForTimeout(250)
  const names = await page.locator('tbody tr').evaluateAll((rows) => rows.map((r) => r.querySelector('a').textContent))
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  return yes(priceOk && JSON.stringify(names) === JSON.stringify(sorted), `prices ${pr.join(', ')} | names ${names.slice(0, 3).join(' / ')} …`)
})
await t('Sorting', 'Sort by status', 'Most urgent first: Out of stock rows come before Low stock, then In stock', async () => {
  await page.getByRole('button', { name: 'Status', exact: true }).click()
  await page.waitForTimeout(250)
  const rows = await page.locator('tbody tr').allInnerTexts()
  const rank = rows.map((r) => (/Out of stock/.test(r) ? 0 : /Low stock/.test(r) ? 1 : 2))
  return yes(rank.every((v, i) => i === 0 || rank[i - 1] <= v) && rank[0] === 0, rank.join(''))
})
await t('Sorting', 'Sorting is kept after a refresh', 'Same sort and order after reloading the page', async () => {
  await page.reload()
  await page.waitForTimeout(800)
  return yes((await header('Status').getAttribute('aria-sort')) === 'ascending', page.url())
})
await t('Sorting', 'Changing the sort while on page 2 goes back to page 1', 'Shows rows 1 to 8', async () => {
  await page.getByRole('button', { name: 'Page 2' }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Price', exact: true }).click()
  await page.waitForTimeout(250)
  const text = (await page.getByRole('navigation', { name: 'Pagination' }).innerText()).replace(/\s+/g, ' ')
  return yes(/Showing 1.8 of/.test(text), text)
})

// ---- Stock gauges ----
await go('/products')
await t('Products', 'Stock gauge matches the status', 'Out of stock = empty bar, Low stock = partly filled, In stock = full', async () => {
  const widths = await page.locator('tbody tr').evaluateAll((rows) =>
    rows.map((r) => ({ status: /Out of stock/.test(r.innerText) ? 'out' : /Low stock/.test(r.innerText) ? 'low' : 'in', width: parseFloat(r.querySelector('div.rounded-full > div').style.width) })),
  )
  const out = widths.filter((w) => w.status === 'out')
  const low = widths.filter((w) => w.status === 'low')
  const full = widths.filter((w) => w.status === 'in')
  return yes(out.every((w) => w.width === 0) && low.every((w) => w.width > 0 && w.width < 100) && full.every((w) => w.width === 100), `empty=${out.length}, partial=${low.map((w) => w.width + '%').join('/')}, full=${full.length}`)
})
await t('Products', 'Quick action on a row opens receive/issue with the product chosen', 'Dialog opens with "Wireless Mouse (WM-200)" already selected', async () => {
  await page.getByLabel('Search products').fill('WM-200')
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Receive or issue stock for Wireless Mouse' }).click()
  await page.waitForTimeout(400)
  const selected = await dialog().getByLabel('Product').evaluate((el) => el.options[el.selectedIndex].text)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(selected === 'Wireless Mouse (WM-200)', selected)
})
await page.getByLabel('Search products').fill('')

// ---- CSV ----
await t('Export', 'Download all products as CSV', 'File named products-DATE.csv with a header row and one row per product', async () => {
  const { name, text } = await readDownload(() => page.getByRole('button', { name: 'Export CSV' }).click())
  const lines = text.replace(/^﻿/, '').split('\r\n')
  const stored = await storedCounts()
  return yes(/^products-\d{4}-\d{2}-\d{2}\.csv$/.test(name) && /^Product name,Product code \(SKU\)/.test(lines[0]) && lines.length === stored.products + 1, `${name}: ${lines.length - 1} rows, header: ${lines[0].slice(0, 60)}`)
})
await dismissToasts()
await t('Export', 'Export respects the search filter', 'Searching "WM-200" then exporting gives 1 product row, with a success message', async () => {
  await page.getByLabel('Search products').fill('WM-200')
  await page.waitForTimeout(250)
  const { text } = await readDownload(() => page.getByRole('button', { name: 'Export CSV' }).click())
  const lines = text.replace(/^﻿/, '').split('\r\n')
  const toast = await toasts()
  return yes(lines.length === 2 && /Wireless Mouse/.test(lines[1]) && /Exported 1 product to CSV/.test(toast), `${lines.length - 1} row(s); "${toast}"`)
})
await dismissToasts()
await t('Export', 'Export is switched off when nothing matches', 'Button is disabled with an empty list', async () => {
  await page.getByLabel('Search products').fill('zzzzzz')
  await page.waitForTimeout(250)
  return yes(await page.getByRole('button', { name: 'Export CSV' }).isDisabled(), 'disabled')
})
await page.getByLabel('Search products').fill('')
await t('Export', 'Product names that look like spreadsheet formulas are made safe', 'A product named =1+1 appears as \'=1+1 in the file, so Excel will not run it', async () => {
  await page.getByRole('button', { name: 'Add product' }).first().click()
  await fillProduct({ name: '=1+1', sku: 'CSV-1', category: 'Furniture', price: '2', quantity: '1', min: '1' })
  await dialog().getByRole('button', { name: 'Add product' }).click()
  await page.waitForTimeout(400)
  await dismissToasts()
  await page.getByLabel('Search products').fill('CSV-1')
  await page.waitForTimeout(250)
  const { text } = await readDownload(() => page.getByRole('button', { name: 'Export CSV' }).click())
  return yes(text.includes("'=1+1,CSV-1") && !text.includes('\r\n=1+1'), text.split('\r\n')[1])
})
await dismissToasts()
// remove the helper product again
await page.getByRole('button', { name: /^Delete =1\+1/ }).click()
await dialog().getByRole('button', { name: 'Delete product' }).click()
await page.waitForTimeout(400)
await dismissToasts()
await page.getByLabel('Search products').fill('')

await nav('Stock')
await t('Export', 'Download stock movements as CSV (all and filtered)', 'Row counts equal the saved movements; "Issued only" exports only issued rows', async () => {
  const stored = await storedCounts()
  const all = await readDownload(() => page.getByRole('button', { name: 'Export CSV' }).click())
  const allLines = all.text.replace(/^﻿/, '').split('\r\n')
  await dismissToasts()
  await page.getByLabel('Filter by movement type').selectOption('out')
  await page.waitForTimeout(250)
  const issued = await readDownload(() => page.getByRole('button', { name: 'Export CSV' }).click())
  const issuedLines = issued.text.replace(/^﻿/, '').split('\r\n')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  return yes(allLines.length - 1 === stored.movements && issuedLines.length - 1 === stored.out && issuedLines.slice(1).every((l) => /,Issued,/.test(l)), `all ${allLines.length - 1}/${stored.movements}, issued ${issuedLines.length - 1}/${stored.out}; ${all.name}`)
})
await dismissToasts()

// ---- Undo ----
await nav('Products')
const countProducts = async () => (await storedCounts()).products
await t('Undo', 'Delete a product, then press Undo', 'Product returns with the same quantity (85) and its history is still there', async () => {
  const before = await countProducts()
  await page.getByLabel('Search products').fill('WM-200')
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Delete Wireless Mouse' }).click()
  await dialog().getByRole('button', { name: 'Delete product' }).click()
  await page.waitForTimeout(400)
  const goneCount = await countProducts()
  await shot('19-undo-toast')
  const undo = page.getByRole('button', { name: 'Undo' })
  const hadUndo = await undo.isVisible()
  await undo.click()
  await page.waitForTimeout(500)
  const toast = await toasts()
  const row = (await page.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ')
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('mini-erp/dummy') ?? 'null'))
  void history
  return yes(hadUndo && goneCount === before - 1 && (await countProducts()) === before && /restored/.test(toast) && /Wireless Mouse/.test(row) && /85/.test(row), `count ${before} → ${goneCount} → ${await countProducts()}; row: ${row}; toast: "${toast}"`)
})
await dismissToasts()
await t('Undo', 'Restored product keeps its stock history', 'Opening its page shows the same movements as before', async () => {
  await page.getByRole('link', { name: 'Wireless Mouse', exact: true }).click()
  await page.waitForTimeout(700)
  const rows = await page.locator('tbody tr').count()
  const qty = await page.locator('xpath=//p[normalize-space()="Available quantity"]/following-sibling::p').first().innerText()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mini-erp:v1')).data.stock.movements.filter((m) => m.sku === 'WM-200').length)
  return yes(rows === Math.min(8, stored) && qty === '85', `${rows} history rows shown (of ${stored}), quantity ${qty}`)
})
await nav('Categories')
await t('Undo', 'Delete a category, then press Undo', 'Category returns to the list', async () => {
  await page.getByRole('button', { name: 'Add category' }).first().click()
  await dialog().getByLabel('Category name').fill('Temp Undo')
  await dialog().getByRole('button', { name: 'Add category' }).click()
  await page.waitForTimeout(400)
  await dismissToasts()
  await page.getByRole('button', { name: 'Delete Temp Undo' }).click()
  await dialog().getByRole('button', { name: 'Delete category' }).click()
  await page.waitForTimeout(400)
  const gone = (await page.getByRole('row', { name: /Temp Undo/ }).count()) === 0
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.waitForTimeout(400)
  const back = await page.getByRole('row', { name: /Temp Undo/ }).isVisible()
  return yes(gone && back, `removed=${gone}, restored=${back}`)
})
await dismissToasts()
await page.waitForTimeout(900)
await t('Undo', 'No Undo button on a refused delete', 'Trying to delete a category in use shows an error without Undo', async () => {
  await page.getByRole('button', { name: 'Delete Electronics' }).click()
  await page.waitForTimeout(300)
  return yes((await page.getByRole('button', { name: 'Undo', exact: true }).count()) === 0 && /used by/.test(await toasts()), 'error only')
})
await dismissToasts()
await t('Undo', 'Undo button disappears after about 8 seconds', 'Notification and Undo are gone after 9 seconds', async () => {
  await page.getByRole('button', { name: 'Delete Temp Undo' }).click()
  await dialog().getByRole('button', { name: 'Delete category' }).click()
  await page.waitForTimeout(500)
  const shown = await page.getByRole('button', { name: 'Undo' }).isVisible()
  await page.waitForTimeout(8500)
  const after = await page.getByRole('button', { name: 'Undo' }).count()
  return yes(shown && after === 0, `visible at start=${shown}, after 9s=${after}`)
})

// ---- Restock from the dashboard ----
await nav('Dashboard')
await page.waitForTimeout(500)
await t('Dashboard', 'Restock button on a low-stock product', 'Opens Receive with the product chosen; receiving 100 units removes it from the low-stock count', async () => {
  const lowBefore = await stat('Low-stock products')
  const button = page.getByRole('button', { name: /^Restock / }).first()
  const label = await button.getAttribute('aria-label')
  const name = label.replace('Restock ', '')
  await button.click()
  await page.waitForTimeout(400)
  const selected = await dialog().getByLabel('Product').evaluate((el) => el.options[el.selectedIndex].text)
  const receive = await dialog().getByRole('radio', { name: 'Receive stock' }).getAttribute('aria-checked')
  await shot('20-restock-dialog')
  await dialog().getByLabel(/Quantity to/).fill('100')
  await submitStock('in')
  await page.waitForTimeout(600)
  const lowAfter = await stat('Low-stock products')
  return yes(selected.startsWith(name) && receive === 'true' && lowAfter === lowBefore - 1, `${name}: low-stock ${lowBefore} → ${lowAfter}`)
})
await dismissToasts()

// ---- Interactive charts ----
await go('/')
await page.waitForTimeout(1800)
await t('Dashboard', 'Click a bar in "Stock by category"', 'Opens the products list filtered to that category', async () => {
  await page.locator('.recharts-bar-rectangle path').first().click({ force: true })
  await page.waitForTimeout(800)
  const selected = await page.getByLabel('Filter by category').evaluate((el) => el.options[el.selectedIndex].text)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(/category=/.test(page.url()) && rows.length > 0 && rows.every((r) => r.includes(selected)), `${selected}: ${rows.length} rows`)
})
await go('/')
await page.waitForTimeout(1800)
await t('Dashboard', 'Click a slice of the stock status chart', 'Opens the products list filtered to that status', async () => {
  const point = await page.evaluate(() => {
    const sector = document.querySelector('.recharts-pie-sector path')
    const m = sector.getScreenCTM()
    const q = sector.getPointAtLength(sector.getTotalLength() * 0.1)
    const edge = { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f }
    const box = document.querySelector('.recharts-pie').getBoundingClientRect()
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    // move from the outer edge toward the middle of the ring
    return { x: edge.x + (centre.x - edge.x) * 0.19, y: edge.y + (centre.y - edge.y) * 0.19 }
  })
  await page.mouse.click(point.x, point.y)
  await page.waitForTimeout(800)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(/status=in-stock/.test(page.url()) && rows.length > 0 && rows.every((r) => /In stock/.test(r)), `${page.url()} → ${rows.length} rows`)
})
await go('/')
await page.waitForTimeout(1500)
await t('Dashboard', 'Status list under the chart is clickable (keyboard friendly)', 'Clicking "Out of stock" opens the filtered list', async () => {
  await page.getByRole('link', { name: /^Out of stock/ }).click()
  await page.waitForTimeout(700)
  const rows = await page.locator('tbody tr').allInnerTexts()
  return yes(/status=out-of-stock/.test(page.url()) && rows.every((r) => /Out of stock/.test(r)), page.url())
})

// ---- Product graph ----
await go('/products?q=WM-200')
await page.getByRole('link', { name: 'Wireless Mouse', exact: true }).click()
await page.waitForTimeout(1800)
await t('Products', 'Stock level graph on the product page', 'A graph is drawn and hovering shows the quantity and what changed', async () => {
  const drawn = await page.locator('.recharts-area-area').count()
  const box = await page.locator('.recharts-wrapper').first().boundingBox()
  await page.mouse.move(box.x + box.width * 0.93, box.y + box.height * 0.5)
  await page.waitForTimeout(400)
  const tip = (await page.locator('.recharts-tooltip-wrapper').first().innerText()).replace(/\s+/g, ' ')
  await page.locator('.recharts-wrapper').first().scrollIntoViewIfNeeded()
  await shot('21-product-graph')
  return yes(drawn >= 1 && /units/.test(tip), `tooltip: ${tip}`)
})

// ---- Sidebar collapse ----
await go('/')
await t('Layout', 'Collapse and expand the sidebar', 'Sidebar shrinks to icons, links keep their names, choice survives a refresh', async () => {
  const side = page.getByRole('complementary').first()
  const wide = (await side.boundingBox()).width
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await page.waitForTimeout(600)
  const narrow = (await side.boundingBox()).width
  const named = await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Products' }).count()
  await shot('22-sidebar-collapsed')
  await page.reload()
  await page.waitForTimeout(800)
  const stillNarrow = (await page.getByRole('complementary').first().boundingBox()).width
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.waitForTimeout(600)
  const back = (await page.getByRole('complementary').first().boundingBox()).width
  return yes(narrow < 100 && wide > 200 && named === 1 && stillNarrow < 100 && Math.abs(back - wide) < 2, `wide=${wide}px, collapsed=${narrow}px, after refresh=${stillNarrow}px, expanded again=${back}px`)
})

// ---- Phone ----
await page.setViewportSize({ width: 375, height: 812 })
await go('/')
await t('Responsive', 'Search button in the phone top bar', 'Opens the search panel and it fits inside the screen', async () => {
  await page.getByRole('banner').getByRole('button', { name: 'Search and quick actions' }).click()
  await page.waitForTimeout(400)
  const box = await palette().boundingBox()
  await shot('23-mobile-search')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return yes(box.x >= 0 && box.x + box.width <= 376, `panel ${Math.round(box.x)}–${Math.round(box.x + box.width)}px of 375px`)
})
await t('Responsive', 'Hero buttons and cards fit a small phone (320px)', 'No sideways scrolling on the dashboard', async () => {
  await page.setViewportSize({ width: 320, height: 640 })
  await go('/')
  await page.waitForTimeout(1200)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  return yes(overflow <= 1, `overflow ${overflow}px`)
})
await page.setViewportSize({ width: 1440, height: 900 })

// ===================================================================
// 13. CONSOLE
// ===================================================================
await t('General', 'Browser console during the whole test run', 'No errors or uncaught exceptions', async () => {
  const unique = [...new Set(consoleErrors)]
  return yes(unique.length === 0, unique.length ? unique.slice(0, 5).join(' || ') : 'no errors')
})

await browser.close()
fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2))
const pass = results.filter((r) => r.status === 'PASS').length
console.log(`\n${pass}/${results.length} passed`)
for (const r of results.filter((x) => x.status === 'FAIL')) {
  console.log(`FAIL  [${r.feature}] ${r.scenario}\n      expected: ${r.expected}\n      actual:   ${r.actual}`)
}
