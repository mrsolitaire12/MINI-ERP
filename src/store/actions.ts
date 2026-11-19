import { createAction } from '@reduxjs/toolkit'
import type { StockMovement } from '@/types'
import type { SeedData } from '@/data/seed'

/**
 * Shared actions that more than one slice listens to.
 * They live here so slices do not need to import each other.
 */

/** A stock movement happened: the product quantity changes and the movement is stored. */
export const stockMoved = createAction<StockMovement>('inventory/stockMoved')

/** Replace all data (used by "Reset demo data"). */
export const dataReset = createAction<SeedData>('inventory/dataReset')
