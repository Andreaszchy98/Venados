/**
 * VXP - Modelos y Tipos Centralizados
 * Plataforma Integral de Negocio, Afición y Operaciones del Club Venados de Mazatlán
 */

export type UserRole = 'aficionado' | 'admin' | 'taquilla' | 'concesionario' | 'runner' | 'superadmin';
export type Language = 'es' | 'en';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  language?: Language;
  photoURL?: string | null;
  phoneNumber?: string | null;
  // Sede de navegación elegida por el aficionado para visualizar tienda, eventos y menú
  browsingVenueId?: string;
  browsingVenueName?: string;
  // Ámbito de administración exclusivo para administradores de sede (scope operativo)
  venueId?: string; // Para administradores de sede: ID del recinto asignado (ej: 'venue-teodoro-mariscal')
  venueName?: string; // Nombre del recinto asignado
  standId?: string; // Si el usuario es operador de un puesto de comida/concesionario
  standName?: string; // Nombre del puesto asignado
  zoneId?: string; // ID de la zona del estadio asignada al runner (ej: 'zona-a')
  assignedZone?: string; // Para runner: ej: 'Zona A - Sombra Central', 'Palcos VIP', etc.
  runnerStatus?: 'disponible' | 'en_entrega' | 'inactivo';
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// 0. RECINTOS & EVENTOS (VENUES & EVENTS)
// ==========================================
export interface Venue {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  teamName?: string;
  storeName?: string;
  // Imagen y contenido promocional de la tienda oficial en el hero del login
  storePromoBannerUrl?: string;
  storePromoTitle?: string;
  storePromoSubtitle?: string;
  storePromoActive?: boolean;
  // Tipos de evento permitidos para este recinto (ej. Teodoro Mariscal: baseball y concert; El Encanto: football y concert)
  allowedEventTypes?: EventType[];
}

export type HeroSlideType = 'event' | 'store_promo';

export interface HeroSlide {
  id: string;
  slideType: HeroSlideType;
  title: string;
  subtitle?: string;
  venueId: string;
  venueName?: string;
  imageUrl: string;
  dateBadge?: string;
  badgeLabel?: string;
  targetAction: 'ticket' | 'store';
  eventId?: string;
}

export type EventType = 'baseball' | 'football' | 'soccer' | 'basketball' | 'concert' | 'other';

export interface EventPriceTier {
  section: string; // ej. "Platino", "Deluxe Supreme", "Oriente Central"
  price: number;
}

export interface VenueEvent {
  id: string;
  venueId: string;
  type: EventType;
  name: string; // ej. "Venados de Mazatlán vs Tomateros de Culiacán"
  opponent?: string;
  date: string;
  time: string;
  gate?: string;
  active: boolean;
  ticketsAvailable: boolean; // el admin abre/cierra la venta
  priceTiers: EventPriceTier[];
  createdAt: string;
  posterUrl?: string; // imagen promocional del evento
  venueName?: string; // Nombre del recinto/estadio
  orderingOpensAt?: string; // ISO datetime — desde cuándo los negocios de la sede aceptan pedidos para este evento
  orderingClosesAt?: string; // ISO datetime — hasta cuándo aceptan pedidos
  availableSeats?: number; // Asientos disponibles declarados por el admin de la sede
  totalCapacity?: number; // Capacidad / aforo total del recinto para el evento
  status?: 'programado' | 'en_vivo' | 'finalizado' | 'cancelado'; // Estado del juego/evento
}

// ==========================================
// 1. BOLETOS & TAQUILLA
// ==========================================
export type TicketStatus = 'activo' | 'usado' | 'cancelado';

export interface Ticket {
  id: string;
  userId: string;
  eventId: string;
  venueId?: string;
  purchaseId?: string;
  seatId?: string;
  matchTitle: string;
  opponent?: string;
  matchDate: string;
  matchTime?: string;
  stadium: string;
  section: string;
  row: string;
  seat: string;
  price: number;
  status: TicketStatus;
  qrId: string;
  gate?: string;
  specialType?: 'ninos' | 'insen' | 'prensa' | string;
  usedAt?: string;
  usedGate?: string;
  usedBy?: string;
  createdAt: string;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  paymentStatus?: 'paid' | 'pending' | 'failed' | string;
  paymentMethod?: string;
  customerEmail?: string;
  customerName?: string;
}

// Mapa físico — pertenece a la SEDE, no cambia entre eventos
export interface SeatSection {
  id: string;
  venueId: string;
  sectionNumber: string; // "101", "227", etc.
  zoneName: string; // "Diamante", "Platino", "Sky Plus", "Oro", "Plus", "Sky", "Fan", "Fan Plus", "Deluxe Supreme"
  totalSeats: number; // capacidad total de la sección (ej. 30)
  rows: number; // filas dentro de la sección, para poder generar la cuadrícula de asientos
  seatsPerRow: number;
}

