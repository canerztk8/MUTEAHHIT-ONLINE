import React, { useState, useEffect, useRef } from 'react';
import { X, Handshake, Check, Ban, AlertTriangle, ShieldAlert, Sparkles, TrendingDown, Clock } from 'lucide-react';
import { BOARD_TILES } from '../game/boardData.js';

export function TradeModal({
  gameState,
  myPlayerId,
  targetPlayer,
  initialRequestedPropId,
  initialOfferedMoney = 0,
  onClose,
  onProposeTrade,
  onRespondTrade
}) {
  const { players = [], properties = {}, pendingTrade, tradeQueue = [], tradeCooldowns = {} } = gameState || {};
  const me = players.find(p => p.id === myPlayerId);

  // Gelen Takas Teklifi Varsa
  const isIncomingTrade = Boolean(pendingTrade && pendingTrade.toPlayerId === myPlayerId);

  // Canlı saniye sayacı (cooldown için)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Gelen teklif yanıtlandığında veya iptal olduğunda, sırada başka gelen teklif kalmadıysa modalı otomatik kapat
  const wasIncomingRef = useRef(isIncomingTrade);
  useEffect(() => {
    if (wasIncomingRef.current && !pendingTrade) {
      onClose();
    }
    wasIncomingRef.current = Boolean(pendingTrade && pendingTrade.toPlayerId === myPlayerId);
  }, [pendingTrade, myPlayerId, onClose]);

  // Yeni takas formu durumu
  const [selectedTargetId, setSelectedTargetId] = useState(targetPlayer ? targetPlayer.id : '');
  const [offeredMoney, setOfferedMoney] = useState(() => {
    if (initialOfferedMoney > 0) {
      return Math.min(initialOfferedMoney, Math.max(0, me?.money || 0));
    }
    return 0;
  });
  const [requestedMoney, setRequestedMoney] = useState(0);
  const [offeredProps, setOfferedProps] = useState([]);
  const [requestedProps, setRequestedProps] = useState(initialRequestedPropId ? [initialRequestedPropId] : []);

  React.useEffect(() => {
    if (initialOfferedMoney > 0) {
      setOfferedMoney(Math.min(initialOfferedMoney, Math.max(0, me?.money || 0)));
    }
  }, [initialOfferedMoney, me?.money]);

  React.useEffect(() => {
    if (targetPlayer?.id) {
      setSelectedTargetId(targetPlayer.id);
    }
  }, [targetPlayer?.id]);

  React.useEffect(() => {
    if (initialRequestedPropId) {
      setRequestedProps([initialRequestedPropId]);
    }
  }, [initialRequestedPropId]);

  // Uygun diğer oyuncular
  const otherPlayers = players.filter(p => p.id !== myPlayerId && !p.isBankrupt);
  const activeTarget = players.find(p => p.id === (targetPlayer?.id || selectedTargetId)) || otherPlayers[0];

  // Cooldown hesaplama yardımcısı
  const getCooldownRemaining = (targetId) => {
    if (!myPlayerId || !targetId || !tradeCooldowns) return 0;
    const key = `${myPlayerId}_${targetId}`;
    const lastTime = tradeCooldowns[key] || 0;
    const remaining = Math.ceil((30000 - (now - lastTime)) / 1000);
    return remaining > 0 ? remaining : 0;
  };

  const cooldownRemaining = activeTarget ? getCooldownRemaining(activeTarget.id) : 0;
  const isOnCooldown = cooldownRemaining > 0;

  // Sıradaki teklif sayısı
  const myQueuedTradesCount = tradeQueue.filter(t => t.toPlayerId === myPlayerId).length;

  // Benim mülklerim (bina kurulmamış)
  const myTradableProps = Object.values(properties)
    .filter(p => p.ownerId === myPlayerId && p.houses === 0)
    .map(p => BOARD_TILES[p.tileId]);

  // Hedefin mülkleri (bina kurulmamış)
  const targetTradableProps = activeTarget ? Object.values(properties)
    .filter(p => p.ownerId === activeTarget.id && p.houses === 0)
    .map(p => BOARD_TILES[p.tileId]) : [];

  const toggleOfferedProp = (id) => {
    setOfferedProps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleRequestedProp = (id) => {
    setRequestedProps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Teklif Oluşturma Canlı Değer Hesabı
  const calcOfferedValue = Number(offeredMoney) + offeredProps.reduce((sum, id) => sum + (BOARD_TILES[id]?.cost || 0), 0);
  const calcRequestedValue = Number(requestedMoney) + requestedProps.reduce((sum, id) => sum + (BOARD_TILES[id]?.cost || 0), 0);

  const canSubmitTrade = (offeredProps.length > 0 || requestedProps.length > 0) &&
    !(requestedMoney > 0 && requestedProps.length === 0 && offeredProps.length === 0);

  const handleSendOffer = () => {
    if (!activeTarget || !canSubmitTrade || isOnCooldown) return;
    onProposeTrade({
      toPlayerId: activeTarget.id,
      offeredMoney: Number(offeredMoney),
      offeredProperties: offeredProps,
      requestedMoney: Number(requestedMoney),
      requestedProperties: requestedProps
    });
    onClose();
  };

  const handleRespond = (accept) => {
    onRespondTrade(accept);
    if (myQueuedTradesCount === 0) {
      onClose();
    }
  };

  // Gelen takasın zarara olup olmadığını hesapla
  const isDetrimental = pendingTrade ? (
    pendingTrade.isDetrimental || (pendingTrade.offeredValue < pendingTrade.requestedValue)
  ) : false;

  const valueLoss = pendingTrade ? Math.max(0, pendingTrade.requestedValue - pendingTrade.offeredValue) : 0;
  const offerRatio = pendingTrade && pendingTrade.requestedValue > 0
    ? Math.round((pendingTrade.offeredValue / pendingTrade.requestedValue) * 100)
    : (pendingTrade && pendingTrade.offeredValue > 0 ? 100 : 0);

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 transition-colors ${
      isIncomingTrade && isDetrimental ? 'bg-rose-950/25' : 'bg-black/25'
    }`}>
      <div className={`relative w-full max-w-lg bg-slate-900/95 rounded-3xl shadow-2xl p-4 sm:p-6 max-h-[88vh] overflow-y-auto custom-scrollbar transition-all ${
        isIncomingTrade && isDetrimental
          ? 'border-2 border-rose-500 ring-4 ring-rose-500/40 shadow-rose-900/70 animate-pulse'
          : 'border border-slate-700'
      }`}>
        {/* Kapat butonu */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition z-20"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. DURUM: Bize Gelen Bir Takas Teklifi Varsa */}
        {isIncomingTrade ? (
          <div className="space-y-4 text-center">
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-lg ${
              isDetrimental
                ? 'bg-rose-600/30 border-2 border-rose-500 text-rose-400 animate-bounce-short'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
            }`}>
              {isDetrimental ? '🚨' : <Handshake className="w-7 h-7" />}
            </div>

            <div>
              <h2 className="text-xl font-black text-white">
                {pendingTrade.fromPlayerName} Sana Takas Teklif Etti!
              </h2>

              {/* İstenen Değerin Yüzde Kaçının Teklif Edildiğini Gösteren Rozet */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-md flex items-center gap-1.5 font-jetbrains ${
                  offerRatio >= 100
                    ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                    : offerRatio >= 75
                    ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                    : 'bg-rose-500/20 border border-rose-400 text-rose-300 animate-pulse'
                }`}>
                  <span>📊 Teklif Oranı: %{offerRatio}</span>
                  <span className="text-[10px] font-medium opacity-85">
                    ({pendingTrade.offeredValue}₺ / {pendingTrade.requestedValue}₺)
                  </span>
                </span>

                {myQueuedTradesCount > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 border border-sky-400 text-sky-300 flex items-center gap-1.5 shadow-md">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Sırada bekleyen {myQueuedTradesCount} teklif daha var</span>
                  </span>
                )}
              </div>

              {isDetrimental ? (
                <div className="mt-2 p-3 bg-rose-950/90 border border-rose-500 rounded-2xl text-rose-200 text-xs shadow-lg flex flex-col gap-1">
                  <div className="flex items-center justify-center gap-1.5 font-black text-rose-400 text-sm">
                    <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
                    <span>DİKKAT: BU TEKLİF ZARARINIZA! (KÂRLI DEĞİL)</span>
                  </div>
                  <p className="text-[11px] text-rose-300 font-medium">
                    Karşı tarafın verdiği değer ({pendingTrade.offeredValue}₺), sizden istediği değerden ({pendingTrade.requestedValue}₺) <strong className="text-white font-bold">{valueLoss}₺ DAHA AZ</strong> (İstenen değerin %{offerRatio}'si teklif ediliyor).
                  </p>
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-900/60 py-0.5 rounded">
                    ⚠️ Bu teklifi kabul ederseniz ciddi değer kaybedeceksiniz!
                  </span>
                </div>
              ) : (
                <div className="mt-2 p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Dengeli Teklif (Teklif Değeri: {pendingTrade.offeredValue}₺ vs İstenen: {pendingTrade.requestedValue}₺ - Karşılık: %{offerRatio})</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              {/* Teklif Edilenler */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-400 block mb-1">
                    Alacağın Şeyler:
                  </span>
                  <div className="text-sm font-black text-white mb-2">
                    +{pendingTrade.offeredMoney}₺ Nakit
                  </div>
                  <div className="space-y-1">
                    {pendingTrade.offeredProperties.map(id => {
                      const t = BOARD_TILES[id];
                      return (
                        <div key={id} className="text-xs bg-slate-700/80 px-2 py-1 rounded-lg text-slate-200 flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/40 flex-shrink-0"
                              style={{ backgroundColor: t?.groupColor || '#64748b' }}
                            />
                            <span className="text-[9.5px] font-mono font-bold text-amber-300 flex-shrink-0">
                              #{t?.id}
                            </span>
                            <span className="truncate">{t?.name}</span>
                          </div>
                          <span className="text-[10px] text-amber-400 font-bold flex-shrink-0">{t?.cost}₺</span>
                        </div>
                      );
                    })}
                    {pendingTrade.offeredProperties.length === 0 && (
                      <span className="text-xs text-slate-500 italic">Mülk yok</span>
                    )}
                  </div>
                </div>
                <div className="pt-2 mt-2 border-t border-slate-700/60 text-[11px] text-slate-400 font-semibold">
                  Toplam Değer: <strong className="text-emerald-400 font-bold">{pendingTrade.offeredValue}₺</strong>
                </div>
              </div>

              {/* İstenenler */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-400 block mb-1">
                    Senden İstenenler:
                  </span>
                  <div className="text-sm font-black text-white mb-2">
                    -{pendingTrade.requestedMoney}₺ Nakit
                  </div>
                  <div className="space-y-1">
                    {pendingTrade.requestedProperties.map(id => {
                      const t = BOARD_TILES[id];
                      return (
                        <div key={id} className="text-xs bg-slate-700/80 px-2 py-1 rounded-lg text-slate-200 flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/40 flex-shrink-0"
                              style={{ backgroundColor: t?.groupColor || '#64748b' }}
                            />
                            <span className="text-[9.5px] font-mono font-bold text-rose-300 flex-shrink-0">
                              #{t?.id}
                            </span>
                            <span className="truncate">{t?.name}</span>
                          </div>
                          <span className="text-[10px] text-amber-400 font-bold flex-shrink-0">{t?.cost}₺</span>
                        </div>
                      );
                    })}
                    {pendingTrade.requestedProperties.length === 0 && (
                      <span className="text-xs text-slate-500 italic">Mülk yok</span>
                    )}
                  </div>
                </div>
                <div className="pt-2 mt-2 border-t border-slate-700/60 text-[11px] text-slate-400 font-semibold">
                  Toplam Değer: <strong className="text-rose-400 font-bold">{pendingTrade.requestedValue}₺</strong>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleRespond(true)}
                className={`flex-1 py-3 text-white rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition shadow-lg active:scale-95 cursor-pointer ${
                  isDetrimental
                    ? 'bg-slate-700 hover:bg-slate-600 border border-slate-600'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{isDetrimental ? 'Yine de Kabul Et' : 'Kabul Et'}</span>
              </button>
              <button
                onClick={() => handleRespond(false)}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition shadow-lg shadow-rose-600/30 active:scale-95 cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                <span>Reddet</span>
              </button>
            </div>
          </div>
        ) : (
          /* 2. DURUM: Yeni Takas Oluşturma Formu */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-black text-white">Oyuncular Arası Takas</h2>
            </div>

            {/* Hedef Oyuncu Seçici */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Kiminle Takas Yapacaksın?
              </label>
              <select
                value={activeTarget?.id || ''}
                onChange={(e) => {
                  setSelectedTargetId(e.target.value);
                  setRequestedProps([]);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:outline-none focus:border-amber-400"
              >
                {otherPlayers.map(p => {
                  const cd = getCooldownRemaining(p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.money}₺){cd > 0 ? ` [⏳ ${cd}s Bekleyin]` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2 Sütunlu Teklif Alanı */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Sol: Senin Teklifin */}
              <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">Senin Teklifin</span>
                  <span className="text-[10px] text-slate-400 font-bold">Bakiye: {me?.money}₺</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400 block">Nakit Para:</label>
                    <div className="flex items-center gap-1.5">
                      {initialOfferedMoney > 0 && (
                        <button
                          type="button"
                          onClick={() => setOfferedMoney(Math.min(initialOfferedMoney, Math.max(0, me?.money || 0)))}
                          className="text-[9.5px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                        >
                          [Arsa Bedeli: {initialOfferedMoney}₺]
                        </button>
                      )}
                      {(me?.money || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setOfferedMoney(me.money)}
                          className="text-[9.5px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                        >
                          [Maksimum]
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, me?.money || 0)}
                      value={offeredMoney}
                      onChange={(e) => {
                        const maxAllowed = Math.max(0, me?.money || 0);
                        const num = Math.max(0, Math.min(maxAllowed, Number(e.target.value) || 0));
                        setOfferedMoney(num);
                      }}
                      className="w-16 flex-shrink-0 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold text-center"
                    />
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, me?.money || 0)}
                      step={5}
                      value={offeredMoney}
                      onChange={(e) => {
                        const maxAllowed = Math.max(0, me?.money || 0);
                        const num = Math.max(0, Math.min(maxAllowed, Number(e.target.value) || 0));
                        setOfferedMoney(num);
                      }}
                      className="flex-1 min-w-0 accent-amber-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
                    />
                  </div>
                  {me?.money < 0 && (
                    <span className="text-[10px] text-rose-400 font-semibold block mt-1">
                      ⚠️ Borçtasınız! Nakit veremezsiniz, sadece arsa satıp nakit alabilirsiniz.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Mülklerin:</label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {myTradableProps.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleOfferedProp(t.id)}
                        className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center justify-between gap-1.5 cursor-pointer ${
                          offeredProps.includes(t.id)
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {t.image ? (
                            <img
                              src={t.image}
                              alt={t.name}
                              className="w-4 h-4 rounded object-cover flex-shrink-0"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: t.groupColor || '#64748b' }}
                            />
                          )}
                          <span className="text-[9px] font-mono text-amber-400/90 flex-shrink-0">
                            #{t.id}
                          </span>
                          <span className="truncate">{t.name}</span>
                        </div>
                        <span className="text-[10px] opacity-75 flex-shrink-0">{t.cost}₺</span>
                      </button>
                    ))}
                    {myTradableProps.length === 0 && (
                      <span className="text-slate-500 text-[11px] italic">Verilecek mülk yok</span>
                    )}
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-700/50 text-[11px] text-slate-400 flex justify-between">
                  <span>Toplam Değer:</span>
                  <strong className="text-amber-400">{calcOfferedValue}₺</strong>
                </div>
              </div>

              {/* Sağ: İstenenler */}
              <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-400">{activeTarget?.name} Teklifi</span>
                  <span className="text-[10px] text-slate-400 font-bold">Bakiye: {activeTarget?.money}₺</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400 block">İstediğin Nakit:</label>
                    {(activeTarget?.money || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setRequestedMoney(Math.max(0, activeTarget?.money || 0))}
                        className="text-[9.5px] text-sky-400 hover:text-sky-300 font-bold underline cursor-pointer"
                      >
                        [Tüm Nakti: {activeTarget?.money}₺]
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <input
                      type="number"
                      min={0}
                      max={activeTarget?.money || 0}
                      value={requestedMoney}
                      onChange={(e) => {
                        const maxAllowed = activeTarget?.money || 0;
                        const num = Math.max(0, Math.min(maxAllowed, Number(e.target.value) || 0));
                        setRequestedMoney(num);
                      }}
                      className="w-16 flex-shrink-0 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold text-center"
                    />
                    <input
                      type="range"
                      min={0}
                      max={activeTarget?.money || 0}
                      value={requestedMoney}
                      onChange={(e) => {
                        const maxAllowed = activeTarget?.money || 0;
                        const num = Math.max(0, Math.min(maxAllowed, Number(e.target.value) || 0));
                        setRequestedMoney(num);
                      }}
                      className="flex-1 min-w-0 accent-sky-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Mülkleri:</label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {targetTradableProps.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleRequestedProp(t.id)}
                        className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center justify-between gap-1.5 cursor-pointer ${
                          requestedProps.includes(t.id)
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {t.image ? (
                            <img
                              src={t.image}
                              alt={t.name}
                              className="w-4 h-4 rounded object-cover flex-shrink-0"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: t.groupColor || '#64748b' }}
                            />
                          )}
                          <span className="text-[9px] font-mono text-sky-400/90 flex-shrink-0">
                            #{t.id}
                          </span>
                          <span className="truncate">{t.name}</span>
                        </div>
                        <span className="text-[10px] opacity-75 flex-shrink-0">{t.cost}₺</span>
                      </button>
                    ))}
                    {targetTradableProps.length === 0 && (
                      <span className="text-slate-500 text-[11px] italic">Mülk yok</span>
                    )}
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-700/50 text-[11px] text-slate-400 flex justify-between">
                  <span>İstenen Değer:</span>
                  <strong className="text-sky-400">{calcRequestedValue}₺</strong>
                </div>
              </div>
            </div>

            {/* Masada Aktif Başka Takas Varsa Kuyruk Bilgilendirmesi */}
            {pendingTrade && (
              <div className="p-2.5 bg-sky-950/60 border border-sky-500/40 rounded-xl text-sky-200 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="text-[11px] leading-tight">
                  Masada şu anda aktif bir takas görüşmesi var. Teklifiniz sıraya (kuyruğa) alınacak ve mevcut teklif yanıtlandığında iletilecektir.
                </span>
              </div>
            )}

            {/* Cooldown (Spam Koruması) Uyarı Kutusu */}
            {isOnCooldown && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-200 text-xs shadow-md flex items-start gap-2.5 animate-fadeIn">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 animate-spin" />
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span>⏱️ Takas Bekleme Süresi:</span>
                    <span className="font-mono text-white bg-amber-500/30 px-1.5 py-0.5 rounded text-[11px]">{cooldownRemaining}s</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-tight">
                    <strong className="text-white font-bold">{activeTarget?.name}</strong> oyuncusuna az önce bir takas teklifi gönderdiniz. Teklif spamını önlemek için sürenin bitmesini beklemelisiniz.
                  </p>
                </div>
              </div>
            )}

            {/* Uyarı ve Gönder Butonu */}
            {!canSubmitTrade && !isOnCooldown && (
              <p className="text-[11px] text-amber-400/90 text-center font-semibold bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                💡 Resmi kurallara göre takasta en az 1 mülk teklif edilmeli veya talep edilmelidir (Karşılıksız para transferi yapılamaz).
              </p>
            )}

            <button
              type="button"
              onClick={handleSendOffer}
              disabled={!canSubmitTrade || isOnCooldown}
              className={`w-full min-h-[44px] py-3 font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 ${
                !canSubmitTrade || isOnCooldown
                  ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 active:scale-95 cursor-pointer shadow-amber-500/20'
              }`}
            >
              {isOnCooldown ? (
                <>
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Bekleyin ({cooldownRemaining}s)</span>
                </>
              ) : (
                <>
                  <Handshake className="w-4 h-4" />
                  <span>Teklifi Gönder</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
