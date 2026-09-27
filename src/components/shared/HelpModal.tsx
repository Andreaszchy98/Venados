import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useTheme } from '../../context/ThemeContext';
import {
  HelpCircle,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Ticket,
  CreditCard,
  QrCode,
  MapPin,
  Utensils,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Mail,
  Send,
  User,
  AlertCircle,
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDefaultName?: string;
  userDefaultEmail?: string;
}

interface FAQItem {
  id: string;
  category: 'boletos' | 'pagos' | 'comida' | 'general';
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'boletos',
    question: '¿Cómo compro boletos en VXP?',
    answer: 'Entra a la app, selecciona el evento, elige tus asientos en el mapa interactivo, agrégalos al carrito y paga con Stripe, SPEI o efectivo.',
    icon: <Ticket className="w-4 h-4 text-red-400" />,
  },
  {
    id: 'faq-2',
    category: 'pagos',
    question: '¿Qué métodos de pago aceptan?',
    answer: 'Aceptamos Pagos digitales (tarjeta) y efectivo o terminal en taquilla.',
    icon: <CreditCard className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'faq-3',
    category: 'boletos',
    question: '¿Cómo recibo mi boleto?',
    answer: 'Se genera automáticamente como QR en la app y te lo enviamos por email en 5 minutos.',
    icon: <QrCode className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'faq-4',
    category: 'boletos',
    question: '¿Puedo ver mi QR si lo pierdo?',
    answer: 'Sí, siempre está disponible en "Mis Boletos" dentro de la app.',
    icon: <CheckCircle2 className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'faq-5',
    category: 'pagos',
    question: '¿Cuánto pago si compro en línea?',
    answer: 'El precio del boleto + comisión de venta (2.9% + $0.30 MXN).',
    icon: <CreditCard className="w-4 h-4 text-purple-400" />,
  },
  {
    id: 'faq-6',
    category: 'general',
    question: '¿Dónde puedo ver el mapa del estadio?',
    answer: 'Al seleccionar un evento, aparece el mapa interactivo con todas las secciones.',
    icon: <MapPin className="w-4 h-4 text-red-400" />,
  },
  {
    id: 'faq-7',
    category: 'comida',
    question: '¿Cómo pido comida a mi asiento (In-Seat Delivery)?',
    answer: 'Ve a la sección "Comida", selecciona tu puesto preferido, elige la opción "Entrega a Butaca", indica tu sección, fila y asiento, y un runner llevará tu pedido directamente a tu lugar.',
    icon: <Utensils className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'faq-8',
    category: 'comida',
    question: '¿Cómo funciona el servicio Pickup Express en comida?',
    answer: 'Ordena desde tu teléfono, paga digitalmente o al recoger, y recibe una notificación cuando tus platillos estén servidos en barra para recoger sin hacer filas.',
    icon: <Utensils className="w-4 h-4 text-emerald-400" />,
  },
];

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  userDefaultName = '',
  userDefaultEmail = '',
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'faq' | 'email'>('faq');
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [expandedId, setExpandedId] = useState<string | null>('faq-1');

  // Estado para el formulario de Enviar Email
  const [name, setName] = useState(userDefaultName);
  const [email, setEmail] = useState(userDefaultEmail);
  const [problem, setProblem] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSentSuccess, setIsSentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const filteredFaqs = FAQ_DATA.filter((item) => {
    return activeCategory === 'todos' || item.category === activeCategory;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleSubmitEmailForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !problem.trim()) {
      setErrorMessage('Por favor completa todos los campos requeridos.');
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'supportTickets'), {
        name: name.trim(),
        email: email.trim(),
        problem: problem.trim(),
        status: 'nuevo',
        createdAt: new Date().toISOString(),
      });

      setIsSentSuccess(true);
      setProblem('');
    } catch (err: any) {
      console.error('Error guardando mensaje de soporte:', err);
      setErrorMessage('No se pudo enviar el reporte. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`border-2 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl transition-colors ${
          isLight
            ? 'bg-slate-50 border-slate-300 text-slate-900'
            : 'bg-[#0F1420] border-slate-700 text-white'
        }`}
      >
        {/* Cabecera con degradado */}
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-amber-500 p-4 sm:p-6 border-b border-red-400/40 relative shrink-0 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors cursor-pointer"
            aria-label="Cerrar ayuda"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/40 text-amber-300 border border-white/20 font-sports mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Centro de Soporte y FAQ</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-sports uppercase tracking-wide flex items-center gap-2">
            <span>¿En qué te podemos ayudar?</span>
          </h2>
          <p className="text-xs text-white/90 mt-1 font-medium">
            Encuentra respuestas rápidas o envíanos un mensaje directo para asistirte.
          </p>

          {/* Selector de Opciones principales */}
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('faq')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider font-sports transition-all cursor-pointer flex items-center justify-center gap-2 border-2 ${
                activeTab === 'faq'
                  ? 'bg-slate-950 text-amber-300 border-amber-400 shadow-lg font-black'
                  : 'bg-black/40 hover:bg-black/60 text-white/90 border-white/20 font-bold'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Opción 1: Preguntas Frecuentes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider font-sports transition-all cursor-pointer flex items-center justify-center gap-2 border-2 ${
                activeTab === 'email'
                  ? 'bg-slate-950 text-amber-300 border-amber-400 shadow-lg font-black'
                  : 'bg-black/40 hover:bg-black/60 text-white/90 border-white/20 font-bold'
              }`}
            >
              <Mail className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Opción 2: Enviar Email 📧</span>
            </button>
          </div>
        </div>

        {activeTab === 'faq' ? (
          <>
            {/* Categorías de FAQ */}
            <div
              className={`p-3 border-b shrink-0 transition-colors ${
                isLight ? 'bg-slate-200/70 border-slate-300' : 'bg-[#141C2E] border-slate-800'
              }`}
            >
              {/* Filtro por categoría */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                {[
                  { id: 'todos', label: 'Todas' },
                  { id: 'boletos', label: '🎫 Boletos & QR' },
                  { id: 'pagos', label: '💳 Pagos & Precios' },
                  { id: 'comida', label: '🍔 Comida & Butaca' },
                  { id: 'general', label: '📍 Estadio & Mapa' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer font-sports ${
                      activeCategory === cat.id
                        ? 'bg-red-600 text-white shadow-md shadow-red-950/40 border border-red-500'
                        : isLight
                        ? 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                        : 'bg-[#0B101D] text-slate-400 border border-slate-800 hover:bg-[#12192A] hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista Acordeón de FAQ */}
            <div
              className={`p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 transition-colors ${
                isLight ? 'bg-slate-100/60' : 'bg-[#0A0E17]'
              }`}
            >
              {filteredFaqs.length === 0 ? (
                <div className={`text-center py-12 space-y-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <HelpCircle className={`w-12 h-12 mx-auto ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
                  <p className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    No encontramos resultados para tu búsqueda
                  </p>
                  <p className="text-xs">Prueba buscando otras palabras clave como "boletos", "tarjeta" o "mapa".</p>
                </div>
              ) : (
                filteredFaqs.map((faq) => {
                  const isExpanded = expandedId === faq.id;

                  return (
                    <div
                      key={faq.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isExpanded
                          ? isLight
                            ? 'bg-white border-red-500 shadow-md ring-1 ring-red-500/20'
                            : 'bg-[#141C2E] border-red-500/80 shadow-lg ring-1 ring-red-500/30'
                          : isLight
                          ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                          : 'bg-[#0F1626] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(faq.id)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                              isLight
                                ? 'bg-slate-100 border-slate-200'
                                : 'bg-[#0A0E17] border-slate-700/80'
                            }`}
                          >
                            {faq.icon}
                          </div>
                          <span
                            className={`font-bold text-sm font-sports tracking-wide ${
                              isLight ? 'text-slate-900' : 'text-white'
                            }`}
                          >
                            {faq.question}
                          </span>
                        </div>

                        <div
                          className={`p-1 rounded-lg shrink-0 ${
                            isLight ? 'bg-slate-100 text-slate-600' : 'bg-black/30 text-slate-400'
                          }`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div
                          className={`px-4 pb-4 pt-3 text-xs sm:text-sm leading-relaxed border-t animate-in fade-in duration-150 ${
                            isLight
                              ? 'bg-slate-100/90 border-slate-200 text-slate-900 font-semibold'
                              : 'bg-[#0B101D] border-slate-800 text-slate-100 font-medium'
                          }`}
                        >
                          <p>{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* OPCIÓN 2: FORMULARIO ENVIAR EMAIL */
          <div
            className={`p-4 sm:p-6 overflow-y-auto flex-1 transition-colors ${
              isLight ? 'bg-slate-100/60' : 'bg-[#0A0E17]'
            }`}
          >
            {isSentSuccess ? (
              <div className="py-10 text-center space-y-4 animate-in zoom-in-95">
                <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-xl">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-sports uppercase tracking-wide">
                    ¡Mensaje Enviado con Éxito!
                  </h3>
                  <p className={`text-xs font-medium leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Hemos registrado tu reporte de soporte en el sistema. Nuestro equipo revisará los detalles de tu problema a la brevedad.
                  </p>
                </div>

                <div className="pt-4 flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setIsSentSuccess(false)}
                    className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    Enviar otro mensaje
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl font-sports shadow-md transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitEmailForm} className="space-y-4 max-w-lg mx-auto py-2">
                {errorMessage && (
                  <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-xl text-red-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Campo Tu Nombre */}
                <div>
                  <label className={`block text-xs font-bold mb-1 uppercase tracking-wider font-sports ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                    Tu Nombre *
                  </label>
                  <div className="relative">
                    <User className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      required
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-xs font-bold focus:outline-hidden focus:border-red-500 shadow-inner ${
                        isLight ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Campo Tu Email */}
                <div>
                  <label className={`block text-xs font-bold mb-1 uppercase tracking-wider font-sports ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                    Tu Email *
                  </label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@correo.com"
                      required
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-xs font-bold focus:outline-hidden focus:border-red-500 shadow-inner ${
                        isLight ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Campo Tu Problema */}
                <div>
                  <label className={`block text-xs font-bold mb-1 uppercase tracking-wider font-sports ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                    Tu Problema / Detalle de la Consulta *
                  </label>
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="Describe detalladamente lo que sucedió o la duda que tienes sobre tu boleto o pedido..."
                    rows={4}
                    required
                    className={`w-full p-3 border rounded-xl text-xs font-bold focus:outline-hidden focus:border-red-500 shadow-inner resize-none ${
                      isLight ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-400'
                    }`}
                  />
                </div>

                {/* Botón de Enviar */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer font-sports active:scale-98"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Enviando Reporte...' : 'Enviar Email a Soporte'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Pie del modal con contacto directo */}
        <div
          className={`p-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 transition-colors ${
            isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-[#12192A] border-slate-800'
          }`}
        >
          <div className={`flex items-center gap-2 text-xs ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
            <Mail className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Correo oficial de soporte:{' '}
              <a
                href="mailto:soportevxp@gmail.com"
                className={`font-bold font-mono hover:underline ${
                  isLight ? 'text-amber-800' : 'text-amber-300'
                }`}
              >
                soportevxp@gmail.com
              </a>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer font-sports active:scale-95"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
