import React, { useState, useEffect } from 'react';
import { StadiumStand, MenuItem, UserProfile, FoodOrderItem } from '../../types';
import { getStadiumStands, getMenuItemsByStand } from '../../lib/stands';
import { createFoodOrder } from '../../lib/foodOrders';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Utensils,
  ShoppingBag,
  Clock,
  MapPin,
  Plus,
  Minus,
  CheckCircle2,
  Coffee,
  Sparkles,
  ArrowRight,
  X,
  Store,
} from 'lucide-react';

interface MenuStandProps {
  user: UserProfile;
  onOrderSuccess?: () => void;
}

export const MenuStand: React.FC<MenuStandProps> = ({ user, onOrderSuccess }) => {
  const [stands, setStands] = useState<StadiumStand[]>([]);
  const [selectedStand, setSelectedStand] = useState<StadiumStand | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingStands, setLoadingStands] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [lastPlacedCode, setLastPlacedCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchStands = async () => {
      setLoadingStands(true);
      try {
        const data = await getStadiumStands();
        setStands(data);
        if (data.length > 0) {
          setSelectedStand(data[0]);
        }
      } catch (err) {
        console.error('Error fetching stands:', err);
      } finally {
        setLoadingStands(false);
      }
    };
    fetchStands();
  }, []);

  useEffect(() => {
    if (!selectedStand) return;
    const fetchMenu = async () => {
      setLoadingMenu(true);
      try {
        const items = await getMenuItemsByStand(selectedStand.id);
        setMenuItems(items);
      } catch (err) {
        console.error('Error fetching menu items:', err);
      } finally {
        setLoadingMenu(false);
      }
    };
    fetchMenu();
  }, [selectedStand]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.item.id === itemId) {
            return { ...c, quantity: c.quantity + delta };
          }
          return c;
        })
        .filter((c) => c.quantity > 0);
    });
  };

  const total = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  const totalCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedStand) return;
    setPlacingOrder(true);
    try {
      const foodItems: FoodOrderItem[] = cart.map((c) => ({
        itemId: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.quantity,
      }));

      const order = await createFoodOrder({
        standId: selectedStand.id,
        standName: selectedStand.name,
        userId: user.uid,
        customerName: user.displayName || 'Aficionado Teodoro Mariscal',
        items: foodItems,
        total,
        paymentMethod: 'Tarjeta de Crédito / Débito',
      });

      setLastPlacedCode(order.pickupCode);
      setCart([]);
      if (onOrderSuccess) onOrderSuccess();
    } catch (err) {
      console.error('Error placing food order:', err);
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Pickup Express */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-700 via-amber-800 to-red-950 text-white p-6 sm:p-8 border border-amber-600/40 shadow-lg">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-xs border border-white/20 text-amber-200">
            <Sparkles className="w-3.5 h-3.5" /> Pickup Express • Estadio Teodoro Mariscal
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Pide desde tu Asiento & Recoge sin Filas
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/90 max-w-xl">
            Ordena aguachiles, tacos de asada, hamburguesas o cerveza de barril. Recibirás tu código express para retirar en la barra cuando tu pedido esté listo.
          </p>
        </div>
      </div>

      {lastPlacedCode && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <h3 className="font-extrabold text-sm text-emerald-900">
                ¡Orden Enviada a Cocina con Éxito!
              </h3>
            </div>
            <button
              onClick={() => setLastPlacedCode(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 underline font-semibold"
            >
              Cerrar
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-emerald-200">
            <div>
              <p className="text-xs text-slate-500">Tu código para recoger en mostrador es:</p>
              <p className="text-2xl font-black text-emerald-700 tracking-wider font-mono">
                {lastPlacedCode}
              </p>
            </div>
            <p className="text-xs text-slate-600">
              Pasa al mostrador cuando la pantalla o tu pestaña "Mis Pedidos" marque <strong>LISTO</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Selector de Puestos del Estadio */}
      {loadingStands ? (
        <LoadingSpinner message="Localizando puestos de comida en el estadio..." />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-red-700" /> Puestos Activos en el Estadio
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stands.map((stand) => (
              <button
                key={stand.id}
                onClick={() => {
                  setSelectedStand(stand);
                  setCart([]);
                }}
                className={`p-3.5 rounded-xl text-left border transition-all flex items-start gap-3 ${
                  selectedStand?.id === stand.id
                    ? 'bg-white border-red-700 shadow-md ring-2 ring-red-700/20'
                    : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                <img
                  src={stand.image}
                  alt={stand.name}
                  className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{stand.name}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-red-600 shrink-0" />
                    <span className="truncate">{stand.location}</span>
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 mt-1">
                    <Clock className="w-3 h-3" /> ~{stand.estimatedWaitMinutes} min
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menú y Carrito */}
      {selectedStand && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Menú del puesto seleccionado */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">{selectedStand.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-red-600" /> {selectedStand.location}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {selectedStand.categoryTag}
              </span>
            </div>

            {loadingMenu ? (
              <LoadingSpinner message="Cargando menú del puesto..." />
            ) : menuItems.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
                No hay productos disponibles en este puesto en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors flex gap-3 justify-between"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-slate-900">{item.name}</h4>
                        {!item.available && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                            Agotado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-xs font-black text-red-900">
                          ${item.price.toLocaleString('es-MX')} MXN
                        </span>
                        {item.available && (
                          <button
                            onClick={() => addToCart(item)}
                            className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Agregar
                          </button>
                        )}
                      </div>
                    </div>

                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover bg-slate-100 shrink-0 self-center"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrito de Pickup Express */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 h-fit sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                <ShoppingBag className="w-4 h-4 text-red-700" />
                <span>Comanda Express</span>
              </div>
              <span className="text-xs text-slate-500 font-semibold">{totalCount} platillos</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Utensils className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">Selecciona platillos del menú</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {cart.map((c) => (
                  <div
                    key={c.item.id}
                    className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{c.item.name}</p>
                      <p className="text-[11px] text-red-800 font-semibold">
                        ${(c.item.price * c.quantity).toLocaleString('es-MX')} MXN
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md p-0.5">
                      <button
                        onClick={() => updateCartQty(c.item.id, -1)}
                        className="p-1 text-slate-600 hover:text-red-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold px-1">{c.quantity}</span>
                      <button
                        onClick={() => updateCartQty(c.item.id, 1)}
                        className="p-1 text-slate-600 hover:text-red-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-sm font-black text-slate-900">
                <span>Total:</span>
                <span className="text-red-900">${total.toLocaleString('es-MX')} MXN</span>
              </div>

              <button
                disabled={cart.length === 0 || placingOrder}
                onClick={handleCheckout}
                className="w-full py-3 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {placingOrder ? (
                  'Generando Código de Retiro...'
                ) : (
                  <>
                    <span>Confirmar y Pagar Orden</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
