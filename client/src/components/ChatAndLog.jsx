import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, ScrollText, Send, Maximize2, Minimize2, X, Sparkles, ChevronRight, Mic, MicOff, PhoneOff, Radio } from 'lucide-react';
import { useVoiceChat, VoiceRoomView } from './VoiceRoom.jsx';

/**
 * Olayın gerçekleştiği dakikayı ve saniyesini (MM:SS veya HH:MM:SS) hesaplar.
 */
function getEventGameTime(log, gameStartTime, totalPausedDuration = 0) {
  if (!log) return '00:00';
  
  if (log.time && /^\d{1,2}:\d{2}$/.test(log.time)) {
    return log.time;
  }
  
  if (log.timestamp && gameStartTime) {
    const elapsedMs = Math.max(0, log.timestamp - gameStartTime - (totalPausedDuration || 0));
    const totalSecs = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Eğer eski tarz 24 saatlik saat formatındaysa (HH:MM:SS) saat yerine 00:00 göster
  if (log.time && /^\d{2}:\d{2}:\d{2}$/.test(log.time)) {
    return '00:00';
  }

  return log.time || '00:00';
}

function getEventTooltip(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 'Oyun Süresi: 00:00';
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) {
      return `Oyunun ${m}. dakika ${s}. saniyesi`;
    }
  } else if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
      return `Oyunun ${h}. saat ${m}. dakika ${s}. saniyesi`;
    }
  }
  return `Oyun Süresi: ${timeStr}`;
}

/**
 * Sohbet mesajının gönderildiği oyun içi süreyi (MM:SS veya HH:MM:SS) hesaplar.
 */
