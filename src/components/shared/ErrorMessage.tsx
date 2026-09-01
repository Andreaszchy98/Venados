import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800 text-sm">
      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-red-900 leading-snug">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-500 hover:text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors"
        >
          Cerrar
        </button>
      )}
    </div>
  );
};
