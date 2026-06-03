import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession, type PlanKey } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { plan } = await req.json()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL!

    const url = await createCheckoutSession({
      userId: user.id,
      email: user.email!,
      plan: plan as PlanKey,
      successUrl: `${origin}/settings?checkout=success`,
      cancelUrl: `${origin}/pricing`,
    })

    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
