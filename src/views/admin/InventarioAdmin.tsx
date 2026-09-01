import React, { useState, useEffect } from 'react';
import { InventoryProduct, ProductCategory } from '../../types';
import {
  getInventoryProducts,
  saveInventoryProduct,
  adjustProductStock,
  deleteInventoryProduct,
} from '../../lib/inventory';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
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
} from 'lucide-react';

export const InventarioAdmin: React.FC = () => {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<InventoryProduct> | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await getInventoryProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

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
      costPrice: 450,
      stock: 20,
      minStockAlert: 5,
      sizes: ['S', 'M', 'L', 'XL'],
      image: 'https://images.unsplash.com/photo-1577210897949-1f56f943502f?w=600&auto=format&fit=crop&q=80',
      description: '',
      supplier: 'Venados Store Oficial',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: InventoryProduct) => {
    setEditingProduct({ ...product });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name || !editingProduct.sku) return;
    setSaving(true);
    try {
      await saveInventoryProduct(editingProduct as any);
      setIsModalOpen(false);
      setFeedbackMessage('Producto guardado correctamente en inventario.');
      fetchInventory();
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este producto del inventario?')) return;
    try {
      await deleteInventoryProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setFeedbackMessage('Producto eliminado del inventario.');
    } catch (err) {
      console.error('Error deleting product:', err);
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

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto</span>
        </button>
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
                            src={prod.image}
                            alt={prod.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                            referrerPolicy="no-referrer"
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
                      <td className="py-3.5 px-4 text-slate-500">${prod.costPrice.toLocaleString('es-MX')}</td>
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
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Eliminar"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct.id ? 'Editar Producto de Inventario' : 'Registrar Nuevo Producto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código SKU</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.sku || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={editingProduct.category || 'Jerseys'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-semibold bg-white"
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
                <label className="block font-bold text-slate-700 mb-1">Nombre del Producto</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="Ej. Jersey Rojo Conmemorativo 2026"
                  className="w-full p-2 border border-slate-300 rounded-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio Venta (MXN)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Costo Unitario</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingProduct.costPrice || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, costPrice: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingProduct.stock || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alerta Stock Mínimo</label>
                  <input
                    type="number"
                    min="1"
                    value={editingProduct.minStockAlert || 5}
                    onChange={(e) => setEditingProduct({ ...editingProduct, minStockAlert: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={editingProduct.supplier || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, supplier: e.target.value })}
                    placeholder="New Era / El Siglo"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">URL de Imagen</label>
                <input
                  type="url"
                  value={editingProduct.image || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
