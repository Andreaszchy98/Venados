import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode as QrIcon } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 128,
  className = '',
  alt = 'Código QR de acceso',
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setDataUrl(null);
      return;
    }

    QRCode.toDataURL(
      value,
      {
        width: size * 2, // 2x para nitidez retina
        margin: 1,
        color: {
          dark: '#0A0E17',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      },
      (err, url) => {
        if (!isMounted) return;
        if (err) {
          console.error('Error generating QR code:', err);
          setError(true);
        } else {
          setDataUrl(url);
          setError(false);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (error || !value) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 p-2 ${className}`}
        style={{ width: size, height: size }}
      >
        <QrIcon className="w-8 h-8 text-slate-400" />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-50 rounded-lg p-2 animate-pulse ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={`block object-contain select-none ${className}`}
      loading="lazy"
    />
  );
};
