import React, { useState } from 'react';
import { BOARD_TILES } from '../game/boardData.js';
import { Building2, Home, Landmark, Train, Zap, ChevronRight, Layers, ArrowUpDown } from 'lucide-react';

function TitleDeedCardsBase({ gameState = {}, myPlayerId, onTileClick }) {
  const { players = [], properties = {} } = gameState || {};
  // Yerel oyuncuyu güvenli çözümle (myPlayerId, oturum tokenı veya isim üzerinden)
  const savedPlayerName = typeof localStorage !== 'undefined' ? localStorage.getItem('muteahhit_name') : null;
  const savedSessionToken = typeof localStorage !== 'undefined' ? localStorage.getItem('muteahhit_session_token') : null;
  const myPlayer = players.find(p => !p.isBot && (
    (myPlayerId && p.id === myPlayerId) ||
    (savedSessionToken && p.sessionToken === savedSessionToken) ||
    (savedPlayerName && p.name === savedPlayerName)
  )) || players.find(p => p.id === myPlayerId) || null;
  const effectiveMyId = myPlayer?.id || myPlayerId;

  // Hangi oyuncunun tapularının incelendiği (varsayılan: kullanıcının kendisi)
  const [selectedPlayerId, setSelectedPlayerId] = useState(effectiveMyId);
  // Sıralama modu: 'color' (renk grubu - en çok arsa başta) | 'price' (fiyat) | 'time' (satın alma zamanı)
  const [sortBy, setSortBy] = useState('color');
  // İpotek filtresi: 'all' (tümü) | 'mortgaged' (sadece ipotekli olanlar)
  const [mortgageFilter, setMortgageFilter] = useState('all');

  React.useEffect(() => {
    if (effectiveMyId && (!selectedPlayerId || selectedPlayerId === myPlayerId)) {
      setSelectedPlayerId(effectiveMyId);
    }
  }, [effectiveMyId, myPlayerId, selectedPlayerId]);

  const targetPlayer = players.find(p => p.id === selectedPlayerId && !p.isBankrupt)
    || myPlayer
    || players.find(p => !p.isBankrupt)
    || players[0]
    || null;

  // Oyuncu sekmeleri: Kullanıcının kendisi (bizim oyuncu) her zaman en solda ilk sırada dursun
  const sortedPlayers = React.useMemo(() => {
    const active = players.filter(p => p && !p.isBankrupt);
    const me = active.find(p => p.id === effectiveMyId);
    if (!me) return active;
    return [me, ...active.filter(p => p.id !== effectiveMyId)];
  }, [players, effectiveMyId]);

  // Seçili oyuncunun sahip olduğu mülkler (useMemo ile memoize edildi)
  const allOwnedTiles = React.useMemo(() => {
    if (!targetPlayer) return [];
    const owned = Object.values(properties)
      .filter(prop => prop && prop.ownerId === targetPlayer.id)
      .map(prop => {
        const tile = BOARD_TILES[prop.tileId];
        const state = properties[prop.tileId] || { tileId: prop.tileId, ownerId: targetPlayer.id, houses: 0, mortgaged: false };
        return { tile, state };
      })
      .filter(item => Boolean(item.tile));

    // Renk grubu frekansı: Oyuncunun elinde en çok hangi renkten arsa varsa o renk grubu başta listelenir
    const groupCounts = {};
    const groupMinId = {};
    owned.forEach(item => {
      const g = item.tile?.group || item.tile?.type || 'other';
      groupCounts[g] = (groupCounts[g] || 0) + 1;
      const tid = item.tile?.id ?? 999;
      if (groupMinId[g] === undefined || tid < groupMinId[g]) {
        groupMinId[g] = tid;
      }
    });

    owned.sort((a, b) => {
      if (sortBy === 'color') {
        const groupA = a.tile?.group || a.tile?.type || 'other';
        const groupB = b.tile?.group || b.tile?.type || 'other';
        const countA = groupCounts[groupA] || 0;
        const countB = groupCounts[groupB] || 0;
        if (countB !== countA) {
          return countB - countA; // En çok arsası olan renk grubu en başta
        }
        if (groupA !== groupB) {
          return (groupMinId[groupA] || 0) - (groupMinId[groupB] || 0); // Aynı sayıda tapu varsa tahta sırasına göre grup bütünlüğünü koru
        }
        return (a.tile?.id || 0) - (b.tile?.id || 0); // Grup içi tahta sırası
      }
      if (sortBy === 'price') {
        const costA = a.tile?.cost || 0;
        const costB = b.tile?.cost || 0;
        if (costB !== costA) return costB - costA;
        return (a.tile?.id || 0) - (b.tile?.id || 0);
      }
      if (sortBy === 'time') {
        const timeA = a.state?.acquiredAt || 0;
        const timeB = b.state?.acquiredAt || 0;
        if (timeB !== timeA) return timeB - timeA;
        return (a.tile?.id || 0) - (b.tile?.id || 0);
      }
      return (a.tile?.id || 0) - (b.tile?.id || 0);
    });

    return owned;
  }, [targetPlayer, properties, sortBy]);

  // Kaç arsanın ipotekli olduğunun hesaplanması
  const mortgagedCount = React.useMemo(() => {
    return allOwnedTiles.filter(item => Boolean(item.state?.mortgaged)).length;
  }, [allOwnedTiles]);

  // İpotek filtresine göre gösterilen mülkler
  const displayedTiles = React.useMemo(() => {
    if (mortgageFilter === 'mortgaged') {
      return allOwnedTiles.filter(item => Boolean(item.state?.mortgaged));
    }
    return allOwnedTiles;
  }, [allOwnedTiles, mortgageFilter]);

  return (
    <div className="cardstock-panel rounded-3xl p-3 sm:p-4 shadow-xl flex flex-col gap-2.5 sm:gap-3 min-h-[220px] lg:min-h-0 flex-1 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Üst Kısım: Başlık & Oyuncu Seçim Sekmeleri */}
      <div className="flex flex-col gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5 font-space">
              <Landmark className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                Tapu Senetleri ({allOwnedTiles.length})
                {mortgagedCount > 0 ? (
                  <span className="text-rose-600 dark:text-rose-400 ml-1.5 font-bold">
                    • {mortgagedCount} İpotekli
                  </span>
                ) : null}
              </span>
            </h2>
          </div>
          <span className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
            {targetPlayer?.id !== effectiveMyId ? 'Teklif yapmak için tapuya tıkla' : 'Yönetmek için tapuya tıkla'}
          </span>
        </div>

        {/* Oyuncu Seçici Hap Butonlar (Tabs) - Bizim oyuncunun ismi hep en solda */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {sortedPlayers.map(p => {
            const isSelected = p.id === targetPlayer?.id;
            const isMe = p.id === effectiveMyId;
            const pCount = Object.values(properties).filter(prop => prop && prop.ownerId === p.id).length;
            const tokenIcon = p.token?.icon || '●';

            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlayerId(p.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition cursor-pointer flex-shrink-0 font-space ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 font-bold'
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border border-white/60 shadow-xs"
                  style={{ backgroundColor: p.color || '#64748b' }}
                >
                  {tokenIcon}
                </div>
                <span>{isMe ? `${p.name} (Sen)` : p.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-jetbrains ${
                  isSelected ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold'
                }`}>
                  {pCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sıralama & Filtreleme Butonları: Renge Göre, Fiyata Göre, Zamana Göre, İpoteğe Göre */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 font-space">
              <ArrowUpDown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Sırala:</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSortBy('color')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 font-space ${
                  sortBy === 'color'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
                title="En çok arsanız olan renk grubu başta olacak şekilde sırala"
              >
                <span>🎨</span>
                <span>Renk</span>
              </button>
              <button
                type="button"
                onClick={() => setSortBy('price')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 font-space ${
                  sortBy === 'price'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
                title="Fiyata göre (En pahalıdan en ucuza) sırala"
              >
                <span>💰</span>
                <span>Fiyat</span>
              </button>
              <button
                type="button"
                onClick={() => setSortBy('time')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 font-space ${
                  sortBy === 'time'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
                title="Satın alma sırasına göre sırala"
              >
                <span>⏱️</span>
                <span>Zaman</span>
              </button>
            </div>
          </div>

          {/* İpoteğe Göre Filtrele Butonu */}
          <button
            type="button"
            onClick={() => setMortgageFilter(prev => prev === 'mortgaged' ? 'all' : 'mortgaged')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 border font-space ${
              mortgageFilter === 'mortgaged'
                ? 'bg-rose-600 text-white border-rose-500 shadow-xs font-black ring-1 ring-rose-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400'
            }`}
            title={mortgageFilter === 'mortgaged' ? 'Tüm tapuları göster' : 'Yalnızca ipotekli tapuları filtrele'}
          >
            <span>🏦</span>
            <span>İpotekli ({mortgagedCount})</span>
          </button>
        </div>
      </div>

      {/* Tapu Kartları Izgarası / Yatay Listesi */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
        {!targetPlayer || allOwnedTiles.length === 0 ? (
          <div className="py-8 min-h-[140px] flex-1 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center text-xl mb-2 text-amber-600 dark:text-amber-400">
              📜
            </div>
            <p className="text-xs font-black text-slate-800 dark:text-slate-100 font-space">
              {targetPlayer?.id === myPlayerId ? 'Henüz hiçbir tapunuz yok' : `${targetPlayer?.name || 'Seçili oyuncunun'} tapusu yok`}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs font-medium">
              Karelere gelerek sahipsiz mülkleri satın alın ve kira geliri toplayın.
            </p>
          </div>
        ) : displayedTiles.length === 0 ? (
          <div className="py-8 min-h-[140px] flex-1 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-rose-300 dark:border-rose-800">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center text-xl mb-2 text-rose-600 dark:text-rose-400">
              🏦
            </div>
            <p className="text-xs font-black text-slate-800 dark:text-slate-100 font-space">
              İpotekli tapu bulunmuyor (0/{allOwnedTiles.length})
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs font-medium">
              Bu oyuncunun şu anda ipotek edilmiş herhangi bir tapusu yoktur.
            </p>
            <button
              onClick={() => setMortgageFilter('all')}
              className="mt-2.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold font-space cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              Tüm Tapuları Göster ({allOwnedTiles.length})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {displayedTiles.map(({ tile, state }) => {
              const houses = Math.max(0, Math.min(5, Number(state?.houses) || 0));
              const isMortgaged = Boolean(state?.mortgaged);

              // Geçerli kira hesabı
              let currentRent = 0;
              if (tile.type === 'property') {
                currentRent = Array.isArray(tile.rent) ? (tile.rent[houses] ?? tile.rent[0] ?? 0) : 0;
              } else if (tile.type === 'railroad') {
                const ownerRailroads = Object.values(properties).filter(
                  pr => pr && pr.ownerId === targetPlayer?.id && BOARD_TILES[pr.tileId]?.type === 'railroad'
                ).length;
                const rIndex = Math.max(0, Math.min(3, ownerRailroads - 1));
                currentRent = Array.isArray(tile.rent) ? (tile.rent[rIndex] ?? tile.rent[0] ?? 25) : 25;
              } else if (tile.type === 'utility') {
                const ownerUtilities = Object.values(properties).filter(
                  pr => pr && pr.ownerId === targetPlayer?.id && BOARD_TILES[pr.tileId]?.type === 'utility'
                ).length;
                currentRent = ownerUtilities === 2 ? '10x Zar' : '4x Zar';
              }

              const ownerRailroadsCount = Object.values(properties).filter(
                pr => pr && pr.ownerId === targetPlayer?.id && BOARD_TILES[pr.tileId]?.type === 'railroad'
              ).length;

              const ownerUtilitiesCount = Object.values(properties).filter(
                pr => pr && pr.ownerId === targetPlayer?.id && BOARD_TILES[pr.tileId]?.type === 'utility'
              ).length;

              const isAuctionTile = gameState.auction && gameState.auction.tileId === tile.id;
              const isPendingTradeTile = gameState.pendingTrade && (
                gameState.pendingTrade.offeredProperties?.includes(tile.id) ||
                gameState.pendingTrade.requestedProperties?.includes(tile.id)
              );
              const isDemandHighlighted = Boolean(isAuctionTile || isPendingTradeTile);
              const isTradeOffered = Boolean(gameState.pendingTrade?.offeredProperties?.includes(tile.id));
              const isTradeRequested = Boolean(gameState.pendingTrade?.requestedProperties?.includes(tile.id));

              return (
                <div
                  key={tile.id}
                  onClick={() => onTileClick && onTileClick(tile)}
                  className={`group relative rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-lg hover:-translate-y-0.5 select-none tile-paper-press ${
                    isDemandHighlighted
                      ? (isAuctionTile ? 'demand-highlight-auction' : 'demand-highlight-trade')
                      : isMortgaged
                      ? 'border-rose-400 dark:border-rose-600'
                      : 'border-slate-300 dark:border-slate-700 hover:border-amber-500'
                  }`}
                >
                  {/* Üst Tapu Başlık Bandı (Otantik Müteahhit Şekli) */}
                  <div
                    className="w-full p-2 text-center relative border-b border-black/20 flex flex-col items-center justify-center shadow-xs"
                    style={{ backgroundColor: tile.groupColor || '#334155' }}
                  >
                    <span className="text-[7.5px] tracking-widest uppercase font-black text-white/90 block drop-shadow-xs leading-tight font-space">
                      TAPU SENEDİ
                    </span>
                    <h4 className="text-xs font-black text-white tracking-wide uppercase truncate w-full drop-shadow leading-tight mt-0.5 font-space">
                      {tile.name}
                    </h4>

                    {/* Açık Artırma veya Takas Rozeti */}
                    {isDemandHighlighted && (
                      <div className="mt-1 flex items-center justify-center gap-1 bg-black/80 px-2 py-0.5 rounded-full border border-white/80 shadow-md animate-bounce">
                        <span className="text-[8.5px] font-black text-white flex items-center gap-1 font-space">
                          <span>{isAuctionTile ? '🔨' : '🤝'}</span>
                          <span>
                            {isAuctionTile
                              ? 'AÇIK ARTIRMA'
                              : isTradeOffered && !isTradeRequested
                              ? 'TAKAS: VERİLECEK'
                              : isTradeRequested && !isTradeOffered
                              ? 'TAKAS: İSTENEN'
                              : 'TAKAS'}
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Ev / Otel Rozeti */}
                    {houses > 0 && (
                      <div className="mt-1 flex items-center justify-center gap-1 bg-black/60 px-1.5 py-0.5 rounded-full border border-white/20">
                        {houses === 5 ? (
                          <span className="text-[9px] font-black text-rose-300 flex items-center gap-1 font-jetbrains">
                            🏨 OTEL
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-300 font-jetbrains">
                            <span className="font-mono text-white">x{houses}</span>
                            <span>🏠</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tapu Küçük Fotoğrafı (Asla boş kalmaz) */}
                  <div className="w-full h-14 sm:h-16 relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center">
                    {tile.image && (
                      <img
                        src={tile.image}
                        alt={tile.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 relative z-10"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <span className="text-2xl absolute inset-0 flex items-center justify-center z-0">{tile.icon || '🏛️'}</span>
                  </div>

                  {/* Kart Gövdesi: Kira & Değer Bilgileri */}
                  <div className="p-2 flex flex-col gap-1.5 text-[10px] leading-snug bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {/* Geçerli Kira (Vurgulanmış) */}
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold font-space">Geçerli Kira:</span>
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs font-jetbrains">
                        {isMortgaged ? `0₺ (${targetPlayer?.name ? `${targetPlayer.name} İpotek` : 'İpotek'})` : `${currentRent}${typeof currentRent === 'number' ? '₺' : ''}`}
                      </span>
                    </div>

                    {/* Arsa / Ev Kira Kademeleri */}
                    {tile.type === 'property' && Array.isArray(tile.rent) && (
                      <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[8.5px] sm:text-[9px] text-slate-600 dark:text-slate-400 font-medium">
                        <span className={houses === 0 && !isMortgaged ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>
                          Arsa: {tile.rent[0]}₺
                        </span>
                        <span className={houses === 1 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>
                          1 Ev: {tile.rent[1]}₺
                        </span>
                        <span className={houses === 2 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>
                          2 Ev: {tile.rent[2]}₺
                        </span>
                        <span className={houses === 3 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>
                          3 Ev: {tile.rent[3]}₺
                        </span>
                        <span className={houses === 4 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>
                          4 Ev: {tile.rent[4]}₺
                        </span>
                        <span className={houses === 5 ? 'text-rose-900 dark:text-rose-200 bg-rose-100/90 dark:bg-rose-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>
                          Otel: {tile.rent[5]}₺
                        </span>
                      </div>
                    )}

                    {/* Gar Kira Kademeleri */}
                    {tile.type === 'railroad' && (
                      <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[8.5px] sm:text-[9px] text-slate-600 dark:text-slate-400 font-medium">
                        <span className={ownerRailroadsCount === 1 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>1 Gar: 25₺</span>
                        <span className={ownerRailroadsCount === 2 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>2 Gar: 50₺</span>
                        <span className={ownerRailroadsCount === 3 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>3 Gar: 100₺</span>
                        <span className={ownerRailroadsCount === 4 ? 'text-rose-900 dark:text-rose-200 bg-rose-100/90 dark:bg-rose-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>4 Gar: 200₺</span>
                      </div>
                    )}

                    {/* Kamu Hizmeti Çarpanları */}
                    {tile.type === 'utility' && (
                      <div className="flex flex-col gap-0.5 text-[8.5px] sm:text-[9px] text-slate-600 dark:text-slate-400 font-medium">
                        <span className={ownerUtilitiesCount === 1 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>1 Tesis: Zarın 4 Katı</span>
                        <span className={ownerUtilitiesCount === 2 ? 'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 font-black px-1 rounded' : 'text-slate-600 dark:text-slate-400'}>2 Tesis: Zarın 10 Katı</span>
                      </div>
                    )}

                    {/* Alt Bilgiler: İnşa Maliyeti & İpotek Bedeli */}
                    <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                      {tile.houseCost ? (
                        <span>Ev: <strong className="text-slate-800 dark:text-slate-200 font-jetbrains">{tile.houseCost}₺</strong></span>
                      ) : (
                        <span>Maliyet: <strong className="text-slate-800 dark:text-slate-200 font-jetbrains">{tile.cost}₺</strong></span>
                      )}
                      <span>İpotek: <strong className="text-slate-800 dark:text-slate-200 font-jetbrains">{tile.mortgage}₺</strong></span>
                    </div>
                  </div>

                  {/* İpotek Damgası (Klasik Çift Çerçeveli Kırmızı Kaşe) */}
                  {isMortgaged && (
                    <div className="absolute inset-0 z-20 bg-rose-900/10 dark:bg-rose-950/30 backdrop-grayscale-[0.3] backdrop-contrast-[0.95] flex items-center justify-center p-2 pointer-events-none select-none overflow-hidden">
                      <div className="transform -rotate-12 p-[2px] rounded-md border-2 border-red-600 dark:border-red-500/90 bg-red-50/95 dark:bg-black/80 shadow-xl flex items-center justify-center">
                        <div className="border border-red-500/70 dark:border-red-500/60 rounded-[3px] px-2.5 py-0.5 flex items-center justify-center">
                          <span className="text-[10.5px] sm:text-xs font-space font-black uppercase tracking-widest text-red-700 dark:text-red-400 leading-none drop-shadow-xs">
                            İPOTEK
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Kartın Alt Butonu / Hover Efekti */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-1 text-center border-t border-slate-200 dark:border-slate-800 group-hover:bg-amber-100/80 dark:group-hover:bg-amber-950/80 group-hover:text-amber-950 dark:group-hover:text-amber-200 text-[9.5px] font-bold text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center gap-1 font-space">
                    <span>{targetPlayer?.id !== effectiveMyId ? 'Detay / Teklif Yap' : 'Detay / İnşa'}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const TitleDeedCards = React.memo(TitleDeedCardsBase);
