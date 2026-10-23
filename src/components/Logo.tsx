import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { appIdentities } from '../data/appIdentity';

const LOGO_URL = "/PadiCheck_Verified_Document_Logo_(1).png";

interface LogoProps {
  height?: number;
  className?: string;
}

export function Logo({ height = 28, className = '' }: LogoProps) {
  const { resolved } = useTheme();

  // The artwork has a white background and navy lettering, so dark mode uses the app mark + live wordmark.
  if (resolved === 'dark') {
    return (
      <span className={`inline-flex shrink-0 items-center gap-2 ${className}`} style={{ height }} aria-label="PadiCheck" role="img">
        <img src={appIdentities.consumer.icon} alt="" className="rounded-lg object-cover" style={{ height, width: height }} />
        <span className="font-extrabold tracking-tight" style={{ fontSize: height * 0.78, lineHeight: 1 }} aria-hidden="true">
          <span className="text-ink">Padi</span>
          <span className="text-brand-bright">Check</span>
        </span>
      </span>);

  }

  const imgH = height / 0.434;
  const imgW = imgH * 2;
  return (
    <span className={`relative block shrink-0 overflow-hidden ${className}`} style={{ height, width: imgW * 0.852 }}>
      <img
        src={LOGO_URL}
        alt="PadiCheck"
        className="mix-blend-multiply"
        style={{ position: 'absolute', height: imgH, width: imgW, maxWidth: 'none', left: -imgW * 0.079, top: -imgH * 0.276 }} />
      
    </span>);

}