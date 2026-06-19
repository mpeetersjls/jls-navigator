import { createFileRoute } from '@tanstack/react-router'
import { PassportDetailsPage } from '@/components/visa/PassportDetailsPage'

export const Route = createFileRoute('/_app/crew-immigration/visas/passport-details')({
  validateSearch: (search: Record<string, unknown>) => ({
    crewId:        (search.crewId        as string | undefined) ?? '',
    applicationId: (search.applicationId as string | undefined) ?? '',
    country:       (search.country       as string | undefined) ?? 'UAE',
  }),
  component:  PassportDetailsPage,
  head: () => ({ meta: [{ title: 'Passport Details — Crew Visa Application — Polaris' }] }),
})
