import { redirect } from 'next/navigation'
import { getHomePage } from '@/lib/actions'

export default async function RootPage() {
  const home = await getHomePage()
  if (home) redirect(`/page/${home.id}`)
  redirect('/setup')
}
