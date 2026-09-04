import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Diccionario bilingüe para VXP (Español / Inglés)
const translations: Record<Language, Record<string, string>> = {
  es: {
    // Header & Navegación
    'header.platform_name': 'Venue Experience Platform',
    'header.switch_view': 'Cambiar vista:',
    'header.role.aficionado': 'Aficionado (Boletos, Tienda, Comida)',
    'header.role.admin': 'Administrador (Ventas, Inventario, Envíos, Personal)',
    'header.role.concesionario': 'Concesionario (Comanda en Vivo)',
    'header.role.runner': 'Runner (Entregas en Butaca)',
    'header.role.taquilla': 'Taquilla (Control de Accesos)',
    'header.role.superadmin': 'Superadmin (Gestión Global de Sedes)',
    'header.login': 'Iniciar Sesión',
    'header.logout': 'Cerrar Sesión',
    'header.language': 'Idioma',
    'header.language.es': 'Español',
    'header.language.en': 'English',

    // Hero / Bienvenida
    'hero.tag': 'Tu estadio, en un solo lugar',
    'hero.title': 'Bienvenido a VXP',
    'hero.subtitle': 'Boletos digitales, pedidos a tu asiento, tienda oficial y toda la experiencia de tu estadio, desde tu celular.',
    'hero.login_btn': 'Ingresar con Google o Correo',
    'hero.loading_session': 'Verificando sesión en Firebase...',

    // Tarjetas de Arquitectura / Módulos
    'features.store_food.title': 'Tienda & Alimentos',
    'features.store_food.desc': 'Venta de uniformes oficiales, souvenirs y comanda Pickup Express sin filas en butaca.',
    'features.inventory.title': 'Gestión de Inventario',
    'features.inventory.desc': 'Control de stock de tienda y almacén, ajuste de piezas, costos y alertas de stock mínimo.',
    'features.shipping.title': 'Logística de Envíos',
    'features.shipping.desc': 'Despacho de pedidos, asignación de guías de transportistas (DHL, Estafeta) y tracking.',
    'features.sales.title': 'Auditoría de Ventas',
    'features.sales.desc': 'Consolidación financiera y métricas de ingresos multicanal en tiempo real.',

    // Modal de Autenticación
    'auth.title_login': 'Iniciar Sesión',
    'auth.title_register': 'Crear Cuenta',
    'auth.subtitle': 'Accede a tus boletos, pedidos y membresía',
    'auth.google_btn': 'Continuar con Google',
    'auth.or_email': 'o continúa con tu correo',
    'auth.email': 'Correo electrónico',
    'auth.email_placeholder': 'tu@email.com',
    'auth.password': 'Contraseña',
    'auth.name': 'Nombre completo',
    'auth.name_placeholder': 'Ej. Juan Pérez',
    'auth.submit_login': 'Entrar',
    'auth.submit_register': 'Registrarse',
    'auth.loading': 'Procesando...',
    'auth.switch_to_register': '¿No tienes cuenta? Regístrate aquí',
    'auth.switch_to_login': '¿Ya tienes cuenta? Inicia sesión',
    'auth.cancel': 'Cancelar',

    // Pestañas de Aficionado
    'aficionado.hello': 'Hola,',
    'aficionado.tagline': 'Portal de Experiencia del Aficionado • Boletos, eventos, consumos y tienda en tu sede',
    'aficionado.tab.tickets': 'Mis Boletos',
    'aficionado.tab.membership': 'Membresía & Abonos',
    'aficionado.tab.store': 'Tienda Oficial',
    'aficionado.tab.food': 'Comida & Bebidas',
    'aficionado.tab.orders': 'Mis Pedidos',

    // Boletos
    'tickets.title': 'Mis Boletos para Eventos',
    'tickets.filter.all': 'Todos',
    'tickets.filter.active': 'Activos',
    'tickets.filter.used': 'Utilizados',
    'tickets.buy_btn': 'Comprar Boletos',
    'tickets.empty': 'No tienes boletos registrados para esta sede.',
    'tickets.select_seat': 'Seleccionar Butaca en el Mapa',
    'tickets.qr_hint': 'Muestra este código QR en los torniquetes de acceso.',
    'tickets.match': 'Partido / Evento',
    'tickets.zone': 'Zona',
    'tickets.row': 'Fila',
    'tickets.seat': 'Asiento',

    // Tienda
    'store.title': 'Tienda Oficial Venados',
    'store.subtitle': 'Productos originales, jerseys de juego y souvenirs con envío a domicilio o retiro en estadio.',
    'store.cart': 'Carrito de Compras',
    'store.empty_cart': 'Tu carrito está vacío',
    'store.checkout': 'Proceder al Pago',
    'store.add_to_cart': 'Agregar al Carrito',
    'store.out_of_stock': 'Agotado',
    'store.shipping_home': 'Envío a Domicilio',
    'store.pickup_stadium': 'Recoger en Tienda Oficial',
    'store.subtotal': 'Subtotal',
    'store.shipping_cost': 'Costo de Envío',
    'store.free_shipping': 'Gratis',
    'store.total': 'Total a Pagar',
    'store.pay_confirm': 'Confirmar y Pagar Pedido',
    'store.categories.all': 'Todos los productos',

    // Comida y Bebidas
    'food.title': 'Comida & Bebidas en Estadio',
    'food.subtitle': 'Pide directo a tu butaca o recoge en mostrador express.',
    'food.in_seat_title': 'Entrega en Butaca (In-Seat)',
    'food.pickup_title': 'Pickup Express en Mostrador',
    'food.empty_stands': 'No hay puestos de comida disponibles en este momento.',
    'food.my_cart': 'Mi Orden de Comida',
    'food.send_order': 'Enviar Pedido a Cocina',

    // Pedidos
    'orders.title': 'Historial y Seguimiento de Pedidos',
    'orders.merch_tab': 'Tienda & Souvenirs',
    'orders.food_tab': 'Alimentos & Bebidas',
    'orders.empty': 'No tienes pedidos registrados en esta categoría.',
    'orders.tracking_carrier': 'Guía de Rastreo',

    // Admin Navigation
    'admin.tabs.overview': 'Resumen General',
    'admin.tabs.events': 'Gestión de Eventos',
    'admin.tabs.sales': 'Auditoría de Ventas',
    'admin.tabs.inventory': 'Inventario y Almacén',
    'admin.tabs.logistics': 'Logística y Envíos',
    'admin.tabs.staff': 'Personal y Accesos',
    'admin.tabs.business': 'Locales y Concesiones',

    // Footer
    'footer.copyright': 'VXP — Venue Experience Platform © 2026. Todos los derechos reservados.',

    // Generales
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.close': 'Cerrar',
    'common.loading': 'Cargando...',
    'common.status': 'Estado',
    'common.date': 'Fecha',
    'common.total': 'Total',
    'common.actions': 'Acciones',
  },
  en: {
    // Header & Navigation
    'header.platform_name': 'Venue Experience Platform',
    'header.switch_view': 'Switch view:',
    'header.role.aficionado': 'Fan (Tickets, Store, Food)',
    'header.role.admin': 'Administrator (Sales, Inventory, Shipping, Staff)',
    'header.role.concesionario': 'Concessionaire (Live Orders)',
    'header.role.runner': 'Runner (In-Seat Delivery)',
    'header.role.taquilla': 'Box Office (Access Control)',
    'header.role.superadmin': 'Superadmin (Global Venue Management)',
    'header.login': 'Sign In',
    'header.logout': 'Sign Out',
    'header.language': 'Language',
    'header.language.es': 'Español',
    'header.language.en': 'English',

    // Hero / Welcome
    'hero.tag': 'Your stadium, in one place',
    'hero.title': 'Welcome to VXP',
    'hero.subtitle': 'Digital tickets, in-seat ordering, official merch store, and your complete stadium experience, right on your phone.',
    'hero.login_btn': 'Sign in with Google or Email',
    'hero.loading_session': 'Verifying Firebase session...',

    // Architecture / Modules
    'features.store_food.title': 'Store & Food',
    'features.store_food.desc': 'Official team jerseys, souvenirs, and Pickup Express in-seat ordering without waiting in lines.',
    'features.inventory.title': 'Inventory Management',
    'features.inventory.desc': 'Stock control for store and warehouse, piece adjustments, unit costs, and low-stock alerts.',
    'features.shipping.title': 'Shipping Logistics',
    'features.shipping.desc': 'Order fulfillment, courier tracking assignment (DHL, Estafeta), and delivery dispatch.',
    'features.sales.title': 'Sales Audit',
    'features.sales.desc': 'Financial consolidation and real-time multi-channel revenue analytics.',

    // Auth Modal
    'auth.title_login': 'Sign In',
    'auth.title_register': 'Create Account',
    'auth.subtitle': 'Access your digital tickets, orders, and membership',
    'auth.google_btn': 'Continue with Google',
    'auth.or_email': 'or continue with your email',
    'auth.email': 'Email address',
    'auth.email_placeholder': 'you@email.com',
    'auth.password': 'Password',
    'auth.name': 'Full name',
    'auth.name_placeholder': 'e.g. John Smith',
    'auth.submit_login': 'Sign In',
    'auth.submit_register': 'Sign Up',
    'auth.loading': 'Processing...',
    'auth.switch_to_register': "Don't have an account? Sign up here",
    'auth.switch_to_login': 'Already have an account? Sign in',
    'auth.cancel': 'Cancel',

    // Fan Tabs
    'aficionado.hello': 'Hello,',
    'aficionado.tagline': 'Fan Experience Hub • Tickets, events, concessions, and official store at your venue',
    'aficionado.tab.tickets': 'My Tickets',
    'aficionado.tab.membership': 'Season Pass & Membership',
    'aficionado.tab.store': 'Official Store',
    'aficionado.tab.food': 'Food & Drinks',
    'aficionado.tab.orders': 'My Orders',

    // Tickets
    'tickets.title': 'My Event Tickets',
    'tickets.filter.all': 'All',
    'tickets.filter.active': 'Active',
    'tickets.filter.used': 'Used',
    'tickets.buy_btn': 'Buy Tickets',
    'tickets.empty': 'You have no tickets registered for this venue.',
    'tickets.select_seat': 'Select Seat on Stadium Map',
    'tickets.qr_hint': 'Show this QR code at stadium access turnstiles.',
    'tickets.match': 'Match / Event',
    'tickets.zone': 'Zone',
    'tickets.row': 'Row',
    'tickets.seat': 'Seat',

    // Store
    'store.title': 'Official Venados Store',
    'store.subtitle': 'Official merchandise, team jerseys, and souvenirs delivered to your door or available for stadium pickup.',
    'store.cart': 'Shopping Cart',
    'store.empty_cart': 'Your cart is empty',
    'store.checkout': 'Proceed to Checkout',
    'store.add_to_cart': 'Add to Cart',
    'store.out_of_stock': 'Out of Stock',
    'store.shipping_home': 'Home Delivery',
    'store.pickup_stadium': 'Pick up at Stadium Store',
    'store.subtotal': 'Subtotal',
    'store.shipping_cost': 'Shipping Fee',
    'store.free_shipping': 'Free',
    'store.total': 'Total to Pay',
    'store.pay_confirm': 'Confirm and Pay Order',
    'store.categories.all': 'All Products',

    // Food and Concessions
    'food.title': 'Stadium Food & Drinks',
    'food.subtitle': 'Order directly to your seat or pick up at the express counter.',
    'food.in_seat_title': 'In-Seat Delivery',
    'food.pickup_title': 'Express Counter Pickup',
    'food.empty_stands': 'No food stands available at the moment.',
    'food.my_cart': 'My Food Order',
    'food.send_order': 'Send Order to Kitchen',

    // Orders
    'orders.title': 'Order History & Tracking',
    'orders.merch_tab': 'Store & Souvenirs',
    'orders.food_tab': 'Food & Drinks',
    'orders.empty': 'You have no orders in this category.',
    'orders.tracking_carrier': 'Tracking Number',

    // Admin Navigation
    'admin.tabs.overview': 'Executive Overview',
    'admin.tabs.events': 'Event Management',
    'admin.tabs.sales': 'Sales Audit',
    'admin.tabs.inventory': 'Inventory & Warehouse',
    'admin.tabs.logistics': 'Logistics & Shipping',
    'admin.tabs.staff': 'Staff & Access',
    'admin.tabs.business': 'Stands & Concessions',

    // Footer
    'footer.copyright': 'VXP — Venue Experience Platform © 2026. All rights reserved.',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.total': 'Total',
    'common.actions': 'Actions',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'vxp_language_pref';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // 1. Verificar preferencia guardada en localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') {
      return saved;
    }
    // 2. O detectar el idioma del navegador
    if (typeof navigator !== 'undefined' && navigator.language) {
      if (navigator.language.toLowerCase().startsWith('en')) {
        return 'en';
      }
    }
    return 'es';
  });

  // Guardar en localStorage y actualizar estado
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      // Si el usuario tiene sesión activa, guardar en su perfil de Firestore
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        updateDoc(userRef, {
          language: lang,
          updatedAt: new Date().toISOString(),
        }).catch((err) => {
          console.warn('Aviso al sincronizar preferencia de idioma en Firestore:', err);
        });
      }
    } catch (e) {
      console.warn('No se pudo guardar idioma en almacenamiento local:', e);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  // Función de traducción
  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language] || translations['es'];
    if (langDict[key]) {
      return langDict[key];
    }
    // Fallback al español si falta en inglés
    if (translations['es'][key]) {
      return translations['es'][key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage debe usarse dentro de un LanguageProvider');
  }
  return context;
}
