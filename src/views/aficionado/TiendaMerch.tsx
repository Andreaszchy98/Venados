import React, { useState, useEffect, useMemo } from 'react';
import { InventoryProduct, UserProfile, OrderItem, ShippingAddress } from '../../types';
import { getInventoryProducts, adjustProductStock } from '../../lib/inventory';
import { createMerchOrder } from '../../lib/logistics';
import { normalizeGoogleDriveImageUrl, getDefaultProductPlaceholder } from '../../lib/imageUtils';
import { getStadiumStoreProfile } from '../../lib/stadiumStoreProfiles';
import { useTheme } from '../../context/ThemeContext';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ErrorMessage } from '../../components/shared/ErrorMessage';
import { CardPaymentModal } from '../../components/shared/CardPaymentModal';
import { DirectPaymentResult } from '../../lib/stripe';
import {
  ShoppingBag,
  ShoppingCart,
  CheckCircle2,
  Truck,
  Building,
  Tag,
  Filter,
  X,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Package,
  Maximize2,
} from 'lucide-react';

interface TiendaMerchProps {
  user: UserProfile;
  onOrderCompleted?: () => void;
  onRequireAuth?: () => void;
}

export const TiendaMerch: React.FC<TiendaMerchProps> = ({ user, onOrderCompleted, onRequireAuth }) => {
  const { theme } = useTheme();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<{ product: InventoryProduct; size: string; quantity: number }[]>(() => {
    try {
      const saved = sessionStorage.getItem('vxp_merch_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string; category?: string } | null>(null);

  // Sincronizar carrito con sessionStorage para no perder artículos ante recarga o inicio de sesión
  useEffect(() => {
    try {
      if (cart.length > 0) {
        sessionStorage.setItem('vxp_merch_cart', JSON.stringify(cart));
      } else {
        sessionStorage.removeItem('vxp_merch_cart');
      }
    } catch (e) {
      console.warn('Error guardando carrito de merch en sessionStorage:', e);
    }
  }, [cart]);

  // Formulario de Envío
  const [shippingType, setShippingType] = useState<'domicilio' | 'tienda'>('domicilio');
  const [address, setAddress] = useState<ShippingAddress>({
    recipientName: user.displayName || '',
    street: '',
    neighborhood: '',
    city: 'Mazatlán',
    state: 'Sinaloa',
    zipCode: '82000',
    phone: user.phoneNumber || '',
    referenceNotes: '',
  });
  // Método de pago exclusivo por tarjeta
  const [paymentMethod] = useState<'Tarjeta'>('Tarjeta');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  // Perfil de marca e identidad de la tienda del estadio actual (usa browsingVenueId de navegación)
  const activeVenueId = user.browsingVenueId || user.venueId;
  const storeProfile = useMemo(() => {
    return getStadiumStoreProfile(activeVenueId);
  }, [activeVenueId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await getInventoryProducts(activeVenueId);
      setProducts(data);
    } catch (err: any) {
      console.error('Error cargando catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [activeVenueId]);

  const categories = ['Todos', 'Jerseys', 'Gorras', 'Sudaderas', 'Souvenirs', 'Coleccionables'];

  const filteredProducts = products.filter((p) => {
    if (!p.active) return false;
    if (selectedCategory === 'Todos') return true;
    return p.category === selectedCategory;
  });

  const addToCart = (product: InventoryProduct, size?: string) => {
    const selectedSize = size || (product.sizes && product.sizes.length > 0 ? product.sizes[0] : 'Unitalla');
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id && item.size === selectedSize);
      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex].quantity += 1;
        return copy;
      }
      return [...prev, { product, size: selectedSize, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart((prev) => {
      const copy = [...prev];
      copy[index].quantity += delta;
      if (copy[index].quantity <= 0) {
        copy.splice(index, 1);
      }
      return copy;
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingCost = shippingType === 'domicilio' ? (subtotal > 1500 ? 0 : 120) : 0;
  const total = subtotal + shippingCost;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const executeOrderSubmission = async (paymentDetails?: DirectPaymentResult) => {
    setSubmittingOrder(true);

    try {
      const orderItems: OrderItem[] = cart.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        price: item.product.price,
        quantity: item.quantity,
        size: item.size,
        image: normalizeGoogleDriveImageUrl(item.product.image) || getDefaultProductPlaceholder(item.product.category),
      }));

      const orderPayload: Parameters<typeof createMerchOrder>[0] = {
        venueId: activeVenueId || 'venue-teodoro-mariscal',
        userId: user.uid,
        customerName: address.recipientName?.trim() || user.displayName || 'Aficionado Venados',
        customerEmail: user.email || 'aficionado@venados.com',
        items: orderItems,
        subtotal,
        shippingCost,
        total,
        shippingType,
        carrier: shippingType === 'domicilio' ? 'DHL Express' : 'Recoger en Tienda Estadio',
        status: 'pendiente',
        paymentMethod: paymentMethod === 'Tarjeta' ? 'Tarjeta en Línea' : paymentMethod,
        paymentStatus: 'pagado',
      };

      if (address.phone?.trim()) {
        orderPayload.customerPhone = address.phone.trim();
      }

      if (shippingType === 'domicilio') {
        orderPayload.shippingAddress = {
          recipientName: address.recipientName?.trim() || user.displayName || `Aficionado ${storeProfile.teamName}`,
          street: address.street || '',
          neighborhood: address.neighborhood || '',
          city: address.city || 'Mazatlán',
          state: address.state || 'Sinaloa',
          zipCode: address.zipCode || '',
          phone: address.phone || '',
          ...(address.referenceNotes?.trim() ? { referenceNotes: address.referenceNotes.trim() } : {}),
        };
      } else {
        orderPayload.notes = `Recoger en ${storeProfile.pickupLocation}`;
      }

      if (paymentDetails) {
        orderPayload.notes = (orderPayload.notes ? orderPayload.notes + ' | ' : '') +
          `Pago tarjeta: ${paymentDetails.cardBrand} ****${paymentDetails.cardLast4} (Auth: ${paymentDetails.authCode})`;
      }

      await createMerchOrder(orderPayload);

      // Si es administrador, reducir stock directamente; para aficionados, el almacén lo gestiona en logística
      if (user.role === 'admin') {
        for (const item of cart) {
          try {
            await adjustProductStock(item.product.id, -item.quantity);
          } catch {
            // Manejo silencioso en caso de error
          }
        }
      }

      setCart([]);
      try {
        sessionStorage.removeItem('vxp_merch_cart');
      } catch {}
      setIsCheckingOut(false);
      setIsCartOpen(false);
      setOrderSuccess(
        `¡Pedido confirmado con éxito! Total: $${total.toLocaleString('es-MX')} MXN.${
          paymentDetails ? ` Pago aprobado con tarjeta ${paymentDetails.cardBrand} terminación ${paymentDetails.cardLast4}.` : ''
        } Puedes seguir el envío en la pestaña "Mis Pedidos".`
      );
      fetchProducts();
      if (onOrderCompleted) onOrderCompleted();
    } catch (err: any) {
      console.error('Error al procesar pedido:', err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    // Si el usuario no tiene sesión iniciada, solicitamos login manteniendo su carrito intacto
    if (!user || !user.uid) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    // Método exclusivo: abrir pasarela interactiva de pago con tarjeta en línea
    setIsCardModalOpen(true);
  };

  const handleCardPaymentSuccess = async (result: DirectPaymentResult) => {
    setIsCardModalOpen(false);
    await executeOrderSubmission(result);
  };

  return (
    <div className="space-y-6">
      {/* Banner de la Tienda Oficial */}
      <div
        data-theme-surface="dark"
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${storeProfile.headerGradient} text-white p-6 sm:p-8 border shadow-lg`}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-xs ${storeProfile.accentBadgeClass}`}>
              <ShoppingBag className="w-3.5 h-3.5" /> {storeProfile.badgeLabel}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight !text-white text-white">
              {storeProfile.headline}
            </h2>
            <p className="text-xs sm:text-sm !text-[#E2E8F0] text-slate-200 max-w-xl leading-relaxed">
              {storeProfile.tagline}
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-4 text-xs !text-[#E2E8F0] text-slate-200 font-sports">
              <span className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-amber-300" />
                <span>Retiro en: <strong className="!text-white text-white font-bold">{storeProfile.pickupLocation}</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-300" />
                <span>Envíos a todo México por paquetería</span>
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className={`relative px-5 py-3 rounded-xl ${storeProfile.buttonClass} font-bold text-xs sm:text-sm flex items-center gap-2.5 shadow-lg transition-all self-start sm:self-auto cursor-pointer`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Mi Carrito</span>
            {totalItemsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-slate-900 text-xs font-extrabold flex items-center justify-center">
                {totalItemsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {orderSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{orderSuccess}</span>
          </div>
          <button
            onClick={() => setOrderSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg text-xs underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Selector de Categorías */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none font-sports">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              selectedCategory === cat
                ? 'bg-red-600 text-white shadow-md'
                : theme === 'light'
                ? 'bg-white text-slate-800 hover:text-slate-950 hover:bg-slate-100 border border-slate-300 shadow-xs'
                : 'bg-[#0F1626] text-slate-300 hover:text-white border border-slate-700/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Catálogo de Productos */}
      {loading ? (
        <LoadingSpinner message={`Cargando catálogo oficial de ${storeProfile.storeName}...`} />
      ) : filteredProducts.length === 0 ? (
        <div className={`border rounded-2xl p-12 text-center space-y-2 ${
          theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#0F1626] border-slate-700/80 text-slate-400'
        }`}>
          <Package className="w-10 h-10 text-slate-500 mx-auto" />
          <p className={`text-sm font-bold font-sports uppercase tracking-wide ${
            theme === 'light' ? 'text-slate-900' : 'text-white'
          }`}>No hay productos en esta categoría</p>
          <p className="text-xs text-slate-500">Prueba seleccionando otra categoría o regresa más tarde.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between group ${
                theme === 'light'
                  ? 'bg-white border-slate-200 shadow-sm hover:border-red-600/50 hover:shadow-md'
                  : 'bg-[#0F1626] border-slate-700/80 shadow-xl hover:border-red-600/50 hover:shadow-red-950/20'
              }`}
            >
              <div>
                {(() => {
                  const resolvedImg = normalizeGoogleDriveImageUrl(prod.image) || getDefaultProductPlaceholder(prod.category);
                  return (
                    <div
                      className="relative h-64 sm:h-72 bg-[#060911] p-4 flex items-center justify-center overflow-hidden border-b border-slate-700/60 cursor-pointer group/img"
                      onClick={() => setPreviewImage({ src: resolvedImg, title: prod.name, category: prod.category })}
                    >
                      {/* Fondo de brillo ambiental suave */}
                      <img
                        src={resolvedImg}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-md opacity-25 scale-110 pointer-events-none"
                        referrerPolicy="no-referrer"
                      />

                      {/* Imagen de mercancía completa sin recortar */}
                      <img
                        src={resolvedImg}
                        alt={prod.name}
                        className="relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-md"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = getDefaultProductPlaceholder(prod.category);
                        }}
                      />

                      {/* Botón para inspeccionar imagen en grande */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage({ src: resolvedImg, title: prod.name, category: prod.category });
                        }}
                        className="absolute bottom-3 right-3 p-2 bg-[#0F1626]/90 hover:bg-red-600 border border-slate-700 hover:border-red-500 rounded-lg text-white shadow-lg opacity-0 group-hover/img:opacity-100 transition-all z-20 flex items-center gap-1.5 text-[11px] font-sports font-bold tracking-wider cursor-pointer"
                        title="Ver imagen completa"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">AMPLIAR</span>
                      </button>

                      <div className="absolute top-3 left-3 bg-[#0A0E17]/90 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-slate-700 font-sports z-20">
                        {prod.category}
                      </div>
                      {prod.stock <= prod.minStockAlert && (
                        <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs font-sports uppercase z-20">
                          ¡Últimas {prod.stock} pzas!
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="p-5 space-y-2">
                  <div className={`text-[11px] font-mono ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>SKU: {prod.sku}</div>
                  <h3 className={`font-extrabold text-sm leading-snug line-clamp-2 font-sports tracking-wide ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>
                    {prod.name}
                  </h3>
                  <p className={`text-xs line-clamp-2 leading-relaxed ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                  }`}>
                    {prod.description}
                  </p>

                  {prod.sizes && prod.sizes.length > 0 && (
                    <div className="pt-2 flex flex-wrap items-center gap-1.5 font-sports">
                      <span className={`text-[11px] mr-1 uppercase ${
                        theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                      }`}>Tallas:</span>
                      {prod.sizes.map((s) => (
                        <span
                          key={s}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                            theme === 'light'
                              ? 'bg-slate-100 text-slate-800 border-slate-300'
                              : 'bg-[#141C2E] text-slate-200 border-slate-700'
                          }`}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={`p-5 pt-0 border-t flex items-center justify-between gap-3 mt-3 ${
                theme === 'light' ? 'border-slate-200' : 'border-slate-700/70'
              }`}>
                <div>
                  <span className={`text-[11px] block font-sports uppercase tracking-wider ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}>Precio</span>
                  <span className={`text-lg font-black font-scoreboard ${
                    theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                  }`}>
                    ${prod.price.toLocaleString('es-MX')} <span className={`text-xs font-semibold font-sans ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>MXN</span>
                  </span>
                </div>

                <button
                  disabled={prod.stock <= 0}
                  onClick={() => addToCart(prod)}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 font-sports uppercase tracking-wider cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {prod.stock <= 0 ? 'Agotado' : 'Agregar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Carrito Lateral / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md h-full border-l shadow-2xl flex flex-col justify-between overflow-hidden ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}>
            {/* Header del Carrito */}
            <div className={`p-5 border-b flex items-center justify-between ${
              theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#0A0E17] border-slate-700/80 text-white'
            }`}>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-sm font-sports tracking-wide uppercase">Tu Carrito ({totalItemsCount} artículos)</h3>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckingOut(false);
                }}
                className={`p-1 rounded-lg cursor-pointer ${
                  theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Carrito o Checkout */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16 space-y-3 font-sports">
                  <ShoppingCart className={`w-12 h-12 mx-auto ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`} />
                  <p className={`text-sm font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-slate-300'}`}>Tu carrito está vacío</p>
                  <p className={`text-xs font-sans ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Agrega jerseys, gorras o souvenirs para continuar.</p>
                </div>
              ) : isCheckingOut ? (
                /* Formulario de Checkout */
                <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4 text-xs font-sports">
                  <div className={`p-3 rounded-xl border ${
                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#0A0E17] border-slate-700/80 text-white'
                  }`}>
                    <p className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                    }`}>
                      <Truck className="w-4 h-4 text-red-500" /> Método de Entrega
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setShippingType('domicilio')}
                        className={`p-2.5 rounded-lg border text-left font-semibold cursor-pointer transition-all ${
                          shippingType === 'domicilio'
                            ? theme === 'light'
                              ? 'bg-red-50 border-red-500 text-red-950 shadow-xs'
                              : 'bg-red-950/40 border-red-500 text-white shadow-xs'
                            : theme === 'light'
                            ? 'bg-white border-slate-300 text-slate-700 hover:text-slate-900'
                            : 'bg-[#141C2E] border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <p className="font-bold uppercase">Envío a Domicilio</p>
                        <span className={`text-[10px] block font-sans ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>DHL / Paquetexpress</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShippingType('tienda')}
                        className={`p-2.5 rounded-lg border text-left font-semibold cursor-pointer transition-all ${
                          shippingType === 'tienda'
                            ? theme === 'light'
                              ? 'bg-red-50 border-red-500 text-red-950 shadow-xs'
                              : 'bg-red-950/40 border-red-500 text-white shadow-xs'
                            : theme === 'light'
                            ? 'bg-white border-slate-300 text-slate-700 hover:text-slate-900'
                            : 'bg-[#141C2E] border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <p className="font-bold uppercase">Recoger en Tienda</p>
                        <span className={`text-[10px] block truncate font-sans ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{storeProfile.stadiumName}</span>
                      </button>
                    </div>
                  </div>

                  {shippingType === 'domicilio' && (
                    <div className={`space-y-2.5 p-3 rounded-xl border font-sans ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#0A0E17] border-slate-700/80 text-slate-300'
                    }`}>
                      <p className={`font-bold font-sports uppercase tracking-wider ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Dirección de Envío</p>
                      <div>
                        <label className={`block mb-0.5 text-[11px] ${theme === 'light' ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>Nombre de quien recibe</label>
                        <input
                          type="text"
                          required
                          value={address.recipientName}
                          onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
                          className={`w-full p-2 border rounded-lg focus:outline-hidden focus:border-red-500 ${
                            theme === 'light'
                              ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                              : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                          }`}
                          placeholder="Ej. Juan Pérez"
                        />
                      </div>
                      <div>
                        <label className={`block mb-0.5 text-[11px] ${theme === 'light' ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>Calle y Número</label>
                        <input
                          type="text"
                          required
                          value={address.street}
                          onChange={(e) => setAddress({ ...address, street: e.target.value })}
                          className={`w-full p-2 border rounded-lg focus:outline-hidden focus:border-red-500 ${
                            theme === 'light'
                              ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                              : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                          }`}
                          placeholder="Av. Ejército Mexicano 405"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={`block mb-0.5 text-[11px] ${theme === 'light' ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>Colonia</label>
                          <input
                            type="text"
                            required
                            value={address.neighborhood}
                            onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                            className={`w-full p-2 border rounded-lg focus:outline-hidden focus:border-red-500 ${
                              theme === 'light'
                                ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                                : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                            }`}
                            placeholder="Palos Prietos"
                          />
                        </div>
                        <div>
                          <label className={`block mb-0.5 text-[11px] ${theme === 'light' ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>Código Postal</label>
                          <input
                            type="text"
                            required
                            value={address.zipCode}
                            onChange={(e) => setAddress({ ...address, zipCode: e.target.value })}
                            className={`w-full p-2 border rounded-lg focus:outline-hidden focus:border-red-500 ${
                              theme === 'light'
                                ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                                : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                            }`}
                            placeholder="82000"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={`block mb-0.5 text-[11px] ${theme === 'light' ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>Ciudad</label>
                          <input
                            type="text"
                            required
                            value={address.city}
                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                            className={`w-full p-2 border rounded-lg focus:outline-hidden focus:border-red-500 ${
                              theme === 'light'
                                ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                                : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block mb-0.5 text-[11px] ${theme === 'light' ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>Teléfono</label>
                          <input
                            type="tel"
                            required
                            value={address.phone}
                            onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                            className={`w-full p-2 border rounded-lg focus:outline-hidden focus:border-red-500 ${
                              theme === 'light'
                                ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                                : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                            }`}
                            placeholder="669 123 4567"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 font-sports">
                    <div className="flex items-center justify-between">
                      <label className={`block font-bold uppercase tracking-wider text-xs ${
                        theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                      }`}>
                        Método de Pago Autorizado
                      </label>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        🔒 Encriptación SSL 256-bit
                      </span>
                    </div>

                    <div className={`p-3.5 rounded-xl border-2 transition-all flex items-center justify-between ${
                      theme === 'light'
                        ? 'border-red-600 bg-red-50/70 text-red-950'
                        : 'border-red-500 bg-red-950/40 text-white'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center text-xl">
                          💳
                        </div>
                        <div>
                          <p className={`font-extrabold text-xs uppercase leading-tight ${
                            theme === 'light' ? 'text-slate-900' : 'text-white'
                          }`}>
                            Tarjeta en Línea (Débito o Crédito)
                          </p>
                          <p className={`text-[11px] mt-0.5 font-sans ${
                            theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                          }`}>
                            Visa, Mastercard, American Express • Cargo directo y seguro
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-red-600/20 text-red-600 dark:text-red-400 border border-red-500/30">
                        Exclusivo
                      </span>
                    </div>
                  </div>
                </form>
              ) : (
                /* Lista de Items en Carrito */
                <div className="space-y-3 font-sports">
                  {cart.map((item, idx) => (
                    <div
                      key={`${item.product.id}-${item.size}`}
                      className={`flex gap-3 p-3 rounded-xl border ${
                        theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#0A0E17] border-slate-700/80'
                      }`}
                    >
                      <img
                        src={normalizeGoogleDriveImageUrl(item.product.image) || getDefaultProductPlaceholder(item.product.category)}
                        alt={item.product.name}
                        className={`w-16 h-16 object-contain p-1 rounded-lg border shrink-0 ${
                          theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#060911] border-slate-700/80'
                        }`}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = getDefaultProductPlaceholder(item.product.category);
                        }}
                      />
                      <div className="flex-1 space-y-1">
                        <p className={`text-xs font-bold leading-snug line-clamp-1 ${
                          theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                        }`}>{item.product.name}</p>
                        <p className={`text-[11px] font-sans ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                          Talla: <strong className={theme === 'light' ? 'text-amber-800' : 'text-amber-400'}>{item.size}</strong>
                        </p>
                        <p className={`text-xs font-black font-scoreboard ${
                          theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                        }`}>
                          ${(item.product.price * item.quantity).toLocaleString('es-MX')} MXN
                        </p>
                      </div>
                      <div className="flex flex-col items-center justify-between">
                        <div className={`flex items-center gap-1.5 border rounded-lg p-0.5 ${
                          theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#141C2E] border-slate-700 text-white'
                        }`}>
                          <button
                            onClick={() => updateCartQty(idx, -1)}
                            className={`p-1 cursor-pointer ${
                              theme === 'light' ? 'text-slate-500 hover:text-red-600' : 'text-slate-400 hover:text-red-400'
                            }`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className={`text-xs font-bold px-1.5 font-mono ${
                            theme === 'light' ? 'text-slate-900' : 'text-white'
                          }`}>{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(idx, 1)}
                            className={`p-1 cursor-pointer ${
                              theme === 'light' ? 'text-slate-500 hover:text-emerald-600' : 'text-slate-400 hover:text-emerald-400'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer con Totales y Botón de Pago */}
            {cart.length > 0 && (
              <div className={`p-5 border-t space-y-3 font-sports ${
                theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#0A0E17] border-slate-700/80 text-white'
              }`}>
                <div className={`space-y-1.5 text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className={`font-semibold font-mono ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                      ${subtotal.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Envío:</span>
                    <span>
                      {shippingCost === 0 ? (
                        <strong className={theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}>GRATIS</strong>
                      ) : (
                        `$${shippingCost} MXN`
                      )}
                    </span>
                  </div>
                  <div className={`flex justify-between text-sm font-black pt-1 border-t ${
                    theme === 'light' ? 'border-slate-200 text-slate-900' : 'border-slate-700/80 text-white'
                  }`}>
                    <span className="uppercase tracking-wider">Total a Pagar:</span>
                    <span className={`font-scoreboard text-lg ${
                      theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                    }`}>
                      ${total.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                </div>

                {isCheckingOut ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCheckingOut(false)}
                      className={`px-4 py-2.5 border text-xs font-bold rounded-xl uppercase tracking-wider cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                          : 'bg-[#141C2E] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={submittingOrder}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                    >
                      {submittingOrder
                        ? 'Procesando Pedido...'
                        : !user || !user.uid
                        ? `Iniciar Sesión para Pagar $${total.toLocaleString('es-MX')} MXN`
                        : `Pagar con Tarjeta $${total.toLocaleString('es-MX')} MXN`}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCheckingOut(true)}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                  >
                    <span>Proceder al Pago</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal de Imagen Completa (Lightbox) */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#0F1626] border border-slate-700 rounded-2xl p-4 sm:p-6 flex flex-col items-center shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-700/80">
              <div>
                <span className="text-[10px] font-sports uppercase tracking-wider text-red-400 font-bold">
                  {previewImage.category || 'Mercancía Oficial'}
                </span>
                <h4 className="text-white font-sports font-extrabold text-base sm:text-lg">{previewImage.title}</h4>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 text-slate-400 hover:text-white bg-[#141C2E] hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Cerrar vista previa"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full max-h-[70vh] flex items-center justify-center p-4 bg-[#060911] rounded-xl border border-slate-800">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[60vh] max-w-full object-contain rounded-lg drop-shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal interactivo de Formulario de Pago con Tarjeta para la Tienda Oficial */}
      <CardPaymentModal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
        amount={total}
        concept={`Tienda Oficial ${storeProfile.teamName} — ${totalItemsCount} artículo(s)`}
        customerName={address.recipientName?.trim() || user.displayName || user.email || 'Aficionado'}
        customerEmail={user.email || undefined}
        orderType="tienda"
        metadata={{
          venueId: activeVenueId || 'venue-teodoro-mariscal',
          shippingType,
          itemsCount: String(totalItemsCount),
        }}
        onSuccess={handleCardPaymentSuccess}
      />
    </div>
  );
};
