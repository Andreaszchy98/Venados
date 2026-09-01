/**
 * Venados App - Modelos y Tipos Centralizados
 * Plataforma Integral de Negocio, Afición y Operaciones del Club Venados de Mazatlán
 */

export type UserRole = 'aficionado' | 'admin' | 'taquilla' | 'concesionario';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  photoURL?: string | null;
  phoneNumber?: string | null;
  standId?: string; // Si el usuario es operador de un puesto de comida/concesionario
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// 1. BOLETOS & TAQUILLA
// ==========================================
export type TicketStatus = 'activo' | 'usado' | 'cancelado';

export interface Ticket {
  id: string;
  userId: string;
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
  createdAt: string;
}

// ==========================================
// 2. SOCIOS & MEMBRESÍAS
// ==========================================
export type MembershipTier = 'General' | 'Oro' | 'Platino' | 'Diamante';
export type MembershipStatus = 'activa' | 'vencida' | 'suspendida';

export interface Membership {
  id: string;
  userId: string;
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
  sku: string;
  name: string;
  category: ProductCategory;
  price: number;
  costPrice: number;
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
  paymentMethod: 'Tarjeta' | 'Transferencia SPEI' | 'MercadoPago' | 'Efectivo en Tienda';
  paymentStatus: 'pagado' | 'pendiente' | 'reembolsado';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 5. CONCESIONES & PICKUP EXPRESS (COMIDA & BEBIDAS)
// ==========================================
export interface StadiumStand {
  id: string;
  name: string;
  location: string; // Ej: 'Zona Central Puerta 3', 'Bleachers Planta Alta'
  categoryTag: 'Mariscos & Botaneros' | 'Tacos & Parrilla' | 'Hot Dogs & Snacks' | 'Cerveza & Coctelería' | 'Postres & Helados';
  ownerId?: string;
  ownerName?: string;
  active: boolean;
  image: string;
  estimatedWaitMinutes: number;
  createdAt: string;
}

export type MenuItemCategory = 'comida' | 'bebida' | 'cerveza' | 'snack' | 'combo';

export interface MenuItem {
  id: string;
  standId: string;
  name: string;
  description: string;
  price: number;
  category: MenuItemCategory;
  available: boolean;
  image: string;
  prepTimeMinutes?: number;
  createdAt: string;
}

export type FoodOrderStatus = 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado';

export interface FoodOrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface FoodOrder {
  id: string;
  standId: string;
  standName: string;
  userId: string;
  customerName: string;
  pickupCode: string; // Ej: 'V-482'
  items: FoodOrderItem[];
  total: number;
  status: FoodOrderStatus;
  paymentMethod: string;
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
