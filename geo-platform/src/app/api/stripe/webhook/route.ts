import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: any
  try {
    event = constructWebhookEvent(payload, sig)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const supabase = await createClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { userId, plan } = session.metadata || {}
    if (userId && plan) {
      await supabase.from('workspaces').update({
        plan,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        subscription_status: 'active',
      }).eq('owner_id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
    const sub = event.data.object
    await supabase.from('workspaces').update({ plan: 'free', subscription_status: 'inactive' }).eq('stripe_customer_id', sub.customer)
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    await supabase.from('workspaces').update({
      stripe_price_id: sub.items.data[0]?.price?.id,
      subscription_status: sub.status,
    }).eq('stripe_customer_id', sub.customer)
  }

  return NextResponse.json({ received: true })
}
