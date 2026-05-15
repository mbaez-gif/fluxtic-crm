'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function PagoPendingContent() {
  const searchParams = useSearchParams()
  const externalReference = searchParams.get('external_reference') || searchParams.get('ref')

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>⏳</div>
        <h1 style={styles.title}>Pago en proceso</h1>
        <p style={styles.subtitle}>
          Tu pago está siendo procesado. Una vez confirmado, recibirás un mensaje por WhatsApp.
        </p>
        {externalReference && (
          <p style={styles.ref}>Referencia: <code style={styles.code}>{externalReference}</code></p>
        )}
        <Link href="/reservar" style={styles.btn}>Volver al inicio</Link>
      </div>
    </main>
  )
}

export default function PagoPendingPage() {
  return (
    <Suspense fallback={<main style={styles.page}><div style={styles.card}><p>Cargando…</p></div></main>}>
      <PagoPendingContent />
    </Suspense>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: 'var(--font-b)',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--r-lg)',
    padding: '40px 32px',
    boxShadow: 'var(--shadow-md)',
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
  },
  icon: {
    fontSize: 48,
    margin: '0 auto 16px',
    display: 'block',
  },
  title: {
    fontFamily: 'var(--font-d)',
    fontWeight: 400,
    fontSize: 28,
    color: 'var(--noir)',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--muted)',
    lineHeight: 1.6,
    marginBottom: 20,
  },
  ref: {
    fontSize: 12,
    color: 'var(--muted)',
    marginBottom: 24,
  },
  code: {
    fontFamily: 'var(--font-m)',
    background: 'var(--bg-2)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  btn: {
    display: 'inline-block',
    background: 'var(--blush-d)',
    color: '#fff',
    padding: '10px 24px',
    borderRadius: 'var(--r-md)',
    fontSize: 14,
    fontWeight: 500,
    textDecoration: 'none',
    fontFamily: 'var(--font-b)',
  },
}
