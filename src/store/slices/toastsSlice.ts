import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Toast, ToastType, UndoAction } from '@/types'
import { createId } from '@/lib/id'

export interface ToastsState {
  items: Toast[]
}

const MAX_VISIBLE = 4

const toastsSlice = createSlice({
  name: 'toasts',
  initialState: { items: [] } as ToastsState,
  reducers: {
    addToast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.items.push(action.payload)
        if (state.items.length > MAX_VISIBLE) state.items.shift()
      },
      prepare(type: ToastType, message: string, undo?: UndoAction) {
        return { payload: { id: createId('toast'), type, message, ...(undo ? { undo } : {}) } }
      },
    },
    removeToast(state, action: PayloadAction<string>) {
      state.items = state.items.filter((toast) => toast.id !== action.payload)
    },
  },
})

export const { addToast, removeToast } = toastsSlice.actions
export default toastsSlice.reducer
