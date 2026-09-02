import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'warning' | 'primary';
  itemName?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Deseas eliminar esto?',
  message = 'Esta acción no se puede deshacer y el elemento será eliminado permanentemente.',
  confirmText = 'Sí, Eliminar',
  cancelText = 'Cancelar',
  isLoading = false,
  variant = 'danger',
  itemName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[92vh]">
        {/* Cabecera con botón de cerrar */}
        <div className="p-4 sm:p-5 pb-0 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                variant === 'danger'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : variant === 'warning'
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              {variant === 'danger' ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Confirmación de acción requerida</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo del Mensaje */}
        <div className="p-4 sm:p-5 pt-3 space-y-3 overflow-y-auto flex-1 text-xs sm:text-sm">
          <p className="text-slate-600 leading-relaxed">
            {message}
          </p>

          {itemName && (
            <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 break-words flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 shrink-0"></span>
              <span className="truncate">{itemName}</span>
            </div>
          )}
        </div>

        {/* Pie con Botones de Cancelar y Eliminar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50 text-center"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-black rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-700 hover:bg-red-800 text-white shadow-red-700/20'
                : variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20'
            }`}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