function getChatMessageTime(m, gameStartTime, totalPausedDuration = 0) {
  if (!m) return '00:00';

  if (m.timestamp && gameStartTime) {
    const elapsedMs = Math.max(0, m.timestamp - gameStartTime - (totalPausedDuration || 0));
    const totalSecs = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  if (m.time && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(m.time)) {
    return m.time;
  }

  return m.time || '00:00';
}

function ChatAndLogBase({
  logs = [],
  messages = [],
  onSendMessage,
  players = [],
  embedded = false,
  gameStartTime = null,
  totalPausedDuration = 0,
  roomCode = '',
  myPlayerId = '',
  myPlayerName = '',
  isDarkMode = false,
  voiceStates = {},
  onSendVoiceState = null
}) {
  // Varsayılan olarak minimize (kapalı/kompakt) başlar
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('log'); // 'log' | 'chat' | 'voice'
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState('ALL');
  const [inputMsg, setInputMsg] = useState('');
  const logEndRef = useRef(null);
  const chatEndRef = useRef(null);

  // Ses Odası WebRTC Hook'u (Sekme veya modal değişse dahi bağlantı kesilmeden arka planda aktif kalır)
  const voiceChat = useVoiceChat({
    roomCode,
    myPlayerId,
    myPlayerName,
    players,
    voiceStates,
    onSendVoiceState
  });

  // Son 3 olay ve tersine çevrilmiş günlükler (useMemo ile bellek & GC optimizasyonu)
  const reversedLogs = useMemo(() => [...logs].reverse(), [logs]);
  const recentLogs = useMemo(() => reversedLogs.slice(0, 3), [reversedLogs]);

  const selectedPlayer = players.find(p => p.id === selectedPlayerFilter);
  const filteredLogs = useMemo(() => {
    if (selectedPlayerFilter === 'ALL') return reversedLogs;
    return reversedLogs.filter(log => selectedPlayer && log.text.includes(selectedPlayer.name));
  }, [reversedLogs, selectedPlayerFilter, selectedPlayer]);

  useEffect(() => {
    if (isExpanded || embedded) {
      if (activeTab === 'chat') {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, activeTab, isExpanded, embedded]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    onSendMessage(inputMsg.trim());
    setInputMsg('');
  };

  const handleQuickEmoji = (emoji) => {
    onSendMessage(emoji);
  };

  const borderColors = {
    dice: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/40',
    buy: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/40',
    rent: 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 border border-rose-200/70 dark:border-rose-800/40',
    jail: 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200 border border-orange-200/70 dark:border-orange-800/40',
    card: 'border-l-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200 border border-sky-200/70 dark:border-sky-800/40',
    bankrupt: 'border-l-red-600 bg-red-50 dark:bg-red-950/40 text-red-950 dark:text-red-200 border border-red-200/70 dark:border-red-800/40',
    info: 'border-l-slate-400 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700/60'
  };

  // ZAR TABLASI ALTINA YERLEŞİK (EMBEDDED) GÖRÜNÜM
  if (embedded) {
    return (
      <>
        <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-slate-100 min-h-0">
          {/* Üst Sekmeler Barı & Büyütme Butonu */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('log')}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  activeTab === 'log'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <ScrollText className="w-3 h-3" />
                <span>Olaylar ({logs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>Sohbet ({messages.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('voice')}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer relative ${
                  activeTab === 'voice'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Radio className={`w-3 h-3 ${voiceChat.isInVoice ? 'text-emerald-500 animate-pulse' : ''}`} />
                <span>Ses Odası</span>
                {voiceChat.isInVoice ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                ) : voiceChat.participantsCount > 0 ? (
                  <span className="text-[9px] px-1 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    {voiceChat.participantsCount}
                  </span>
                ) : null}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Tam ekranda genişlet"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Seste Olup Başka Sekmedeyken Gösterilen Mini Kontrol Çubuğu */}
          {voiceChat.isInVoice && activeTab !== 'voice' && (
            <div className="flex items-center justify-between px-2.5 py-1 bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/30 text-[10.5px] text-emerald-800 dark:text-emerald-300 flex-shrink-0 animate-fadeIn">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="font-bold truncate">Sestesiniz ({voiceChat.participantsCount} kişi)</span>
                {voiceChat.isSpeaking && (
                  <span className="text-[8px] bg-emerald-500 text-slate-950 font-black px-1 rounded uppercase tracking-wider font-jetbrains">
                    Konuşuyor
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={voiceChat.toggleMute}
                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 cursor-pointer transition ${
                    voiceChat.isMuted
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                  }`}
                  title={voiceChat.isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}
                >
                  {voiceChat.isMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                  <span>{voiceChat.isMuted ? 'Sessiz' : 'Açık'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('voice')}
                  className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Odaya Git
                </button>
                <button
                  type="button"
                  onClick={voiceChat.handleLeaveVoice}
                  className="p-1 rounded text-rose-600 hover:bg-rose-500/20 transition cursor-pointer"
                  title="Sesten Ayrıl"
                >
                  <PhoneOff className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Orta Kaydırılabilir Liste Alanı */}
          <div className="flex-1 overflow-y-auto p-2 text-xs space-y-1.5 custom-scrollbar bg-slate-50/40 dark:bg-slate-900/40 min-h-0">
            {activeTab === 'voice' ? (
              <VoiceRoomView
                voiceChat={voiceChat}
                roomCode={roomCode}
                myPlayerId={myPlayerId}
                players={players}
                isDarkMode={isDarkMode}
                voiceStates={voiceStates}
              />
            ) : activeTab === 'log' ? (
              <div>
                {/* Oyuncu Filtreleme Çipleri */}
                {players && players.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-1.5 custom-scrollbar flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPlayerFilter('ALL')}
                      className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition whitespace-nowrap cursor-pointer ${
                        selectedPlayerFilter === 'ALL'
                          ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Tümü
                    </button>
                    {players.map((p) => {
                      const count = reversedLogs.filter(l => l.text.includes(p.name)).length;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPlayerFilter(p.id)}
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                            selectedPlayerFilter === p.id
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="truncate max-w-[55px]">{p.name}</span>
                          <span className="text-[8px] opacity-70 font-mono">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {filteredLogs.map((log, idx) => {
                  const eventTime = getEventGameTime(log, gameStartTime, totalPausedDuration);
                  return (
                    <div
                      key={log.id}
                      className={`py-1 px-2 mb-1 rounded-r-md border-l-2 text-[10.5px] leading-snug flex items-start justify-between gap-1.5 shadow-xs ${
                        borderColors[log.type] || borderColors.info
                      }`}
                    >
                      <div className="flex items-start gap-1 flex-1 font-medium min-w-0">
                        {idx === 0 && selectedPlayerFilter === 'ALL' && (
                          <span className="text-[7.5px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 px-0.5 rounded flex-shrink-0 font-jetbrains mt-0.5">
                            Yeni
                          </span>
                        )}
                        <span className="break-words flex-1 text-slate-900 dark:text-slate-100">{log.text}</span>
                      </div>
                      <span
                        className="text-[8.5px] text-slate-500 dark:text-slate-400 font-mono flex-shrink-0 font-jetbrains mt-0.5"
                        title={getEventTooltip(eventTime)}
                      >
                        {eventTime}
                      </span>
                    </div>
                  );
                })}

                {filteredLogs.length === 0 && (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-6 text-xs italic">
                    Henüz olay kaydedilmedi.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {messages.map((m) => {
                  const msgTime = getChatMessageTime(m, gameStartTime, totalPausedDuration);
                  return (
                    <div key={m.id} className="p-1.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-black text-[10.5px] font-space" style={{ color: m.senderColor }}>
                          {m.senderName}
                        </span>
                        <span
                          className="text-[8.5px] text-slate-400 font-mono font-jetbrains"
                          title={getEventTooltip(msgTime)}
                        >
                          {msgTime}
                        </span>
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 text-[11px] break-words leading-relaxed font-medium">{m.text}</div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-6 text-xs italic flex flex-col items-center gap-1">
                    <MessageSquare className="w-5 h-5 text-slate-400" />
                    <span>Sohbet mesajı yok. İlk mesajı sen yaz!</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Alt Çubuk (Canlı Sohbet Girişi) */}
          {activeTab === 'chat' && (
            <div className="p-1.5 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1 flex-shrink-0">
              {/* Hızlı Emoji Reaksiyonları */}
              <div className="flex gap-1.5 justify-center py-0.5">
                {['🎩', '💰', '🎲', '😂', '🏠', '🎉'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleQuickEmoji(em)}
                    className="hover:scale-125 active:scale-95 transition-transform text-xs cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSend} className="flex gap-1">
                <input
                  type="text"
                  value={inputMsg}
                  maxLength={120}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-100 text-xs placeholder-slate-400 focus:outline-none focus:border-amber-500 transition font-medium"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 rounded-lg text-xs font-black transition flex items-center justify-center gap-1 active:scale-95 shadow-xs cursor-pointer font-space"
                >
                  <Send className="w-3 h-3" />
                  <span>Gönder</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* 2. Genişletilmiş Tam Ekran Modal / Drawer Görünümü (Büyüt ikonuna basıldığında) */}
        {isExpanded && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
            onClick={() => setIsExpanded(false)}
          >
            <div
              className="w-full max-w-lg bg-[#F8FAFC] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] max-h-[650px] relative text-slate-900 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Üst Başlık & Sekmeler */}
              <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('log')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'log'
                        ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <ScrollText className="w-3.5 h-3.5" />
                    <span>Tüm Olaylar ({logs.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'chat'
                        ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Canlı Sohbet ({messages.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('voice')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer relative ${
                      activeTab === 'voice'
                        ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${voiceChat.isInVoice ? 'text-emerald-500 animate-pulse' : ''}`} />
                    <span>Ses Odası</span>
                    {voiceChat.isInVoice ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    ) : voiceChat.participantsCount > 0 ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                        {voiceChat.participantsCount}
                      </span>
                    ) : null}
                  </button>
                </div>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
                  title="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal İçerik Alanı */}
              <div className="flex-1 overflow-y-auto p-4 text-xs space-y-2 custom-scrollbar bg-[#F8FAFC] dark:bg-slate-900">
                {activeTab === 'voice' ? (
                  <VoiceRoomView
                    voiceChat={voiceChat}
                    roomCode={roomCode}
                    myPlayerId={myPlayerId}
                    players={players}
                    isDarkMode={isDarkMode}
                    voiceStates={voiceStates}
                  />
                ) : activeTab === 'log' ? (
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between font-bold">
                      <span>Olay Geçmişi (En yeni olaylar en üsttedir)</span>
                      <span className="font-jetbrains">Toplam {logs.length} olay</span>
                    </div>

                    {/* Oyuncu Filtreleme Çipleri */}
                    {players && players.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 custom-scrollbar">
                        <button
                          onClick={() => setSelectedPlayerFilter('ALL')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                            selectedPlayerFilter === 'ALL'
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          Tümü ({logs.length})
                        </button>
                        {players.map((p) => {
                          const count = reversedLogs.filter(l => l.text.includes(p.name)).length;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPlayerFilter(p.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                selectedPlayerFilter === p.id
                                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                              <span>{p.name} ({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {filteredLogs.map((log, idx) => {
                      const eventTime = getEventGameTime(log, gameStartTime, totalPausedDuration);
                      return (
                        <div
                          key={log.id}
                          className={`py-1.5 px-2.5 mb-1.5 rounded-r-lg border-l-2 text-xs leading-relaxed flex items-start justify-between gap-2 shadow-xs ${
                            borderColors[log.type] || borderColors.info
                          }`}
                        >
                          <div className="flex items-start gap-1.5 flex-1 font-medium min-w-0">
                            {idx === 0 && selectedPlayerFilter === 'ALL' && (
                              <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 rounded flex-shrink-0 font-jetbrains mt-0.5">
                                Yeni
                              </span>
                            )}
                            <span className="break-words whitespace-pre-wrap flex-1 text-slate-900 dark:text-slate-100">{log.text}</span>
                          </div>
                          <span
                            className="text-[10px] text-slate-500 dark:text-slate-400 mr-1 font-mono flex-shrink-0 font-jetbrains mt-0.5"
                            title={getEventTooltip(eventTime)}
                          >
                            {eventTime}
                          </span>
                        </div>
                      );
                    })}

                    {filteredLogs.length === 0 && (
                      <div className="text-center text-slate-500 dark:text-slate-400 py-10 text-xs italic">
                        Bu filtreye ait olay bulunamadı.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {messages.map((m) => {
                      const msgTime = getChatMessageTime(m, gameStartTime, totalPausedDuration);
                      return (
                        <div key={m.id} className="p-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-xs font-space" style={{ color: m.senderColor }}>
                              {m.senderName}
                            </span>
                            <span
                              className="text-[10px] text-slate-400 font-mono font-jetbrains"
                              title={getEventTooltip(msgTime)}
                            >
                              {msgTime}
                            </span>
                          </div>
                          <div className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm break-words leading-relaxed font-medium">{m.text}</div>
                        </div>
                      );
                    })}
                    {messages.length === 0 && (
                      <div className="text-center text-slate-500 dark:text-slate-400 py-16 text-xs italic flex flex-col items-center gap-2">
                        <MessageSquare className="w-8 h-8 text-slate-400" />
                        <span className="font-medium">Henüz sohbet mesajı yok. Arkadaşlarına bir şey yaz!</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Modal Sohbet Alt Çubuğu */}
              {activeTab === 'chat' && (
                <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                  {/* Hızlı Emoji Reaksiyonları */}
                  <div className="flex gap-2 justify-center py-1">
                    {['🎩', '💰', '🎲', '😂', '🏠', '🚨', '👋', '🎉'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => handleQuickEmoji(em)}
                        className="hover:scale-125 active:scale-95 transition-transform p-1 text-base cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSend} className="flex gap-2">
                    <input
                      type="text"
                      value={inputMsg}
                      maxLength={120}
                      onChange={(e) => setInputMsg(e.target.value)}
                      placeholder="Mesajınızı yazın..."
                      autoFocus
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100 text-xs sm:text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 transition font-medium"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer font-space"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Gönder</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* 1. Kompakt / Minimize Görünüm (Varsayılan - Son 3 Olay Ticker'ı) */}
      <div
        onClick={() => setIsExpanded(true)}
        className="cardstock-panel hover:bg-white dark:hover:bg-slate-850 rounded-2xl p-3 shadow-md hover:border-amber-500/60 cursor-pointer transition-all duration-200 group relative overflow-hidden flex flex-col gap-1.5 text-slate-900 dark:text-slate-100 tile-paper-press flex-shrink-0"
        title="Olay geçmişini ve sohbeti tam ekran açmak için tıklayın"
      >
        {/* Üst Bar: Başlık & Genişlet Butonu */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5 font-space">
              <ScrollText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Olaylar & Sohbet</span>
            </h3>
            {messages.length > 0 && (
              <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5 font-jetbrains">
                <MessageSquare className="w-2.5 h-2.5 text-indigo-600" />
                <span>{messages.length}</span>
              </span>
            )}
            {voiceChat.isInVoice && (
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 font-jetbrains">
                <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                <span>Seste ({voiceChat.participantsCount})</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 group-hover:text-indigo-800 font-space">
            <span>Aç & Sohbet Et</span>
            <Maximize2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          </div>
        </div>

        {/* Son 3 Olayın Gösterimi (En yeni olay en üstte!) */}
        <div className="space-y-1 mt-0.5">
          {recentLogs.length > 0 ? (
            recentLogs.map((log, idx) => {
              const eventTime = getEventGameTime(log, gameStartTime, totalPausedDuration);
              return (
                <div
                  key={log.id}
                  className={`py-0.5 px-2 rounded-r-md border-l-2 text-[10.5px] leading-snug flex items-center justify-between gap-1.5 truncate ${
                    borderColors[log.type] || borderColors.info
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate flex-1 font-medium">
                    {idx === 0 && (
                      <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 rounded flex-shrink-0 font-jetbrains">
                        Yeni
                      </span>
                    )}
                    <span className="truncate">{log.text}</span>
                  </div>
                  <span
                    className="text-[9px] text-slate-500 font-mono flex-shrink-0 font-jetbrains"
                    title={getEventTooltip(eventTime)}
                  >
                    {eventTime}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-[11px] text-slate-500 italic text-center py-1 font-medium">
              Oyun henüz başladı, ilk olaylar bekleniyor...
            </div>
          )}
        </div>
      </div>

      {/* 2. Genişletilmiş Tam Ekran Modal / Drawer Görünümü */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="w-full max-w-lg bg-[#F8FAFC] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] max-h-[650px] relative text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Üst Başlık & Sekmeler */}
            <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('log')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'log'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ScrollText className="w-3.5 h-3.5" />
                  <span>Tüm Olaylar ({logs.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'chat'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Canlı Sohbet ({messages.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('voice')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer relative ${
                    activeTab === 'voice'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Radio className={`w-3.5 h-3.5 ${voiceChat.isInVoice ? 'text-emerald-500 animate-pulse' : ''}`} />
                  <span>Ses Odası</span>
                  {voiceChat.isInVoice ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  ) : voiceChat.participantsCount > 0 ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {voiceChat.participantsCount}
                    </span>
                  ) : null}
                </button>
              </div>

              <button
                onClick={() => setIsExpanded(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal İçerik Alanı */}
            <div className="flex-1 overflow-y-auto p-4 text-xs space-y-2 custom-scrollbar bg-[#F8FAFC] dark:bg-slate-900">
              {activeTab === 'voice' ? (
                <VoiceRoomView
                  voiceChat={voiceChat}
                  roomCode={roomCode}
                  myPlayerId={myPlayerId}
                  players={players}
                  isDarkMode={isDarkMode}
                  voiceStates={voiceStates}
                />
              ) : activeTab === 'log' ? (
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between font-bold">
                    <span>Olay Geçmişi (En yeni olaylar en üsttedir)</span>
                    <span className="font-jetbrains">Toplam {logs.length} olay</span>
                  </div>

                  {/* Oyuncu Filtreleme Çipleri */}
                  {players && players.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 custom-scrollbar">
                      <button
                        onClick={() => setSelectedPlayerFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                          selectedPlayerFilter === 'ALL'
                            ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        Tümü ({logs.length})
                      </button>
                      {players.map((p) => {
                        const count = reversedLogs.filter(l => l.text.includes(p.name)).length;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPlayerFilter(p.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                              selectedPlayerFilter === p.id
                                ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                            <span>{p.name} ({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {filteredLogs.map((log, idx) => {
                    const eventTime = getEventGameTime(log, gameStartTime, totalPausedDuration);
                    return (
                      <div
                        key={log.id}
                        className={`py-1.5 px-2.5 mb-1.5 rounded-r-lg border-l-2 text-xs leading-relaxed flex items-start justify-between gap-2 shadow-xs ${
                          borderColors[log.type] || borderColors.info
                        }`}
                      >
                        <div className="flex items-start gap-1.5 flex-1 font-medium min-w-0">
                          {idx === 0 && selectedPlayerFilter === 'ALL' && (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 rounded flex-shrink-0 font-jetbrains mt-0.5">
                              Yeni
                            </span>
                          )}
                          <span className="break-words whitespace-pre-wrap flex-1 text-slate-900 dark:text-slate-100">{log.text}</span>
                        </div>
                        <span
                          className="text-[10px] text-slate-500 dark:text-slate-400 mr-1 font-mono flex-shrink-0 font-jetbrains mt-0.5"
                          title={getEventTooltip(eventTime)}
                        >
                          {eventTime}
                        </span>
                      </div>
                    );
                  })}

                  {filteredLogs.length === 0 && (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-10 text-xs italic">
                      Bu filtreye ait olay bulunamadı.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {messages.map((m) => {
                    const msgTime = getChatMessageTime(m, gameStartTime, totalPausedDuration);
                    return (
                      <div key={m.id} className="p-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-xs font-space" style={{ color: m.senderColor }}>
                            {m.senderName}
                          </span>
                          <span
                            className="text-[10px] text-slate-400 font-mono font-jetbrains"
                            title={getEventTooltip(msgTime)}
                          >
                            {msgTime}
                          </span>
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm break-words leading-relaxed font-medium">{m.text}</div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-16 text-xs italic flex flex-col items-center gap-2">
                      <MessageSquare className="w-8 h-8 text-slate-400" />
                      <span className="font-medium">Henüz sohbet mesajı yok. Arkadaşlarına bir şey yaz!</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Modal Sohbet Alt Çubuğu */}
            {activeTab === 'chat' && (
              <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                {/* Hızlı Emoji Reaksiyonları */}
                <div className="flex gap-2 justify-center py-1">
                  {['🎩', '💰', '🎲', '😂', '🏠', '🚨', '👋', '🎉'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => handleQuickEmoji(em)}
                      className="hover:scale-125 active:scale-95 transition-transform p-1 text-base cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    value={inputMsg}
                    maxLength={120}
                    onChange={(e) => setInputMsg(e.target.value)}
                    placeholder="Mesajınızı yazın..."
                    autoFocus
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100 text-xs sm:text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 transition font-medium"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer font-space"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gönder</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export const ChatAndLog = React.memo(ChatAndLogBase);
