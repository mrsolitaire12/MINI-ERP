import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Activity, ActivityType } from '@/types'
import { createId } from '@/lib/id'
import { dataReset } from '../actions'

export interface ActivityState {
  /** Newest first. */
  items: Activity[]
}

const MAX_ACTIVITIES = 200

const activitySlice = createSlice({
  name: 'activity',
  initialState: { items: [] } as ActivityState,
  reducers: {
    activityLogged: {
      reducer(state, action: PayloadAction<Activity>) {
        state.items.unshift(action.payload)
        if (state.items.length > MAX_ACTIVITIES) state.items.length = MAX_ACTIVITIES
      },
      prepare(type: ActivityType, message: string) {
        return {
          payload: { id: createId('act'), type, message, createdAt: new Date().toISOString() },
        }
      },
    },
  },
  extraReducers: (builder) => {
    builder.addCase(dataReset, (state, action) => {
      state.items = action.payload.activities
    })
  },
})

export const { activityLogged } = activitySlice.actions
export default activitySlice.reducer
