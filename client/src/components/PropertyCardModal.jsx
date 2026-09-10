import React, { useState, useRef } from 'react';
import { X, Home, Building, DollarSign, ShieldAlert, ShieldCheck, Sparkles, Handshake } from 'lucide-react';
import { COLOR_GROUPS } from '../game/boardData.js';

// Özel etkinlik ve aksiyon kareleri için resmi kural sözlüğü
function getSpecialTileInfo(tile) {
  switch (tile.type) {
    case 'chest':
      return {
        badge: 'BELEDİYE & İMAR',
        headerColor: '#0891b2',
        category: 'Belediye & İmar Evrakı',
        icon: '🏛️',
        summary: 'Belediye & İmar destesinden resmi bir evrak çekilir.',
        rules: [
          'Bu kareye geldiğinizde Belediye & İmar destesinden bir kart çekmek zorunludur.',
          'Kartlar; ruhsat, altyapı bedelleri, belediye istimlak tazminatları veya sevk emirlerini içerir.',
          'Kart üzerindeki işlem (tahsilat, ödeme veya piyon sevki) anında icra edilir.'
        ]
      };
    case 'chance':
      return {
        badge: 'İHALE & FIRSAT',
        headerColor: '#d97706',
        category: 'İhale & Fırsat Destesi',
        icon: '📜',
        summary: 'İhale & Fırsat destesinden sürpriz bir proje kartı çekilir.',
        rules: [
          'Bu kareye geldiğinizde İhale & Fırsat destesinden bir kart çekilir.',
          'Kartlar; belirli projelere ilerleme, şantiye tesisat/İSG revizyonu veya Maliye Denetimi\'ne sevk gibi işlemleri uygular.',
          'İlgili işlem hemen yerine getirilir.'
        ]
      };
    case 'jail':
      return {
        badge: 'MALİYE DENETİMİ (KODES)',
        headerColor: '#334155',
        category: 'Ziyaret ve Denetim Alanı',
        icon: '📋',
        summary: 'Normal adımlamayla gelenler ziyaretçidir; incelemeye sevk edilenler denetimdedir.',
        rules: [
          'Ziyaretçi Statüsü: Normal zar atarak bu kareye geldiğinizde yalnızca ziyaretçisinizdir. Ceza ödemezsiniz.',
          'Denetim Statüsü: "Vergi İncelemesi" karesine basarak, 3 kez üst üste çift zar atarak veya ilgili kart kararıyla buraya sevk edildiyseniz denetimdesinizdir.',
          'Denetimde Kira Tahsilatı: Resmi kurallara göre denetimdeyken de sahip olduğunuz mülklerden %100 tam kira toplamaya devam edersiniz.',
          'Denetimden Çıkış: 1) Kendi turunuzda çift zar atmak (3 tur deneme hakkı), 2) 50₺ harç ödemek, veya 3) "Vergi Barışı & İmar Affı Belgesi" kullanmak.'
        ]
      };
    case 'gotojail':
      return {
        badge: 'VERGİ İNCELEMESİ (MÜFETTİŞ)',
        headerColor: '#be123c',
        category: 'Maliye Denetimi Sevk',
        icon: '🕵️‍♂️',
        summary: 'Doğrudan Maliye Denetimi\'ne (10. Kare) sevk edilirsiniz.',
        rules: [
          'Bu kareye basan oyuncu anında 10. kare olan Maliye Denetimi karesine sevk edilir.',
          'Merkez Şantiye (Başlangıç) üzerinden geçilmez ve 200₺ tur başı maaşı alınamaz.',
          'Oyuncunun turu derhal sona erer.'
        ]
      };
    case 'go':
      return {
        badge: 'MERKEZ ŞANTİYE (BAŞLANGIÇ)',
        headerColor: '#047857',
        category: 'Maaş ve Başlangıç',
        icon: '👷',
        summary: 'Her tam turu tamamladığınızda veya tam üzerine bastığınızda 200₺ maaş kazanırsınız.',
        rules: [
          'Buradan geçtiğinizde veya tam üzerine bastığınızda kasanıza 200₺ maaş aktarılır.',
          'Resmi kurallarda bu miktar tüm oyun boyunca sabit 200₺ olarak kalır.'
        ]
      };
    case 'parking':
      return {
        badge: 'DİNLENME TESİSİ (MOLA)',
        headerColor: '#b45309',
        category: 'Serbest Mola Alanı',
        icon: '☕',
        summary: 'Herhangi bir kira veya ceza ödenmeyen güvenli dinlenme sahası.',
        rules: [
          'Bu karede duran oyuncu tamamen güvendedir ve hiçbir ödeme yapmaz.',
          'Resmi kurallara göre burası sadece dinlenme alanıdır; ceza havuzu veya ikramiye birikmez.'
        ]
      };
    case 'tax':
      return {
        badge: tile.amount >= 200 ? 'GELİR VERGİSİ (200₺)' : 'LÜKS VERGİSİ (100₺)',
        headerColor: '#b91c1c',
        category: 'Zorunlu Vergi Tahsilatı',
        icon: tile.amount >= 200 ? '💸' : '💎',
        summary: `${tile.amount || 200}₺ tutarındaki vergi Bankaya ödenir.`,
        rules: [
          `Bu kareye basıldığında ${tile.amount || 200}₺ doğrudan Bankaya ödenir.`,
          'Ödenen vergi bedeli kasaya gider, dinlenme tesisinde birikmez.',
          'Yeterli nakdiniz yoksa ev/otel satmanız veya tapularınızı ipotek etmeniz gerekir.'
        ]
      };
    default:
      return {
        badge: 'ÖZEL ETKİNLİK ALANI',
        headerColor: '#334155',
        category: 'Özel Ankara Karesi',
        icon: tile.icon || '📍',
        summary: tile.description || 'Bu kareye özel kurallar geçerlidir.',
        rules: [
          tile.description || 'Bu alana geldiğinizde ilgili etkinlik veya işlem uygulanır.'
        ]
      };
  }
}

