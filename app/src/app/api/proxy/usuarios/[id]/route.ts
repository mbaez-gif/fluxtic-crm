import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN

async function proxyRequest(req: NextRequest, path: string) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = `${API_BASE}${path}`
  const method = req.method

  let body: string | undefined
  if (method !== 'GET' && method !== 'DELETE') {
    body = await req.text()
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(INTERNAL_TOKEN ? { Authorization: `Bearer ${INTERNAL_TOKEN}` } : {}),
  }

  const res = await fetch(url, { method, headers, body })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return proxyRequest(req, `/usuarios/${params.id}`)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return proxyRequest(req, `/usuarios/${params.id}`)
}
