import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

/** QR codes always render dark-on-white so they scan reliably in both themes. */
export function QrCode({ value, size = 160, label }: {value: string;size?: number;label: string;}) {
  return (
    <div className="inline-block rounded-2xl bg-white p-3" role="img" aria-label={label}>
      <QRCodeSVG value={value} size={size} level="M" fgColor="#0B1A33" bgColor="#FFFFFF" />
    </div>);

}