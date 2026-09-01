import React, { useState, useEffect } from 'react';
import { InventoryProduct, UserProfile, OrderItem, ShippingAddress } from '../../types';
import { getInventoryProducts, adjustProductStock } from '../../lib/inventory';
import { createMerchOrder } from '../../lib/logistics';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ErrorMessage } from '../../components/shared/ErrorMessage';
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
} from 'lucide-react';

interface TiendaMerchProps {
  user: UserProfile;
  onOrderCompleted?: () => void;
}

export const TiendaMerch: React.FC<TiendaMerchProps> = ({ user, onOrderCompleted }) => {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<{ product: InventoryProduct; size: string; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

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
  const [paymentMethod, setPaymentMethod] = useState<'Tarjeta' | 'Transferencia SPEI' | 'MercadoPago' | 'Efectivo en Tienda'>('Tarjeta');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await getInventoryProducts();
      setProducts(data);
    } catch (err: any) {
      console.error('Error cargando catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setSubmittingOrder(true);

    try {
      const orderItems: OrderItem[] = cart.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        price: item.product.price,
        quantity: item.quantity,
        size: item.size,
        image: item.product.image,
      }));

      await createMerchOrder({
        userId: user.uid,
        customerName: address.recipientName || user.displayName || 'Aficionado Venados',
        customerEmail: user.email || 'aficionado@venados.com',
        customerPhone: address.phone,
        items: orderItems,
        subtotal,
        shippingCost,
        total,
        shippingType,
        shippingAddress: shippingType === 'domicilio' ? address : undefined,
        carrier: shippingType === 'domicilio' ? 'DHL Express' : 'Recoger en Tienda Estadio',
        status: 'pendiente',
        paymentMethod,
        paymentStatus: 'pagado',
        notes: shippingType === 'tienda' ? 'Recoger en tienda oficial Estadio Teodoro Mariscal' : undefined,
      });

      // Reducir stock de los productos adquiridos
      for (const item of cart) {
        await adjustProductStock(item.product.id, -item.quantity);
      }

      setCart([]);
      setIsCheckingOut(false);
      setIsCartOpen(false);
      setOrderSuccess(`¡Pedido confirmado con éxito! Total: $${total.toLocaleString('es-MX')} MXN. Puedes seguir el envío en la pestaña "Mis Pedidos".`);
      fetchProducts();
      if (onOrderCompleted) onOrderCompleted();
    } catch (err: any) {
      console.error('Error al procesar pedido:', err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de la Tienda Oficial */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-red-950 to-slate-900 text-white p-6 sm:p-8 border border-red-900/40 shadow-lg">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-red-700/60 text-red-200 border border-red-500/30">
              <ShoppingBag className="w-3.5 h-3.5" /> Tienda Oficial Venados Store
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Equipamiento & Souvenirs Oficiales
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Viste con orgullo los colores del puerto. Envíos a todo México o retiro express en la tienda del Estadio Teodoro Mariscal.
            </p>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative px-5 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2.5 shadow-lg transition-all self-start sm:self-auto"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Mi Carrito</span>
            {totalItemsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-red-900 text-xs font-extrabold flex items-center justify-center">
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
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === cat
                ? 'bg-red-800 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Catálogo de Productos */}
      {loading ? (
        <LoadingSpinner message="Cargando catálogo oficial de Venados..." />
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-2">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No hay productos en esta categoría</p>
          <p className="text-xs">Prueba seleccionando otra categoría o regresa más tarde.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between group"
            >
              <div>
                <div className="relative h-52 bg-slate-100 overflow-hidden">
                  <img
                    src={prod.image}
                    alt={prod.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {prod.category}
                  </div>
                  {prod.stock <= prod.minStockAlert && (
                    <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                      ¡Últimas {prod.stock} pzas!
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-2">
                  <div className="text-[11px] text-slate-400 font-mono">SKU: {prod.sku}</div>
                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-2">
                    {prod.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {prod.description}
                  </p>

                  {prod.sizes && prod.sizes.length > 0 && (
                    <div className="pt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 mr-1">Tallas:</span>
                      {prod.sizes.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded border border-slate-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between gap-3 mt-3">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Precio</span>
                  <span className="text-lg font-black text-red-900">
                    ${prod.price.toLocaleString('es-MX')} <span className="text-xs font-semibold text-slate-500">MXN</span>
                  </span>
                </div>

                <button
                  disabled={prod.stock <= 0}
                  onClick={() => addToCart(prod)}
                  className="px-4 py-2.5 bg-red-700 hover:bg-red-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Header del Carrito */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-sm">Tu Carrito ({totalItemsCount} artículos)</h3>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckingOut(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Carrito o Checkout */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-3">
                  <ShoppingCart className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold">Tu carrito está vacío</p>
                  <p className="text-xs">Agrega jerseys, gorras o souvenirs para continuar.</p>
                </div>
              ) : isCheckingOut ? (
                /* Formulario de Checkout */
                <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4 text-xs">
                  <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-900">
                    <p className="font-bold flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-red-700" /> Método de Entrega
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setShippingType('domicilio')}
                        className={`p-2.5 rounded-lg border text-left font-semibold ${
                          shippingType === 'domicilio'
                            ? 'bg-white border-red-700 text-red-900 shadow-xs'
                            : 'bg-red-100/50 border-transparent text-slate-700'
                        }`}
                      >
                        <p className="font-bold">Envío a Domicilio</p>
                        <span className="text-[10px] text-slate-500 block">DHL / Paquetexpress</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShippingType('tienda')}
                        className={`p-2.5 rounded-lg border text-left font-semibold ${
                          shippingType === 'tienda'
                            ? 'bg-white border-red-700 text-red-900 shadow-xs'
                            : 'bg-red-100/50 border-transparent text-slate-700'
                        }`}
                      >
                        <p className="font-bold">Recoger en Tienda</p>
                        <span className="text-[10px] text-slate-500 block">Estadio Teodoro M.</span>
                      </button>
                    </div>
                  </div>

                  {shippingType === 'domicilio' && (
                    <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-800">Dirección de Envío</p>
                      <div>
                        <label className="block text-slate-600 mb-0.5">Nombre de quien recibe</label>
                        <input
                          type="text"
                          required
                          value={address.recipientName}
                          onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="Ej. Juan Pérez"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-0.5">Calle y Número</label>
                        <input
                          type="text"
                          required
                          value={address.street}
                          onChange={(e) => setAddress({ ...address, street: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="Av. Ejército Mexicano 405"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-600 mb-0.5">Colonia</label>
                          <input
                            type="text"
                            required
                            value={address.neighborhood}
                            onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                            placeholder="Palos Prietos"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-0.5">Código Postal</label>
                          <input
                            type="text"
                            required
                            value={address.zipCode}
                            onChange={(e) => setAddress({ ...address, zipCode: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                            placeholder="82000"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-600 mb-0.5">Ciudad</label>
                          <input
                            type="text"
                            required
                            value={address.city}
                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-0.5">Teléfono</label>
                          <input
                            type="tel"
                            required
                            value={address.phone}
                            onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                            placeholder="669 123 4567"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Método de Pago</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-medium"
                    >
                      <option value="Tarjeta">Tarjeta de Crédito / Débito (Visa, MC, Amex)</option>
                      <option value="MercadoPago">Mercado Pago / Billetera Digital</option>
                      <option value="Transferencia SPEI">Transferencia Bancaria SPEI</option>
                      {shippingType === 'tienda' && <option value="Efectivo en Tienda">Efectivo al Recoger en Estadio</option>}
                    </select>
                  </div>
                </form>
              ) : (
                /* Lista de Items en Carrito */
                <div className="space-y-3">
                  {cart.map((item, idx) => (
                    <div key={`${item.product.id}-${item.size}`} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <img src={item.product.image} alt={item.product.name} className="w-16 h-16 object-cover rounded-lg bg-white" />
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">{item.product.name}</p>
                        <p className="text-[11px] text-slate-500">Talla: <strong className="text-slate-800">{item.size}</strong></p>
                        <p className="text-xs font-black text-red-900">${(item.product.price * item.quantity).toLocaleString('es-MX')} MXN</p>
                      </div>
                      <div className="flex flex-col items-center justify-between">
                        <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg p-0.5">
                          <button onClick={() => updateCartQty(idx, -1)} className="p-1 text-slate-500 hover:text-red-700">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold px-1.5">{item.quantity}</span>
                          <button onClick={() => updateCartQty(idx, 1)} className="p-1 text-slate-500 hover:text-red-700">
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
              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${subtotal.toLocaleString('es-MX')} MXN</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Envío:</span>
                    <span>{shippingCost === 0 ? <strong className="text-emerald-600">GRATIS</strong> : `$${shippingCost} MXN`}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total a Pagar:</span>
                    <span className="text-red-900">${total.toLocaleString('es-MX')} MXN</span>
                  </div>
                </div>

                {isCheckingOut ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCheckingOut(false)}
                      className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={submittingOrder}
                      className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2"
                    >
                      {submittingOrder ? 'Procesando Pedido...' : `Confirmar y Pagar $${total.toLocaleString('es-MX')} MXN`}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCheckingOut(true)}
                    className="w-full py-3 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
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
    </div>
  );
};
