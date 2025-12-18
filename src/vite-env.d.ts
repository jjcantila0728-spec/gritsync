/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_GOOGLE_PLACES_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Declare module for HTML raw imports
declare module '*.html?raw' {
  const content: string
  export default content
}

// Google Maps API types
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (input: HTMLInputElement, options?: {
            componentRestrictions?: { country: string }
            fields?: string[]
          }) => {
            addListener: (event: string, callback: () => void) => void
            getPlace: () => {
              address_components?: Array<{
                long_name: string
                short_name: string
                types: string[]
              }>
              formatted_address?: string
            }
          }
        }
      }
    }
  }
}


