import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createPlayerToken, getPawnModelUrl, isPawnModelCached, loadGLTFModel, onPawnModelPreloaded } from '../three/proceduralTokens.js';
import { PLAYER_TOKENS } from '../game/boardData.js';
import { Sparkles, RotateCw } from 'lucide-react';

/**
 * Pawn3DViewer
 * Lobide seçilen piyonun 3D modelini dönen stüdyo ışıklandırmalı kaidede gösterir.
 * Kullanıcı fare/dokunma ile modeli 360 derece döndürebilir.
 */
export function Pawn3DViewer({
  tokenId = 'hard_hat',
  color = '#ef4444',
  tokenName = 'Piyon',
  className = ''
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const tokenGroupRef = useRef(null);
  const animFrameRef = useRef(null);
  const currentTokenRootRef = useRef(null);
  const activeRequestIdRef = useRef(0);

  // Etkileşimli döndürme state'i
  const isDraggingRef = useRef(false);
  const prevMouseXRef = useRef(0);
  const rotVelocityRef = useRef(0.015);
  const autoRotateRef = useRef(true);
  const dragTimeoutRef = useRef(null);
  const currentScaleRef = useRef(1.0);
  const targetScaleRef = useRef(1.0);

  const [isLoading, setIsLoading] = useState(false);

  // 1. Sahne Başlatma (Mount)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 280;
    const height = container.clientHeight || 200;

    // Sahne
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Kamera: Piyonun ön-üst çaprazına konumlandırılmış perspektif
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 1.25, 2.3);
    camera.lookAt(0, 0.38, 0);
    cameraRef.current = camera;

    // Renderer (Şeffaf WebGL)
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.cursor = 'grab';
    container.appendChild(canvas);
    rendererRef.current = renderer;

    // Işıklandırma (Stüdyo Işık Seti)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    // Ana Işık (Key Light)
    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    dirLight.position.set(3, 5, 3.5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Dolgu Işığı (Fill Light)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    fillLight.position.set(-3, 3, 2);
    scene.add(fillLight);

    // Arka Siluet Işığı (Rim Light)
    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.0);
    rimLight.position.set(0, 4, -4);
    scene.add(rimLight);

    // Kaide Altı Yumuşak Gölge Düzlemi
    const shadowGeo = new THREE.PlaneGeometry(3, 3);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.005;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Dönen piyon grubu
    const tokenGroup = new THREE.Group();
    scene.add(tokenGroup);
    tokenGroupRef.current = tokenGroup;

    // Boyutlandırma Gözlemcisi
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Etkileşimli Döndürme Dinleyicileri (Drag & Swipe)
    const onPointerDown = (e) => {
      isDraggingRef.current = true;
      autoRotateRef.current = false;
      prevMouseXRef.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (e) => {
      if (!isDraggingRef.current || !tokenGroupRef.current) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const deltaX = clientX - prevMouseXRef.current;
      prevMouseXRef.current = clientX;

      // Kullanıcının sürükleme hızına göre grubu döndür
      tokenGroupRef.current.rotation.y += deltaX * 0.012;
      rotVelocityRef.current = deltaX * 0.004;
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = 'grab';
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
      // 1.2 saniye sonra yumuşakça otomatik dönüşe geri dön
      dragTimeoutRef.current = setTimeout(() => {
        if (!isDraggingRef.current) {
          autoRotateRef.current = true;
        }
        dragTimeoutRef.current = null;
      }, 1200);
    };

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Render Döngüsü
    const renderLoop = () => {
      animFrameRef.current = requestAnimationFrame(renderLoop);

      if (tokenGroupRef.current) {
        if (autoRotateRef.current && !isDraggingRef.current) {
          // Otomatik pürüzsüz dönüş
          rotVelocityRef.current = THREE.MathUtils.lerp(rotVelocityRef.current, 0.014, 0.04);
          tokenGroupRef.current.rotation.y += rotVelocityRef.current;
        } else if (!isDraggingRef.current) {
          // Atalet sönümlemesi
          rotVelocityRef.current *= 0.94;
          tokenGroupRef.current.rotation.y += rotVelocityRef.current;
        }

        // Pürüzsüz mikro-pop geçiş animasyonu (0.84 -> 1.0)
        if (currentScaleRef.current < targetScaleRef.current) {
          currentScaleRef.current = THREE.MathUtils.lerp(currentScaleRef.current, targetScaleRef.current, 0.18);
          if (Math.abs(currentScaleRef.current - targetScaleRef.current) < 0.003) {
            currentScaleRef.current = targetScaleRef.current;
          }
          tokenGroupRef.current.scale.setScalar(currentScaleRef.current);
        }
      }

      renderer.render(scene, camera);
    };
    renderLoop();

    // 🚀 Arka planda WebGL GPU Isıtma (Background GPU Pre-warming)
    const prewarmToken = async (id, targetUrl) => {
      try {
        if (!renderer || !camera || !scene) return;
        const dummyToken = createPlayerToken(id, '#fbbf24', targetUrl, { showPedestal: true });
        if (typeof renderer.compileAsync === 'function') {
          await renderer.compileAsync(dummyToken, camera, scene);
        } else if (typeof renderer.compile === 'function') {
          renderer.compile(dummyToken, camera, scene);
        }
      } catch (e) {}
    };

    // Zaten inmiş modelleri hemen GPU'ya ısıt
    PLAYER_TOKENS.forEach((t) => {
      if (isPawnModelCached(t.id)) {
        prewarmToken(t.id, getPawnModelUrl(t.id));
      }
    });

    // İndikçe yeni modelleri arka planda WebGL VRAM'ine derle
    const unsubscribePreload = onPawnModelPreloaded((id, url) => {
      prewarmToken(id, url);
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
      unsubscribePreload();
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      if (sceneRef.current) {
        disposeHierarchy(sceneRef.current);
        sceneRef.current.clear();
      }
      renderer.dispose();
    };
  }, []);

function disposeHierarchy(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        // YALNIZCA bu örneğe özel klonlanmış materyalleri imha et.
        // Paylaşılan GLTF modelinin orijinal dokularını (textures) ve materyallerini ASLA yok etme!
        if (m && m.__isCloned) {
          m.dispose();
        }
      });
    }
  });
}

  // 2. Token & Renk Değişimi (Sıfır Donma, GPU Asenkron Derleme)
  useEffect(() => {
    if (!tokenGroupRef.current) return;

    const requestId = ++activeRequestIdRef.current;
    const modelUrl = getPawnModelUrl(tokenId);
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const isCached = isPawnModelCached(tokenId);

    // İlk açılışta sahnede henüz hiçbir şey yoksa kaideyi yerleştir
    if (!currentTokenRootRef.current) {
      const initialRoot = createPlayerToken(tokenId, color, modelUrl, { showPedestal: true });
      tokenGroupRef.current.add(initialRoot);
      currentTokenRootRef.current = initialRoot;
    }

    if (!isCached) {
      setIsLoading(true);
    }

    const loadAndPrewarm = async () => {
      try {
        if (modelUrl && !isCached) {
          await loadGLTFModel(modelUrl);
        }
        if (activeRequestIdRef.current !== requestId) return;

        const newTokenRoot = createPlayerToken(tokenId, color, modelUrl, { showPedestal: true });

        // 🚀 GPU Pre-warming: Three.js compileAsync ile shader'ları ve dokuları arka planda derle
        // Bu işlem ana UI thread'ini dondurmadan WebGL KHR_parallel_shader_compile ile çalışır.
        if (renderer && camera && scene) {
          if (typeof renderer.compileAsync === 'function') {
            await renderer.compileAsync(newTokenRoot, camera, scene);
          } else if (typeof renderer.compile === 'function') {
            renderer.compile(newTokenRoot, camera, scene);
          }
        }

        if (activeRequestIdRef.current !== requestId) return;

        // Model ve shader'lar GPU'da %100 hazır: Kesintisiz 60 FPS geçiş yap
        if (currentTokenRootRef.current) {
          tokenGroupRef.current.remove(currentTokenRootRef.current);
          disposeHierarchy(currentTokenRootRef.current);
        }
        tokenGroupRef.current.add(newTokenRoot);
        currentTokenRootRef.current = newTokenRoot;

        // 🎬 Pürüzsüz mikro-pop geçiş animasyonunu başlat (0.84 -> 1.0)
        currentScaleRef.current = 0.84;
        targetScaleRef.current = 1.0;
        tokenGroupRef.current.scale.setScalar(0.84);

        setIsLoading(false);
      } catch (err) {
        console.warn('[Pawn3DViewer] Model hazırlanamadı:', err);
        if (activeRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    };

    loadAndPrewarm();

    return () => {
      if (currentTokenRootRef.current) {
        disposeHierarchy(currentTokenRootRef.current);
      }
    };
  }, [tokenId, color]);

  return (
    <div className={`relative rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 overflow-hidden shadow-xl ${className}`}>
      {/* Arka Plan Ortam Işıltısı (Seçilen Oyuncu Renginde Glow) */}
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none transition-all duration-700"
        style={{ backgroundColor: color }}
      />

      {/* Üst Rozet: 3D Önizleme Başlığı */}
      <div className="absolute top-2.5 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/70 shadow-sm">
          <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
          <span className="text-[10px] font-space font-bold uppercase tracking-wider text-slate-200">
            3D Piyon Stüdyosu
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/70 text-[9.5px] font-jetbrains text-slate-400">
          <RotateCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
          <span className="hidden sm:inline">360° Çevir</span>
        </div>
      </div>

      {/* 3D WebGL Canvas Konteynırı */}
      <div
        ref={mountRef}
        className="w-full h-full min-h-[170px] sm:min-h-[190px] select-none"
        title="Döndürmek için farenizle tutup sürükleyin"
      />

      {/* Yükleme Rozeti (Model indirilirken veya işlenirken şık gösterge) */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] pointer-events-none transition-all duration-300">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-amber-500/50 shadow-2xl text-amber-300 text-xs font-semibold animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>3D Model Hazırlanıyor...</span>
          </div>
        </div>
      )}

      {/* Alt Bilgi Rozeti: Seçilen Piyon İsmi ve Rengi */}
      <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/80 shadow-md">
          <div
            className="w-3 h-3 rounded-full border border-white/80 shadow-xs"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-space font-black text-white tracking-wide">
            {tokenName}
          </span>
        </div>

        <span className="text-[9px] font-jetbrains text-slate-400 italic bg-slate-950/70 px-2 py-0.5 rounded-lg">
          Döndürmek için sürükleyin
        </span>
      </div>
    </div>
  );
}
