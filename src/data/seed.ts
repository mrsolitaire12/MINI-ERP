import type { Activity, Category, MovementType, Product, StockMovement } from '@/types'
import { describeMovement } from '@/lib/inventory'

export interface SeedData {
  categories: Category[]
  products: Product[]
  /** Newest first. */
  movements: StockMovement[]
  /** Newest first. */
  activities: Activity[]
}

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/** Small repeatable random number generator, so demo data is the same every time. */
function createRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CATEGORY_DATA: Array<[string, string]> = [
  ['Electronics', 'Computers, accessories and office electronics'],
  ['Office Supplies', 'Paper, stationery and everyday desk items'],
  ['Furniture', 'Chairs, desks and storage'],
  ['Packaging', 'Boxes, tape and shipping materials'],
  ['Cleaning Supplies', 'Sanitisers, wipes and cleaning products'],
  ['Tools & Hardware', 'Hand tools and power tools'],
]

// name, sku, category index, description, unit price, quantity, minimum stock
const PRODUCT_DATA: Array<[string, string, number, string, number, number, number]> = [
  ['Wireless Mouse', 'WM-200', 0, '2.4 GHz wireless optical mouse with USB receiver.', 24.99, 85, 20],
  ['Mechanical Keyboard', 'KB-410', 0, 'Full-size keyboard with tactile switches and backlight.', 79.5, 12, 15],
  ['USB-C Hub 7-in-1', 'HUB-070', 0, 'HDMI, USB-A, SD card reader and 100 W power pass-through.', 39, 0, 10],
  ['27-inch Monitor', 'MN-270', 0, 'QHD IPS monitor with adjustable stand.', 249, 18, 5],
  ['HD Webcam 1080p', 'WC-108', 0, 'Webcam with built-in microphone and privacy cover.', 49.9, 34, 10],
  ['Laptop Stand', 'LS-110', 0, 'Foldable aluminium stand, fits laptops up to 17 inches.', 29.95, 9, 10],
  ['A4 Copy Paper (500 sheets)', 'PP-A4-500', 1, '80 gsm white paper, one ream.', 6.75, 320, 100],
  ['Ballpoint Pens (Box of 50)', 'PN-050', 1, 'Blue ink, medium point.', 9.8, 140, 40],
  ['Sticky Notes 12-Pack', 'SN-012', 1, 'Assorted colours, 76 x 76 mm.', 7.25, 0, 25],
  ['Heavy Duty Stapler', 'ST-300', 1, 'Staples up to 60 sheets.', 14.5, 26, 8],
  ['Whiteboard Markers (Set of 8)', 'WB-008', 1, 'Dry-erase markers in assorted colours.', 11.2, 7, 15],
  ['Ergonomic Office Chair', 'CH-ERG1', 2, 'Mesh back chair with lumbar support and adjustable arms.', 189, 14, 5],
  ['Standing Desk 140 cm', 'DK-140', 2, 'Electric height-adjustable desk with memory presets.', 429, 4, 5],
  ['3-Drawer Filing Cabinet', 'FC-003', 2, 'Lockable steel cabinet for A4 files.', 119, 11, 4],
  ['5-Tier Bookshelf', 'BS-005', 2, 'Wooden bookshelf, 180 cm tall.', 84, 0, 3],
  ['Cardboard Box Medium (Pack of 25)', 'BX-M25', 3, 'Double-wall boxes, 40 x 30 x 25 cm.', 18.4, 210, 60],
  ['Bubble Wrap Roll 50 m', 'BW-050', 3, 'Protective wrap, 50 m by 50 cm.', 22, 38, 12],
  ['Packing Tape (6 Rolls)', 'PT-006', 3, 'Clear tape, 48 mm by 66 m.', 12.6, 15, 20],
  ['Shipping Labels 4x6 (500)', 'SL-4X6', 3, 'Self-adhesive thermal labels.', 16.9, 64, 15],
  ['Hand Sanitiser 500 ml', 'HS-500', 4, 'Alcohol-based gel with pump.', 5.4, 180, 50],
  ['Disinfectant Wipes (Tub of 80)', 'DW-080', 4, 'Surface wipes for desks and equipment.', 6.9, 95, 30],
  ['Floor Cleaner 5 L', 'FL-005', 4, 'Concentrated multi-surface cleaner.', 13.75, 22, 8],
  ['Microfibre Cloths (10 Pack)', 'MC-010', 4, 'Reusable lint-free cloths.', 8.3, 6, 12],
  ['Cordless Drill 18 V', 'DR-180', 5, 'Includes two batteries and charger.', 96, 17, 5],
  ['Screwdriver Set 32-Piece', 'SD-032', 5, 'Precision and standard bits with case.', 27.5, 29, 8],
  ['Tape Measure 5 m', 'TM-005', 5, 'Locking steel tape with belt clip.', 8.95, 52, 15],
  ['Safety Gloves (Pair)', 'SG-001', 5, 'Cut-resistant work gloves, size L.', 4.2, 0, 40],
]

const REASONS: Record<MovementType, string[]> = {
  in: ['Supplier delivery', 'Purchase order restock', 'Customer return'],
  out: ['Sales order', 'Internal use', 'Damaged goods write-off'],
}

export function buildSeed(now: Date = new Date()): SeedData {
  const random = createRandom(20261120)
  const nowMs = now.getTime()

  const categories: Category[] = CATEGORY_DATA.map(([name, description], index) => ({
    id: `cat_seed_${index + 1}`,
    name,
    description,
    createdAt: new Date(nowMs - 60 * DAY).toISOString(),
  }))

  const products: Product[] = []
  const movements: StockMovement[] = []

  PRODUCT_DATA.forEach(([name, sku, categoryIndex, description, unitPrice, quantity, minStock], index) => {
    const product: Product = {
      id: `prd_seed_${index + 1}`,
      name,
      sku,
      categoryId: categories[categoryIndex].id,
      description,
      unitPrice,
      quantity,
      minStock,
      createdAt: new Date(nowMs - (20 + (index % 20)) * DAY).toISOString(),
    }
    products.push(product)

    // Build this product's history backwards from its current quantity,
    // so previous/new quantities always add up and never go negative.
    const steps = 4 + (index % 3)
    const base = Math.max(3, Math.round(quantity * 0.3))
    let current = quantity
    let hoursAgo = 2 + Math.floor(random() * 20)

    for (let step = 0; step < steps; step += 1) {
      let type: MovementType = random() < 0.45 ? 'in' : 'out'
      const amount = 1 + Math.floor(random() * base)
      if (type === 'in' && current < amount) type = 'out'
      const previous = type === 'in' ? current - amount : current + amount
      const reasons = REASONS[type]

      movements.push({
        id: `mov_seed_${index + 1}_${step + 1}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type,
        quantity: amount,
        previousQuantity: previous,
        newQuantity: current,
        reason: reasons[Math.floor(random() * reasons.length)],
        createdAt: new Date(nowMs - hoursAgo * HOUR).toISOString(),
      })

      current = previous
      hoursAgo += 6 + Math.floor(random() * 40)
    }

    if (current > 0) {
      movements.push({
        id: `mov_seed_${index + 1}_open`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: 'in',
        quantity: current,
        previousQuantity: 0,
        newQuantity: current,
        reason: 'Opening stock',
        createdAt: product.createdAt,
      })
    }
  })

  movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const activities: Activity[] = movements.slice(0, 12).map((movement) => ({
    id: `act_${movement.id}`,
    type: movement.type === 'in' ? 'stock-in' : 'stock-out',
    message: describeMovement(movement),
    createdAt: movement.createdAt,
  }))

  return { categories, products, movements, activities }
}
