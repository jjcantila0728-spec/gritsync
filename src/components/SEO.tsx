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
  title: 'GritSync | NCLEX Processing for Filipino Nurses — US Nursing Licensure Made Simple',
  description: 'GritSync is the trusted NCLEX application processing agency for Filipino nurses. We handle NYSED submissions, BON applications, Pearson VUE registration, and ATT acquisition — so you can focus on passing the exam.',
  keywords: 'NCLEX processing Philippines, Filipino nurse USA, NCLEX application Philippines, NCLEX processing agency, Filipino nurses US nursing license, NCLEX Philippines to USA, nursing licensure USA, PRC to US nursing license, NCLEX ATT Philippines, NYSED nursing application, BON application nurses, Pearson VUE registration nurses, USRN processing, Philippine nurses NCLEX, NCLEX sponsorship Philippines',
  author: 'GritSync',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  themeColor: '#DC2626',
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover',
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
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://gritsync.com'

    if (title) document.title = title

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

    const setLinkTag = (rel: string, href: string, attributes?: Record<string, string>) => {
      if (!href) return
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement
      if (!element) {
        element = document.createElement('link')
        element.setAttribute('rel', rel)
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value))
        }
        document.head.appendChild(element)
      }
      element.setAttribute('href', href)
    }

    setMetaTag('description', description || defaultSEO.description!)
    setMetaTag('keywords', keywords || defaultSEO.keywords!)
    setMetaTag('author', author || defaultSEO.author!)

    const robotsContent = [
      noindex ? 'noindex' : 'index',
      nofollow ? 'nofollow' : 'follow',
      'max-image-preview:large',
      'max-snippet:-1',
      'max-video-preview:-1',
    ].join(', ')
    setMetaTag('robots', robotsContent)

    const resolvedOgImage = ogImage || `${baseUrl}/gritsync_logo.png`

    setMetaTag('og:title', ogTitle || title || defaultSEO.title!, 'property')
    setMetaTag('og:description', ogDescription || description || defaultSEO.description!, 'property')
    setMetaTag('og:image', resolvedOgImage, 'property')
    setMetaTag('og:image:alt', ogTitle || title || 'GritSync — NCLEX Processing Agency', 'property')
    setMetaTag('og:type', ogType || defaultSEO.ogType!, 'property')
    setMetaTag('og:url', ogUrl || canonicalUrl || currentUrl, 'property')
    setMetaTag('og:site_name', 'GritSync', 'property')
    setMetaTag('og:locale', 'en_US', 'property')

    setMetaTag('twitter:card', twitterCard || defaultSEO.twitterCard!)
    setMetaTag('twitter:site', '@gritsync')
    setMetaTag('twitter:creator', '@gritsync')
    setMetaTag('twitter:title', twitterTitle || ogTitle || title || defaultSEO.title!)
    setMetaTag('twitter:description', twitterDescription || ogDescription || description || defaultSEO.description!)
    setMetaTag('twitter:image', twitterImage || resolvedOgImage)
    setMetaTag('twitter:image:alt', twitterTitle || title || 'GritSync — NCLEX Processing Agency')

    if (canonicalUrl || currentUrl) setLinkTag('canonical', canonicalUrl || currentUrl)
    if (themeColor || defaultSEO.themeColor) setMetaTag('theme-color', themeColor || defaultSEO.themeColor!)
    if (viewport || defaultSEO.viewport) setMetaTag('viewport', viewport || defaultSEO.viewport!)

    if (structuredData) {
      document.querySelectorAll('script[type="application/ld+json"][data-react-seo]').forEach(s => s.remove())
      const dataArray = Array.isArray(structuredData) ? structuredData : [structuredData]
      dataArray.forEach((data) => {
        const script = document.createElement('script')
        script.type = 'application/ld+json'
        script.setAttribute('data-react-seo', 'true')
        script.text = JSON.stringify(data)
        document.head.appendChild(script)
      })
    }
  }, [title, description, keywords, author, ogTitle, ogDescription, ogImage, ogType, ogUrl,
      twitterCard, twitterTitle, twitterDescription, twitterImage, canonicalUrl,
      structuredData, noindex, nofollow, themeColor, viewport])

  return null
}

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'ProfessionalService'],
    '@id': 'https://gritsync.com/#organization',
    name: 'GritSync',
    alternateName: 'GritSync NCLEX Processing Agency',
    description: 'GritSync is a professional NCLEX application processing agency that helps Filipino nurses and internationally educated nurses obtain US nursing licensure. We manage end-to-end document processing, NYSED submissions, BON applications, and ATT acquisition.',
    url: 'https://gritsync.com',
    logo: {
      '@type': 'ImageObject',
      url: 'https://gritsync.com/gritsync_logo.png',
      width: 200,
      height: 200,
    },
    image: 'https://gritsync.com/gritsync_logo.png',
    telephone: '+15092703437',
    email: 'admin@gritsync.com',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+15092703437',
        contactType: 'customer service',
        email: 'admin@gritsync.com',
        availableLanguage: ['English', 'Filipino', 'Tagalog'],
        contactOption: 'TollFree',
        areaServed: ['US', 'PH'],
      },
    ],
    areaServed: [
      { '@type': 'Country', name: 'United States' },
      { '@type': 'Country', name: 'Philippines' },
    ],
    serviceArea: { '@type': 'Country', name: 'United States' },
    knowsAbout: [
      'NCLEX-RN Examination',
      'US Nursing Licensure',
      'NYSED Document Submission',
      'Board of Nursing Applications',
      'Pearson VUE Registration',
      'ATT Authorization to Test',
      'Filipino Nurse Immigration',
      'International Nursing Credential Evaluation',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'NCLEX Processing Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Full NCLEX Application Processing',
            description: 'End-to-end NCLEX application processing from document collection through ATT issuance.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'NCLEX Sponsorship Program',
            description: 'Financial sponsorship covering processing fees for qualified Filipino nurses in exchange for a service commitment.',
          },
        },
      ],
    },
    founder: {
      '@type': 'Person',
      name: 'JJ Cantila',
      jobTitle: 'RM, RN, SGRN, CADRN, USRN',
    },
    sameAs: [
      'https://www.facebook.com/gritsync',
      'https://www.instagram.com/gritsync',
      'https://twitter.com/gritsync',
    ],
  }
}

