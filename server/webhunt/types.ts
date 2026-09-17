/**
 * GACKS P.A × WebHunt Delta — Type Definitions
 * Matches WebHunt production schema and contracts.
 */

export type WebHuntPipelineStatus =
  | 'NEW'
  | 'QUALIFIED'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'NEGOTIATION'
  | 'CLOSED'
  | 'NOT_INTERESTED'
  | 'SAVED'
  | 'PREPARING'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'ARCHIVED'

export type WebHuntRemoteType = 'worldwide' | 'regional' | 'country_specific' | 'hybrid' | 'onsite'
export type WebHuntVerificationStatus = 'SOURCE_LISTED' | 'VERIFIED' | 'UNAVAILABLE'

export interface WebHuntSocialProfiles {
  facebook?: string | null
  instagram?: string | null
  linkedin?: string | null
  twitter?: string | null
}

export interface WebHuntDiscoveredContact {
  type: 'email' | 'phone' | 'whatsapp' | 'contact_form' | 'social_profile'
  value: string
  source: string
  confidence: number
}

export interface WebHuntEnrichedContacts {
  primaryEmail?: string
  allEmails?: string[]
  primaryPhone?: string
  whatsappNumber?: string
  contactPageUrl?: string
  bookingUrl?: string
  hasContactForm?: boolean
  socialProfiles?: WebHuntSocialProfiles
  discoveredItems?: WebHuntDiscoveredContact[]
  techStack?: string[]
  domainAgeYears?: number
  lastCrawledAt?: string
}

export interface WebHuntPhysicalLead {
  id: string
  type: 'physical'
  businessName: string
  phone: string
  phoneFormatted: string
  phoneStatus: 'verified' | 'unverified' | 'unavailable'
  address?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  category?: string | null
  rating?: number | null
  reviewCount?: number | null
  hasWebsite: boolean
  noWebsiteConfidence: 'High' | 'Medium' | 'Verified'
  sourceProvider: string
  providerPlaceId?: string | null
  sourceUrl?: string | null
  sourceType?: string | null
  verificationStatus: WebHuntVerificationStatus
  dataQualityScore?: number | null
  latitude?: number | null
  longitude?: number | null
  lastVerifiedAt?: string | null
  status: WebHuntPipelineStatus
  estimatedValue: number
  notes?: string | null
  tags?: string[]
  contactedAt?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
  email?: string | null
  whatsapp?: string | null
  contactPageUrl?: string | null
  bookingUrl?: string | null
  hasContactForm?: boolean
  socialProfiles?: WebHuntSocialProfiles
  enrichment?: WebHuntEnrichedContacts
}

export interface WebHuntRemoteJob {
  id: string
  type: 'online'
  title: string
  company: string
  location: string
  country: string
  isRemote: boolean
  remoteType: WebHuntRemoteType
  category?: string | null
  tags: string[]
  url: string
  postedDate: string
  salary: string
  source: string
  sourceId?: string | null
  sourceUrl?: string | null
  sourceType?: string | null
  status: WebHuntPipelineStatus
  estimatedValue: number
  notes?: string | null
  verificationStatus: WebHuntVerificationStatus
  email?: string | null
  whatsapp?: string | null
  contactPageUrl?: string | null
  bookingUrl?: string | null
  hasContactForm?: boolean
  socialProfiles?: WebHuntSocialProfiles
  enrichment?: WebHuntEnrichedContacts
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type WebHuntLeadItem = WebHuntPhysicalLead | WebHuntRemoteJob

export interface WebHuntSearchParams {
  mode?: 'physical' | 'online'
  niche?: string
  location?: string
  country?: string
  radius?: number
  query?: string
  category?: string
  tags?: string[]
  remoteOnly?: boolean
  page?: number
  limit?: number
}

export interface WebHuntSearchResult {
  leads: WebHuntLeadItem[]
  totalFetched: number
  qualifiedLeads: number
  searchId?: string
  cached?: boolean
}

export interface WebHuntProposalTemplate {
  type: 'technical_pitch' | 'comprehensive_cover' | 'local_website_pitch' | 'agency_modernization'
  name: string
  description: string
}

export interface WebHuntGeneratedProposal {
  templateType: string
  title: string
  subject: string
  greeting: string
  body: string
  callToAction: string
  fullText: string
  candidateName: string
  candidateTitle: string
  matchedSkills?: string[]
  unmatchedSkills?: string[]
  leadContext?: {
    businessName: string
    category?: string
    location?: string
    hasWebsite?: boolean
    phone?: string
    email?: string
  }
}

export interface WebHuntUser {
  id: string
  email: string
  name?: string | null
  role: string
  status?: string
  isVerified?: boolean
  profile?: any
}

export interface WebHuntAuthResponse {
  success: boolean
  authenticated?: boolean
  token?: string
  user?: WebHuntUser
  subscription?: {
    hasActiveSubscription: boolean
    plan?: string
    status?: string
  }
  error?: string
}

export interface WebHuntIntegrationStatus {
  connected: boolean
  baseUrl: string
  authenticated: boolean
  userEmail?: string
  userId?: string
  userName?: string
  plan?: string
  role?: string
  hasActiveSubscription?: boolean
  latencyMs: number
  sourceOfTruth: 'PRODUCTION_API' | 'LOCAL_FALLBACK'
}

