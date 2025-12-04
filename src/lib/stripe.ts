import { loadStripe } from '@stripe/stripe-js'

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

// Only initialize Stripe if key is provided
export const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

// Helper function to check if Stripe is configured
export const isStripeConfigured = (): boolean => {
  return !!stripePublishableKey && !!stripePromise
}

// Stripe configuration is checked at runtime via isStripeConfigured()

