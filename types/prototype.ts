export type PrototypeNiche =
  | 'klinik'
  | 'villa'
  | 'kontraktor'
  | 'florist'
  | 'bengkel'
  | 'resto'
  | 'corporate'
  | 'general';

export interface PrototypeService {
  title: string;
  description: string;
  price?: string;
  badge?: string;
  iconName?: string;
  image?: string;
}

export interface PrototypeGalleryItem {
  url: string;
  title: string;
  caption?: string;
}

export interface PrototypeTestimonial {
  name: string;
  comment: string;
  rating: number;
  role?: string;
}

export interface PrototypeFaqItem {
  question: string;
  answer: string;
}

export interface PrototypeData {
  id: string;
  slug: string;
  businessName: string;
  category: string;
  niche: PrototypeNiche;
  city: string;
  phone: string;
  address: string;
  mapsUrl?: string;
  rating: number;
  reviewsCount: number;
  badgeText: string;
  headline: string;
  subheadline: string;
  heroImage: string;
  primaryColor: string;
  themeStyle: 'modern' | 'luxury' | 'clean' | 'warm';
  promoBanner?: string;
  services: PrototypeService[];
  features: string[];
  gallery: PrototypeGalleryItem[];
  testimonials: PrototypeTestimonial[];
  faqs?: PrototypeFaqItem[];
  businessHours: string;
  customDomain: string; // default: 'corecraft.my.id'
  subdomainEnabled?: boolean;
  status: 'draft' | 'published';
  publishedAt?: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}
