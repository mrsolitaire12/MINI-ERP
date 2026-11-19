import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Category } from '@/types'
import { dataReset } from '../actions'

export interface CategoriesState {
  items: Category[]
}

const categoriesSlice = createSlice({
  name: 'categories',
  initialState: { items: [] } as CategoriesState,
  reducers: {
    categoryAdded(state, action: PayloadAction<Category>) {
      state.items.push(action.payload)
    },
    categoryUpdated(state, action: PayloadAction<Category>) {
      const index = state.items.findIndex((category) => category.id === action.payload.id)
      if (index >= 0) state.items[index] = action.payload
    },
    categoryDeleted(state, action: PayloadAction<string>) {
      state.items = state.items.filter((category) => category.id !== action.payload)
    },
  },
  extraReducers: (builder) => {
    builder.addCase(dataReset, (state, action) => {
      state.items = action.payload.categories
    })
  },
})

export const { categoryAdded, categoryUpdated, categoryDeleted } = categoriesSlice.actions
export default categoriesSlice.reducer
