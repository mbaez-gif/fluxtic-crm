import { redirect } from 'next/navigation'

export default function RootPage() {
  // Middleware handles the actual auth check.
  // This redirect is a fallback for direct / access.
  redirect('/dashboard')
}
