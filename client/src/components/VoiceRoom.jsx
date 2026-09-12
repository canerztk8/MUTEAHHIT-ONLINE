import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { getPeerConfig } from '../network/PeerService.js';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, ShieldCheck, Users, Radio } from 'lucide-react';

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
export function useVoiceChat({
  roomCode,
  myPlayerId,
  myPlayerName,
  players = [],
  voiceStates = {},
  onSendVoiceState = null
}) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 🎙️ Mikrofon Donanım Seçimi (Harici mikrofon seçilerek Bluetooth kulaklığın hands-free moduna düşmesi engellenir)
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    try {
      return localStorage.getItem('muteahhit_mic_id') || '';
    } catch {
      return '';
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

  // Sesteki uzak kullanıcılar: playerId -> { playerId, playerName, color, isSpeaking, isMuted, stream }
  const [voicePeers, setVoicePeers] = useState(new Map());

  // Referanslar
  const localStreamRef = useRef(null);
  const voicePeerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const isMutedRef = useRef(false);
  const activeCallsRef = useRef(new Map()); // playerId -> MediaConnection
  const remoteAudiosRef = useRef(new Map()); // playerId -> HTMLAudioElement
  const remoteAnalysersRef = useRef(new Map()); // playerId -> AnalyserNode
  const lastSpeakingSentRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const voiceStatesRef = useRef(voiceStates);
  const playersRef = useRef(players);
  const onSendVoiceStateRef = useRef(onSendVoiceState);

  useEffect(() => {
    voiceStatesRef.current = voiceStates;
  }, [voiceStates]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    onSendVoiceStateRef.current = onSendVoiceState;
  }, [onSendVoiceState]);

  // Ses aygıtlarını listele ve harici mikrofonu otomatik tercih et
  const refreshAudioDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      setAudioDevices(audioInputs);

      // Eğer kayıtlı aygıt yoksa veya listede yoksa, akıllı otomatik seçim yap:
      // Bluetooth Hands-Free harici olan (USB, External, Mikrofon) bir aygıt varsa onu seç!
      setSelectedDeviceId(currentId => {
        if (currentId && audioInputs.some(d => d.deviceId === currentId)) {
          return currentId;
        }
        const externalMic = audioInputs.find(d => {
          const lbl = (d.label || '').toLowerCase();
          return lbl && !lbl.includes('hands-free') && !lbl.includes('handsfree') && !lbl.includes('bth') && !lbl.includes('bluetooth') &&
            (lbl.includes('usb') || lbl.includes('mic') || lbl.includes('realtek') || lbl.includes('high definition'));
        });
        const fallback = externalMic?.deviceId || audioInputs[0]?.deviceId || '';
        try { localStorage.setItem('muteahhit_mic_id', fallback); } catch (_) {}
        return fallback;
      });
    } catch (e) {
      console.warn('[useVoiceChat] Aygıt listesi alınamadı:', e);
    }
  }, []);

  useEffect(() => {
    refreshAudioDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshAudioDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshAudioDevices);
      };
    }
  }, [refreshAudioDevices]);

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

  // Canlı Ses Düzeyi ve Konuşma Algılayıcı Döngüsü
  const startVolumeAnalysis = useCallback((stream) => {
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

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
          const nowSpeaking = avg > 14;

          if (isSpeakingRef.current !== nowSpeaking) {
            isSpeakingRef.current = nowSpeaking;
            setIsSpeaking(nowSpeaking);

            // Ağ üzerinden durumu debounced gönder (fazla paket yükünü engeller)
            const now = Date.now();
            if (now - lastSpeakingSentRef.current > 300) {
              lastSpeakingSentRef.current = now;
              onSendVoiceStateRef.current?.({
                inVoice: true,
                isMuted: isMutedRef.current,
                isSpeaking: nowSpeaking
              });
            }
          }
        } else {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            onSendVoiceStateRef.current?.({
              inVoice: true,
              isMuted: isMutedRef.current,
              isSpeaking: false
            });
          }
        }

        // Uzak kullanıcıların frekans analizi
        setVoicePeers(prevPeers => {
          let hasDiff = false;
          const nextPeers = new Map(prevPeers);

          remoteAnalysersRef.current.forEach((remAnalyser, playerId) => {
            const peerData = nextPeers.get(playerId);
            if (peerData) {
              const remData = new Uint8Array(remAnalyser.frequencyBinCount);
              remAnalyser.getByteFrequencyData(remData);
              let sum = 0;
              for (let i = 0; i < remData.length; i++) sum += remData[i];
              const avg = sum / remData.length;
              const nowSpeaking = avg > 14;
              if (peerData.isSpeaking !== nowSpeaking) {
                nextPeers.set(playerId, { ...peerData, isSpeaking: nowSpeaking });
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
  const attachRemoteAudio = useCallback((playerId, remoteStream, playerMeta = {}) => {
    let audioEl = remoteAudiosRef.current.get(playerId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      remoteAudiosRef.current.set(playerId, audioEl);
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
        remoteAnalysersRef.current.set(playerId, remAnalyser);
      }
    } catch (e) {
      console.warn('[useVoiceChat] Uzak analizör hatası:', e);
    }

    setVoicePeers(prev => {
      const next = new Map(prev);
      const existing = next.get(playerId) || {};
      next.set(playerId, {
        playerId,
        playerName: playerMeta.name || existing.playerName || 'Oyuncu',
        color: playerMeta.color || existing.color || '#38bdf8',
        isSpeaking: false,
        isMuted: false,
        stream: remoteStream
      });
      return next;
    });
  }, [voiceVolume]);

  const removeRemoteAudio = useCallback((playerId) => {
    const audioEl = remoteAudiosRef.current.get(playerId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
      } catch (_) {}
      remoteAudiosRef.current.delete(playerId);
    }
    remoteAnalysersRef.current.delete(playerId);
    activeCallsRef.current.delete(playerId);

    setVoicePeers(prev => {
      const next = new Map(prev);
      next.delete(playerId);
      return next;
    });
  }, []);

  // Güvenlik doğrulaması: Arayanın oda tuzu ve masadaki oyuncu kimliği doğrulanır
  const getPlayerIdFromVoicePeerId = useCallback((callerVoiceId) => {
    if (!callerVoiceId || typeof callerVoiceId !== 'string') return null;
    const cleanRoom = String(roomCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const salt = getVoiceRoomSalt(roomCode);
    const prefix = `v_${cleanRoom}_${salt}_`;
    if (!callerVoiceId.startsWith(prefix)) return null;
    const cleanPlayer = callerVoiceId.slice(prefix.length);
    const matched = (playersRef.current || []).find(p => String(p.id).replace(/[^a-zA-Z0-9_-]/g, '') === cleanPlayer);
    return matched ? matched.id : null;
  }, [roomCode]);

  // Uzak kullanıcıyı arama
  const tryCallPeer = useCallback((targetPlayerId, localStream, playerMeta) => {
    if (!voicePeerRef.current || activeCallsRef.current.has(targetPlayerId)) return;
    const targetVoiceId = getVoicePeerId(roomCode, targetPlayerId);

    try {
      const call = voicePeerRef.current.call(targetVoiceId, localStream, {
        metadata: {
          id: myPlayerId,
          name: myPlayerName
        }
      });
      if (!call) return;

      call.on('stream', (remoteStream) => {
        attachRemoteAudio(targetPlayerId, remoteStream, playerMeta);
      });
      call.on('close', () => {
        removeRemoteAudio(targetPlayerId);
      });
      call.on('error', () => {
        removeRemoteAudio(targetPlayerId);
      });
      activeCallsRef.current.set(targetPlayerId, call);
    } catch (_) {}
  }, [roomCode, myPlayerId, myPlayerName, attachRemoteAudio, removeRemoteAudio]);

  // Mikrofon aygıtını canlı değiştirme (Çağrı kesilmeden ses track'ini değiştirir)
  const switchMicrophone = useCallback(async (newDeviceId) => {
    setSelectedDeviceId(newDeviceId);
    try { localStorage.setItem('muteahhit_mic_id', newDeviceId); } catch (_) {}

    if (!localStreamRef.current || !isInVoice) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: newDeviceId ? { exact: newDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });

      const newTrack = newStream.getAudioTracks()[0];
      if (newTrack) {
        newTrack.enabled = !isMutedRef.current;

        // Eski akışın track'lerini kapat
        localStreamRef.current.getAudioTracks().forEach(t => {
          try { t.stop(); } catch (_) {}
        });

        localStreamRef.current = newStream;
        startVolumeAnalysis(newStream);

        // Tüm aktif PeerJS aramalarındaki ses track'ini yeni mikrofonla anında değiştir
        activeCallsRef.current.forEach(call => {
          try {
            const peerConnection = call.peerConnection;
            if (peerConnection) {
              const senders = peerConnection.getSenders();
              const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
              if (audioSender) {
                audioSender.replaceTrack(newTrack);
              }
            }
          } catch (_) {}
        });
      }
    } catch (err) {
      console.warn('[useVoiceChat] Mikrofon değiştirilemedi:', err);
    }
  }, [isInVoice, startVolumeAnalysis]);

  // Sesli Sohbete Katıl
  const handleJoinVoice = async () => {
    if (isConnecting || isInVoice) return;
    setIsConnecting(true);
    setErrorMessage('');

    try {
      const constraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      isMutedRef.current = false;
      setIsMuted(false);

      // İzin verildikten sonra mikrofon etiketlerini yenile
      refreshAudioDevices();
      startVolumeAnalysis(stream);

      // Güvenli ve izole PeerJS bağlantısı
      const config = getPeerConfig();
      const myVoiceId = getVoicePeerId(roomCode, myPlayerId);

      const voicePeer = new Peer(myVoiceId, config);
      voicePeerRef.current = voicePeer;

      voicePeer.on('open', () => {
        setIsInVoice(true);
        setIsConnecting(false);

        // Tüm odaya ses odasına katıldığımızı bildir
        onSendVoiceStateRef.current?.({
          inVoice: true,
          isMuted: false,
          isSpeaking: false
        });

        // Masadaki diğer oyuncuları ara
        const currentPlayers = playersRef.current || [];
        currentPlayers.forEach(p => {
          if (p.id !== myPlayerId && !p.isBot) {
            tryCallPeer(p.id, stream, p);
          }
        });
      });

      // Gelen aramaları karşıla ve yetki kontrolü yap
      voicePeer.on('call', (call) => {
        const callerPlayerId = getPlayerIdFromVoicePeerId(call.peer);
        if (!callerPlayerId) {
          console.warn('[useVoiceChat Security] Yetkisiz arama reddedildi:', call.peer);
          call.close();
          return;
        }

        call.answer(stream);
        const callerPlayer = (playersRef.current || []).find(p => p.id === callerPlayerId) || {};

        call.on('stream', (remoteStream) => {
          attachRemoteAudio(callerPlayerId, remoteStream, callerPlayer);
        });
        call.on('close', () => {
          removeRemoteAudio(callerPlayerId);
        });
        call.on('error', () => {
          removeRemoteAudio(callerPlayerId);
        });
        activeCallsRef.current.set(callerPlayerId, call);
      });

      voicePeer.on('error', (err) => {
        console.warn('[useVoiceChat] Peer uyarısı:', err.type);
        if (err.type === 'unavailable-id') {
          setIsInVoice(true);
          setIsConnecting(false);
        } else if (err.type === 'peer-unavailable') {
          // Normal: Karşı taraf henüz ses odasında değil
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

  // 🔄 Periyodik Bağlantı Bekçisi (Karşı taraf sese girdiğinde otomatik bağlanır)
  useEffect(() => {
    if (!isInVoice || !localStreamRef.current) return;

    const interval = setInterval(() => {
      const currentStream = localStreamRef.current;
      if (!currentStream || !voicePeerRef.current) return;

      const currentPlayers = playersRef.current || [];
      const vStates = voiceStatesRef.current || {};

      currentPlayers.forEach(p => {
        if (p.id !== myPlayerId && !p.isBot) {
          const isTargetInVoice = Boolean(vStates[p.id]?.inVoice);
          const hasActiveCall = activeCallsRef.current.has(p.id);

          // Karşı taraf seste ve henüz aramızda aktif ses bağlantısı yoksa ara
          if (isTargetInVoice && !hasActiveCall) {
            tryCallPeer(p.id, currentStream, p);
          }
        }
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isInVoice, myPlayerId, tryCallPeer]);

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

    onSendVoiceStateRef.current?.({
      inVoice: true,
      isMuted: nextMuted,
      isSpeaking: false
    });
  }, []);

  // Sesli Sohbetten Ayrıl
  const handleLeaveVoice = useCallback(() => {
    onSendVoiceStateRef.current?.({
      inVoice: false,
      isMuted: false,
      isSpeaking: false
    });

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
    isSpeakingRef.current = false;
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

  // Toplam seste olan insan sayısı hesabı (voiceStates veya P2P bağlantılarına göre)
  const humanPlayers = (players || []).filter(p => !p.isBot);
  const inVoiceCount = humanPlayers.filter(p => {
    if (p.id === myPlayerId) return isInVoice;
    return Boolean(voiceStates?.[p.id]?.inVoice || voicePeers.has(p.id));
  }).length;

  return {
    isInVoice,
    isConnecting,
    isMuted,
    isSpeaking,
    errorMessage,
    voiceVolume,
    setVoiceVolume,
    audioDevices,
    selectedDeviceId,
    switchMicrophone,
    voicePeers,
    participantsCount: inVoiceCount,
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
  isDarkMode = false,
  voiceStates = {}
}) {
  const {
    isInVoice,
    isConnecting,
    isMuted,
    isSpeaking,
    errorMessage,
    voiceVolume,
    setVoiceVolume,
    audioDevices,
    selectedDeviceId,
    switchMicrophone,
    voicePeers,
    handleJoinVoice,
    toggleMute,
    handleLeaveVoice
  } = voiceChat;

  const humanPlayers = players.filter(p => !p.isBot);

  return (
    <div className="w-full h-full flex flex-col p-2.5 sm:p-3.5 select-none overflow-y-auto custom-scrollbar">
      
      {/* 1. ÜST BİLGİ & GÜVENLİK KARTI */}
      <div className={`rounded-2xl p-2.5 mb-2.5 border flex flex-col gap-2 ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm ${
              isInVoice ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}>
              {isInVoice ? <Radio className="w-3.5 h-3.5 animate-pulse" /> : <Users className="w-3.5 h-3.5" />}
            </div>
            <div>
              <h4 className="text-xs font-black font-space text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>Ses Odası</span>
                <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  isInVoice ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {isInVoice ? 'Bağlandı' : 'Çevrimdışı'}
                </span>
              </h4>
              <span className="text-[9.5px] text-slate-500 dark:text-slate-400">
                {voiceChat.participantsCount > 0 ? `${voiceChat.participantsCount} katılımcı seste` : 'Odadaki oyuncularla canlı konuşun'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-lg" title="WebRTC DTLS-SRTP Uçtan Uca Şifreleme ve Oda Tuzu Koruması">
            <ShieldCheck className="w-3 h-3" />
            <span>E2EE Şifreli</span>
          </div>
        </div>

        {/* 🎙️ Mikrofon Seçimi & Ses Düzeyi Kontrolleri */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row gap-2 text-[10.5px]">
          {/* Mikrofon Seçimi Açılır Kutusu */}
          <div className="flex-1 px-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 min-w-0">
            <Mic className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <select
              value={selectedDeviceId}
              onChange={(e) => switchMicrophone(e.target.value)}
              className="w-full bg-transparent text-slate-800 dark:text-slate-200 text-[10px] font-medium focus:outline-none truncate cursor-pointer"
              title="Mikrofon Aygıtı Seçimi (Harici mikrofon seçilerek kulaklık kalitesi korunur)"
            >
              {audioDevices.length === 0 ? (
                <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Varsayılan Mikrofon</option>
              ) : (
                audioDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {d.label || `Mikrofon ${i + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Bağımsız Ses Kaydırıcısı (Slider) */}
          <div className="px-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setVoiceVolume(v => (v > 0 ? 0 : 1.0))}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer flex-shrink-0"
              title="Sohbet Sesini Sustur/Aç"
            >
              {voiceVolume === 0 ? <VolumeX className="w-3 h-3 text-rose-400" /> : <Volume2 className="w-3 h-3 text-amber-500" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={voiceVolume}
              onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
              className="w-16 sm:w-20 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              title={`Ses Düzeyi: %${Math.round(voiceVolume * 100)}`}
            />
            <span className="text-[9.5px] font-mono font-bold text-slate-700 dark:text-slate-300 w-7 text-right">
              %{Math.round(voiceVolume * 100)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. BAĞLANTI & MİKROFON BUTONLARI */}
      <div className="mb-3">
        {!isInVoice ? (
          <button
            type="button"
            onClick={handleJoinVoice}
            disabled={isConnecting}
            className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:brightness-110 active:scale-98 text-slate-950 font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer font-space border border-emerald-300/40"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isConnecting ? 'Ses Odasına Bağlanılıyor...' : '🎧 Sesli Sohbete Bağlan'}</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`py-2 px-3 rounded-2xl font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border ${
                isMuted
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-sm shadow-rose-600/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 shadow-sm shadow-emerald-500/30'
              }`}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}</span>
            </button>

            <button
              type="button"
              onClick={handleLeaveVoice}
              className="py-2 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-rose-500/60 text-rose-300 hover:text-rose-200 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Sesten Ayrıl</span>
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mt-2 p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10.5px] font-medium text-center">
            {errorMessage}
          </div>
        )}
      </div>

      {/* 3. KATILIMCI LİSTESİ VE CANLI DURUMLAR */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-200 dark:border-slate-800">
          <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase font-space tracking-wider">
            Masa Oyuncuları ({humanPlayers.length})
          </span>
          <span className="text-[9.5px] text-slate-400 font-jetbrains">
            {voiceChat.participantsCount > 0 ? `Seste: ${voiceChat.participantsCount}` : 'Seste kimse yok'}
          </span>
        </div>

        <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1 pr-0.5">
          {humanPlayers.map((player) => {
            const isMe = player.id === myPlayerId;
            const pVoiceState = voiceStates?.[player.id];
            const peerData = voicePeers.get(player.id);

            // Seste mi? (Hem yerel, hem ağ durumu, hem de WebRTC stream bazlı kontrol)
            const isConnectedToVoice = isMe
              ? isInVoice
              : Boolean(pVoiceState?.inVoice || peerData);

            // Susturulmuş mu?
            const playerIsMuted = isMe
              ? isMuted
              : Boolean(pVoiceState ? pVoiceState.isMuted : (peerData?.isMuted ?? false));

            // Konuşuyor mu?
            const playerIsSpeaking = isMe
              ? isSpeaking
              : Boolean(peerData?.isSpeaking || pVoiceState?.isSpeaking);

            return (
              <div
                key={player.id}
                className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                  playerIsSpeaking
                    ? 'bg-emerald-500/15 border-emerald-500 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/40'
                    : isConnectedToVoice
                    ? (isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')
                    : (isDarkMode ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-100/60 border-slate-200 opacity-60')
                }`}
              >
                {/* Sol: Avatar & İsim */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white shadow-xs font-space"
                      style={{ backgroundColor: player.color || '#38bdf8' }}
                    >
                      {player.name?.[0]?.toUpperCase() || 'O'}
                    </div>

                    {/* Canlı Konuşma Halkası */}
                    {playerIsSpeaking && (
                      <span className="absolute -inset-1 rounded-xl border-2 border-emerald-400 animate-ping pointer-events-none" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1 truncate">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {player.name}
                      </span>
                      {isMe && (
                        <span className="text-[8.5px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/40 px-1 rounded flex-shrink-0">
                          Sen
                        </span>
                      )}
                    </div>
                    
                    <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block truncate">
                      {isConnectedToVoice
                        ? (playerIsSpeaking ? '🎙️ Konuşuyor...' : playerIsMuted ? '🔇 Susturuldu' : '👂 Dinliyor')
                        : 'Seste Değil'}
                    </span>
                  </div>
                </div>

                {/* Sağ: Mikrofon ve Durum Rozeti */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isConnectedToVoice ? (
                    playerIsSpeaking ? (
                      <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/50 px-1.5 py-0.5 rounded-lg text-emerald-400 font-bold text-[9.5px]">
                        <div className="flex items-end gap-0.5 h-2.5">
                          <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-0.5 h-1 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span>Konuşuyor</span>
                      </div>
                    ) : playerIsMuted ? (
                      <div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/50 px-1.5 py-0.5 rounded-lg text-rose-400 font-bold text-[9.5px]">
                        <MicOff className="w-2.5 h-2.5" />
                        <span>Sessiz</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-lg text-slate-300 font-medium text-[9.5px]">
                        <Mic className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Açık</span>
                      </div>
                    )
                  ) : (
                    <div className="text-[9.5px] text-slate-500 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-lg">
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
