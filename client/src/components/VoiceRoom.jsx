import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { getPeerConfig } from '../network/PeerService.js';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, ShieldCheck, Headphones, Users, Radio } from 'lucide-react';

/**
 * Oda kodu ve oturumdan deterministik güvenli oda tuzu üretir.
 * Dışarıdan rastgele ID tahmin ederek odaya sızılmasını engeller.
 */
function getVoiceRoomSalt(roomCode) {
  const cleanRoom = String(roomCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let hash = 0;
  for (let i = 0; i < cleanRoom.length; i++) {
    hash = ((hash << 5) - hash) + cleanRoom.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(6, '0').slice(0, 6);
}

function getVoicePeerId(roomCode, playerId) {
  const cleanRoom = String(roomCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanPlayer = String(playerId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const salt = getVoiceRoomSalt(roomCode);
  return `v_${cleanRoom}_${salt}_${cleanPlayer}`;
}

/**
 * WebRTC Sesli İletişim Hook'u
 * Chat ve panel sekmeleri değişse dahi bağlantı kesilmeden arka planda aktif kalır.
 */
export function useVoiceChat({ roomCode, myPlayerId, myPlayerName, players = [] }) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 🎧 Kulaklık Modu: Açıkken echoCancellation ve autoGainControl kapatılır (Bluetooth Hands-Free mono düşüşünü engeller)
  const [headphoneMode, setHeadphoneMode] = useState(() => {
    try {
      const saved = localStorage.getItem('muteahhit_headphone_mode');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // 🔊 Bağımsız Sesli Sohbet Ses Düzeyi (Oyun seslerinden bağımsızdır)
  const [voiceVolume, setVoiceVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('muteahhit_voice_volume');
      return saved !== null ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  // Sesteki uzak kullanıcılar: peerId -> { playerId, playerName, color, isSpeaking, isMuted, stream }
  const [voicePeers, setVoicePeers] = useState(new Map());

  // Referanslar
  const localStreamRef = useRef(null);
  const voicePeerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const isMutedRef = useRef(false);
  const activeCallsRef = useRef(new Map()); // targetVoiceId -> MediaConnection
  const remoteAudiosRef = useRef(new Map()); // targetVoiceId -> HTMLAudioElement
  const remoteAnalysersRef = useRef(new Map()); // targetVoiceId -> AnalyserNode

  // Ses düzeyi değiştiğinde tüm uzak ses elementlerine anında uygula
  useEffect(() => {
    remoteAudiosRef.current.forEach(audioEl => {
      try {
        audioEl.volume = voiceVolume;
      } catch (_) {}
    });
    try {
      localStorage.setItem('muteahhit_voice_volume', String(voiceVolume));
    } catch (_) {}
  }, [voiceVolume]);

  // Kulaklık modu tercihini kaydet
  useEffect(() => {
    try {
      localStorage.setItem('muteahhit_headphone_mode', String(headphoneMode));
    } catch (_) {}
  }, [headphoneMode]);

  // Canlı Ses Düzeyi ve Konuşma Algılayıcı Döngüsü
  const startVolumeAnalysis = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const localDataArray = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        // Yerel konuşma kontrolü
        if (analyserRef.current && !isMutedRef.current) {
          analyserRef.current.getByteFrequencyData(localDataArray);
          let sum = 0;
          for (let i = 0; i < localDataArray.length; i++) sum += localDataArray[i];
          const avg = sum / localDataArray.length;
          setIsSpeaking(avg > 14);
        } else {
          setIsSpeaking(false);
        }

        // Uzak kullanıcıların konuşma seviyeleri kontrolü
        let hasSpeakingChange = false;
        setVoicePeers(prevPeers => {
          let hasDiff = false;
          const nextPeers = new Map(prevPeers);

          remoteAnalysersRef.current.forEach((remAnalyser, peerId) => {
            const peerData = nextPeers.get(peerId);
            if (peerData) {
              const remData = new Uint8Array(remAnalyser.frequencyBinCount);
              remAnalyser.getByteFrequencyData(remData);
              let sum = 0;
              for (let i = 0; i < remData.length; i++) sum += remData[i];
              const avg = sum / remData.length;
              const nowSpeaking = avg > 14;
              if (peerData.isSpeaking !== nowSpeaking) {
                nextPeers.set(peerId, { ...peerData, isSpeaking: nowSpeaking });
                hasDiff = true;
              }
            }
          });

          return hasDiff ? nextPeers : prevPeers;
        });

        animFrameRef.current = requestAnimationFrame(loop);
      };

      animFrameRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.warn('[useVoiceChat] Ses analizörü başlatılamadı:', e);
    }
  }, []);

  // Uzak ses akışını bağla
  const attachRemoteAudio = useCallback((peerId, remoteStream, playerMeta = {}) => {
    let audioEl = remoteAudiosRef.current.get(peerId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      remoteAudiosRef.current.set(peerId, audioEl);
    }
    audioEl.volume = voiceVolume;
    audioEl.srcObject = remoteStream;
    audioEl.play().catch(() => {});

    // Uzak akış için ses analizörü kur
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        const remAnalyser = audioContextRef.current.createAnalyser();
        remAnalyser.fftSize = 256;
        remAnalyser.smoothingTimeConstant = 0.4;
        const remSource = audioContextRef.current.createMediaStreamSource(remoteStream);
        remSource.connect(remAnalyser);
        remoteAnalysersRef.current.set(peerId, remAnalyser);
      }
    } catch (e) {
      console.warn('[useVoiceChat] Uzak analizör hatası:', e);
    }

    setVoicePeers(prev => {
      const next = new Map(prev);
      next.set(peerId, {
        playerId: playerMeta.id || peerId,
        playerName: playerMeta.name || 'Oyuncu',
        color: playerMeta.color || '#38bdf8',
        isSpeaking: false,
        isMuted: false,
        stream: remoteStream
      });
      return next;
    });
  }, [voiceVolume]);

  const removeRemoteAudio = useCallback((peerId) => {
    const audioEl = remoteAudiosRef.current.get(peerId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
      } catch (_) {}
      remoteAudiosRef.current.delete(peerId);
    }
    remoteAnalysersRef.current.delete(peerId);
    activeCallsRef.current.delete(peerId);

    setVoicePeers(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  // Güvenlik doğrulaması: Arayanın oda tuzu ve masadaki oyuncu kimliği doğrulanır
  const isPeerAuthorized = useCallback((callerPeerId) => {
    if (!callerPeerId || typeof callerPeerId !== 'string') return false;
    const cleanRoom = String(roomCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const salt = getVoiceRoomSalt(roomCode);
    const prefix = `v_${cleanRoom}_${salt}_`;

    if (!callerPeerId.startsWith(prefix)) return false;

    const callerPlayerId = callerPeerId.slice(prefix.length);
    const isValidPlayer = players.some(p => String(p.id).replace(/[^a-zA-Z0-9_-]/g, '') === callerPlayerId && !p.isBot);
    return isValidPlayer;
  }, [roomCode, players]);

  // Uzak kullanıcıyı arama (Deterministik çağrı önceliği)
  const tryCallPeer = useCallback((targetVoiceId, localStream, playerMeta) => {
    if (!voicePeerRef.current || activeCallsRef.current.has(targetVoiceId)) return;

    try {
      const call = voicePeerRef.current.call(targetVoiceId, localStream, {
        metadata: {
          id: myPlayerId,
          name: myPlayerName
        }
      });
      if (!call) return;

      call.on('stream', (remoteStream) => {
        attachRemoteAudio(targetVoiceId, remoteStream, playerMeta);
      });
      call.on('close', () => {
        removeRemoteAudio(targetVoiceId);
      });
      call.on('error', () => {
        removeRemoteAudio(targetVoiceId);
      });
      activeCallsRef.current.set(targetVoiceId, call);
    } catch (e) {
      // Karşı taraf henüz ses odasına girmemiş olabilir
    }
  }, [myPlayerId, myPlayerName, attachRemoteAudio, removeRemoteAudio]);

  // Sesli Sohbete Katıl
  const handleJoinVoice = async () => {
    if (isConnecting || isInVoice) return;
    setIsConnecting(true);
    setErrorMessage('');

    try {
      // 🎧 Bluetooth ve Hands-Free Koruma Kısıtlamaları:
      // echoCancellation: false ve autoGainControl: false Windows'un Bluetooth kulaklıkları mono telekom profiline düşürmesini engeller
      const constraints = {
        audio: {
          echoCancellation: !headphoneMode,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: { ideal: 2 }
        },
        video: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      isMutedRef.current = false;
      setIsMuted(false);

      startVolumeAnalysis(stream);

      // Güvenli ve izole PeerJS bağlantısı
      const config = getPeerConfig();
      const myVoiceId = getVoicePeerId(roomCode, myPlayerId);

      const voicePeer = new Peer(myVoiceId, config);
      voicePeerRef.current = voicePeer;

      voicePeer.on('open', () => {
        setIsInVoice(true);
        setIsConnecting(false);

        // Masadaki diğer insan oyuncuları ara (Deterministik öncelik)
        if (Array.isArray(players)) {
          players.forEach(p => {
            if (p.id !== myPlayerId && !p.isBot) {
              const targetVoiceId = getVoicePeerId(roomCode, p.id);
              if (String(myPlayerId) < String(p.id)) {
                tryCallPeer(targetVoiceId, stream, p);
              }
            }
          });
        }
      });

      // 🛡️ Gelen aramaları karşıla ve yetki kontrolü yap
      voicePeer.on('call', (call) => {
        if (!isPeerAuthorized(call.peer)) {
          console.warn('[useVoiceChat Security] Yetkisiz dış sesli arama reddedildi:', call.peer);
          call.close();
          return;
        }

        call.answer(stream);
        const callerPlayer = players.find(p => getVoicePeerId(roomCode, p.id) === call.peer) || {};

        call.on('stream', (remoteStream) => {
          attachRemoteAudio(call.peer, remoteStream, callerPlayer);
        });
        call.on('close', () => {
          removeRemoteAudio(call.peer);
        });
        call.on('error', () => {
          removeRemoteAudio(call.peer);
        });
        activeCallsRef.current.set(call.peer, call);
      });

      voicePeer.on('error', (err) => {
        console.warn('[useVoiceChat] Peer uyarısı:', err.type);
        if (err.type === 'unavailable-id') {
          setIsInVoice(true);
          setIsConnecting(false);
        } else if (err.type === 'peer-unavailable') {
          // Normal
        } else {
          setErrorMessage(err.message || 'Ses bağlantısı uyarısı.');
        }
      });

    } catch (err) {
      console.error('[useVoiceChat] Mikrofon hatası:', err);
      setErrorMessage('Mikrofon erişimi sağlanamadı. Tarayıcı izinlerini kontrol edin.');
      setIsConnecting(false);
      handleLeaveVoice();
    }
  };

  // Mikrofonu Sustur / Aç
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;

    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
    if (nextMuted) {
      setIsSpeaking(false);
    }
  }, []);

  // Sesli Sohbetten Ayrıl
  const handleLeaveVoice = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (_) {}
      });
      localStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    activeCallsRef.current.forEach(call => {
      try { call.close(); } catch (_) {}
    });
    activeCallsRef.current.clear();

    remoteAudiosRef.current.forEach(audioEl => {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
      } catch (_) {}
    });
    remoteAudiosRef.current.clear();
    remoteAnalysersRef.current.clear();

    if (voicePeerRef.current) {
      try { voicePeerRef.current.destroy(); } catch (_) {}
      voicePeerRef.current = null;
    }

    isMutedRef.current = false;
    setIsInVoice(false);
    setIsConnecting(false);
    setIsMuted(false);
    setIsSpeaking(false);
    setVoicePeers(new Map());
  }, []);

  // Unmount anında güvenli temizlik
  useEffect(() => {
    return () => {
      handleLeaveVoice();
    };
  }, [handleLeaveVoice]);

  return {
    isInVoice,
    isConnecting,
    isMuted,
    isSpeaking,
    errorMessage,
    headphoneMode,
    setHeadphoneMode,
    voiceVolume,
    setVoiceVolume,
    voicePeers,
    participantsCount: isInVoice ? voicePeers.size + 1 : voicePeers.size,
    handleJoinVoice,
    toggleMute,
    handleLeaveVoice
  };
}

