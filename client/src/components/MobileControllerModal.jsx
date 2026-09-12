import React, { useState, useMemo } from 'react';
import { generateQrSvg } from '../utils/qrCodeSvg.js';
import { Copy, Check, ExternalLink, Smartphone, X, Sparkles } from 'lucide-react';

export function MobileControllerModal({ roomCode, playerId, playerName, onClose }) {
  const [copied, setCopied] = useState(false);

  // Mobil kumanda URL'si (Kısa parametreler QR kodunu hafif ve okunabilir tutar)
  const controllerUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const params = new URLSearchParams();
    params.set('c', roomCode || '');
    if (playerId) params.set('p', playerId);
    if (playerName) params.set('n', playerName);
    return `${origin}/?${params.toString()}`;
  }, [roomCode, playerId, playerName]);

  // QR SVG içeriği
  const qrSvgMarkup = useMemo(() => {
    return generateQrSvg(controllerUrl, '#0f172a', '#ffffff', 2);
  }, [controllerUrl]);

  const handleCopy = () => {
    if (!controllerUrl) return;
    navigator.clipboard.writeText(controllerUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-400/80 shadow-[0_0_50px_rgba(245,158,11,0.35)] p-5 sm:p-6 text-slate-100 flex flex-col items-center text-center">
        
        {/* Kapat Butonu */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Başlık İkonu */}
        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-2xl mb-3 shadow-inner">
          <Smartphone className="w-6 h-6 text-amber-400 animate-pulse" />
        </div>

        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1 mb-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          FİZİKSEL JİROSKOP KUMANDASI
        </span>
        <h3 className="text-base sm:text-lg font-black font-space tracking-tight text-white mb-2">
          Telefonu Salla, Zarları At!
        </h3>
        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Kameranı açıp QR kodu tara veya linki telefonunda aç. Sıran geldiğinde telefonunu elinde sallayarak masaya 3D zar fırlat!
        </p>

        {/* QR Kod Çerçevesi */}
        <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-amber-400/60 mb-4 w-48 h-48 flex items-center justify-center overflow-hidden">
          <div
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
          />
        </div>

        {/* Bağlantı Kopyalama & Test */}
        <div className="w-full flex items-center gap-2 mb-3">
          <input
            type="text"
            readOnly
            value={controllerUrl}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-slate-300 truncate focus:outline-none select-all"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer flex-shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
          </button>
        </div>

        {/* Yeni Sekmede Dene */}
        <a
          href={controllerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
        >
          <span>Tarayıcıda test et</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
