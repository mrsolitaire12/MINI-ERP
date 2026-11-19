import { buildSeed } from '@/data/seed'
import { createAppStore } from './index'
import { attachPersistence, loadPersisted } from './persistence'
import { addToast } from './slices/toastsSlice'

/** The one store the running app uses. It starts from saved data, or demo data on first visit. */
const { state: saved, recovered } = loadPersisted()
const seed = buildSeed()

export const store = createAppStore(
  saved ?? {
    products: { items: seed.products },
    categories: { items: seed.categories },
    stock: { movements: seed.movements },
    activity: { items: seed.activities },
  },
)

attachPersistence(store)

if (recovered) {
  store.dispatch(addToast('info', 'Saved data could not be read, so the demo data was restored.'))
}
