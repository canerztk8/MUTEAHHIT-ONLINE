import React, { useState, useEffect } from 'react';
import { Users, Play, Bot, Copy, Check, Sparkles, LogIn, PlusCircle, LogOut, Trash2, Cpu, Sun, Moon } from 'lucide-react';
import { PLAYER_TOKENS, PLAYER_COLORS } from '../game/boardData.js';
import { TopDownPawnPreview } from './TopDownPawnPreview.jsx';
import { TopDownPawnSvg } from './TopDownPawnSvg.jsx';
import { ACTION } from '../network/protocol.js';


export function Lobby({
  network,
  gameState,
  currentRoomCode,
  onStartGame,
  onCreateRoom,
  onJoinRoom,
  myPlayerId,
  onLeaveRoom,
  isDarkMode = false,
  onToggleDarkMode,
  isPerformanceMode = false,
  ping
}) {
  const [name, setName] = useState(localStorage.getItem('muteahhit_name') || '');
  const [selectedToken, setSelectedToken] = useState(PLAYER_TOKENS[0]);
  const [selectedColor, setSelectedColor] = useState(PLAYER_COLORS[0]);
  const [roomInput, setRoomInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedBotDiff, setSelectedBotDiff] = useState('orta');
  const [editingLobbyName, setEditingLobbyName] = useState('');
  const [optimisticTokenId, setOptimisticTokenId] = useState(null);
  const [optimisticColor, setOptimisticColor] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!network) {
      setIsJoining(false);
    }
  }, [network]);

  // Lobideki mevcut oyuncu adını ve piyon seçimlerini senkronize et
  useEffect(() => {
    if (gameState?.status === 'lobby') {
      const p = gameState.players?.find(x => x.id === myPlayerId);
      if (p?.name && !editingLobbyName) {
        setEditingLobbyName(p.name);
      }
      if (p?.token?.id && p.token.id === optimisticTokenId) {
        setOptimisticTokenId(null);
      }
      if (p?.color && p.color === optimisticColor) {
        setOptimisticColor(null);
      }
    }
  }, [gameState?.players, gameState?.status, myPlayerId, optimisticTokenId, optimisticColor]);

  const [invitedRoomCode, setInvitedRoomCode] = useState('');

  // URL'deki ?room= parametresini al ve otomatik katılmayı dene
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      setRoomInput(code);
      setInvitedRoomCode(code);

      // Oyuncunun önceden kaydedilmiş bir ismi varsa doğrudan davet linkine katılsın!
      const savedName = localStorage.getItem('muteahhit_name');
      if (savedName && savedName.trim() && !gameState && !network) {
        let sessionToken = localStorage.getItem('muteahhit_session_token');
        if (!sessionToken) {
          sessionToken = 'st_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
          localStorage.setItem('muteahhit_session_token', sessionToken);
        }
        onJoinRoom?.({
          hostPeerId: code,
          playerName: savedName.trim(),
          token: selectedToken,
          color: selectedColor,
          sessionToken
        });
      }
    }
  }, []);

  const handleCreateRoom = () => {
    if (!name.trim()) {
      setErrorMsg('Lütfen adınızı girin!');
      return;
    }
    setErrorMsg('');
    localStorage.setItem('muteahhit_name', name.trim());
    let sessionToken = localStorage.getItem('muteahhit_session_token');
    if (!sessionToken) {
      sessionToken = 'st_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('muteahhit_session_token', sessionToken);
    }
    // App.jsx'teki createRoom callback'ini çağır → HostPeerService oluşturur
    onCreateRoom?.({
      playerName: name.trim(),
      token: selectedToken,
      color: selectedColor,
      sessionToken,
    });
  };

  const handleJoinRoom = () => {
    if (isJoining || network) return;
    if (!name.trim()) {
      setErrorMsg('Lütfen adınızı girin!');
      return;
    }
    if (!roomInput.trim()) {
      setErrorMsg('Lütfen bir oda kodu girin!');
      return;
    }
    setErrorMsg('');
    setIsJoining(true);
    localStorage.setItem('muteahhit_name', name.trim());
    let sessionToken = localStorage.getItem('muteahhit_session_token');
    if (!sessionToken) {
      sessionToken = 'st_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('muteahhit_session_token', sessionToken);
    }
    // App.jsx'teki joinRoom callback'ini çağır → ClientPeerService oluşturur
    onJoinRoom?.({
      hostPeerId: roomInput.trim().toUpperCase(),
      playerName: name.trim(),
      token: selectedToken,
      color: selectedColor,
      sessionToken,
    });
  };

  const handleAddBot = (diff = selectedBotDiff) => {
    network?.sendAction(ACTION.ADD_BOT, { difficulty: diff });
  };

  const handleSetBotDifficulty = (botId, difficulty) => {
    network?.sendAction(ACTION.SET_BOT_DIFFICULTY, { botId, difficulty });
  };

  const handleRemoveBot = (botId) => {
    network?.sendAction(ACTION.REMOVE_BOT, { botId });
  };

  const handleKickPlayer = (targetPlayerId) => {
    if (window.confirm('Bu oyuncuyu lobiden atmak istediğinizden emin misiniz?')) {
      network?.sendAction(ACTION.KICK_PLAYER, { targetPlayerId });
    }
  };

  const handleUpdateProfile = (data) => {
    setErrorMsg('');
    if (data.tokenId) setOptimisticTokenId(data.tokenId);
    if (data.color) setOptimisticColor(data.color);
    network?.sendAction(ACTION.UPDATE_PROFILE, data);
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${gameState.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Eğer bir odadaysak lobi bekleme salonunu göster
  if (gameState && gameState.status === 'lobby') {
    const me = gameState.players.find(p => p.id === myPlayerId);
    const hasHumanHost = gameState.players.some(p => !p.isBot && p.isHost);
    // Eğer odada aktif bir insan lider yoksa veya biz liderseniz başlatma yetkisi bizdedir
    const isHost = me?.isHost || (!hasHumanHost && me && !me.isBot);
    const canStart = gameState.players.length >= 2;

    return (
      <div className="flex flex-col items-center justify-center min-h-[90vh] px-4">
        <div className={`w-full max-w-2xl ${isDarkMode ? 'bg-slate-900/85 border-slate-700/60 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10' : 'bg-white/90 border-white/80 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5'} border backdrop-blur-2xl rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden transition-all duration-300`}>
          {/* Header Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Lobi Üst Bar: Ayrıl / Odayı Kapat Butonu & Karanlık Mod */}
          <div className={`flex items-center justify-between pb-3 mb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} relative z-10`}>
            <button
              onClick={() => {
                if (window.confirm(isHost ? 'Odayı kapatmak ve iptal etmek istediğinizden emin misiniz?' : 'Lobiden ayrılmak istediğinizden emin misiniz?')) {
                  onLeaveRoom && onLeaveRoom(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${isDarkMode ? 'bg-slate-800/80 hover:bg-rose-950/60 border-slate-700 hover:border-rose-600/70 text-slate-300 hover:text-rose-300' : 'bg-slate-100 hover:bg-rose-50 border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-700'} border text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer`}
              title={isHost ? 'Odayı İptal Et ve Kapat' : 'Lobiden Ayrıl'}
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>{isHost ? 'Odayı Kapat & İptal Et' : 'Lobiden Ayrıl'}</span>
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>
                {isHost ? '👑 Oda Kurucususunuz' : '👤 Oyuncu'}
              </span>
              {onToggleDarkMode && (
                <button
                  onClick={onToggleDarkMode}
                  title={isDarkMode ? 'Aydınlık Moda Geç' : 'Karanlık Moda Geç'}
                  className={`p-1.5 rounded-xl border transition cursor-pointer shadow-xs flex items-center justify-center ${
                    isDarkMode
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/70 text-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  }`}
                >
                  {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
                </button>
              )}
            </div>
          </div>

          <div className="text-center mb-8 relative">
            <span className="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold tracking-widest uppercase mb-3 inline-block">
              Ankara • Oyun Lobisi
            </span>
            <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'} flex items-center justify-center gap-3`}>
              <span>MÜTEAHHİT</span>
              <span className="text-amber-500 dark:text-amber-400">ONLINE</span>
            </h1>

            {/* Oda Kodu & Link Kopyalama */}
            <div className={`mt-4 inline-flex items-center gap-3 ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-100 border-slate-300'} border rounded-2xl px-5 py-2.5`}>
              <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} text-sm font-medium`}>Oda Kodu:</span>
              <span className="font-mono text-2xl font-black text-amber-500 dark:text-amber-400 tracking-wider">
                {gameState.roomCode}
              </span>
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
                title="Arkadaşına Davet Linki Kopyala"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopyalandı!' : 'Linki Kopyala'}</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-xs font-semibold text-center animate-fadeIn">
              {errorMsg}
            </div>
          )}

          {/* Lobi Bekleme Salonu: Oyuncunun Kendi 3D Piyonu & Profil Özelleştirme */}
          {me && (
            <div className="mb-6 space-y-4">
              <TopDownPawnPreview
                tokenId={optimisticTokenId || me.token?.id || 'hard_hat'}
                color={optimisticColor || me.color || '#ef4444'}
                playerName={me.name}
                isDarkMode={isDarkMode}
              />

              {/* İsim Değiştirme, Piyon ve Renk Seçimi Kutusu */}
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/70 border-slate-700/70' : 'bg-slate-50 border-slate-200'} space-y-3.5 shadow-sm`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400">
                    🎨 Profilini Özelleştir
                  </span>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    Aynı piyon veya rengi iki oyuncu alamaz
                  </span>
                </div>

                {/* İsim Düzenleme */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingLobbyName}
                    maxLength={16}
                    onChange={(e) => setEditingLobbyName(e.target.value)}
                    placeholder="İsminizi değiştirin..."
                    className={`flex-1 px-3 py-1.5 rounded-xl border text-xs font-medium focus:outline-none focus:border-amber-400 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    onClick={() => {
                      if (editingLobbyName.trim() && editingLobbyName.trim() !== me.name) {
                        handleUpdateProfile({ name: editingLobbyName.trim() });
                      }
                    }}
                    disabled={!editingLobbyName.trim() || editingLobbyName.trim() === me.name}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
                  >
                    Kaydet
                  </button>
                </div>

                {/* Piyon Seçimi */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Piyon Seç:
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {PLAYER_TOKENS.map((token) => {
                      const isTakenByOther = gameState.players.some(
                        (p) => p.id !== me.id && p.token?.id === token.id
                      );
                      const isMyToken = (optimisticTokenId || me.token?.id) === token.id;
                      return (
                        <button
                          key={token.id}
                          type="button"
                          disabled={isTakenByOther}
                          onClick={() => handleUpdateProfile({ tokenId: token.id })}
                          className={`p-1.5 rounded-xl border text-xl flex flex-col items-center justify-center transition cursor-pointer relative ${
                            isMyToken
                              ? 'bg-amber-500/25 border-amber-400 scale-105 shadow-sm'
                              : isTakenByOther
                              ? 'opacity-30 cursor-not-allowed bg-slate-800/40 border-slate-700'
                              : isDarkMode
                              ? 'bg-slate-900/60 border-slate-700 hover:border-slate-500'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                          title={isTakenByOther ? `${token.name} (Başka oyuncu tarafından seçildi)` : token.name}
                        >
                          <img
                            src={`/images/pawns/${token.id}.png`}
                            alt={token.name}
                            className="w-6 h-6 my-0.5 object-contain filter drop-shadow-xs pointer-events-none"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'block';
                            }}
                          />
                          <div style={{ display: 'none' }}>
                            <TopDownPawnSvg tokenId={token.id} className="w-6 h-6 my-0.5" />
                          </div>
                          <span className="text-[8.5px] truncate max-w-[50px] mt-0.5 opacity-80">{token.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Renk Seçimi */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Piyon Rengi Seç:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PLAYER_COLORS.map((c) => {
                      const isColorTaken = gameState.players.some(
                        (p) => p.id !== me.id && p.color === c
                      );
                      const isMyColor = (optimisticColor || me.color) === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={isColorTaken}
                          onClick={() => handleUpdateProfile({ color: c })}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl transition-all relative ${
                            isMyColor
                              ? 'ring-4 ring-amber-400 scale-110 shadow-md'
                              : isColorTaken
                              ? 'opacity-20 cursor-not-allowed'
                              : 'opacity-80 hover:opacity-100 hover:scale-105 cursor-pointer'
                          }`}
                          style={{ backgroundColor: c }}
                          title={isColorTaken ? 'Bu renk başka oyuncu tarafından alındı' : c}
                        >
                          {isColorTaken && (
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-white/90 font-black">
                              ✕
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KOMPAKT KOPMA / ATILMA BİLDİRİMİ (Lobi) */}
          {gameState?.disconnectNotice && (
            <div className="mb-4 animate-fadeIn">
              {gameState.disconnectNotice.type === 'disconnecting' ? (
                <div className="bg-amber-500/95 text-slate-950 px-3 py-2 rounded-xl border-2 border-amber-300 shadow-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-black backdrop-blur-md animate-pulse">
                  <span className="text-base">⚠️</span>
                  <span className="truncate">
                    <strong>{gameState.disconnectNotice.playerName}</strong> bağlantısı kesildi... (Yeniden bağlanması bekleniyor - 60sn)
                  </span>
                </div>
              ) : gameState.disconnectNotice.type === 'kicked' ? (
                <div className="bg-rose-600/95 text-white px-3 py-2 rounded-xl border-2 border-rose-400 shadow-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-black backdrop-blur-md animate-bounce">
                  <span className="text-base">❌</span>
                  <span className="truncate">
                    <strong>{gameState.disconnectNotice.playerName}</strong> 60sn içinde bağlanamadığı için oyundan atıldı.
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* Oyuncu Listesi */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider flex items-center gap-2`}>
                <Users className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Oyuncular ({gameState.players.length}/6)</span>
              </h2>
              <div className="flex items-center gap-2">
                {isHost && gameState.players.some(p => p.isBot) && (
                  <button
                    onClick={() => handleRemoveBot()}
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    title="Son eklenen botu çıkar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bot Çıkar</span>
                  </button>
                )}
                {isHost && gameState.players.length < 6 && (
                  <div className={`flex items-center gap-1 ${isDarkMode ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100 border-slate-300'} border rounded-xl p-0.5`}>
                    <select
                      value={selectedBotDiff}
                      onChange={(e) => setSelectedBotDiff(e.target.value)}
                      className={`bg-transparent ${isDarkMode ? 'text-amber-300' : 'text-amber-700'} text-xs font-bold px-2 py-1 cursor-pointer focus:outline-none`}
                      title="Eklenecek botun zorluk seviyesi"
                    >
                      <option value="cok_kolay" className={`${isDarkMode ? 'bg-slate-900 text-emerald-300' : 'bg-white text-emerald-700'}`}>Çok Kolay</option>
                      <option value="kolay" className={`${isDarkMode ? 'bg-slate-900 text-sky-300' : 'bg-white text-sky-700'}`}>Kolay</option>
                      <option value="orta" className={`${isDarkMode ? 'bg-slate-900 text-amber-300' : 'bg-white text-amber-700'}`}>Orta</option>
                      <option value="zor" className={`${isDarkMode ? 'bg-slate-900 text-orange-400' : 'bg-white text-orange-700'}`}>Zor</option>
                      <option value="imkansiz" className={`${isDarkMode ? 'bg-slate-900 text-rose-400' : 'bg-white text-rose-700'}`}>İmkansız</option>
                    </select>
                    <button
                      onClick={() => handleAddBot(selectedBotDiff)}
                      className="flex items-center gap-1.5 text-xs font-bold text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 px-3 py-1.5 rounded-lg transition cursor-pointer active:scale-95"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>+ Bot Ekle</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameState.players.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'} border relative overflow-hidden shadow-xs`}
                >
                  <div className="flex items-center gap-3 z-10">
                    <div
                      className={`flex-shrink-0 rounded-full border text-sm flex items-center justify-center ${
                        p.id === myPlayerId
                          ? 'w-9 h-9 border-white ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                          : 'w-8 h-8 border-white/60'
                      }`}
                      style={{ backgroundColor: p.color }}
                      title={p.token?.name || 'Piyon'}
                    >
                      <span>{p.token?.icon || '●'}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'} text-sm`}>{p.name}</span>
                        {p.isHost && (
                          <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-md font-semibold">
                            Lider
                          </span>
                        )}
                        {p.isBot && (
                          <span className="text-[10px] bg-sky-500/20 border border-sky-500/40 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5">
                            <Bot className="w-2.5 h-2.5" /> Bot
                          </span>
                        )}
                      </div>
                      
                      {/* Bot Zorluk Seçici (Botların Yanında) */}
                      {p.isBot ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Zorluk:</span>
                          {isHost ? (
                            <select
                              value={p.difficulty || 'orta'}
                              onChange={(e) => handleSetBotDifficulty(p.id, e.target.value)}
                              className={`${isDarkMode ? 'bg-slate-900/90 text-amber-300' : 'bg-white text-amber-800'} border border-amber-400/50 text-[10px] font-bold rounded-md px-1.5 py-0.5 cursor-pointer focus:outline-none`}
                            >
                              <option value="cok_kolay" className={`${isDarkMode ? 'bg-slate-900 text-emerald-300' : 'bg-white text-emerald-700'}`}>Çok Kolay</option>
                              <option value="kolay" className={`${isDarkMode ? 'bg-slate-900 text-sky-300' : 'bg-white text-sky-700'}`}>Kolay</option>
                              <option value="orta" className={`${isDarkMode ? 'bg-slate-900 text-amber-300' : 'bg-white text-amber-700'}`}>Orta</option>
                              <option value="zor" className={`${isDarkMode ? 'bg-slate-900 text-orange-400' : 'bg-white text-orange-700'}`}>Zor</option>
                              <option value="imkansiz" className={`${isDarkMode ? 'bg-slate-900 text-rose-400' : 'bg-white text-rose-700'}`}>İmkansız</option>
                            </select>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded">
                              {p.difficulty === 'cok_kolay' ? 'Çok Kolay' : p.difficulty === 'kolay' ? 'Kolay' : p.difficulty === 'zor' ? 'Zor' : p.difficulty === 'imkansiz' ? 'İmkansız' : 'Orta'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{p.token.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 z-10">
                    {(() => {
                      const playerPing = p.isBot
                        ? 1
                        : (p.ping ?? (p.id === myPlayerId ? (ping || 1) : (p.isHost ? 1 : 12)));
                      const dotBg = playerPing < 60 ? 'bg-emerald-500' : playerPing < 150 ? 'bg-amber-500' : 'bg-rose-500';
                      const textColor = playerPing < 60 ? 'text-emerald-500 dark:text-emerald-400' : playerPing < 150 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400';
                      return (
                        <div className={`text-xs font-semibold flex items-center gap-1.5 font-jetbrains ${textColor}`} title={`${p.name} ağ gecikmesi: ${playerPing} ms`}>
                          <span className={`w-2 h-2 rounded-full ${dotBg} animate-pulse`} />
                          <span>{playerPing} ms</span>
                        </div>
                      );
                    })()}
                    {isHost && p.isBot && (
                      <button
                        onClick={() => handleRemoveBot(p.id)}
                        className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-500 dark:text-rose-400 transition shadow-sm active:scale-95 flex items-center gap-1 text-xs font-bold cursor-pointer"
                        title="Bu Botu Çıkar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Çıkar</span>
                      </button>
                    )}
                    {isHost && !p.isBot && p.id !== (me?.id || myPlayerId) && (
                      <button
                        onClick={() => handleKickPlayer(p.id)}
                        className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-500 dark:text-rose-400 transition shadow-sm active:scale-95 flex items-center gap-1 text-xs font-bold cursor-pointer"
                        title="Bu Oyuncuyu Lobiden At"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[10px]">At</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Başlat Butonu & Bilgilendirme */}
          <div className="flex flex-col items-center gap-3">
            {isHost ? (
              <button
                onClick={onStartGame}
                disabled={!canStart}
                className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-xl transition-all ${
                  canStart
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 hover:brightness-110 active:scale-98 shadow-amber-500/30 cursor-pointer'
                    : `${isDarkMode ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-200 text-slate-400 border-slate-300'} cursor-not-allowed border`
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{canStart ? 'Oyunu Başlat!' : 'Başlamak için en az 2 oyuncu gerekli'}</span>
              </button>
            ) : (
              <div className={`w-full py-4 text-center text-sm font-medium ${isDarkMode ? 'text-slate-400 bg-slate-800/60 border-slate-700/60' : 'text-slate-600 bg-slate-100 border-slate-200'} rounded-2xl border`}>
                Oda liderinin oyunu başlatması bekleniyor...
              </div>
            )}
            <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'} text-center`}>
              Arkadaşınızla oynamak için yukarıdaki linki kopyalayıp WhatsApp veya Discord'dan gönderin.
            </p>

            <button
              onClick={() => {
                if (window.confirm(isHost ? 'Odayı kapatmak ve iptal etmek istediğinizden emin misiniz?' : 'Lobiden ayrılmak istediğinizden emin misiniz?')) {
                  onLeaveRoom && onLeaveRoom(true);
                }
              }}
              className={`text-xs ${isDarkMode ? 'text-slate-400 hover:text-rose-300' : 'text-slate-500 hover:text-rose-600'} transition underline underline-offset-4 py-1 flex items-center gap-1 cursor-pointer`}
            >
              <span>{isHost ? '✕ Odayı İptal Et ve Ana Ekrana Dön' : '← Lobiden Çık'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Henüz bir odaya katılmamış giriş ekranı
  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] px-4 py-8">
      <div className={`w-full max-w-lg ${isDarkMode ? 'bg-slate-900/85 border-slate-700/60 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10' : 'bg-white/90 border-white/80 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5'} border backdrop-blur-2xl rounded-3xl p-6 sm:p-10 relative overflow-hidden transition-all duration-300`}>
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Sağ Üst Karanlık Mod Butonu */}
        {onToggleDarkMode && (
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={onToggleDarkMode}
              title={isDarkMode ? 'Aydınlık Moda Geç' : 'Karanlık Moda Geç'}
              className={`p-2 rounded-xl border transition cursor-pointer shadow-xs flex items-center justify-center ${
                isDarkMode
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/70 text-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400 animate-pulse" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 text-3xl shadow-lg shadow-amber-500/20 mb-4 transform -rotate-6">
            👷
          </div>
          <h1 className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
            MÜTEAHHİT <span className="text-amber-500 dark:text-amber-400">ONLINE</span>
          </h1>
          <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} text-sm mt-1`}>Arkadaşlarınla canlı veya yapay zekaya karşı oyna • <strong className="text-amber-500 dark:text-amber-400 font-semibold">Ankara</strong></p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-xs font-semibold text-center">
            {errorMsg}
          </div>
        )}

        <div className="space-y-6">
          {/* Oyuncu Adı */}
          <div>
            <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider mb-2`}>
              Oyuncu Adı
            </label>
            <input
              type="text"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              placeholder="Adınızı girin..."
              className={`w-full px-4 py-3 ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'} border rounded-xl focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition text-sm font-medium`}
            />
          </div>

          {/* Kuşbakışı 2D Piyon Önizleme Alanı */}
          <TopDownPawnPreview
            token={selectedToken}
            color={selectedColor}
            playerName={name || 'Siz'}
            isDarkMode={isDarkMode}
          />

          {/* Piyon Seçimi */}
          <div>
            <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider mb-2`}>
              Piyonunu Seç
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
              {PLAYER_TOKENS.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  onClick={() => setSelectedToken(token)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition text-2xl cursor-pointer ${
                    selectedToken.id === token.id
                      ? 'bg-amber-500/20 border-amber-400 scale-105 shadow-md shadow-amber-500/20'
                      : isDarkMode
                      ? 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-800'
                  }`}
                  title={token.name}
                >
                  <img
                    src={`/images/pawns/${token.id}.png`}
                    alt={token.name}
                    className="w-7 h-7 object-contain filter drop-shadow-xs pointer-events-none"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'block';
                    }}
                  />
                  <div style={{ display: 'none' }}>
                    <TopDownPawnSvg tokenId={token.id} className="w-7 h-7" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Renk Seçimi */}
          <div>
            <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider mb-2`}>
              Piyon Rengi
            </label>
            <div className="flex items-center justify-between gap-2">
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-9 h-9 rounded-xl transition-all cursor-pointer ${
                    selectedColor === c ? 'ring-4 ring-amber-400/80 scale-110 shadow-lg' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Davet Bağlantısı Bildirimi */}
          {invitedRoomCode && (
            <div className="p-3 rounded-xl bg-amber-500/15 border-2 border-amber-400/80 text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center justify-between gap-2 shadow-md animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base flex-shrink-0">🔗</span>
                <div className="min-w-0">
                  <p className="font-space font-black uppercase text-[9.5px] tracking-wider leading-none text-amber-600 dark:text-amber-400">Davet Bağlantısı Alındı</p>
                  <p className="font-jetbrains text-[11px] mt-0.5 truncate">Oda Kodu: <strong className="font-mono text-amber-500 dark:text-amber-300">{invitedRoomCode}</strong></p>
                </div>
              </div>
              <span className="text-[9.5px] bg-amber-500 text-slate-950 font-black px-2 py-1 rounded-lg flex-shrink-0 font-space">DAVETLİSİNİZ</span>
            </div>
          )}

          {/* Butonlar */}
          <div className="pt-2 space-y-3">
            <button
              onClick={handleCreateRoom}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 hover:brightness-110 active:scale-98 shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer font-space"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Yeni Oyun Odası Aç</span>
            </button>

            <div className="flex items-center gap-3">
              <div className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'} flex-1`} />
              <span className="text-xs text-slate-500 font-semibold uppercase">veya koda katıl</span>
              <div className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'} flex-1`} />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="ODA KODU (örn. 7XK8)"
                maxLength={8}
                className={`flex-1 px-4 py-3 ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'} border rounded-xl text-center font-mono font-bold tracking-widest focus:outline-none focus:border-amber-400 transition text-sm`}
              />
              <button
                onClick={handleJoinRoom}
                disabled={isJoining || Boolean(network)}
                className={`px-5 py-3 rounded-xl font-bold text-sm ${
                  isJoining || Boolean(network)
                    ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed opacity-80'
                    : invitedRoomCode
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 animate-pulse shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-98'
                    : isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 cursor-pointer active:scale-98'
                    : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 cursor-pointer active:scale-98'
                } border transition flex items-center gap-2 font-space`}
              >
                {isJoining || Boolean(network) ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                    <span>Bağlanılıyor...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{invitedRoomCode ? `Katıl (${invitedRoomCode})` : 'Katıl'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
