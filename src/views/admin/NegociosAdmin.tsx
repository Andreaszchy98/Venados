import React, { useState, useEffect } from 'react';
import { StadiumStand, MenuItem, UserProfile, StandCategoryTag } from '../../types';
import {
  getStadiumStands,
  createStadiumStand,
  updateStadiumStand,
  toggleStandActive,
  deleteStadiumStand,
  getAllMenuItems,
  saveMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
} from '../../lib/stands';
import { getAllUsers } from '../../lib/auth';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ConfirmationModal } from '../../components/shared/ConfirmationModal';
import {
  Store,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Clock,
  DollarSign,
  Percent,
  Phone,
  Mail,
  ChefHat,
  Utensils,
  RefreshCw,
  X,
  Save,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Tag,
} from 'lucide-react';

const CATEGORIES: StandCategoryTag[] = [
  'Mariscos & Botaneros',
  'Tacos & Parrilla',
  'Hot Dogs & Snacks',
  'Cerveza & Coctelería',
  'Postres & Helados',
  'Souvenirs & Tiendita',
  'Café & Churros',
];

const PRESET_IMAGES: { label: string; url: string }[] = [
  {
    label: 'Mariscos',
    url: 'https://images.unsplash.com/photo-1535400255456-984241443b29?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Tacos / Carne Asada',
    url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Snacks & Hot Dogs',
    url: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Cerveza & Barra',
    url: 'https://images.unsplash.com/photo-1608270199996-51f786fa05d8?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Postres & Helados',
    url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Cafetería & Churros',
    url: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=600&auto=format&fit=crop&q=80',
  },
];

