import { lazy, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { AppLayout } from '@/components/layout/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Each screen is loaded when first opened, which keeps the first download small.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const ProductsPage = lazy(() => import('@/features/products/ProductsPage'))
const ProductDetailPage = lazy(() => import('@/features/products/ProductDetailPage'))
const StockPage = lazy(() => import('@/features/stock/StockPage'))
const CategoriesPage = lazy(() => import('@/features/categories/CategoriesPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export default function App() {
  useEffect(() => {
    AOS.init({
      duration: 500,
      once: true,
      offset: 20,
      easing: 'ease-out',
      // People who ask their device for less motion are handled in index.css,
      // which shows everything straight away instead of fading it in.
    })
  }, [])

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/:productId" element={<ProductDetailPage />} />
              <Route path="stock" element={<StockPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  )
}
