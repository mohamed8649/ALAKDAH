import {
  Activity,
  Award,
  Ban,
  BarChart3,
  Check,
  Clock,
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  ListPlus,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  Palette,
  PartyPopper,
  Percent,
  Plug,
  Puzzle,
  QrCode,
  RefreshCw,
  Route,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Table,
  Truck,
  Upload,
  UserCheck,
  UserCog,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon registry.
 *
 * Icons are referenced by string from data (navigation, app catalogue, trust
 * badges) so those definitions stay serialisable and free of React imports.
 */
const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  award: Award,
  ban: Ban,
  'bar-chart-3': BarChart3,
  check: Check,
  clock: Clock,
  'credit-card': CreditCard,
  'file-text': FileText,
  headphones: Headphones,
  'layout-dashboard': LayoutDashboard,
  'layout-template': LayoutTemplate,
  layers: Layers,
  'list-plus': ListPlus,
  lock: Lock,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  package: Package,
  palette: Palette,
  'party-popper': PartyPopper,
  percent: Percent,
  plug: Plug,
  puzzle: Puzzle,
  'qr-code': QrCode,
  refresh: RefreshCw,
  route: Route,
  'scroll-text': ScrollText,
  search: Search,
  settings: Settings,
  shield: Shield,
  'shield-alert': ShieldAlert,
  'shield-check': ShieldCheck,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  table: Table,
  truck: Truck,
  upload: Upload,
  'user-check': UserCheck,
  'user-cog': UserCog,
  users: Users,
  zap: Zap,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Component = ICONS[name] ?? Package;
  return <Component className={className} aria-hidden />;
}

export function hasIcon(name: string): boolean {
  return name in ICONS;
}
