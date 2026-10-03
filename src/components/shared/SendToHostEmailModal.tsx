import React, { useState } from 'react';
import {
  Mail,
  Send,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Building,
  User,
  Clock,
  Sparkles,
  Ticket,
  FileText,
  AlertTriangle,
  SendHorizontal,
} from 'lucide-react';
import {
  HostEmailPayload,
  generateMailtoUrl,
  generateGmailComposeUrl,
  sendEmailViaGmailApi,
  sendHostOrderEmailAutomatically,
} from '../../lib/orderEmailService';
import { auth } from '../../lib/firebase';
import { useTheme } from '../../context/ThemeContext';

interface SendToHostEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailPayload: HostEmailPayload;
}

export const SendToHostEmailModal: React.FC<SendToHostEmailModalProps> = ({
  isOpen,
  onClose,
  emailPayload,
}) => {
  const { theme } = useTheme();
  const userEmail = auth.currentUser?.email || 'jorgeandres980706@gmail.com';
  const defaultHostEmail = 'soportevxp@gmail.com';
  const [recipientEmail, setRecipientEmail] = useState(
    emailPayload.hostEmail || defaultHostEmail
  );
  const [activeTab, setActiveTab] = useState<'card' | 'text'>('card');
  const [copied, setCopied] = useState(false);
  const [sendingGmail, setSendingGmail] = useState(false);
  const [sentSuccessMessage, setSentSuccessMessage] = useState<string | null>(null);
  const [sentErrorMessage, setSentErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(
        `ASUNTO: ${emailPayload.subject}\nDESTINATARIO: ${recipientEmail}\n\n${emailPayload.bodyText}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleSendViaGmailApi = async () => {
    setSendingGmail(true);
    setSentSuccessMessage(null);
    setSentErrorMessage(null);
    try {
      const res = await sendEmailViaGmailApi({
        to: recipientEmail,
        subject: emailPayload.subject,
        htmlBody: emailPayload.htmlBody,
        bodyText: emailPayload.bodyText,
      });

      if (res.success) {
        setSentSuccessMessage(`¡Correo enviado con éxito vía Gmail a ${recipientEmail}! Revisa tu bandeja de entrada.`);
      } else {
        // Si no se pudo por API, abrimos Gmail Web Composer de forma segura
        const gmailUrl = generateGmailComposeUrl(recipientEmail, emailPayload.subject, emailPayload.bodyText);
        window.open(gmailUrl, '_blank');
        setSentSuccessMessage(`Se abrió Gmail con el pase digital listo para enviar a ${recipientEmail}.`);
      }
    } catch (err: any) {
      console.warn('Error en Gmail API:', err);
      const gmailUrl = generateGmailComposeUrl(recipientEmail, emailPayload.subject, emailPayload.bodyText);
      window.open(gmailUrl, '_blank');
      setSentSuccessMessage(`Se abrió Gmail con el pase digital listo para enviar a ${recipientEmail}.`);
    } finally {
      setSendingGmail(false);
    }
  };

  const handleOpenGmailCompose = () => {
    const url = generateGmailComposeUrl(recipientEmail, emailPayload.subject, emailPayload.bodyText);
    window.open(url, '_blank');
    setSentSuccessMessage(`Redactando en Gmail para ${recipientEmail}...`);
  };

  const handleOpenMailClient = () => {
    const url = generateMailtoUrl(recipientEmail, emailPayload.subject, emailPayload.bodyText);
    window.location.href = url;
    setSentSuccessMessage(`Abriendo cliente de correo predeterminado...`);
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    emailPayload.orderIdOrCode
  )}&bgcolor=ffffff&color=000000&margin=2`;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden relative my-auto max-h-[94vh] flex flex-col ${
          theme === 'light'
            ? 'bg-white text-slate-900 border-slate-200'
            : 'bg-[#0A0E17] text-white border-slate-800'
        }`}
      >
        {/* Barra Superior Arcoíris Oficial del Pase */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"></div>

        {/* Cabecera visual */}
        <div className="p-4 pb-3 border-b border-slate-800/80 bg-[#0F1626]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider font-sports text-emerald-400">
                <Check className="w-3 h-3" />
                <span>Despacho de Pase Digital Oficial</span>
              </div>
              <h3 className="text-base sm:text-lg font-black font-sports tracking-wide">
                Enviar Comprobante por Correo Electrónico
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas de Vista */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-800/60 bg-[#0A0E17]">
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            className={`px-3 py-1.5 rounded-xl text-xs font-sports font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'card'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Pase Digital Oficial (HTML)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1.5 rounded-xl text-xs font-sports font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'text'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Texto de Auditoría</span>
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {sentSuccessMessage && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-500/50 rounded-2xl text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{sentSuccessMessage}</span>
            </div>
          )}

          {sentErrorMessage && (
            <div className="p-3 bg-red-950/90 border border-red-500/50 rounded-2xl text-red-300 flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{sentErrorMessage}</span>
            </div>
          )}

          {/* Destinatario y Selección Rápida */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-sports font-bold uppercase tracking-wider">
              <span>Enviar a este Correo Electrónico:</span>
              <span className="text-amber-400">{emailPayload.hostName}</span>
            </div>
            
            <div className="relative">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="ejemplo@gmail.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700 bg-[#151F33] text-white font-sans text-xs focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              />
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            </div>

            {/* Chips de selección rápida de correo */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setRecipientEmail('soportevxp@gmail.com')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-colors cursor-pointer border ${
                  recipientEmail === 'soportevxp@gmail.com'
                    ? 'bg-red-600/30 border-red-500 text-red-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                🏢 Soporte & Anfitrión: soportevxp@gmail.com
              </button>
              {userEmail && userEmail !== 'soportevxp@gmail.com' && (
                <button
                  type="button"
                  onClick={() => setRecipientEmail(userEmail)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-colors cursor-pointer border ${
                    recipientEmail === userEmail
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  👤 Mi Correo: {userEmail}
                </button>
              )}
            </div>
          </div>

          {activeTab === 'card' ? (
            /* ========================================================
               FORMATO PASE DIGITAL OFICIAL IDÉNTICO AL CAPTURADO
               ======================================================== */
            <div className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-5 text-center shadow-xl space-y-4 relative overflow-hidden font-sports">
              {/* Top Rainbow */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"></div>

              {/* Badge Superior */}
              <div className="inline-block px-3 py-1 rounded-full bg-red-600/15 border border-red-500/40 text-red-500 text-[10px] font-black uppercase tracking-wider">
                🎟️ PASE DIGITAL OFICIAL
              </div>

              {/* Título Principal */}
              <div>
                <h4 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide leading-tight">
                  {emailPayload.summary.eventTitle || emailPayload.subject.replace(/\[.*?\]\s*/g, '')}
                </h4>
                <p className="text-xs text-slate-400 font-medium font-sans mt-0.5">
                  Liga ARCO Mexicana del Pacífico • {emailPayload.summary.venueName || 'Estadio Teodoro Mariscal'}
                </p>
              </div>

              {/* QR Code Blanco Centrado */}
              <div className="bg-white rounded-2xl p-3.5 inline-block shadow-2xl mx-auto">
                <img
                  src={qrImageUrl}
                  alt="Código QR de Auditoría"
                  className="w-44 h-44 rounded-xl mx-auto block"
                />
              </div>

              {/* Código Box */}
              <div>
                <div className="inline-block px-4 py-1.5 rounded-xl bg-[#101625] border border-slate-700/80 font-mono font-black text-sm text-white tracking-widest">
                  {emailPayload.orderIdOrCode}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                  MUESTRA ESTE CÓDIGO EN EL LECTOR DEL MOLINETE
                </p>
              </div>

              {/* AVISO DE SEGURIDAD ANTICAPTURAS */}
              <div className="bg-amber-500/10 border border-dashed border-amber-500/40 rounded-xl p-3 text-left space-y-1 font-sans">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase font-sports tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Aviso de Seguridad Anticaptura</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Este código QR estático es un comprobante de auditoría emitido al correo del anfitrión. <strong>No es válido para ingresar al estadio por molinete</strong>, ya que el acceso físico requiere el código QR dinámico interactivo generado en tiempo real dentro de la aplicación móvil.
                </p>
              </div>

              {/* Línea Divisoria Punteada Tipo Boleto */}
              <div className="border-t-2 border-dashed border-slate-800 -mx-5 my-3 relative"></div>

              {/* Fecha y Recinto */}
              <div className="text-left space-y-2">
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    FECHA Y HORA DEL EVENTO
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white">
                    {emailPayload.date}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    RECINTO
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1">
                    <span className="text-red-500">📍</span>
                    <span>{emailPayload.summary.venueName || 'ESTADIO TEODORO MARISCAL'}</span>
                  </div>
                </div>
              </div>

              {/* Asignación de Butaca (3 columnas) */}
              <div className="text-left">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  ASIGNACIÓN DE BUTACA
                </div>
                <div className="grid grid-cols-3 bg-[#0F1626] border border-slate-800 rounded-xl overflow-hidden divide-x divide-slate-800 text-center">
                  <div className="p-2.5">
                    <div className="text-[8px] font-bold text-slate-400 uppercase">ZONA / SECCIÓN</div>
                    <div className="text-xs font-black text-white truncate mt-0.5">
                      {emailPayload.summary.zoneSection || 'DIAMANTE'}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-[8px] font-bold text-slate-400 uppercase">FILA</div>
                    <div className="text-xs font-black text-amber-400 mt-0.5">
                      {emailPayload.summary.row || 'Fila A'}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-[8px] font-bold text-slate-400 uppercase">BUTACA</div>
                    <div className="text-xs font-black text-red-400 mt-0.5">
                      {emailPayload.summary.seat || 'Asiento 2'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalle Inferior: Puerta y Total */}
              <div className="flex items-center justify-between bg-[#0F1626] border border-slate-800 rounded-xl p-3 text-left">
                <div>
                  <div className="text-[9px] text-slate-400">Puerta de ingreso:</div>
                  <div className="text-xs font-black text-white mt-0.5">
                    {emailPayload.summary.gate || 'Puertas 1 y 2'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-slate-400">Total:</div>
                  <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                    ${emailPayload.summary.total.toLocaleString('es-MX')} MXN
                  </div>
                </div>
              </div>

              {/* Sello de Auditoría */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>
                  Ref: <strong className="text-slate-300">#{emailPayload.orderIdOrCode.slice(-6)}</strong>
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Autenticado por Stripe</span>
                </span>
              </div>
            </div>
          ) : (
            /* Vista de Texto Plano */
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-sports font-black uppercase tracking-wider text-slate-400">
                  Cuerpo del Mensaje (Texto Plano):
                </label>
                <button
                  type="button"
                  onClick={handleCopyBody}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-2xl border border-slate-800 bg-[#080D18] text-slate-300 font-mono text-[10px] leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                {emailPayload.bodyText}
              </pre>
            </div>
          )}
        </div>

        {/* Acciones inferiores */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
          {/* Botón Principal: Enviar Directamente vía Gmail API */}
          <button
            type="button"
            disabled={sendingGmail}
            onClick={handleSendViaGmailApi}
            className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-sports font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Send className="w-4 h-4" />
            <span>{sendingGmail ? 'Enviando a Gmail...' : 'Enviar por Gmail (Directo)'}</span>
          </button>

          {/* Botón 2: Abrir en Gmail Web / App */}
          <button
            type="button"
            onClick={handleOpenGmailCompose}
            className="py-2.5 px-3 rounded-xl border border-red-500/40 bg-red-950/40 hover:bg-red-900/60 text-red-200 text-xs font-bold font-sports uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Redactar en Gmail"
          >
            <ExternalLink className="w-3.5 h-3.5 text-red-400" />
            <span>Abrir en Gmail</span>
          </button>

          {/* Botón 3: Copiar texto */}
          <button
            type="button"
            onClick={handleCopyBody}
            className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-sports uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Copiar texto de la orden"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
