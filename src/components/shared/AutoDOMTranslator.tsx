import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';

// Diccionario de traducción instantánea (0 ms de latencia) para términos de interfaz comunes
const FAST_TERMS: Record<string, string> = {
  // Navegación y Roles
  'Cartelera': 'Events & Schedule',
  'Tickets': 'Tickets',
  'Boletos': 'Tickets',
  'Tienda': 'Store',
  'Comida': 'Food & Drinks',
  'Pedidos': 'Orders',
  'Mis Boletos': 'My Tickets',
  'Mis Pedidos': 'My Orders',
  'Mi Membresía': 'My Membership',
  'Membresía': 'Membership',
  'Abonos': 'Season Passes',
  'Cerrar Sesión': 'Sign Out',
  'Iniciar Sesión': 'Sign In',
  'Acceso': 'Access',
  'Inventario': 'Inventory',
  'Logística': 'Logistics',
  'Ventas': 'Sales',
  'Taquilla': 'Box Office',
  'Concesionario': 'Concessionaire',
  'Repartidor': 'Runner',
  'Admin': 'Admin',
  'Super Admin': 'Super Admin',

  // Cartelera y Filtros
  'CARTELERA DEPORTIVA': 'SPORTS & EVENTS SCHEDULE',
  'Cartelera Deportiva': 'Sports & Events Schedule',
  'Todos': 'All',
  'Béisbol': 'Baseball',
  'Beisbol': 'Baseball',
  'Fútbol': 'Soccer',
  'Futbol': 'Soccer',
  'Conciertos': 'Concerts',
  'Desde': 'From',
  'Ver sinopsis': 'View details',
  'Sinopsis': 'Synopsis',
  'Elegir en mapa': 'Select on map',
  'ELEGIR EN MAPA': 'SELECT ON MAP',
  'Compra rápida': 'Quick buy',
  'COMPRA RÁPIDA': 'QUICK BUY',
  'Comprar Boletos': 'Buy Tickets',
  'Seleccionar Butacas': 'Select Seats',
  'Lugares disponibles': 'Available seats',
  'En vivo': 'Live',
  'Finalizado': 'Finalized',
  'Próximo': 'Upcoming',
  'Estadio Teodoro Mariscal': 'Teodoro Mariscal Stadium',

  // Tienda y Merch
  'Tienda Oficial': 'Official Store',
  'Buscar productos...': 'Search products...',
  'Buscar productos': 'Search products',
  'Buscar': 'Search',
  'Categorías': 'Categories',
  'Categorias': 'Categories',
  'Gorras': 'Caps',
  'Jerseys': 'Jerseys',
  'Accesorios': 'Accessories',
  'Ropa': 'Apparel',
  'Novedades': 'New Arrivals',
  'Ofertas': 'Offers',
  'Agregar al carrito': 'Add to cart',
  'AGREGAR AL CARRITO': 'ADD TO CART',
  'Añadir al carrito': 'Add to cart',
  'Ver detalles': 'View details',
  'Talla': 'Size',
  'Tallas': 'Sizes',
  'Color': 'Color',
  'Cantidad': 'Quantity',
  'Disponible': 'In stock',
  'Agotado': 'Out of stock',
  'Pocas piezas': 'Low stock',
  'Envío a domicilio': 'Home delivery',
  'Recoger en estadio': 'Pick up at stadium',
  'Pick up en estadio': 'Stadium pickup',

  // Alimentos y Bebidas
  'Menú de Alimentos': 'Food & Concessions Menu',
  'Alimentos': 'Food',
  'Bebidas': 'Beverages',
  'Snacks': 'Snacks',
  'Combos': 'Combos',
  'Cervezas': 'Beers',
  'Refrescos': 'Soft Drinks',
  'Tacos': 'Tacos',
  'Hot Dogs': 'Hot Dogs',
  'Hamburguesas': 'Burgers',
  'Pizza': 'Pizza',
  'Ordenar a mi asiento': 'Order to my seat',
  'Entrega en butaca': 'Seat delivery',
  'Pick up en puesto': 'Pickup at stand',
  'Tiempo estimado': 'Estimated time',
  'minutos': 'minutes',
  'mins': 'mins',

  // Carrito y Checkout
  'Mi Carrito': 'My Cart',
  'Carrito': 'Cart',
  'Tu carrito está vacío': 'Your cart is empty',
  'Subtotal': 'Subtotal',
  'Total': 'Total',
  'Envío': 'Shipping',
  'Gratis': 'Free',
  'Proceder al pago': 'Proceed to checkout',
  'PAGAR AHORA': 'PAY NOW',
  'Pagar': 'Pay',
  'Confirmar compra': 'Confirm purchase',
  'Método de pago': 'Payment method',
  'Tarjeta de crédito / débito': 'Credit / Debit Card',
  'Efectivo': 'Cash',
  'Dirección de envío': 'Shipping address',
  'Código postal': 'Postal code',
  'Teléfono': 'Phone number',
  'Nombre completo': 'Full name',

  // Mis Compras y Estados Unificados
  'Mis Compras': 'My Purchases',
  'MIS COMPRAS': 'MY PURCHASES',
  'Activas': 'Active',
  'ACTIVAS': 'ACTIVE',
  'Pasadas': 'Past',
  'PASADAS': 'PAST',
  'Boleto Digital': 'Digital Ticket',
  'Recibido': 'Received',
  'Preparando': 'Preparing',
  'Runner Asignado': 'Runner Assigned',
  '¡Listo para recoger!': 'Ready for pickup!',
  'Pendiente Empaque': 'Packaging Pending',
  'En Tránsito': 'In Transit',
  'Envío a Domicilio': 'Home Delivery',
  'Retiro en Tienda Estadio': 'Pickup at Stadium Store',
  'Pickup Express en mostrador': 'Express Pickup at Counter',
  'Entrega a Butaca': 'In-Seat Delivery',
  'Entrega a Butaca:': 'In-Seat Delivery:',
  'artículos': 'items',
  'No tienes compras ni boletos activos': 'You have no active purchases or tickets',
  'No tienes compras pasadas': 'You have no past purchases',
  'Historial unificado de boletos, comida en estadio y mercancía oficial': 'Unified history of tickets, stadium food, and official merchandise',
  'Cocina Abierta': 'Kitchen Open',
  'Catálogo': 'Catalog',
  'Volver a Cartelera': 'Back to Schedule',

  // Fechas y Días
  'Hoy': 'Today',
  'Mañana': 'Tomorrow',
  'Ayer': 'Yesterday',
  'Lunes': 'Monday',
  'Martes': 'Tuesday',
  'Miércoles': 'Wednesday',
  'Miercoles': 'Wednesday',
  'Jueves': 'Thursday',
  'Viernes': 'Friday',
  'Sábado': 'Saturday',
  'Sabado': 'Saturday',
  'Domingo': 'Sunday',
  'Enero': 'January',
  'Febrero': 'February',
  'Marzo': 'March',
  'Abril': 'April',
  'Mayo': 'May',
  'Junio': 'June',
  'Julio': 'July',
  'Agosto': 'August',
  'Septiembre': 'September',
  'Octubre': 'October',
  'Noviembre': 'November',
  'Diciembre': 'December',
  'Jue 17 De Sep': 'Thu Sep 17',
  'Vie 18 De Sep': 'Fri Sep 18',
  'Sab 19 De Sep': 'Sat Sep 19',
  'Dom 20 De Sep': 'Sun Sep 20',

  // Estados de pedido
  'Pendiente': 'Pending',
  'En preparación': 'Preparing',
  'En camino': 'On the way',
  'Entregado': 'Delivered',
  'Cancelado': 'Cancelled',
  'Completado': 'Completed',
  'Detalles del pedido': 'Order details',
  'Número de orden': 'Order number',
  'Número de guía': 'Tracking number',
  'Rastrear pedido': 'Track order',

  // Taquilla, Asientos y Mapa
  'Fila': 'Row',
  'Asiento': 'Seat',
  'Butaca': 'Seat',
  'Zona': 'Zone',
  'Sección': 'Section',
  'Gradería': 'Bleachers',
  'Graderías': 'Bleachers',
  'Palco': 'Box Suite',
  'Palcos': 'Box Suites',
  'Zona VIP': 'VIP Zone',
  'Central Preferente': 'Center Preferred',
  'Lateral Norte': 'North Bleachers',
  'Lateral Sur': 'South Bleachers',
  'Selecciona tus asientos': 'Select your seats',
  'Asientos seleccionados': 'Selected seats',
  'Precio por boleto': 'Price per ticket',
  'Cargo por servicio': 'Service fee',
  'Total a pagar': 'Total to pay',
  'Continuar con la compra': 'Continue purchase',
  'Descargar Boleto': 'Download Ticket',
  'Código QR': 'QR Code',
  'Escanear acceso': 'Scan access',
  'Acceso permitido': 'Access granted',
  'Acceso denegado': 'Access denied',

  // Inventario y Logística
  'Gestión de Inventario': 'Inventory Management',
  'Control de Stock': 'Stock Control',
  'Stock actual': 'Current stock',
  'Entradas de almacén': 'Warehouse entries',
  'Salidas de almacén': 'Warehouse exits',
  'Nuevo producto': 'New product',
  'Actualizar inventario': 'Update inventory',
  'Alertas de stock bajo': 'Low stock alerts',
  'Logística de Envíos': 'Shipping & Logistics',
  'Envíos pendientes': 'Pending shipments',
  'Generar guía': 'Generate shipping label',
  'Empacado': 'Packed',
  'En tránsito': 'In transit',
  'Paquetería': 'Courier / Carrier',
  'Destinatario': 'Recipient',
  'Guía de rastreo': 'Tracking number',
  'Administración de Ventas': 'Sales Administration',
  'Panel de Ventas': 'Sales Dashboard',
  'Ingresos totales': 'Total Revenue',
  'Ventas del día': 'Today\'s Sales',
  'Órdenes completadas': 'Completed Orders',
  'Ticket promedio': 'Average Ticket',
  'Gráfica de rendimiento': 'Performance Chart',
  'Exportar reporte': 'Export Report',

  // Concesiones y Cocina
  'Comandas activas': 'Active Kitchen Tickets',
  'Nueva comanda': 'New Ticket',
  'Listo para entrega': 'Ready for delivery',
  'Asignar runner': 'Assign runner',
  'Entrega confirmada': 'Delivery confirmed',
  'Puesto de comida': 'Concession Stand',

  // UI General
  'Guardar': 'Save',
  'Cancelar': 'Cancel',
  'Editar': 'Edit',
  'Eliminar': 'Delete',
  'Filtrar': 'Filter',
  'Limpiar': 'Clear',
  'Aplicar': 'Apply',
  'Cerrar': 'Close',
  'Volver': 'Back',
  'Regresar': 'Go back',
  'Siguiente': 'Next',
  'Anterior': 'Previous',
  'Ver más': 'View more',
  'Cargando...': 'Loading...',
  'Éxito': 'Success',
  'Error': 'Error',
};