export function PropertyCardModal({
  tile,
  gameState,
  myPlayerId,
  onClose,
  onBuildHouse,
  onSellHouse,
  onMortgage,
  onUnmortgage,
  onOpenTrade,
  onStartAuction
}) {
  if (!tile) return null;

  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, lightX: 50, lightY: 50, isHovering: false });

  const isProperty = tile.type === 'property';
  const isRailroad = tile.type === 'railroad';
  const isUtility = tile.type === 'utility';
  const isOwnable = isProperty || isRailroad || isUtility;

  const propState = isOwnable ? gameState.properties[tile.id] : null;
  const owner = propState?.ownerId ? gameState.players.find(p => p.id === propState.ownerId) : null;
  const isOwner = owner?.id === myPlayerId;

  // Renk grubuna sahip olma kontrolü
  const groupTileIds = tile.group ? COLOR_GROUPS[tile.group] : [];
  const ownsWholeGroup = isProperty && groupTileIds.length > 0 && groupTileIds.every(id => gameState.properties[id]?.ownerId === myPlayerId);

  // 3D Card Tilt & Specular Light Physics (Hafifletilmiş ve yumuşatılmış)
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Merkezden normalize: -1 ile 1 arası
    const normX = (x / rect.width - 0.5) * 2;
    const normY = (y / rect.height - 0.5) * 2;

    // Kartın çok dönmesini engellemek için hafif ve yumuşak açı sınırı [-2.2deg, 2.2deg]
    const rotateX = -normY * 2.2;
    const rotateY = normX * 2.2;

    const lightX = Math.round((x / rect.width) * 100);
    const lightY = Math.round((y / rect.height) * 100);

    setTilt({
      rotateX,
      rotateY,
      lightX,
      lightY,
      isHovering: true
    });
  };

  const handleMouseLeave = () => {
    setTilt({
      rotateX: 0,
      rotateY: 0,
      lightX: 50,
      lightY: 50,
      isHovering: false
    });
  };

  // TAPU SENEDİ OLMAYAN (ÖZEL ETKİNLİK, ŞANS, MALİYE VB.) KARELER İÇİN BİLGİLENDİRME KARTI
  if (!isOwnable) {
    const info = getSpecialTileInfo(tile);
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn [perspective:1200px]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(${tilt.isHovering ? 1.008 : 1}, ${tilt.isHovering ? 1.008 : 1}, 1)`,
            transition: tilt.isHovering ? 'transform 0.12s ease-out' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)'
          }}
          className="relative w-full max-w-sm bg-slate-900 border-2 border-slate-700/80 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col will-change-transform select-none max-h-[92vh] overflow-y-auto custom-scrollbar"
        >
          {/* Specular Radial Gradient */}
          <div
            className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300"
            style={{
              opacity: tilt.isHovering ? 0.35 : 0,
              background: `radial-gradient(circle 200px at ${tilt.lightX}% ${tilt.lightY}%, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.02) 45%, transparent 75%)`
            }}
          />
          {/* Shimmer */}
          <div className="absolute -inset-x-full top-0 bottom-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-25deg] pointer-events-none z-30 animate-shimmer opacity-30" />

          {/* Kapat Butonu */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-40 w-8 h-8 rounded-full bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition border border-white/20 shadow-md cursor-pointer"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Başlık */}
          <div
            className="p-4 sm:p-5 text-center relative border-b border-black/30 flex-shrink-0"
            style={{ backgroundColor: info.headerColor || '#334155' }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/30 border border-white/20 mb-1">
              <span className="text-xs">{info.icon}</span>
              <span className="text-[9.5px] font-black tracking-widest text-white uppercase font-space">
                {info.badge}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow-md font-space">
              {tile.name}
            </h2>
            <span className="text-[9px] text-white/80 font-bold block uppercase tracking-widest mt-0.5 font-jetbrains">
              ANKARA • ÖZEL ETKİNLİK ALANI
            </span>
          </div>

          {/* Fotoğraf / Görsel */}
          <div className="relative w-full h-32 sm:h-36 bg-slate-950 flex-shrink-0 overflow-hidden border-b border-slate-800 flex items-center justify-center">
            {tile.image ? (
              <img
                src={tile.image}
                alt={tile.name}
                className="w-full h-full object-cover brightness-95 contrast-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl" style={{ backgroundColor: info.headerColor || '#334155' }}>
                {info.icon || tile.icon || '📍'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-md bg-black/60 border border-white/20 backdrop-blur-sm font-space">
                {info.category}
              </span>
              {tile.amount ? (
                <span className="text-xs font-black text-rose-300 px-2 py-0.5 rounded-md bg-black/60 border border-rose-400/40 backdrop-blur-sm font-mono">
                  -{tile.amount}₺ Kesinti
                </span>
              ) : tile.id === 0 ? (
                <span className="text-xs font-black text-emerald-300 px-2 py-0.5 rounded-md bg-black/60 border border-emerald-400/40 backdrop-blur-sm font-mono">
                  +200₺ Maaş
                </span>
              ) : null}
            </div>
          </div>

          {/* İçerik */}
          <div className="p-4 sm:p-5 space-y-3 text-xs flex-1">
            {/* Özet Kutusu */}
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2.5">
              <span className="text-xl flex-shrink-0">{info.icon}</span>
              <p className="text-slate-200 text-xs leading-relaxed font-medium">
                {info.summary}
              </p>
            </div>

            {/* Kurallar & İşleyiş */}
            <div className="space-y-2 border border-slate-800 rounded-2xl p-3 bg-slate-950/60">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-space">
                📋 KURAL VE İŞLEYİŞ
              </span>
              <ul className="space-y-1.5 text-slate-300 text-[11px] leading-snug">
                {info.rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold flex-shrink-0 mt-0.5">▸</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Kapat / Anladım Butonu */}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs font-space tracking-wider uppercase shadow-md transition active:scale-95 cursor-pointer mt-1"
            >
              Anladım (Kapat)
            </button>

            {/* İnceleme İpucu */}
            <div className="text-center pt-0.5 text-[9.5px] text-slate-500 italic">
              Farenizi kart üzerinde gezdirerek 3D ışık yansımasını deneyimleyin
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn [perspective:1200px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 3D Döndürülebilir Tapu Kartı (Hafif, Yumuşak ve Stabil) */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(${tilt.isHovering ? 1.008 : 1}, ${tilt.isHovering ? 1.008 : 1}, 1)`,
          transition: tilt.isHovering ? 'transform 0.12s ease-out' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)'
        }}
        className="relative w-full max-w-sm bg-slate-900 border-2 border-slate-700/80 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col will-change-transform select-none max-h-[92vh] overflow-y-auto custom-scrollbar"
      >
        {/* Güçsüzleştirilmiş & Yumuşatılmış Specular Radial Gradient Işık Yansıması */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300"
          style={{
            opacity: tilt.isHovering ? 0.35 : 0,
            background: `radial-gradient(circle 200px at ${tilt.lightX}% ${tilt.lightY}%, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.02) 45%, transparent 75%)`
          }}
        />

        {/* Narin Shimmer Işık Çizgisi */}
        <div className="absolute -inset-x-full top-0 bottom-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-25deg] pointer-events-none z-30 animate-shimmer opacity-30" />

        {/* Kapat Butonu */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-40 w-8 h-8 rounded-full bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition border border-white/20 shadow-md cursor-pointer"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Klasik Tapu Kartı Başlığı */}
        <div
          className="p-4 sm:p-5 text-center relative border-b border-black/30 flex-shrink-0"
          style={{ backgroundColor: tile.groupColor || '#334155' }}
        >
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/30 border border-white/20 mb-1">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span className="text-[9px] font-black tracking-widest text-amber-200 uppercase">
              TAPU SENEDİ İNCELEME
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow-md">
            {tile.name}
          </h2>
          <span className="text-[9px] text-white/80 font-bold block uppercase tracking-wider mt-0.5">
            ANKARA
          </span>
        </div>

        {/* Kartın Küçük Resim / Fotoğraf Bölümü (ASLA BOŞ DURMAZ) */}
        <div className="relative w-full h-32 sm:h-36 bg-slate-950 flex-shrink-0 overflow-hidden border-b border-slate-800 flex items-center justify-center">
          {tile.image ? (
            <img
              src={tile.image}
              alt={tile.name}
              className="w-full h-full object-cover brightness-95 contrast-105 transition-transform duration-500 hover:scale-105"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl" style={{ backgroundColor: tile.groupColor || '#334155' }}>
              {tile.icon || '🏛️'}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between pointer-events-none">
            <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-md bg-black/60 border border-white/20 backdrop-blur-sm">
              {tile.type === 'property' ? 'Konut / Arsa' : tile.type === 'railroad' ? 'Tren İstasyonu' : 'Kamu Tesisi'}
            </span>
            {tile.cost && (
              <span className="text-xs font-black text-amber-300 px-2 py-0.5 rounded-md bg-black/60 border border-amber-400/40 backdrop-blur-sm font-mono">
                {tile.cost}₺
              </span>
            )}
          </div>
        </div>

        {/* Kart İçeriği & Kira Listesi */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1">
          {/* Sahip Bilgisi */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/70 border border-slate-700">
            <span className="text-slate-400 font-semibold">Mülk Sahibi:</span>
            {owner ? (
              <span className="font-bold flex items-center gap-1.5" style={{ color: owner.color }}>
                <span>{typeof owner.token === 'object' ? (owner.token?.icon || '👷') : (owner.token || '👷')}</span>
                <span>{owner.name} {isOwner && '(Sen)'}</span>
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Sahipsiz (Satılık)
              </span>
            )}
          </div>

          {/* Arsa Kira Tablosu */}
          {isProperty && (
            <div className="space-y-1.5 border border-slate-800 rounded-2xl p-3 bg-slate-950/60">
              <div className="flex justify-between py-0.5 border-b border-slate-800/80 font-semibold text-slate-300">
                <span>Yalın Arsa Kirası:</span>
                <span className="text-amber-400 font-bold font-mono">{tile.rent[0]}₺</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-400">
                <span>Tüm Renk Setiyle (2x):</span>
                <span className="text-amber-300 font-semibold font-mono">{tile.rent[0] * 2}₺</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-400">
                <span>1 Ev ile:</span>
                <span className="text-white font-mono">{tile.rent[1]}₺</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-400">
                <span>2 Ev ile:</span>
                <span className="text-white font-mono">{tile.rent[2]}₺</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-400">
                <span>3 Ev ile:</span>
                <span className="text-white font-mono">{tile.rent[3]}₺</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-400">
                <span>4 Ev ile:</span>
                <span className="text-white font-mono">{tile.rent[4]}₺</span>
              </div>
              <div className="flex justify-between py-0.5 font-bold text-rose-400 pt-1 border-t border-slate-800/80">
                <span>🏨 Otel ile:</span>
                <span className="font-mono">{tile.rent[5]}₺</span>
              </div>
            </div>
          )}

          {/* Gar / İstasyon Bilgisi */}
          {isRailroad && (() => {
            const r0 = tile.rent?.[0] || 25;
            const r1 = tile.rent?.[1] || 50;
            const r2 = tile.rent?.[2] || 100;
            const r3 = tile.rent?.[3] || 200;
            return (
              <div className="space-y-1.5 border border-slate-800 rounded-2xl p-3 bg-slate-950/60 text-slate-300">
                <div className="flex justify-between"><span>1 İstasyon Sahibi:</span><span className="font-bold text-amber-400 font-mono">{r0}₺</span></div>
                <div className="flex justify-between"><span>2 İstasyon Sahibi:</span><span className="font-bold text-amber-400 font-mono">{r1}₺</span></div>
                <div className="flex justify-between"><span>3 İstasyon Sahibi:</span><span className="font-bold text-amber-400 font-mono">{r2}₺</span></div>
                <div className="flex justify-between font-bold text-emerald-400">
                  <span>4 İstasyon Sahibi:</span>
                  <span className="font-mono">{r3}₺</span>
                </div>
              </div>
            );
          })()}

          {/* Hizmet / Kamu Kuruluşu Bilgisi */}
          {isUtility && (
            <div className="space-y-2 border border-slate-800 rounded-2xl p-3 bg-slate-950/60 text-slate-300 text-xs">
              <div className="flex justify-between font-bold text-slate-400 border-b border-slate-800 pb-1 text-[11px]">
                <span>Mülkiyet Durumu</span>
                <span>Kira Formülü</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">1 Tesis Sahibi:</span>
                <span className="font-jetbrains font-bold text-amber-400">Zar Toplamının 4 Katı</span>
              </div>
              <div className="flex justify-between items-center text-emerald-300">
                <span>2 Tesis Sahibi (İkisi de):</span>
                <span className="font-jetbrains font-bold text-emerald-400">Zar Toplamının 10 Katı</span>
              </div>
            </div>
          )}

          {/* Maliyet ve İpotek Değerleri */}
          <div className="grid grid-cols-2 gap-2 text-center">
            {tile.cost && (
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Satın Alma</span>
                <span className="font-black text-amber-400 text-sm font-mono">{tile.cost}₺</span>
              </div>
            )}
            {tile.houseCost && (
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Ev Maliyeti</span>
                <span className="font-black text-emerald-400 text-sm font-mono">{tile.houseCost}₺</span>
              </div>
            )}
            {tile.mortgage && (
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 col-span-2">
                <span className="text-[10px] text-slate-400 block">İpotek Bedeli</span>
                <span className="font-bold text-slate-300 font-mono">{tile.mortgage}₺</span>
              </div>
            )}
          </div>

          {/* Sahip Eylemleri (Ev İnşa Et / İpotek) */}
          {isOwner && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              {isProperty && ownsWholeGroup && (
                <div className="space-y-1">
                  <button
                    onClick={() => onBuildHouse(tile.id)}
                    disabled={propState.houses >= 5 || propState.mortgaged}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
                  >
                    <Home className="w-4 h-4" />
                    <span>
                      {propState.houses === 4
                        ? `Otele Yükselt (${tile.houseCost}₺)`
                        : `Ev İnşa Et (${tile.houseCost}₺)`}
                    </span>
                  </button>
                </div>
              )}

              {/* Ev Satma Seçeneği */}
              {isProperty && propState.houses > 0 && (
                <button
                  onClick={() => onSellHouse(tile.id)}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>1 Ev/Otel Sat (+{Math.round(tile.houseCost * 0.5)}₺)</span>
                </button>
              )}

              {propState.mortgaged ? (
                <button
                  onClick={() => onUnmortgage(tile.id)}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    İpoteği Kaldır ({Math.round(tile.mortgage * 1.1)}₺)
                    <span className="text-[10px] text-sky-200 ml-1">(%10 Faiz)</span>
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => onMortgage(tile.id)}
                  disabled={propState.houses > 0}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-rose-300 border border-rose-500/30 rounded-xl font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                  title={propState.houses > 0 ? 'İpotek etmeden önce bu gruptaki tüm evler satılmalıdır' : 'Mülkü ipotek et'}
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Mülkü İpotek Et (+{tile.mortgage}₺)</span>
                </button>
              )}
            </div>
          )}

          {/* Başkasına Aitse Satın Alma / Takas Teklifi Butonu */}
          {!isOwner && owner && !owner.isBankrupt && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-amber-950/40 border border-indigo-500/40 flex items-center justify-between gap-2.5 shadow-lg">
                <div className="text-left min-w-0 flex-1">
                  <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">
                    Satın Alma / Takas Teklifi
                  </span>
                  <span className="text-xs text-slate-200 truncate block font-medium">
                    Sahibi: <strong style={{ color: owner.color }}>{owner.name}</strong>
                  </span>
                  {propState?.houses > 0 && (
                    <span className="text-[10px] text-amber-400 font-medium block mt-0.5">
                      ⚠️ Binalı mülk takas edilemez (Önce binalar satılmalıdır).
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (propState?.houses > 0) return;
                    onClose();
                    onOpenTrade && onOpenTrade(owner, tile.id, tile.cost);
                  }}
                  disabled={propState?.houses > 0}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md flex-shrink-0 ${
                    propState?.houses > 0
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-110 text-slate-950 shadow-amber-500/30 cursor-pointer'
                  }`}
                  title={propState?.houses > 0 ? 'Binalı mülk takas edilemez' : 'Bu mülkü almak için teklif ver'}
                >
                  <Handshake className="w-4 h-4 stroke-[2.5]" />
                  <span>Teklif Yap</span>
                </button>
              </div>
            </div>
          )}

          {/* İnceleme İpucu */}
          <div className="text-center pt-1 text-[9.5px] text-slate-500 italic">
            Farenizi kart üzerinde gezdirerek 3D bükme ve ışık yansımasını deneyimleyin
          </div>
        </div>
      </div>
    </div>
  );
}
