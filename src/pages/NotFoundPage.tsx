import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { PageTransition } from '@/components/ui/PageHeader'

export default function NotFoundPage() {
  return (
    <PageTransition>
      <Card>
        <EmptyState
          icon={Compass}
          title="Page not found"
          description="This page does not exist. Use the menu to find what you need."
          action={
            <Link
              to="/"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Go to dashboard
            </Link>
          }
        />
      </Card>
    </PageTransition>
  )
}
