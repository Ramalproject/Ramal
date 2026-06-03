import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' })
  }
  return _stripe
}

export const PLANS = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    price: 49,
    features: ['5 projects', '100 scans/mo', 'Basic GEO scoring', 'AI content generation (20 pieces)', 'Email support'],
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    price: 149,
    features: ['25 projects', '500 scans/mo', 'Advanced GEO scoring', 'AI content generation (100 pieces)', 'Competitor tracking (10)', 'Prompt monitoring (50 prompts)', 'Priority support'],
  },
  agency: {
    name: 'Agency',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID!,
    price: 399,
    features: ['Unlimited projects', 'Unlimited scans', 'Full GEO suite', 'Unlimited AI content', 'Unlimited competitors', 'Unlimited prompts', 'White-label reports', 'Dedicated support'],
  },
} as const

export type PlanKey = keyof typeof PLANS

export async function createCheckoutSession(params: {
  userId: string
  email: string
  plan: PlanKey
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const stripe = getStripe()
  const { userId, email, plan, successUrl, cancelUrl } = params

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
  })

  return session.url!
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
  return session.url
}

export async function getSubscription(subscriptionId: string) {
  const stripe = getStripe()
  return stripe.subscriptions.retrieve(subscriptionId)
}

export function constructWebhookEvent(payload: string | Buffer, sig: string) {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!)
}
