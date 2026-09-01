import React from 'react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Cargando datos...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
      <div className="w-8 h-8 border-3 border-red-700 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
};