// Disponibilidad — pertenece al EVENTO, se reinicia por cada partido/concierto
export type SeatStatus = 'disponible' | 'vendido' | 'reservado';

export interface EventSeat {
  id: string;
  eventId: string;
  sectionId: string;
  sectionNumber?: string;
  zoneName?: string;
  rowLabel: string; // "A", "B", "1", "2"...
  seatNumber: number;
  status: SeatStatus;
  ticketId?: string; // se llena cuando se vende
  purchaseId?: string;
  updatedAt?: string;
  lockedUntil?: number; // Timestamp en ms del bloqueo temporal (8 min) para compras simultáneas
  lockedBy?: string; // UID del usuario que retiene la butaca
  clientLockToken?: string; // Token único del dispositivo/sesión para evitar desalineación entre guest y login
  lockedAt?: string; // ISO string de cuándo se bloqueó
}

// ==========================================
// 2. SOCIOS & MEMBRESÍAS
// ==========================================
export type MembershipTier = 'General' | 'Oro' | 'Platino' | 'Diamante';
export type MembershipStatus = 'activa' | 'vencida' | 'suspendida';

export interface Membership {
  id: string;
  userId: string;
  venueId?: string;
  venueName?: string;
  clubName?: string;
  memberNumber: string;
  tier: MembershipTier;
  status: MembershipStatus;
  renewalDate: string;
  startDate: string;
  seatAssigned?: string;
  benefits?: string[];
  createdAt: string;
}

// ==========================================
// 3. GESTIÓN DE INVENTARIO (TIENDA & MERCHANDISING)
// ==========================================
export type ProductCategory = 'Jerseys' | 'Gorras' | 'Sudaderas' | 'Souvenirs' | 'Accesorios' | 'Coleccionables';

export interface InventoryProduct {
  id: string;
  venueId?: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
  minStockAlert: number;
  sizes?: string[]; // Ej: ['S', 'M', 'L', 'XL'] o ['Ajustable', '7 1/4']
  image: string;
  description: string;
  supplier?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCost {
  productId: string;
  costPrice: number;
  updatedAt: string;
}

// ==========================================
// 4. LOGÍSTICA DE ENVÍOS & PEDIDOS DE TIENDA
// ==========================================
export type ShippingType = 'domicilio' | 'tienda';
export type CarrierCompany = 'DHL Express' | 'Estafeta' | 'Paquetexpress' | 'Mensajería Local Mazatlán' | 'Recoger en Tienda Estadio';
export type MerchOrderStatus = 'pendiente' | 'empacado' | 'en_transito' | 'entregado' | 'cancelado';

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  size?: string;
  image?: string;
}

export interface ShippingAddress {
  recipientName: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  referenceNotes?: string;
}

