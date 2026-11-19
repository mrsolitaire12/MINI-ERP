import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from './index'
import {
  computeSummary,
  getStockStatus,
  movementsByDay,
  statusDistribution,
  stockTrend,
  stockByCategory,
} from '@/lib/inventory'

export const selectProducts = (state: RootState) => state.products.items
export const selectCategories = (state: RootState) => state.categories.items
export const selectMovements = (state: RootState) => state.stock.movements
export const selectActivities = (state: RootState) => state.activity.items

// Everything on the dashboard is calculated from these selectors, so it
// updates by itself whenever products or movements change.
export const selectSummary = createSelector([selectProducts], computeSummary)

export const selectLowStockProducts = createSelector([selectProducts], (products) =>
  products
    .filter((product) => getStockStatus(product) === 'low-stock')
    .sort((a, b) => a.quantity - b.quantity),
)

export const selectOutOfStockProducts = createSelector([selectProducts], (products) =>
  products.filter((product) => getStockStatus(product) === 'out-of-stock'),
)

export const selectStockByCategory = createSelector(
  [selectProducts, selectCategories],
  stockByCategory,
)

export const selectStatusDistribution = createSelector([selectProducts], statusDistribution)

export const selectMovementsByDay = createSelector([selectMovements], (movements) =>
  movementsByDay(movements, 7),
)

export const selectStockTrend = createSelector([selectProducts, selectMovements], (products, movements) =>
  stockTrend(products, movements, 7),
)

export const selectProductCountByCategory = createSelector([selectProducts], (products) => {
  const counts: Record<string, number> = {}
  for (const product of products) counts[product.categoryId] = (counts[product.categoryId] ?? 0) + 1
  return counts
})
