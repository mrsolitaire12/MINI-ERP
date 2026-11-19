import { combineReducers, configureStore } from '@reduxjs/toolkit'
import productsReducer from './slices/productsSlice'
import categoriesReducer from './slices/categoriesSlice'
import stockReducer from './slices/stockSlice'
import activityReducer from './slices/activitySlice'
import toastsReducer from './slices/toastsSlice'

const rootReducer = combineReducers({
  products: productsReducer,
  categories: categoriesReducer,
  stock: stockReducer,
  activity: activityReducer,
  toasts: toastsReducer,
})

export type RootState = ReturnType<typeof rootReducer>

/** Creates a fresh store. Tests use this too, so they never touch the real one. */
export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({ reducer: rootReducer, preloadedState })
}

export type AppStore = ReturnType<typeof createAppStore>
export type AppDispatch = AppStore['dispatch']