export const NegociosAdmin: React.FC = () => {
  const [stands, setStands] = useState<StadiumStand[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'todas' | StandCategoryTag>('todas');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'inactivos'>('todos');

  // Modal para Crear / Editar Puesto
  const [isStandModalOpen, setIsStandModalOpen] = useState(false);
  const [editingStand, setEditingStand] = useState<StadiumStand | null>(null);
  const [standForm, setStandForm] = useState({
    name: '',
    location: '',
    categoryTag: 'Mariscos & Botaneros' as StandCategoryTag,
    description: '',
    ownerId: '',
    ownerName: '',
    contactPhone: '',
    contactEmail: '',
    commissionRate: 15,
    monthlyRent: 0,
    estimatedWaitMinutes: 10,
    image: PRESET_IMAGES[0].url,
    active: true,
  });

  // Modal para Administrar Menú del Puesto
  const [selectedStandForMenu, setSelectedStandForMenu] = useState<StadiumStand | null>(null);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'comida' as any,
    prepTimeMinutes: 5,
    image: '',
    available: true,
  });

  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados de eliminación con ConfirmationModal
  const [standToDelete, setStandToDelete] = useState<StadiumStand | null>(null);
  const [deletingStand, setDeletingStand] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [standsData, menuData, usersData] = await Promise.all([
        getStadiumStands(),
        getAllMenuItems().catch(() => []),
        getAllUsers().catch(() => []),
      ]);
      setStands(standsData);
      setMenuItems(menuData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error('Error cargando negocios del estadio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewStandModal = () => {
    setEditingStand(null);
    setStandForm({
      name: '',
      location: '',
      categoryTag: 'Mariscos & Botaneros',
      description: '',
      ownerId: '',
      ownerName: '',
      contactPhone: '',
      contactEmail: '',
      commissionRate: 15,
      monthlyRent: 0,
      estimatedWaitMinutes: 10,
      image: PRESET_IMAGES[0].url,
      active: true,
    });
    setIsStandModalOpen(true);
  };

  const openEditStandModal = (stand: StadiumStand) => {
    setEditingStand(stand);
    setStandForm({
      name: stand.name,
      location: stand.location,
      categoryTag: stand.categoryTag || 'Mariscos & Botaneros',
      description: stand.description || '',
      ownerId: stand.ownerId || '',
      ownerName: stand.ownerName || '',
      contactPhone: stand.contactPhone || '',
      contactEmail: stand.contactEmail || '',
      commissionRate: stand.commissionRate !== undefined ? stand.commissionRate : 15,
      monthlyRent: stand.monthlyRent || 0,
      estimatedWaitMinutes: stand.estimatedWaitMinutes || 10,
      image: stand.image || PRESET_IMAGES[0].url,
      active: stand.active,
    });
    setIsStandModalOpen(true);
  };

  const handleSaveStand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalOwnerName = standForm.ownerName;
      if (standForm.ownerId) {
        const foundUser = users.find((u) => u.uid === standForm.ownerId);
        if (foundUser) {
          finalOwnerName = foundUser.displayName || foundUser.email || 'Concesionario';
        }
      }

      const payload = {
        name: standForm.name.trim(),
        location: standForm.location.trim(),
        categoryTag: standForm.categoryTag,
        description: standForm.description.trim(),
        ownerId: standForm.ownerId || undefined,
        ownerName: finalOwnerName || undefined,
        contactPhone: standForm.contactPhone.trim() || undefined,
        contactEmail: standForm.contactEmail.trim() || undefined,
        commissionRate: Number(standForm.commissionRate) || 0,
        monthlyRent: Number(standForm.monthlyRent) || 0,
        estimatedWaitMinutes: Number(standForm.estimatedWaitMinutes) || 5,
        image: standForm.image || PRESET_IMAGES[0].url,
        active: standForm.active,
      };

      if (editingStand) {
        await updateStadiumStand(editingStand.id, payload);
        setStands((prev) =>
          prev.map((s) => (s.id === editingStand.id ? { ...s, ...payload, updatedAt: new Date().toISOString() } : s))
        );
        setNotification({
          type: 'success',
          message: `Negocio "${payload.name}" actualizado correctamente.`,
        });
      } else {
        const created = await createStadiumStand(payload);
        setStands((prev) => [created, ...prev]);
        setNotification({
          type: 'success',
          message: `Nuevo negocio "${payload.name}" registrado con éxito en el estadio.`,
        });
      }

      setIsStandModalOpen(false);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al guardar negocio: ${err.message || 'Intente de nuevo'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (stand: StadiumStand) => {
    const newStatus = !stand.active;
    try {
      await toggleStandActive(stand.id, newStatus);
      setStands((prev) =>
        prev.map((s) => (s.id === stand.id ? { ...s, active: newStatus } : s))
      );
      setNotification({
        type: 'success',
        message: `El negocio "${stand.name}" ahora está ${newStatus ? 'ABIERTO (En Operación)' : 'CERRADO'}.`,
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al cambiar estado: ${err.message}`,
      });
    }
  };

  const handleRequestDeleteStand = (stand: StadiumStand) => {
    setStandToDelete(stand);
  };

  const handleConfirmDeleteStand = async () => {
    if (!standToDelete) return;
    setDeletingStand(true);
    try {
      await deleteStadiumStand(standToDelete.id);
      setStands((prev) => prev.filter((s) => s.id !== standToDelete.id));
      setMenuItems((prev) => prev.filter((m) => m.standId !== standToDelete.id));
      setNotification({
        type: 'success',
        message: `Negocio "${standToDelete.name}" eliminado del estadio.`,
      });
      setStandToDelete(null);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al eliminar negocio: ${err.message}`,
      });
    } finally {
      setDeletingStand(false);
    }
  };

  // Gestión de Menú
  const openMenuModal = (stand: StadiumStand) => {
    setSelectedStandForMenu(stand);
    setMenuModalOpen(true);
    setIsItemFormOpen(false);
  };

  const openNewItemForm = () => {
    setEditingMenuItem(null);
    setItemForm({
      name: '',
      description: '',
      price: 90,
      category: 'comida',
      prepTimeMinutes: 5,
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
      available: true,
    });
    setIsItemFormOpen(true);
  };

  const openEditItemForm = (item: MenuItem) => {
    setEditingMenuItem(item);
    setItemForm({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      prepTimeMinutes: item.prepTimeMinutes || 5,
      image: item.image,
      available: item.available,
    });
    setIsItemFormOpen(true);
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStandForMenu) return;

    setSaving(true);
    try {
      const saved = await saveMenuItem({
        id: editingMenuItem ? editingMenuItem.id : undefined,
        standId: selectedStandForMenu.id,
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        price: Number(itemForm.price),
        category: itemForm.category,
        prepTimeMinutes: Number(itemForm.prepTimeMinutes),
        image: itemForm.image,
        available: itemForm.available,
      });

      if (editingMenuItem) {
        setMenuItems((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      } else {
        setMenuItems((prev) => [saved, ...prev]);
      }

      setIsItemFormOpen(false);
      setNotification({
        type: 'success',
        message: `Platillo "${saved.name}" guardado correctamente en ${selectedStandForMenu.name}.`,
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al guardar platillo: ${err.message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    const newAvail = !item.available;
    try {
      await toggleMenuItemAvailability(item.id, newAvail);
      setMenuItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, available: newAvail } : m))
      );
    } catch (err) {
      console.error('Error actualizando disponibilidad del platillo:', err);
    }
  };

  const handleRequestDeleteItem = (item: MenuItem) => {
    setItemToDelete(item);
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setDeletingItem(true);
    try {
      await deleteMenuItem(itemToDelete.id);
      setMenuItems((prev) => prev.filter((m) => m.id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err) {
      console.error('Error eliminando platillo:', err);
    } finally {
      setDeletingItem(false);
    }
  };

  // Filtrado
  const filteredStands = stands.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'todas' || s.categoryTag === selectedCategory;
    const matchesStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'activos' && s.active) ||
      (statusFilter === 'inactivos' && !s.active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const activeStandsCount = stands.filter((s) => s.active).length;
  const concesionariosList = users.filter((u) => u.role === 'concesionario' || u.role === 'admin');

  return (
    <div className="space-y-6">
      {/* Banner de Notificación */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <p className="font-medium">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tarjetas de Métricas de Negocios en Estadio */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Locales / Puestos</span>
            <div className="p-1.5 rounded-lg bg-red-50 text-red-700">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{stands.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Espacios en Estadio</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Abiertos en Vivo</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{activeStandsCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">En operación activa</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catálogo de Menú</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700">{menuItems.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Platillos y bebidas registrados</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comisión Promedio</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stands.length > 0
              ? Math.round(
                  stands.reduce((acc, s) => acc + (s.commissionRate || 15), 0) / stands.length
                )
              : 15}
            %
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Por venta en alimentos</p>
        </div>
      </div>

      {/* Barra de Búsqueda, Filtros y Botón de Crear Negocio */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-stands-input"
              type="text"
              placeholder="Buscar negocio, ubicación o encargado..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recargar
            </button>

            <button
              id="add-stand-btn"
              onClick={openNewStandModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-800 hover:bg-red-900 rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              Nuevo Negocio / Puesto
            </button>
          </div>
        </div>

        {/* Pestañas de Categoría */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <button
            onClick={() => setSelectedCategory('todas')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
              selectedCategory === 'todas'
                ? 'bg-red-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas las Categorías ({stands.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = stands.filter((s) => s.categoryTag === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-red-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Negocios en el Estadio */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner message="Cargando negocios del estadio..." />
        </div>
      ) : filteredStands.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
          <Store className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold">No se encontraron negocios con ese filtro</p>
          <p className="text-xs text-slate-400 mt-1">
            Puedes agregar un nuevo puesto de comida o bebida con el botón superior
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStands.map((stand) => {
            const standMenuItems = menuItems.filter((m) => m.standId === stand.id);
            const availableMenuItems = standMenuItems.filter((m) => m.available).length;

            return (
              <div
                key={stand.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  stand.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60 opacity-80'
                }`}
              >
                <div>
                  {/* Foto de Portada con Badge de Estado */}
                  <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                    <img
                      src={stand.image}
                      alt={stand.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>

                    {/* Badge de Categoría */}
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-900/80 text-white backdrop-blur-xs border border-white/20">
                        <Tag className="w-3 h-3 text-red-400" />
                        {stand.categoryTag || 'Concesión'}
                      </span>
                    </div>

                    {/* Badge de Estado Operativo */}
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() => handleToggleActive(stand)}
                        title="Clic para cambiar estado de apertura"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs transition-transform active:scale-95 ${
                          stand.active
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                        {stand.active ? 'Abierto' : 'Cerrado'}
                      </button>
                    </div>

                    {/* Nombre y Ubicación sobre la imagen */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-extrabold text-base leading-snug drop-shadow-xs line-clamp-1">
                        {stand.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-slate-200 mt-0.5 drop-shadow-2xs">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="truncate">{stand.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo de Información Comercial */}
                  <div className="p-4 space-y-3">
                    {/* Encargado y Contacto */}
                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Encargado Concesión:</span>
                        <span className="font-bold text-slate-900">
                          {stand.ownerName || 'Sin asignar'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Comisión al Club:</span>
                        <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                          {stand.commissionRate !== undefined ? stand.commissionRate : 15}% por venta
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Espera Estimada:</span>
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {stand.estimatedWaitMinutes || 10} min
                        </span>
                      </div>
                    </div>

                    {/* Resumen del Menú */}
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-slate-500 font-medium">Platillos en Carta:</span>
                      <span className="font-bold text-slate-800">
                        {availableMenuItems} disponibles / {standMenuItems.length} totales
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barra Inferior de Acciones */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    id={`manage-menu-${stand.id}`}
                    onClick={() => openMenuModal(stand)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
                  >
                    <Utensils className="w-3.5 h-3.5 text-amber-600" />
                    Menú ({standMenuItems.length})
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      id={`edit-stand-${stand.id}`}
                      onClick={() => openEditStandModal(stand)}
                      title="Editar Datos del Negocio"
                      className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs transition-all shadow-2xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`delete-stand-${stand.id}`}
                      onClick={() => handleRequestDeleteStand(stand)}
                      title="Eliminar Negocio"
                      className="p-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs transition-all shadow-2xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PARA CREAR / EDITAR NEGOCIO */}
      {isStandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-600/30 border border-red-500/40 text-red-300">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {editingStand ? 'Editar Negocio del Estadio' : 'Registrar Nuevo Negocio / Puesto'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    Configuración de concesión, ubicación y comisiones
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStandModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStand} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre Comercial del Negocio *
                </label>
                <input
                  id="stand-name-input"
                  type="text"
                  required
                  placeholder="Ej: Tacos El Zurdo, Cervecería Pacífico, Mariscos El Palmar..."
                  value={standForm.name}
                  onChange={(e) => setStandForm({ ...standForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:bg-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ubicación en el Estadio *
                  </label>
                  <input
                    id="stand-location-input"
                    type="text"
                    required
                    placeholder="Ej: Zona Central Pasillo 4, Bleachers Puerta 8..."
                    value={standForm.location}
                    onChange={(e) => setStandForm({ ...standForm, location: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Giro / Categoría *
                  </label>
                  <select
                    id="stand-category-select"
                    value={standForm.categoryTag}
                    onChange={(e) => setStandForm({ ...standForm, categoryTag: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:bg-white font-medium"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Asignación de Concesionario / Encargado */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <ChefHat className="w-4 h-4 text-amber-700" />
                  Encargado o Concesionario Operador
                </div>
                <select
                  id="stand-owner-select"
                  value={standForm.ownerId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    const u = users.find((x) => x.uid === uid);
                    setStandForm({
                      ...standForm,
                      ownerId: uid,
                      ownerName: u ? u.displayName || u.email || '' : '',
                    });
                  }}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-600 font-medium"
                >
                  <option value="">-- Sin encargado asignado (o Asignar después) --</option>
                  {concesionariosList.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.email} ({u.role ? u.role.toUpperCase() : 'USUARIO'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-700">
                  El usuario asignado podrá ingresar con su cuenta y ver las comandas en vivo de este puesto.
                </p>
              </div>

              {/* Parámetros Económicos & Operativos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Comisión Club (%)
                  </label>
                  <div className="relative">
                    <input
                      id="stand-commission-input"
                      type="number"
                      min="0"
                      max="100"
                      value={standForm.commissionRate}
                      onChange={(e) => setStandForm({ ...standForm, commissionRate: Number(e.target.value) })}
                      className="w-full pl-3 pr-7 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Canon / Renta ($)
                  </label>
                  <input
                    id="stand-rent-input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={standForm.monthlyRent}
                    onChange={(e) => setStandForm({ ...standForm, monthlyRent: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tiempo Espera (min)
                  </label>
                  <input
                    id="stand-wait-input"
                    type="number"
                    min="1"
                    max="60"
                    value={standForm.estimatedWaitMinutes}
                    onChange={(e) => setStandForm({ ...standForm, estimatedWaitMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Imagen del Negocio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Foto de Portada del Puesto
                </label>
                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                  {PRESET_IMAGES.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => setStandForm({ ...standForm, image: preset.url })}
                      className={`px-2.5 py-1 text-[11px] rounded-lg font-bold shrink-0 transition-all ${
                        standForm.image === preset.url
                          ? 'bg-red-800 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  placeholder="https://..."
                  value={standForm.image}
                  onChange={(e) => setStandForm({ ...standForm, image: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
                />
              </div>

              {/* Estado Activo */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-800">Estado de Operación en Estadio</div>
                  <div className="text-[11px] text-slate-500">
                    {standForm.active
                      ? 'Abierto al público y disponible para pedidos express'
                      : 'Cerrado temporalmente'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={standForm.active}
                  onChange={(e) => setStandForm({ ...standForm, active: e.target.checked })}
                  className="w-5 h-5 text-red-600 rounded-sm focus:ring-red-500"
                />
              </div>

              {/* Botones de Acción */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStandModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  id="save-stand-submit-btn"
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-800 hover:bg-red-900 text-white text-xs font-extrabold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingStand ? 'Actualizar Negocio' : 'Registrar Negocio'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA ADMINISTRAR MENÚ DEL NEGOCIO */}
      {menuModalOpen && selectedStandForMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-600/30 border border-amber-500/40 text-amber-300">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    Menú Oficial: {selectedStandForMenu.name}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    Ubicación: {selectedStandForMenu.location}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMenuModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs sm:text-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Platillos & Bebidas ({menuItems.filter((m) => m.standId === selectedStandForMenu.id).length})
                </span>
                <button
                  id="add-menu-item-btn"
                  onClick={openNewItemForm}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white text-xs font-bold rounded-lg shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Platillo / Producto
                </button>
              </div>

              {/* Formulario Inline para Crear o Editar Item del Menú */}
              {isItemFormOpen && (
                <form
                  onSubmit={handleSaveMenuItem}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                    <span>{editingMenuItem ? 'Editar Platillo' : 'Nuevo Platillo / Bebida'}</span>
                    <button
                      type="button"
                      onClick={() => setIsItemFormOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Nombre del Platillo *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Tacos de Asada, Hot Dog Jumbo, Cerveza Pacífico..."
                        value={itemForm.name}
                        onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Precio ($ MXN) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="95"
                        value={itemForm.price}
                        onChange={(e) => setItemForm({ ...itemForm, price: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Categoría
                      </label>
                      <select
                        value={itemForm.category}
                        onChange={(e) => setItemForm({ ...itemForm, category: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="comida">Comida</option>
                        <option value="bebida">Bebida</option>
                        <option value="cerveza">Cerveza</option>
                        <option value="snack">Snack</option>
                        <option value="combo">Combo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Tiempo Prep. (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={itemForm.prepTimeMinutes}
                        onChange={(e) => setItemForm({ ...itemForm, prepTimeMinutes: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="item-available-check"
                        checked={itemForm.available}
                        onChange={(e) => setItemForm({ ...itemForm, available: e.target.checked })}
                        className="w-4 h-4 text-red-600 rounded-sm"
                      />
                      <label htmlFor="item-available-check" className="text-xs font-semibold text-slate-700">
                        Disponible en venta
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Descripción de Ingredientes
                    </label>
                    <input
                      type="text"
                      placeholder="Ingredientes, salsas, porciones..."
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsItemFormOpen(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 bg-red-800 hover:bg-red-900 text-white text-xs font-bold rounded-lg shadow-xs"
                    >
                      {saving ? 'Guardando...' : 'Guardar Platillo'}
                    </button>
                  </div>
                </form>
              )}

              {/* Lista de Platillos del Puesto */}
              <div className="divide-y divide-slate-100">
                {menuItems
                  .filter((m) => m.standId === selectedStandForMenu.id)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80'}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{item.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.available
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {item.available ? 'En Menú' : 'Agotado'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">{item.description}</div>
                          <div className="text-xs font-bold text-red-800 mt-0.5">${item.price} MXN</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleToggleItemAvailability(item)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                            item.available
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          }`}
                        >
                          {item.available ? 'Pausar' : 'Reactivar'}
                        </button>
                        <button
                          onClick={() => openEditItemForm(item)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRequestDeleteItem(item)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs cursor-pointer"
                          title="Eliminar Platillo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Negocio */}
      <ConfirmationModal
        isOpen={!!standToDelete}
        onClose={() => setStandToDelete(null)}
        onConfirm={handleConfirmDeleteStand}
        isLoading={deletingStand}
        title="¿Deseas eliminar este negocio del estadio?"
        message="Esta acción borrará permanentemente la concesión del estadio y todos los platillos asociados a su menú."
        itemName={standToDelete ? `${standToDelete.name} (${standToDelete.location})` : undefined}
        confirmText="Eliminar Negocio"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal de Confirmación para Eliminar Platillo del Menú */}
      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDeleteItem}
        isLoading={deletingItem}
        title="¿Deseas eliminar este platillo del menú?"
        message="El platillo dejará de estar disponible para pedidos express e in-seat de los aficionados."
        itemName={itemToDelete ? `${itemToDelete.name} ($${itemToDelete.price} MXN)` : undefined}
        confirmText="Eliminar Platillo"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};
