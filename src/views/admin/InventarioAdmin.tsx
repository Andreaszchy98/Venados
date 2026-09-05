import React, { useState, useEffect } from 'react';
import { InventoryProduct, ProductCategory, UserProfile } from '../../types';
import {
  getInventoryProducts,
  saveInventoryProduct,
  adjustProductStock,
  deleteInventoryProduct,
  getProductCost,
  setProductCost,
} from '../../lib/inventory';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ConfirmationModal } from '../../components/shared/ConfirmationModal';
import {
  Boxes,
  Plus,
  Minus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  CheckCircle2,
  DollarSign,
  Package,
  TrendingDown,
  X,
  Save,
  ImageIcon,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  Eye,
  Store,
} from 'lucide-react';
import {
  normalizeGoogleDriveImageUrl,
  isGoogleDriveUrl,
  getDefaultProductPlaceholder,
  DEFAULT_STORE_PROMO_BANNER,
} from '../../lib/imageUtils';
import { getVenueById, updateVenueStorePromo } from '../../lib/venues';

interface InventarioAdminProps {
  user?: UserProfile;
}

export const InventarioAdmin: React.FC<InventarioAdminProps> = ({ user }) => {
  const venueId = user?.venueId || DEFAULT_VENUE_ID;
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [costsMap, setCostsMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<InventoryProduct> | null>(null);
  const [editingCostPrice, setEditingCostPrice] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<InventoryProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Estado para la configuración del Banner Promocional de la Tienda Oficial en el Hero de Login
  const [isStorePromoModalOpen, setIsStorePromoModalOpen] = useState(false);
  const [storePromoBannerUrl, setStorePromoBannerUrl] = useState('');
  const [storePromoTitle, setStorePromoTitle] = useState('Tienda Oficial Venados Store');
  const [storePromoSubtitle, setStorePromoSubtitle] = useState('Jerseys oficiales, gorras y souvenirs con entrega en tu butaca o envío a domicilio.');
  const [storePromoActive, setStorePromoActive] = useState(true);
  const [savingPromo, setSavingPromo] = useState(false);
  const [venueName, setVenueName] = useState('Estadio Teodoro Mariscal');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await getInventoryProducts(venueId);
      setProducts(data);

      // Cargar costos confidenciales desde la subcolección cost/data exclusiva de admin
      const costsPromises = data.map(async (p) => {
        const cost = await getProductCost(p.id);
        return { id: p.id, cost: cost ?? 0 };
      });
      const results = await Promise.all(costsPromises);
      const map: Record<string, number> = {};
      results.forEach((r) => {
        map[r.id] = r.cost;
      });
      setCostsMap(map);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVenuePromo = async () => {
    try {
      const venue = await getVenueById(venueId);
      if (venue) {
        setVenueName(venue.name || 'Estadio Teodoro Mariscal');
        setStorePromoBannerUrl(venue.storePromoBannerUrl || '');
        if (venue.storePromoTitle) setStorePromoTitle(venue.storePromoTitle);
        if (venue.storePromoSubtitle) setStorePromoSubtitle(venue.storePromoSubtitle);
        setStorePromoActive(venue.storePromoActive !== false);
      }
    } catch (err) {
      console.warn('Error fetching venue promo config:', err);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchVenuePromo();
  }, [venueId]);

  const handlePromoBannerChange = (val: string) => {
    const normalized = normalizeGoogleDriveImageUrl(val);
    setStorePromoBannerUrl(normalized);
    if (isGoogleDriveUrl(val) && normalized !== val) {
      setFeedbackMessage('Enlace de Google Drive detectado y transformado automáticamente a URL directa.');
    }
  };

  const handleResetPromoBanner = () => {
    setStorePromoBannerUrl(DEFAULT_STORE_PROMO_BANNER);
  };

  const handleSaveStorePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPromo(true);
    try {
      await updateVenueStorePromo(venueId, {
        storePromoBannerUrl: storePromoBannerUrl.trim(),
        storePromoTitle: storePromoTitle.trim(),
        storePromoSubtitle: storePromoSubtitle.trim(),
        storePromoActive,
      });
      setFeedbackMessage('¡Póster promocional de la Tienda Oficial actualizado exitosamente para el Hero de bienvenida!');
      setIsStorePromoModalOpen(false);
    } catch (err) {
      console.error('Error saving store promo:', err);
      setFeedbackMessage('Error al actualizar la promoción de la tienda oficial.');
    } finally {
      setSavingPromo(false);
    }
  };

  const handleStockDelta = async (productId: string, delta: number) => {
    try {
      const newStock = await adjustProductStock(productId, delta);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
      );
    } catch (err) {
      console.error('Error adjusting stock:', err);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProduct({
      sku: `VEN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      name: '',
      category: 'Jerseys',
      price: 999,
      stock: 20,
      minStockAlert: 5,
      sizes: ['S', 'M', 'L', 'XL'],
      image: getDefaultProductPlaceholder('Jerseys'),
      description: '',
      supplier: 'Venados Store Oficial',
      active: true,
    });
    setEditingCostPrice(450);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (product: InventoryProduct) => {
    const normalizedImg = normalizeGoogleDriveImageUrl(product.image) || getDefaultProductPlaceholder(product.category);
    setEditingProduct({
      ...product,
      image: normalizedImg,
    });
    const currentCost = costsMap[product.id] ?? (await getProductCost(product.id)) ?? 0;
    setEditingCostPrice(currentCost);
    setIsModalOpen(true);
  };

  const handleImageUrlChange = (val: string) => {
    const normalized = normalizeGoogleDriveImageUrl(val);
    setEditingProduct((prev) => (prev ? { ...prev, image: normalized } : null));
    if (isGoogleDriveUrl(val) && normalized !== val) {
      setFeedbackMessage('Enlace de Google Drive detectado y transformado automáticamente a URL directa.');
    }
  };

  const handleResetPlaceholder = () => {
    const defaultImg = getDefaultProductPlaceholder(editingProduct?.category);
    setEditingProduct((prev) => (prev ? { ...prev, image: defaultImg } : null));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name || !editingProduct.sku) return;
    setSaving(true);
    try {
      const saved = await saveInventoryProduct({
        ...editingProduct,
        venueId: editingProduct.venueId || venueId,
        costPrice: editingCostPrice,
      } as any);

      if (saved?.id) {
        setCostsMap((prev) => ({ ...prev, [saved.id]: editingCostPrice }));
      }

      setIsModalOpen(false);
      setFeedbackMessage('Producto guardado correctamente en inventario.');
      fetchInventory();
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDelete = (product: InventoryProduct) => {
    setProductToDelete(product);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      await deleteInventoryProduct(productToDelete.id);
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      setFeedbackMessage(`Producto "${productToDelete.name}" eliminado del inventario.`);
      setProductToDelete(null);
    } catch (err: any) {
      console.error('Error deleting product:', err);
      setFeedbackMessage(`Error al eliminar: ${err?.message || 'No se pudo eliminar el producto'}`);
    } finally {
      setDeleting(false);
    }
  };

  const categories = ['Todos', 'Jerseys', 'Gorras', 'Sudaderas', 'Souvenirs', 'Coleccionables'];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchesLowStock = !showLowStockOnly || p.stock <= p.minStockAlert;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const totalInventoryValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;

  return (
    <div className="space-y-6">
      {/* Header y Métricas de Inventario */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-red-700" />
            Gestión de Inventario & Almacén
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Control de stock, costos, precios y alertas de reabastecimiento de la Tienda Oficial Venados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-store-hero-promo-open"
            type="button"
            onClick={() => setIsStorePromoModalOpen(true)}
            className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            title="Configurar el póster o imagen promocional de la tienda oficial para el Hero del login"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Póster Hero de Tienda</span>
            {storePromoActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Activo
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                Pausado
              </span>
            )}
          </button>

          <button
            id="btn-create-product"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {feedbackMessage}
          </span>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-700 hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Tarjetas KPI de Almacén */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-700">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Unidades en Stock</p>
            <p className="text-lg font-black text-slate-900">{totalStockUnits.toLocaleString()} pzas</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Valor Total de Inventario</p>
            <p className="text-lg font-black text-slate-900">${totalInventoryValue.toLocaleString('es-MX')} MXN</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Alertas de Stock Bajo</p>
            <p className="text-lg font-black text-amber-700">{lowStockCount} productos</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o código SKU..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              showLowStockOnly
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Stock Crítico</span>
          </button>
        </div>
      </div>

      {/* Tabla de Productos de Inventario */}
      {loading ? (
        <LoadingSpinner message="Consultando inventario en tiempo real..." />
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          No se encontraron productos con los filtros seleccionados.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Precio Venta</th>
                  <th className="py-3 px-4">Costo</th>
                  <th className="py-3 px-4 text-center">Stock Actual</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProducts.map((prod) => {
                  const isLow = prod.stock <= prod.minStockAlert;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={normalizeGoogleDriveImageUrl(prod.image) || getDefaultProductPlaceholder(prod.category)}
                            alt={prod.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = getDefaultProductPlaceholder(prod.category);
                            }}
                          />
                          <div>
                            <p className="font-extrabold text-slate-900 leading-snug">{prod.name}</p>
                            <p className="text-[10px] text-slate-400">{prod.supplier || 'Venados Store'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">{prod.sku}</td>
                      <td className="py-3.5 px-4 font-medium">{prod.category}</td>
                      <td className="py-3.5 px-4 font-black text-slate-900">${prod.price.toLocaleString('es-MX')}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {costsMap[prod.id] !== undefined ? `$${costsMap[prod.id].toLocaleString('es-MX')}` : '...'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStockDelta(prod.id, -1)}
                            className="p-1 rounded bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 transition-colors"
                            title="Disminuir stock"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className={`font-mono font-black text-sm px-2 ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                            {prod.stock}
                          </span>
                          <button
                            onClick={() => handleStockDelta(prod.id, 1)}
                            className="p-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 transition-colors"
                            title="Aumentar stock"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Bajo (Min: {prod.minStockAlert})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Óptimo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(prod)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRequestDelete(prod)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Crear / Editar Producto */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-xs sm:text-sm">
                {editingProduct.id ? 'Editar Producto de Inventario' : 'Registrar Nuevo Producto'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código SKU *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.sku || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={editingProduct.category || 'Jerseys'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-semibold bg-white text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  >
                    <option value="Jerseys">Jerseys</option>
                    <option value="Gorras">Gorras</option>
                    <option value="Sudaderas">Sudaderas</option>
                    <option value="Souvenirs">Souvenirs</option>
                    <option value="Accesorios">Accesorios</option>
                    <option value="Coleccionables">Coleccionables</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="Ej. Jersey Rojo Conmemorativo 2026"
                  className="w-full p-2 border border-slate-300 rounded-xl font-semibold text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio Venta (MXN) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Costo Unitario</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingCostPrice}
                    onChange={(e) => setEditingCostPrice(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-xl font-medium text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Inicial *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingProduct.stock || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alerta Stock Mínimo</label>
                  <input
                    type="number"
                    min="1"
                    value={editingProduct.minStockAlert || 5}
                    onChange={(e) => setEditingProduct({ ...editingProduct, minStockAlert: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={editingProduct.supplier || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, supplier: e.target.value })}
                    placeholder="New Era / El Siglo"
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* Sección de Imagen con soporte Google Drive y Vista Previa */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-red-700" />
                    <span>Fotografía del Producto (Soporta Google Drive)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleResetPlaceholder}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                  >
                    Usar placeholder de categoría
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  {/* Vista previa miniatura */}
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-300 shrink-0 relative shadow-xs flex items-center justify-center">
                    <img
                      src={editingProduct.image || getDefaultProductPlaceholder(editingProduct.category)}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xs opacity-35 scale-110 pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                    <img
                      src={editingProduct.image || getDefaultProductPlaceholder(editingProduct.category)}
                      alt="Vista previa del producto"
                      className="relative z-10 max-h-full max-w-full object-contain p-1"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = getDefaultProductPlaceholder(editingProduct.category);
                      }}
                    />
                  </div>

                  {/* Campo de URL con detección automática */}
                  <div className="flex-1 space-y-1.5 w-full">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Pega un enlace compartido de Google Drive o URL web directa:
                    </label>
                    <input
                      type="url"
                      value={editingProduct.image || ''}
                      onChange={(e) => handleImageUrlChange(e.target.value)}
                      placeholder="https://drive.google.com/file/d/... o https://..."
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                    />
                    {editingProduct.image && editingProduct.image.includes('googleusercontent.com/d/') && (
                      <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Enlace de Google Drive optimizado automáticamente con URL directa CDN.</span>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      Formatos compatibles: Enlace de compartir de Drive (`drive.google.com/file/d/...`), carpetas públicas, o URLs de imagen HTTPS.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer text-xs"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Configuración del Banner de la Tienda Oficial en el Hero de Login */}
      {isStorePromoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Póster de Tienda Oficial en el Hero
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aparece en el carrusel principal de bienvenida antes de iniciar sesión ({venueName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStorePromoModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStorePromo} className="mt-4 space-y-4 text-xs">
              {/* Activar / Desactivar promoción en el Hero */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <label htmlFor="store-promo-active-toggle" className="font-bold text-slate-800 text-xs block cursor-pointer">
                    Mostrar en el carrusel de bienvenida (Hero)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Los aficionados podrán ver este póster y acceder directo a la tienda oficial.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="store-promo-active-toggle"
                    type="checkbox"
                    checked={storePromoActive}
                    onChange={(e) => setStorePromoActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* URL de Imagen Promocional (Soporta Google Drive) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="store-promo-banner-input" className="font-bold text-slate-700">
                    URL de la Imagen Promocional / Póster (Soporta Google Drive) *
                  </label>
                  <button
                    type="button"
                    onClick={handleResetPromoBanner}
                    className="text-[10px] text-amber-700 hover:underline font-bold"
                  >
                    Usar imagen oficial por defecto
                  </button>
                </div>

                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="store-promo-banner-input"
                    type="url"
                    placeholder="https://drive.google.com/file/d/... o https://..."
                    value={storePromoBannerUrl}
                    onChange={(e) => handlePromoBannerChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {storePromoBannerUrl && storePromoBannerUrl.includes('googleusercontent.com/d/') && (
                  <p className="mt-1.5 text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Enlace de Google Drive detectado y transformado automáticamente a CDN directo.</span>
                  </p>
                )}

                <p className="mt-1 text-[10px] text-slate-500">
                  Puedes pegar un enlace de archivo compartido de Google Drive, Google Photos, o cualquier enlace HTTPS público.
                </p>
              </div>

              {/* Vista previa en tiempo real idéntica al Hero */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Vista Previa en Vivo (Formato Hero del Login)</span>
                </label>
                <div className="relative w-full aspect-16/9 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 shadow-inner flex items-center justify-center">
                  {storePromoBannerUrl ? (
                    <>
                      {/* Fondo ambiental difuminado */}
                      <img
                        src={storePromoBannerUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      {/* Imagen principal limpia */}
                      <img
                        src={storePromoBannerUrl}
                        alt="Vista previa póster tienda"
                        className="relative z-10 max-h-full max-w-full object-contain p-2 drop-shadow-md"
                        referrerPolicy="no-referrer"
                      />
                      {/* Badge superior */}
                      <div className="absolute top-2 left-2 z-20">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md bg-amber-400 text-slate-950 flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3 text-slate-950" />
                          Tienda Oficial
                        </span>
                      </div>
                      {/* Overlay con títulos */}
                      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 text-white">
                        <p className="font-black text-xs sm:text-sm text-amber-300 drop-shadow-xs line-clamp-1">
                          {storePromoTitle || 'Tienda Oficial Venados Store'}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-slate-200 line-clamp-1 mt-0.5">
                          {storePromoSubtitle || 'Jerseys, gorras y souvenirs oficiales.'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4 text-slate-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs font-semibold">Ingresa una URL de imagen o presiona &quot;Usar imagen oficial por defecto&quot;</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Título promocional */}
              <div>
                <label htmlFor="store-promo-title-input" className="block font-bold text-slate-700 mb-1">
                  Título Destacado en el Hero
                </label>
                <input
                  id="store-promo-title-input"
                  type="text"
                  value={storePromoTitle}
                  onChange={(e) => setStorePromoTitle(e.target.value)}
                  placeholder="Ej. Tienda Oficial Venados Store"
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              {/* Subtítulo / Descripción */}
              <div>
                <label htmlFor="store-promo-subtitle-input" className="block font-bold text-slate-700 mb-1">
                  Mensaje Promocional / Subtítulo
                </label>
                <textarea
                  id="store-promo-subtitle-input"
                  rows={2}
                  value={storePromoSubtitle}
                  onChange={(e) => setStorePromoSubtitle(e.target.value)}
                  placeholder="Ej. Jerseys oficiales, gorras y souvenirs con entrega en tu butaca o envío express a domicilio."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Acciones */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStorePromoModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-store-promo"
                  type="submit"
                  disabled={savingPromo}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer text-xs"
                >
                  <Save className="w-4 h-4" />
                  {savingPromo ? 'Guardando...' : 'Guardar en Pantalla de Bienvenida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Producto */}
      <ConfirmationModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
        title="¿Deseas eliminar este producto del inventario?"
        message="Esta acción retirará el producto del catálogo y tienda oficial de Venados. Si tiene costos o registros asociados, serán removidos."
        itemName={productToDelete ? `${productToDelete.name} (SKU: ${productToDelete.sku})` : undefined}
        confirmText="Eliminar Producto"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};
