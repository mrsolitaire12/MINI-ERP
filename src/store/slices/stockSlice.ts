import { createSlice } from '@reduxjs/toolkit'
import type { StockMovement } from '@/types'
import { dataReset, stockMoved } from '../actions'

export interface StockState {
  /** Newest first. */
  movements: StockMovement[]
}

const stockSlice = createSlice({
  name: 'stock',
  initialState: { movements: [] } as StockState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(stockMoved, (state, action) => {
        state.movements.unshift(action.payload)
      })
      .addCase(dataReset, (state, action) => {
        state.movements = action.payload.movements
      })
  },
})

export default stockSlice.reducer