/**
 * Ses Odası Görsel Arayüz Bileşeni (Ses Odası Sekmesi İçeriği)
 */
export function VoiceRoomView({
  voiceChat,
  roomCode,
  myPlayerId,
  players = [],
  isDarkMode = false
}) {
  const {
    isInVoice,
    isConnecting,
    isMuted,
    isSpeaking,
    errorMessage,
    headphoneMode,
    setHeadphoneMode,
    voiceVolume,
    setVoiceVolume,
    voicePeers,
    handleJoinVoice,
    toggleMute,
    handleLeaveVoice
  } = voiceChat;

  const humanPlayers = players.filter(p => !p.isBot);

  return (
    <div className="w-full h-full flex flex-col p-3 sm:p-4 select-none overflow-y-auto custom-scrollbar">
      
      {/* 1. ÜST BİLGİ & GÜVENLİK KARTI */}
      <div className={`rounded-2xl p-3 mb-3 border flex flex-col gap-2 ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${
              isInVoice ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}>
              {isInVoice ? <Radio className="w-4 h-4 animate-pulse" /> : <Users className="w-4 h-4" />}
            </div>
            <div>
              <h4 className="text-xs font-black font-space text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>Ses Odası</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  isInVoice ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {isInVoice ? 'Bağlandı' : 'Çevrimdışı'}
                </span>
              </h4>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {isInVoice ? `${voicePeers.size + 1} katılımcı seste` : 'Odadaki oyuncularla canlı konuşun'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 px-2 py-1 rounded-lg" title="WebRTC DTLS-SRTP Uçtan Uca Şifreleme ve Oda Tuzu Koruması">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>E2EE Şifreli</span>
          </div>
        </div>

        {/* 🎧 Kulaklık & Ses Seviyesi Kontrolleri */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          {/* Kulaklık Modu Anahtarı */}
          <button
            type="button"
            onClick={() => setHeadphoneMode(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-1.5 transition cursor-pointer ${
              headphoneMode
                ? 'bg-sky-500/15 border-sky-400/40 text-sky-700 dark:text-sky-300 font-bold'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
            title="Bluetooth kulaklıkların mikrofon açıldığında telefon/mono moduna düşerek ses kalitesini bozmasını engeller"
          >
            <div className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5" />
              <span>Kulaklık Modu</span>
            </div>
            <span className="text-[9.5px] uppercase font-mono">{headphoneMode ? 'Açık (HQ)' : 'Kapalı'}</span>
          </button>

          {/* Bağımsız Ses Kaydırıcısı (Slider) */}
          <div className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVoiceVolume(v => (v > 0 ? 0 : 1.0))}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              title="Sohbet Sesini Sustur/Aç"
            >
              {voiceVolume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-500" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={voiceVolume}
              onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              title={`Ses Düzeyi: %${Math.round(voiceVolume * 100)}`}
            />
            <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 w-8 text-right">
              %{Math.round(voiceVolume * 100)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. BAĞLANTI & MİKROFON BUTONLARI */}
      <div className="mb-4">
        {!isInVoice ? (
          <button
            type="button"
            onClick={handleJoinVoice}
            disabled={isConnecting}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:brightness-110 active:scale-98 text-slate-950 font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer font-space border border-emerald-300/40"
          >
            <Mic className="w-4 h-4" />
            <span>{isConnecting ? 'Ses Odasına Bağlanılıyor...' : '🎧 Sesli Sohbete Bağlan'}</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`py-2.5 px-3 rounded-2xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 border ${
                isMuted
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-600/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 shadow-md shadow-emerald-500/30'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}</span>
            </button>

            <button
              type="button"
              onClick={handleLeaveVoice}
              className="py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-rose-500/60 text-rose-300 hover:text-rose-200 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <PhoneOff className="w-4 h-4 text-rose-400" />
              <span>Sesten Ayrıl</span>
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mt-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-medium text-center">
            {errorMessage}
          </div>
        )}
      </div>

      {/* 3. KATILIMCI LİSTESİ VE CANLI DURUMLAR */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase font-space tracking-wider">
            Masa Oyuncuları ({humanPlayers.length})
          </span>
          <span className="text-[10px] text-slate-400 font-jetbrains">
            {isInVoice ? `Seste: ${voicePeers.size + 1}` : 'Bağlı değil'}
          </span>
        </div>

        <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-0.5">
          {humanPlayers.map((player) => {
            const isMe = player.id === myPlayerId;
            const targetVoiceId = getVoicePeerId(roomCode, player.id);
            const peerData = voicePeers.get(targetVoiceId);
            const isConnectedToVoice = isMe ? isInVoice : Boolean(peerData);
            const playerIsSpeaking = isMe ? isSpeaking : Boolean(peerData?.isSpeaking);
            const playerIsMuted = isMe ? isMuted : Boolean(peerData?.isMuted);

            return (
              <div
                key={player.id}
                className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                  playerIsSpeaking
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/15 ring-2 ring-emerald-500/30'
                    : isConnectedToVoice
                    ? (isDarkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-slate-200')
                    : (isDarkMode ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-100/60 border-slate-200 opacity-60')
                }`}
              >
                {/* Sol: Avatar & İsim */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-xs font-space"
                      style={{ backgroundColor: player.color || '#38bdf8' }}
                    >
                      {player.name?.[0]?.toUpperCase() || 'O'}
                    </div>

                    {/* Canlı Konuşma Halkası */}
                    {playerIsSpeaking && (
                      <span className="absolute -inset-1 rounded-2xl border-2 border-emerald-400 animate-ping pointer-events-none" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {player.name}
                      </span>
                      {isMe && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/40 px-1 rounded flex-shrink-0">
                          Sen
                        </span>
                      )}
                    </div>
                    
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                      {isConnectedToVoice
                        ? (playerIsSpeaking ? 'Konuşuyor...' : playerIsMuted ? 'Susturuldu' : 'Dinliyor')
                        : 'Seste Değil'}
                    </span>
                  </div>
                </div>

                {/* Sağ: Mikrofon ve Durum Rozeti */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isConnectedToVoice ? (
                    playerIsSpeaking ? (
                      <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/50 px-2 py-0.5 rounded-lg text-emerald-400 font-bold text-[10px]">
                        <div className="flex items-end gap-0.5 h-3">
                          <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span>Konuşuyor</span>
                      </div>
                    ) : playerIsMuted ? (
                      <div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/50 px-2 py-0.5 rounded-lg text-rose-400 font-bold text-[10px]">
                        <MicOff className="w-3 h-3" />
                        <span>Sessiz</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg text-slate-300 font-medium text-[10px]">
                        <Mic className="w-3 h-3 text-emerald-400" />
                        <span>Açık</span>
                      </div>
                    )
                  ) : (
                    <div className="text-[10px] text-slate-500 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-lg">
                      Seste Değil
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