export interface MerchOrder {
  id: string;
  venueId?: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  shippingType: ShippingType;
  shippingAddress?: ShippingAddress;
  carrier?: CarrierCompany;
  trackingNumber?: string;
  status: MerchOrderStatus;
  paymentMethod: 'Tarjeta' | 'Transferencia SPEI' | 'MercadoPago' | 'Efectivo en Tienda' | 'Efectivo / Terminal física' | string;
  paymentStatus: 'pagado' | 'pendiente' | 'reembolsado';
  stripePaymentIntentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 5. CONCESIONES & PICKUP EXPRESS (COMIDA & BEBIDAS)
// ==========================================
export type StandCategoryTag = 'Mariscos & Botaneros' | 'Tacos & Parrilla' | 'Hot Dogs & Snacks' | 'Cerveza & Coctelería' | 'Postres & Helados' | 'Souvenirs & Tiendita' | 'Café & Churros';

export interface StadiumStand {
  id: string;
  venueId: string;
  name: string;
  location: string; // Ej: 'Zona Central Puerta 3', 'Bleachers Planta Alta'
  categoryTag: StandCategoryTag;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  contactPhone?: string;
  contactEmail?: string;
  commissionRate?: number; // % de comisión por ventas del estadio (ej: 15)
  monthlyRent?: number; // Renta mensual o canon por concesión fija
  active: boolean;
  image: string;
  estimatedWaitMinutes: number;
  createdAt: string;
  updatedAt?: string;
}

export type MenuItemCategory = 'comida' | 'bebida' | 'cerveza' | 'snack' | 'combo';

export interface MenuItem {
  id: string;
  standId: string;
  venueId?: string;
  name: string;
  description: string;
  price: number;
  category: MenuItemCategory;
  available: boolean;
  image: string;
  prepTimeMinutes?: number;
  createdAt: string;
}

export type OrderType = 'pickup' | 'in-seat';
export type FoodOrderStatus = 'pendiente' | 'preparando' | 'listo' | 'en-camino' | 'entregado' | 'cancelado';

export interface Zone {
  id: string;
  venueId: string;
  name: string; // Ej: "Zona A - Sombra Central"
  sections: string[]; // Ej: ['100', '101', '102', '103']
}

export interface FoodOrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface FoodOrder {
  id: string;
  venueId: string;
  standId: string;
  standName: string;
  userId: string;
  customerName: string;
  orderType: OrderType;
  pickupCode: string; // Ej: 'V-482'
  items: FoodOrderItem[];
  total: number;
  status: FoodOrderStatus;
  paymentMethod: string;
  paymentStatus?: 'pagado' | 'pendiente' | 'reembolsado';
  paymentDetails?: {
    paymentIntentId?: string;
    authCode?: string;
    cardBrand?: string;
    cardLast4?: string;
    amount?: number;
    timestamp?: string;
  };
  // Solo para orderType === 'in-seat':
  section?: string;
  row?: string;
  seat?: string;
  zoneId?: string; // derivado de section al crear el pedido
  runnerId?: string | null; // uid del runner que tomó el pedido
  statusHistory?: {
    status: FoodOrderStatus;
    timestamp: string;
    note?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 6. ADMINISTRACIÓN DE VENTAS & AUDITORÍA
// ==========================================
export type SaleChannel = 'boletos' | 'tienda_merch' | 'concesion_alimentos';

export interface SaleTransaction {
  id: string;
  venueId?: string;
  eventId?: string;
  channel: SaleChannel;
  referenceId: string;
  customerName: string;
  description: string;
  amount: number;
  paymentMethod: string;
  date: string;
  status: 'completada' | 'reembolsada' | 'pendiente';
}

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: import('firebase/auth').User | null;
  loading: boolean;
  error: string | null;
}

// ==========================================
// 7. MARCADOR EN VIVO (FASE A)
// ==========================================
export type GameStatus = 'programado' | 'en_vivo' | 'finalizado';
export type ScoreboardSport = 'baseball' | 'football';

export interface InningScore {
  inning: number;
  home: number | null;
  away: number | null;
}

export interface BaseballGameState {
  currentInning: number;
  isTopInning: boolean; // true = alta (visitante batea), false = baja (local batea)
  outs: number; // 0-2
  balls: number; // 0-3
  strikes: number; // 0-2
  inningScores: InningScore[];
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;
}

export type FootballHalf = 'primer_tiempo' | 'entretiempo' | 'segundo_tiempo' | 'finalizado';

export interface FootballCard {
  team: 'home' | 'away';
  playerName: string;
  minute: number;
  type: 'amarilla' | 'roja';
}

export interface FootballGoal {
  team: 'home' | 'away';
  playerName: string;
  minute: number;
}

export interface FootballGameState {
  half: FootballHalf;
  minute: number; // minuto actual mostrado
  addedTime: number; // minutos de tiempo agregado, si aplica
  goals: FootballGoal[];
  cards: FootballCard[];
}

export interface GameScoreboard {
  id: string; // mismo id que el eventId
  eventId: string;
  venueId: string;
  sport: ScoreboardSport;
  status: GameStatus;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  baseballState?: BaseballGameState; // solo si sport === 'baseball'
  footballState?: FootballGameState; // solo si sport === 'football'
  updatedAt: string;
}

// ==========================================
// 8. ALINEACIONES Y ESTADÍSTICAS (FASE B)
// ==========================================
export interface LineupPlayer {
  id: string;
  eventId: string;
  team: 'home' | 'away';
  playerName: string;
  jerseyNumber: string;
  position: string;
  battingOrder: number; // 1-9
}

export interface PlayerGameStats {
  id: string;
  eventId: string;
  playerName: string;
  team: 'home' | 'away';
  atBats?: number;
  hits?: number;
  runs?: number;
  rbi?: number;
  inningsPitched?: number;
  earnedRuns?: number;
  strikeouts?: number;
}

// ==========================================
// 9. HISTORIAL DE JUEGOS Y RESULTADOS
// ==========================================
export interface HistoricalGame {
  id: string;
  eventId: string;
  venueId: string;
  venueName: string;
  city?: string;
  sport: ScoreboardSport | 'basketball';
  matchTitle: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  date: string;
  time?: string;
  status: 'finalizado';
  winnerTeam?: 'home' | 'away' | 'tie';
  baseballState?: BaseballGameState;
  footballState?: FootballGameState;
  summaryNote?: string;
}
