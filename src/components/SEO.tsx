import { useEffect } from 'react'

export interface SEOProps {
  title?: string
  description?: string
  keywords?: string
  author?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogType?: string
  ogUrl?: string
  twitterCard?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
  canonicalUrl?: string
  structuredData?: object | object[]
  noindex?: boolean
  nofollow?: boolean
  themeColor?: string
  viewport?: string
}

const defaultSEO: SEOProps = {
  title: 'GritSync - NCLEX Processing Agency | Your Trusted Partner for US Nursing Licensure',
  description: 'Professional NCLEX application processing service. Get expert assistance with NCLEX applications, document management, and payment processing. Trusted by nurses worldwide.',
  keywords: 'NCLEX, NCLEX application, nursing license, US nursing, NCLEX processing, nursing exam, registered nurse, NCLEX assistance',
  author: 'GritSync',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  themeColor: '#2563eb',
  viewport: 'width=device-width, initial-scale=1.0',
}

export function SEO({
  title,
  description,
  keywords,
  author,
  ogTitle,
  ogDescription,
  ogImage,
  ogType,
  ogUrl,
  twitterCard,
  twitterTitle,
  twitterDescription,
  twitterImage,
  canonicalUrl,
  structuredData,
  noindex = false,
  nofollow = false,
  themeColor,
  viewport,
}: SEOProps) {
  useEffect(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    
    // Set document title
    if (title) {
      document.title = title
    }

    // Helper function to set or update meta tag
    const setMetaTag = (name: string, content: string, attribute: 'name' | 'property' = 'name') => {
      if (!content) return
      
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement
      if (!element) {
        element = document.createElement('meta')
        element.setAttribute(attribute, name)
        document.head.appendChild(element)
      }
      element.setAttribute('content', content)
    }

    // Helper function to set or update link tag
    const setLinkTag = (rel: string, href: string, attributes?: Record<string, string>) => {
      if (!href) return
      
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement
      if (!element) {
        element = document.createElement('link')
        element.setAttribute('rel', rel)
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value)
          })
        }
        document.head.appendChild(element)
      }
      element.setAttribute('href', href)
    }

    // Basic meta tags
    setMetaTag('description', description || defaultSEO.description!)
    setMetaTag('keywords', keywords || defaultSEO.keywords!)
    setMetaTag('author', author || defaultSEO.author!)
    
    // Robots meta
    const robotsContent = [
      noindex ? 'noindex' : 'index',
      nofollow ? 'nofollow' : 'follow'
    ].join(', ')
    setMetaTag('robots', robotsContent)

    // Open Graph tags
    setMetaTag('og:title', ogTitle || title || defaultSEO.title!, 'property')
    setMetaTag('og:description', ogDescription || description || defaultSEO.description!, 'property')
    setMetaTag('og:image', ogImage || `${baseUrl}/gritsync_logo.png`, 'property')
    setMetaTag('og:type', ogType || defaultSEO.ogType!, 'property')
    setMetaTag('og:url', ogUrl || canonicalUrl || currentUrl, 'property')
    setMetaTag('og:site_name', 'GritSync', 'property')
    setMetaTag('og:locale', 'en_US', 'property')

    // Twitter Card tags
    setMetaTag('twitter:card', twitterCard || defaultSEO.twitterCard!, 'name')
    setMetaTag('twitter:title', twitterTitle || ogTitle || title || defaultSEO.title!, 'name')
    setMetaTag('twitter:description', twitterDescription || ogDescription || description || defaultSEO.description!, 'name')
    setMetaTag('twitter:image', twitterImage || ogImage || `${baseUrl}/gritsync_logo.png`, 'name')

    // Canonical URL
    if (canonicalUrl || currentUrl) {
      setLinkTag('canonical', canonicalUrl || currentUrl)
    }

    // Theme color
    if (themeColor || defaultSEO.themeColor) {
      setMetaTag('theme-color', themeColor || defaultSEO.themeColor!, 'name')
    }

    // Viewport
    if (viewport || defaultSEO.viewport) {
      setMetaTag('viewport', viewport || defaultSEO.viewport!, 'name')
    }

    // Structured Data (JSON-LD)
    if (structuredData) {
      // Remove existing structured data scripts
      const existingScripts = document.querySelectorAll('script[type="application/ld+json"]')
      existingScripts.forEach(script => script.remove())

      // Add new structured data
      const dataArray = Array.isArray(structuredData) ? structuredData : [structuredData]
      dataArray.forEach((data) => {
        const script = document.createElement('script')
        script.type = 'application/ld+json'
        script.text = JSON.stringify(data)
        document.head.appendChild(script)
      })
    }

    // Cleanup function
    return () => {
      // Optionally clean up on unmount, but usually we want to keep meta tags
    }
  }, [
    title,
    description,
    keywords,
    author,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    ogUrl,
    twitterCard,
    twitterTitle,
    twitterDescription,
    twitterImage,
    canonicalUrl,
    structuredData,
    noindex,
    nofollow,
    themeColor,
    viewport,
  ])

  return null // This component doesn't render anything
}

// Helper function to generate Organization structured data
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GritSync',
    description: 'Professional NCLEX application processing service helping nurses navigate the NCLEX process to become registered nurses in the United States.',
    url: typeof window !== 'undefined' ? window.location.origin : '',
    logo: typeof window !== 'undefined' ? `${window.location.origin}/gritsync_logo.png` : '',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['English'],
    },
    sameAs: [
      // Add social media links if available
    ],
  }
}

// Helper function to generate WebSite structured data
export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GritSync',
    description: 'NCLEX Processing Agency - Your Trusted Partner for US Nursing Licensure',
    url: typeof window !== 'undefined' ? window.location.origin : '',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: typeof window !== 'undefined' ? `${window.location.origin}/tracking?q={search_term_string}` : '',
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

// Helper function to generate Service structured data
export function generateServiceSchema(serviceName: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: serviceName,
    description: description,
    provider: {
      '@type': 'Organization',
      name: 'GritSync',
    },
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
  }
}

// Helper function to generate BreadcrumbList structured data
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

// Helper function to generate FAQPage structured data
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