// Expresión para saber si un texto amerita traducción
const SPANISH_LETTER_REGEX = /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/;

// Cooldown en cliente para respetar límites de cuota de la API
let clientCooldownUntil = 0;

export const AutoDOMTranslator: React.FC = () => {
  const { language } = useLanguage();
  const trackedTextNodesRef = useRef<Set<Node>>(new Set());
  const trackedElementsRef = useRef<Set<Element>>(new Set());
  const pendingTextsSetRef = useRef<Set<string>>(new Set());
  const nodeMapRef = useRef<Map<string, Set<Node>>>(new Map());
  const debounceTimerRef = useRef<any>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const isApplyingRef = useRef<boolean>(false);
  const memoryCacheRef = useRef<Record<string, string>>({});

  // Cargar caché local en memoria al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vxp_dom_trans_cache');
      if (raw) {
        memoryCacheRef.current = JSON.parse(raw);
      }
    } catch {}
  }, []);

  // Función para obtener traducción rápida o de caché
  const getKnownTranslation = (text: string): string | null => {
    if (FAST_TERMS[text]) return FAST_TERMS[text];
    if (memoryCacheRef.current[text]) return memoryCacheRef.current[text];

    // Patrones frecuentes: "Desde $X MXN" -> "From $X MXN"
    if (text.startsWith('Desde $')) {
      return text.replace(/^Desde \$/, 'From $');
    }
    if (text.endsWith(' hrs')) {
      return text.replace(/ hrs$/, ' hrs');
    }
    if (/^Fila\s+([A-Z0-9]+)$/i.test(text)) {
      return text.replace(/^Fila/i, 'Row');
    }
    if (/^Asiento\s+([A-Z0-9]+)$/i.test(text)) {
      return text.replace(/^Asiento/i, 'Seat');
    }
    if (/^Butaca\s+([A-Z0-9]+)$/i.test(text)) {
      return text.replace(/^Butaca/i, 'Seat');
    }

    return null;
  };

  // Revertir todo el DOM al español original cuando el usuario cambie a 'es'
  const restoreOriginalSpanish = () => {
    // Restaurar TextNodes
    trackedTextNodesRef.current.forEach((node) => {
      try {
        const orig = (node as any).__vxpOrigText;
        if (orig !== undefined && node.nodeValue !== orig) {
          node.nodeValue = orig;
        }
      } catch {}
    });

    // Restaurar atributos
    trackedElementsRef.current.forEach((el) => {
      try {
        const origAttrs = (el as any).__vxpOrigAttrs;
        if (origAttrs) {
          if (origAttrs.placeholder !== undefined && (el as HTMLInputElement).placeholder !== undefined) {
            (el as HTMLInputElement).placeholder = origAttrs.placeholder;
          }
          if (origAttrs.title !== undefined) {
            el.setAttribute('title', origAttrs.title);
          }
          if (origAttrs.ariaLabel !== undefined) {
            el.setAttribute('aria-label', origAttrs.ariaLabel);
          }
        }
      } catch {}
    });
  };

  // Función para enviar textos pendientes al endpoint de Gemini
  const dispatchBatchTranslation = async () => {
    if (language !== 'en') return;
    const textsToTranslate: string[] = Array.from(pendingTextsSetRef.current);
    pendingTextsSetRef.current.clear();

    if (textsToTranslate.length === 0) return;

    try {
      // Leer primero de localStorage
      let localCache: Record<string, string> = {};
      try {
        const raw = localStorage.getItem('vxp_dom_trans_cache');
        if (raw) localCache = JSON.parse(raw);
      } catch {}

      const uncachedTexts: string[] = [];
      const resolvedTranslations: Record<string, string> = {};

      textsToTranslate.forEach((t: string) => {
        if (FAST_TERMS[t]) {
          resolvedTranslations[t] = FAST_TERMS[t];
        } else if (localCache[t]) {
          resolvedTranslations[t] = localCache[t];
        } else {
          uncachedTexts.push(t);
        }
      });

      // Aplicar las que ya teníamos inmediatamente
      applyTranslations(resolvedTranslations);

      // Si hay textos nuevos y no estamos en cooldown de cuota, llamar a Gemini en un único lote agrupado
      if (uncachedTexts.length > 0 && Date.now() >= clientCooldownUntil) {
        // Enviar hasta 80 textos en una sola solicitud para no agotar la cuota por minuto
        const chunk = uncachedTexts.slice(0, 80);
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: chunk, targetLang: 'en', sourceLang: 'es' }),
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.translations)) {
              const newMap: Record<string, string> = {};
              chunk.forEach((orig, idx) => {
                const trans = data.translations[idx];
                if (typeof trans === 'string' && trans.trim()) {
                  newMap[orig] = trans.trim();
                  localCache[orig] = trans.trim();
                  memoryCacheRef.current[orig] = trans.trim();
                }
              });
              applyTranslations(newMap);
            }
          } else {
            // Si el backend responde con saturación o cooldown, pausar 30 segundos
            clientCooldownUntil = Date.now() + 30000;
          }
        } catch {
          // Error de red temporal: pausar 30 segundos
          clientCooldownUntil = Date.now() + 30000;
        }

        try {
          localStorage.setItem('vxp_dom_trans_cache', JSON.stringify(localCache));
        } catch {}
      }
    } catch {
      // Manejo silencioso de errores de parseo local
    }
  };

  // Aplicar un conjunto de traducciones a los nodos correspondientes
  const applyTranslations = (translations: Record<string, string>) => {
    isApplyingRef.current = true;
    try {
      Object.entries(translations).forEach(([origText, translatedText]) => {
        const nodes = nodeMapRef.current.get(origText);
        if (nodes) {
          nodes.forEach((node) => {
            try {
              if (node.nodeValue !== translatedText) {
                // Conservar espacios en blanco al inicio o al final
                const originalVal = (node as any).__vxpOrigText || node.nodeValue || '';
                const leadingSpace = originalVal.match(/^\s*/)?.[0] || '';
                const trailingSpace = originalVal.match(/\s*$/)?.[0] || '';
                node.nodeValue = leadingSpace + translatedText + trailingSpace;
              }
            } catch {}
          });
        }
      });
    } finally {
      isApplyingRef.current = false;
    }
  };

  // Procesar un nodo de texto individual
  const processTextNode = (node: Node) => {
    // Si no es nodo de texto o está dentro de elementos a ignorar
    const parent = node.parentElement;
    if (!parent) return;

    const tagName = parent.tagName.toLowerCase();
    if (
      tagName === 'script' ||
      tagName === 'style' ||
      tagName === 'code' ||
      tagName === 'pre' ||
      tagName === 'svg' ||
      tagName === 'path' ||
      parent.closest('#language-toggle-btn') ||
      parent.closest('.notranslate') ||
      parent.getAttribute('translate') === 'no'
    ) {
      return;
    }

    const rawValue = node.nodeValue || '';
    const trimmed = rawValue.trim();

    if (!trimmed || !SPANISH_LETTER_REGEX.test(trimmed)) {
      return;
    }

    // Si parece ser un timestamp puro, ID hex o código CSS, omitir
    if (/^[0-9:\-\s]+$/.test(trimmed) || /^[a-f0-9]{20,}$/i.test(trimmed)) {
      return;
    }

    // Guardar original en el nodo
    if ((node as any).__vxpOrigText === undefined) {
      (node as any).__vxpOrigText = rawValue;
      trackedTextNodesRef.current.add(node);
    }

    const origText = (node as any).__vxpOrigText.trim();

    // Registrar el nodo en el mapa para ese texto original
    if (!nodeMapRef.current.has(origText)) {
      nodeMapRef.current.set(origText, new Set());
    }
    nodeMapRef.current.get(origText)!.add(node);

    // Si ya tenemos traducción rápida o en memoria, aplicarla de inmediato
    const known = getKnownTranslation(origText);
    if (known) {
      const leadingSpace = rawValue.match(/^\s*/)?.[0] || '';
      const trailingSpace = rawValue.match(/\s*$/)?.[0] || '';
      node.nodeValue = leadingSpace + known + trailingSpace;
      return;
    }

    // Si no, agregar a la cola para traducción
    pendingTextsSetRef.current.add(origText);
  };

  // Procesar atributos de elementos (placeholder, title, aria-label)
  const processElementAttributes = (el: Element) => {
    if (el.closest('#language-toggle-btn') || el.closest('.notranslate')) return;

    const origAttrs = (el as any).__vxpOrigAttrs || {};
    let needsTracking = false;

    // Placeholder
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.type !== 'password' && el.type !== 'email' && el.placeholder) {
        if (origAttrs.placeholder === undefined) {
          origAttrs.placeholder = el.placeholder;
          needsTracking = true;
        }
        const trimmed = origAttrs.placeholder.trim();
        const known = getKnownTranslation(trimmed);
        if (known) {
          el.placeholder = known;
        } else if (SPANISH_LETTER_REGEX.test(trimmed)) {
          pendingTextsSetRef.current.add(trimmed);
        }
      }
    }

    // Title
    const title = el.getAttribute('title');
    if (title && SPANISH_LETTER_REGEX.test(title)) {
      if (origAttrs.title === undefined) {
        origAttrs.title = title;
        needsTracking = true;
      }
      const trimmed = origAttrs.title.trim();
      const known = getKnownTranslation(trimmed);
      if (known) {
        el.setAttribute('title', known);
      } else {
        pendingTextsSetRef.current.add(trimmed);
      }
    }

    // Aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && SPANISH_LETTER_REGEX.test(ariaLabel)) {
      if (origAttrs.ariaLabel === undefined) {
        origAttrs.ariaLabel = ariaLabel;
        needsTracking = true;
      }
      const trimmed = origAttrs.ariaLabel.trim();
      const known = getKnownTranslation(trimmed);
      if (known) {
        el.setAttribute('aria-label', known);
      } else {
        pendingTextsSetRef.current.add(trimmed);
      }
    }

    if (needsTracking) {
      (el as any).__vxpOrigAttrs = origAttrs;
      trackedElementsRef.current.add(el);
    }
  };

  // Escanear todo el DOM recursivamente
  const scanSubtree = (root: Node) => {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      processElementAttributes(root as Element);
    }

    // Usar TreeWalker para máxima velocidad de recorrido
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            if (el.id === 'language-toggle-btn' || el.classList?.contains('notranslate')) {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        processTextNode(currentNode);
      } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
        processElementAttributes(currentNode as Element);
      }
      currentNode = walker.nextNode();
    }
  };

  useEffect(() => {
    if (language === 'es') {
      // Restaurar original de inmediato
      restoreOriginalSpanish();
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    // Si el idioma es 'en':
    // 1. Escaneo inicial de todo el body
    scanSubtree(document.body);

    // Disparar traducción de lo que esté pendiente
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      dispatchBatchTranslation();
    }, 120);

    // 2. Observar mutaciones dinámicas (cambios de ruta, modales, listas, clicks)
    const observer = new MutationObserver((mutations) => {
      if (isApplyingRef.current || language !== 'en') return;

      let hasNewNodes = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            scanSubtree(node);
            hasNewNodes = true;
          });
        } else if (mutation.type === 'characterData') {
          if (mutation.target && (mutation.target as any).__vxpOrigText === undefined) {
            processTextNode(mutation.target);
            hasNewNodes = true;
          }
        }
      });

      if (hasNewNodes) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          dispatchBatchTranslation();
        }, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [language]);

  return null;
};