export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://gritsync.com/#website',
    name: 'GritSync',
    alternateName: 'GritSync NCLEX Processing',
    description: 'NCLEX Processing Agency — Your Trusted Partner for US Nursing Licensure for Filipino Nurses',
    url: 'https://gritsync.com',
    publisher: { '@id': 'https://gritsync.com/#organization' },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://gritsync.com/tracking?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: 'en-US',
  }
}

export function generateServiceSchema(serviceName: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: serviceName,
    name: serviceName,
    description: description,
    provider: { '@id': 'https://gritsync.com/#organization' },
    areaServed: [
      { '@type': 'Country', name: 'United States' },
      { '@type': 'Country', name: 'Philippines' },
    ],
    audience: {
      '@type': 'Audience',
      audienceType: 'Filipino nurses and internationally educated nurses seeking US nursing licensure',
    },
  }
}

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

export function generateHowToSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Get Your US Nursing License (NCLEX) as a Filipino Nurse',
    description: 'A step-by-step guide to processing your NCLEX application through GritSync — from document collection to license issuance for Filipino nurses.',
    image: 'https://gritsync.com/gritsync_logo.png',
    totalTime: 'P6M',
    supply: [
      { '@type': 'HowToSupply', name: 'PRC Nursing Board Certificate' },
      { '@type': 'HowToSupply', name: 'Nursing School Transcript of Records' },
      { '@type': 'HowToSupply', name: 'Nursing School Diploma' },
      { '@type': 'HowToSupply', name: 'Certificate of Good Standing' },
      { '@type': 'HowToSupply', name: 'Valid Philippine Passport' },
      { '@type': 'HowToSupply', name: 'NSO/PSA Birth Certificate' },
    ],
    tool: [
      { '@type': 'HowToTool', name: 'GritSync Application Portal' },
      { '@type': 'HowToTool', name: 'Pearson VUE Account' },
    ],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Documents Collection',
        text: 'Gather all required documents: PRC certificate, nursing school transcript, diploma, Certificate of Good Standing, passport, and birth certificate. Upload them securely to GritSync.',
        url: 'https://gritsync.com/#step-1',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Documents Review',
        text: 'GritSync verifies your documents for completeness, accuracy, and authenticity before submission to any state board.',
        url: 'https://gritsync.com/#step-2',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'NYSED Document Review',
        text: 'GritSync submits your credentials to the New York State Education Department (NYSED) for official credential evaluation. This typically takes 8–16 weeks.',
        url: 'https://gritsync.com/#step-3',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'BON Application',
        text: 'GritSync files your application with the appropriate state Board of Nursing (BON) on your behalf.',
        url: 'https://gritsync.com/#step-4',
      },
      {
        '@type': 'HowToStep',
        position: 5,
        name: 'BON Processing',
        text: 'The state Board of Nursing processes your application and verifies eligibility for the NCLEX examination.',
        url: 'https://gritsync.com/#step-5',
      },
      {
        '@type': 'HowToStep',
        position: 6,
        name: 'Pearson VUE Registration',
        text: 'Once BON approves, GritSync registers you with Pearson VUE — the official NCLEX testing provider.',
        url: 'https://gritsync.com/#step-6',
      },
      {
        '@type': 'HowToStep',
        position: 7,
        name: 'Mandatory Courses',
        text: 'Complete any state-required mandatory courses (e.g., infection control, child abuse identification) as part of licensing requirements.',
        url: 'https://gritsync.com/#step-7',
      },
      {
        '@type': 'HowToStep',
        position: 8,
        name: 'ATT Issued',
        text: 'Receive your Authorization to Test (ATT) from the National Board of Nursing. This document authorizes you to schedule your NCLEX exam.',
        url: 'https://gritsync.com/#step-8',
      },
      {
        '@type': 'HowToStep',
        position: 9,
        name: 'Exam Scheduled',
        text: 'Schedule your NCLEX exam at a Pearson VUE testing center using your ATT. Choose a date and location that works for you.',
        url: 'https://gritsync.com/#step-9',
      },
      {
        '@type': 'HowToStep',
        position: 10,
        name: 'Exam Taken',
        text: 'Take the NCLEX-RN examination at your scheduled Pearson VUE testing center. The computerized adaptive test (CAT) adjusts difficulty based on your answers.',
        url: 'https://gritsync.com/#step-10',
      },
      {
        '@type': 'HowToStep',
        position: 11,
        name: 'Results Pending',
        text: 'Quick Results are available through Pearson VUE within 48 hours for a small fee. Official results are delivered by the state BON within 6 weeks.',
        url: 'https://gritsync.com/#step-11',
      },
      {
        '@type': 'HowToStep',
        position: 12,
        name: 'Results Received',
        text: 'Receive your official Pass/Fail notification. GritSync notifies you immediately when results are posted.',
        url: 'https://gritsync.com/#step-12',
      },
      {
        '@type': 'HowToStep',
        position: 13,
        name: 'License Issued',
        text: 'Upon passing, your official Registered Nurse (RN) license is issued by the state Board of Nursing. Congratulations — you are now a licensed US nurse!',
        url: 'https://gritsync.com/#step-13',
      },
    ],
  }
}

export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': 'https://gritsync.com/#localbusiness',
    name: 'GritSync NCLEX Processing Agency',
    description: 'Professional NCLEX application processing service for Filipino nurses seeking US nursing licensure. We handle NYSED submissions, BON applications, Pearson VUE registration, and ATT acquisition.',
    url: 'https://gritsync.com',
    telephone: '+15092703437',
    email: 'admin@gritsync.com',
    priceRange: '$$',
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
    areaServed: [
      { '@type': 'Country', name: 'United States', sameAs: 'https://www.wikidata.org/wiki/Q30' },
      { '@type': 'Country', name: 'Philippines', sameAs: 'https://www.wikidata.org/wiki/Q928' },
    ],
    hasMap: 'https://gritsync.com/about-us',
    logo: 'https://gritsync.com/gritsync_logo.png',
    image: 'https://gritsync.com/gritsync_logo.png',
    sameAs: [
      'https://www.facebook.com/gritsync',
      'https://www.instagram.com/gritsync',
    ],
  }
}
