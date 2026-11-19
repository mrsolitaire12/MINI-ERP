import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Product } from '@/types'
import { dataReset, stockMoved } from '../actions'

export interface ProductsState {
  items: Product[]
}

const productsSlice = createSlice({
  name: 'products',
  initialState: { items: [] } as ProductsState,
  reducers: {
    productAdded(state, action: PayloadAction<Product>) {
      state.items.unshift(action.payload)
    },
    productUpdated(state, action: PayloadAction<Product>) {
      const index = state.items.findIndex((product) => product.id === action.payload.id)
      if (index >= 0) state.items[index] = action.payload
    },
    productDeleted(state, action: PayloadAction<string>) {
      state.items = state.items.filter((product) => product.id !== action.payload)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(stockMoved, (state, action) => {
        const product = state.items.find((item) => item.id === action.payload.productId)
        if (product) product.quantity = action.payload.newQuantity
      })
      .addCase(dataReset, (state, action) => {
        state.items = action.payload.products
      })
  },
})

export const { productAdded, productUpdated, productDeleted } = productsSlice.actions
export default productsSlice.reducer
