/**
 * Tracking pixels.
 *
 * The important decision here is that nothing is mapped by default.
 *
 * A platform event and an ad-network event are not the same thing. `Purchase`
 * on Meta means money changed hands; in a COD business, an order that was just
 * placed has not been paid for and many will be cancelled at the door. Mapping
 * `order_created` — or even `order_confirmed` — onto `Purchase` automatically
 * would inflate every merchant's reported conversions and quietly poison the
 * optimisation signal their ad spend depends on.
 *
 * So the merchant chooses. We list our events, list the provider's standard
 * events, and leave the mapping empty until someone decides what their business
 * actually means by a conversion.
 */

export interface PixelProvider {
  key: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  /** Shape of the id, shown as a placeholder and checked before saving. */
  idPattern: RegExp;
  idPlaceholder: string;
  /** Provider-side event names the merchant can map our events onto. */
  standardEvents: readonly string[];
  /** Whether a server-side conversions API token is supported. */
  supportsServerToken: boolean;
  scriptDomain: string;
}

/** Events this platform emits, and which a merchant can forward. */
export const TRACKABLE_EVENTS = [
  'page_view',
  'product_view',
  'add_to_cart',
  'checkout_started',
  'order_created',
  'order_confirmed',
  'order_delivered',
] as const;

export type TrackableEvent = (typeof TRACKABLE_EVENTS)[number];

export const PIXEL_PROVIDERS: readonly PixelProvider[] = [
  {
    key: 'facebook',
    nameAr: 'Meta (فيسبوك وإنستغرام)',
    nameEn: 'Meta (Facebook & Instagram)',
    icon: 'facebook',
    idPattern: /^\d{10,20}$/,
    idPlaceholder: '1234567890123456',
    standardEvents: [
      'PageView',
      'ViewContent',
      'AddToCart',
      'InitiateCheckout',
      'Lead',
      'Purchase',
      'CompleteRegistration',
    ],
    supportsServerToken: true,
    scriptDomain: 'connect.facebook.net',
  },
  {
    key: 'tiktok',
    nameAr: 'تيك توك',
    nameEn: 'TikTok',
    icon: 'music',
    idPattern: /^[A-Z0-9]{15,30}$/i,
    idPlaceholder: 'C4XXXXXXXXXXXXXXXXXX',
    standardEvents: [
      'Pageview',
      'ViewContent',
      'AddToCart',
      'InitiateCheckout',
      'SubmitForm',
      'PlaceAnOrder',
      'CompletePayment',
    ],
    supportsServerToken: true,
    scriptDomain: 'analytics.tiktok.com',
  },
  {
    key: 'snapchat',
    nameAr: 'سناب شات',
    nameEn: 'Snapchat',
    icon: 'ghost',
    idPattern: /^[0-9a-f-]{20,60}$/i,
    idPlaceholder: '00000000-0000-0000-0000-000000000000',
    standardEvents: [
      'PAGE_VIEW',
      'VIEW_CONTENT',
      'ADD_CART',
      'START_CHECKOUT',
      'SIGN_UP',
      'PURCHASE',
    ],
    supportsServerToken: true,
    scriptDomain: 'sc-static.net',
  },
  {
    key: 'google_analytics',
    nameAr: 'Google Analytics 4',
    nameEn: 'Google Analytics 4',
    icon: 'bar-chart-3',
    idPattern: /^G-[A-Z0-9]{6,15}$/i,
    idPlaceholder: 'G-XXXXXXXXXX',
    standardEvents: [
      'page_view',
      'view_item',
      'add_to_cart',
      'begin_checkout',
      'generate_lead',
      'purchase',
    ],
    supportsServerToken: false,
    scriptDomain: 'www.googletagmanager.com',
  },
  {
    key: 'google_tag_manager',
    nameAr: 'Google Tag Manager',
    nameEn: 'Google Tag Manager',
    icon: 'tags',
    idPattern: /^GTM-[A-Z0-9]{4,12}$/i,
    idPlaceholder: 'GTM-XXXXXX',
    // GTM has no event vocabulary of its own: it receives whatever is pushed
    // to the data layer, so our own names are what a container will see.
    standardEvents: TRACKABLE_EVENTS,
    supportsServerToken: false,
    scriptDomain: 'www.googletagmanager.com',
  },
];

export function getPixelProvider(key: string): PixelProvider | null {
  return PIXEL_PROVIDERS.find((provider) => provider.key === key) ?? null;
}

export type EventMapping = Partial<Record<TrackableEvent, string>>;

/**
 * A suggestion, never a default.
 *
 * Offered behind an explicit "suggest" button so a merchant can start from
 * something sane, with the money-related events left blank on purpose.
 */
export function suggestedMapping(provider: PixelProvider): EventMapping {
  const has = (name: string) => provider.standardEvents.includes(name);
  const pick = (...names: string[]) => names.find(has);

  return {
    page_view: pick('PageView', 'Pageview', 'PAGE_VIEW', 'page_view'),
    product_view: pick('ViewContent', 'VIEW_CONTENT', 'view_item', 'product_view'),
    add_to_cart: pick('AddToCart', 'ADD_CART', 'add_to_cart'),
    checkout_started: pick('InitiateCheckout', 'START_CHECKOUT', 'begin_checkout', 'checkout_started'),
    // order_created / order_confirmed / order_delivered are intentionally
    // absent. Which of them counts as a purchase is a business decision about
    // COD, not something this catalogue is entitled to make.
  };
}
