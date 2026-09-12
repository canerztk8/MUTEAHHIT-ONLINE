import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { getPeerConfig } from '../network/PeerService.js';
import { Mic, MicOff, PhoneOff, Volume2, Users, Radio, Sparkles } from 'lucide-react';

export function VoiceChatBar({ roomCode, myPlayerId, myPlayerName, players = [], isDarkMode = false }) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicePeers, setVoicePeers] = useState(new Map()); // peerId -> { stream, playerName }
  const [speakingPeers, setSpeakingPeers] = useState(new Set()); // peerIds currently speaking
  const [errorMessage, setErrorMessage] = useState('');

  const localStreamRef = useRef(null);
  const voicePeerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const activeCallsRef = useRef(new Map());
  const remoteAudiosRef = useRef(new Map()); // peerId -> HTMLAudioElement

  // 1. Ses Seviyesi / Konuşma Algılayıcı Döngüsü
  const startSpeakingDetector = (stream) => {
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

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animId;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const speakingNow = avg > 14;
        setIsSpeaking(speakingNow);
        animId = requestAnimationFrame(checkVolume);
      };

      animId = requestAnimationFrame(checkVolume);
      return () => cancelAnimationFrame(animId);
    } catch (e) {
      console.warn('[VoiceChat] Ses analizörü başlatılamadı:', e);
    }
  };

  // 2. Sesli Sohbete Katıl
  const handleJoinVoice = async () => {
    if (isConnecting || isInVoice) return;
    setIsConnecting(true);
    setErrorMessage('');

    try {
      // SADECE SES (Webcam kesinlikle açılmaz!)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream;
      startSpeakingDetector(stream);

      // Dedicated P2P Audio Peer oluştur
      const config = getPeerConfig();
      // Öngörülebilir oda formatı: v_{roomCode}_{cleanPlayerId}
      const cleanId = String(myPlayerId || Math.random().toString(36).slice(2, 7)).replace(/[^a-zA-Z0-9_-]/g, '');
      const voiceId = `v_${roomCode}_${cleanId}`;

      const voicePeer = new Peer(voiceId, config);
      voicePeerRef.current = voicePeer;

      voicePeer.on('open', () => {
        setIsInVoice(true);
        setIsConnecting(false);

        // Odadaki diğer potansiyel oyuncuları ara ve ara
        if (Array.isArray(players)) {
          players.forEach(p => {
            if (p.id !== myPlayerId && !p.isBot) {
              const targetVoiceId = `v_${roomCode}_${String(p.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
              tryCallPeer(targetVoiceId, stream, p.name || 'Oyuncu');
            }
          });
        }
      });

      // Gelen aramaları cevapla
      voicePeer.on('call', (call) => {
        call.answer(stream);
        call.on('stream', (remoteStream) => {
          attachRemoteAudio(call.peer, remoteStream);
        });
        call.on('close', () => {
          removeRemoteAudio(call.peer);
        });
        activeCallsRef.current.set(call.peer, call);
      });

      voicePeer.on('error', (err) => {
        console.warn('[VoicePeer] Hata:', err);
        // ID çakışması veya bağlantı durumunda
        if (err.type === 'unavailable-id') {
          // Zaten açık olabilir
          setIsInVoice(true);
          setIsConnecting(false);
        }
      });

    } catch (err) {
      console.error('[VoiceChat] Mikrofon izni alınamadı:', err);
      setErrorMessage('Mikrofon erişimi reddedildi veya bulunamadı.');
      setIsConnecting(false);
      handleLeaveVoice();
    }
  };

  // Uzak kullanıcıyı arama
  const tryCallPeer = (targetVoiceId, localStream, name) => {
    if (!voicePeerRef.current || activeCallsRef.current.has(targetVoiceId)) return;

    try {
      const call = voicePeerRef.current.call(targetVoiceId, localStream);
      if (!call) return;

      call.on('stream', (remoteStream) => {
        attachRemoteAudio(targetVoiceId, remoteStream, name);
      });
      call.on('close', () => {
        removeRemoteAudio(targetVoiceId);
      });
      activeCallsRef.current.set(targetVoiceId, call);
    } catch (e) {
      // Karşı taraf henüz sesli sohbete katılmamış olabilir (beklenen durum)
    }
  };

  // Uzak ses akışını HTML5 Audio elementi ile çal
  const attachRemoteAudio = (peerId, remoteStream, name = 'Oyuncu') => {
    let audioEl = remoteAudiosRef.current.get(peerId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      remoteAudiosRef.current.set(peerId, audioEl);
    }
    audioEl.srcObject = remoteStream;
    audioEl.play().catch(() => {});

    setVoicePeers(prev => {
      const next = new Map(prev);
      next.set(peerId, { stream: remoteStream, name });
      return next;
    });
  };

  const removeRemoteAudio = (peerId) => {
    const audioEl = remoteAudiosRef.current.get(peerId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      remoteAudiosRef.current.delete(peerId);
    }
    activeCallsRef.current.delete(peerId);
    setVoicePeers(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  };

  // 3. Mikrofonu Sustur / Aç (Mute/Unmute)
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const nextMuted = !isMuted;
    isMutedRef.current = nextMuted;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
    if (nextMuted) setIsSpeaking(false);
  };

  // 4. Sesli Sohbetten Ayrıl
  const handleLeaveVoice = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (activeCallsRef.current) {
      activeCallsRef.current.forEach(call => call.close());
      activeCallsRef.current.clear();
    }
    if (remoteAudiosRef.current) {
      remoteAudiosRef.current.forEach(audioEl => {
        audioEl.pause();
        audioEl.srcObject = null;
      });
      remoteAudiosRef.current.clear();
    }
    if (voicePeerRef.current) {
      voicePeerRef.current.destroy();
      voicePeerRef.current = null;
    }
    isMutedRef.current = false;
    setIsInVoice(false);
    setIsConnecting(false);
    setIsMuted(false);
    setIsSpeaking(false);
    setVoicePeers(new Map());
  };

  // Temizlik
  useEffect(() => {
    return () => {
      handleLeaveVoice();
    };
  }, []);

  const totalParticipants = voicePeers.size + 1; // Uzaktakiler + Ben

  return (
    <div className={`w-full px-3 py-1.5 border-b flex items-center justify-between gap-2 text-xs transition-colors select-none ${
      isDarkMode ? 'bg-[#0b1329] border-slate-800' : 'bg-slate-100/90 border-slate-200'
    }`}>
      
      {!isInVoice ? (
        /* 1. Seste Değilken: İsteğe Bağlı Katıl Butonu */
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Radio className="w-3.5 h-3.5 text-slate-500" />
            <span>Sesli Sohbet (İsteğe Bağlı)</span>
          </div>

          <button
            onClick={handleJoinVoice}
            disabled={isConnecting}
            className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-black text-[10px] flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Mic className="w-3 h-3" />
            <span>{isConnecting ? 'Bağlanıyor...' : 'Sese Katıl'}</span>
          </button>
        </div>
      ) : (
        /* 2. Sesteyken: Canlı Kontrol Çubuğu */
        <div className="w-full flex items-center justify-between">
          {/* Durum & Konuşma İndikatörü */}
          <div className="flex items-center gap-2 min-w-0">
            <div className={`relative flex items-center justify-center w-6 h-6 rounded-full transition-all ${
              isSpeaking
                ? 'bg-emerald-500 text-white ring-4 ring-emerald-400/40 animate-pulse'
                : 'bg-slate-800 text-slate-400'
            }`}>
              <Volume2 className="w-3.5 h-3.5" />
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                SESTESİN ({totalParticipants} Kişi)
              </span>
              <span className="text-[9px] text-slate-400 truncate">
                {isMuted ? 'Mikrofonunuz kapalı' : isSpeaking ? 'Konuşuyorsunuz...' : 'Dinleniyor'}
              </span>
            </div>
          </div>

          {/* Kontrol Butonları */}
          <div className="flex items-center gap-1.5">
            {/* Sustur / Aç */}
            <button
              onClick={toggleMute}
              className={`px-2 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 transition cursor-pointer ${
                isMuted
                  ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}
            >
              {isMuted ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
              <span>{isMuted ? 'Sessiz' : 'Açık'}</span>
            </button>

            {/* Ayrıl */}
            <button
              onClick={handleLeaveVoice}
              className="p-1 rounded-lg bg-rose-950/50 border border-rose-600/50 hover:bg-rose-900/60 text-rose-300 transition cursor-pointer"
              title="Sesli Sohbetten Ayrıl"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Hata Uyarısı */}
      {errorMessage && (
        <span className="text-[9px] text-rose-400 font-bold ml-2">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
