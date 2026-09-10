<div align="center">

# 🏗️ MÜTEAHHİT ONLINE — ANKARA EDİSYONU
### *Gerçek Zamanlı 3D & Çok Oyunculu Web Emlak ve Kutu Oyunu*
### *Real-Time 3D Multiplayer Web Real Estate Board Game*

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r185-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Cannon-es](https://img.shields.io/badge/Cannon--es-Physics-E34F26?style=for-the-badge)](https://pmndrs.github.io/cannon-es/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)](./test/testOfficialRules.js)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)

<p align="center">
  <a href="#-t%C3%BCrk%C3%A7e-dok%C3%BCmantasyon"><b>🇹🇷 Türkçe Dokümantasyon</b></a> •
  <a href="#-english-documentation"><b>🇬🇧 English Documentation</b></a>
</p>

---

</div>

<br />

# 🇹🇷 TÜRKÇE DOKÜMANTASYON

## 📌 İçindekiler
1. [Proje Hakkında](#1-proje-hakk%C4%B1nda)
2. [Öne Çıkan Özellikler](#2-%C3%B6ne-%C3%A7%C4%B1kan-%C3%B6zellikler)
3. [Kullanılan Teknolojiler](#3-kullan%C4%B1lan-teknolojiler)
4. [Proje Mimarisi ve Dizin Yapısı](#4-proje-mimarisi-ve-dizin-yap%C4%B1s%C4%B1)
5. [Kurulum ve Çalıştırma](#5-kurulum-ve-%C3%A7al%C4%B1%C5%9Ft%C4%B1rma)
6. [Oyun Kuralları ve Stratejik Dinamikler](#6-oyun-kurallar%C4%B1-ve-stratejik-dinamikler)
7. [Klavye Kısayolları ve Kontroller](#7-klavye-k%C4%B1sayollar%C4%B1-ve-kontroller)
8. [Otomasyon ve Testler](#8-otomasyon-ve-testler)

---

### 1. Proje Hakkında
**Müteahhit Online**, Ankara'nın ikonik semtleri, tarihi mekanları ve kentsel dönüşüm atmosferi etrafında tasarlanmış, tarayıcı üzerinden çalışan **gerçek zamanlı (real-time) 3D & 2D hibrit çok oyunculu emlak geliştirme kutu oyunudur.**

Geleneksel emlak oyunlarının ötesine geçerek; **Cannon-es fizik motorlu 3D zarlar**, **Three.js tabanlı 3D GLTF piyon modelleri**, **gerçek Ankara mekan fotoğraflarıyla donatılmış 40 karelik mukavva harita**, **stratejik ipotek ve açık artırma mekanikleri**, **canlı açık artırma müzayedesi**, **yapay zeka bot stratejileri** ve **sıfır-harici-dosya Web Audio API prosedürel ses motoru** barındırır.

---

### 2. Öne Çıkan Özellikler

#### 🎲 Hibrit 3D / 2D Oyun Tahtası & Three.js Katmanı
- **Şeffaf Üst Katman (Alpha Overlay):** Responsive 2D karton oyun tahtasının üzerine oturan ve performanstan ödün vermeyen Three.js sahnesi. Buton ve menü tıklamalarını engellemeden piyonların hareketlerini 3D uzayda işler.
- **Yol Noktası İnterpolasyonu (Waypoint Hopping):** Piyonlar kareler arasında düz bir çizgide kaymaz; her karenin köşe açılarına uyarak gerçekçi zıplama ve yay çizme fizikleriyle ilerler.
- **Ankara Temalı 40 Kare:** Kızılay, Tunalı Hilmi, Çankaya, Ulus, Anıtkabir, Atakule, Hamamönü, ODTÜ gibi Ankara'nın kalbindeki 40 semt ve mekanın gerçek fotoğrafları ile hazırlanmış madalyonlu mukavva tasarımı.

#### 🎯 Gelişmiş 3D Zar Fiziği (Cannon-es + Continuous Spin Decay)
- **Sarsıntısız Çuha Fiziği:** Zarlar rastgele yön ve açılarla fırlatılır; Cannon-es temas çözücüsü ve çuha zemin sürtünmesi (`friction: 0.65`, `restitution: 0.20`) ile yuvarlanır.
- **Continuous Spin Decay:** Yapay yüz kilitlenmelerini (snap) önleyen türev sıfırlamalı dönüş sönümleme formülü:
  Zar hedeflenen sayıya doğru dönerken iniş anında açısal ivmesi sıfırlanır; zar yapay sıçramalar yapmadan pürüzsüz ve doğal bir şekilde durur.
- **Klavye Desteği:** İster ekrandaki 3D tablaya tıklayarak, ister `Space` (Boşluk) tuşuna basarak zar atılabilir.

#### 🚘 9 Adet Benzersiz 3D Piyon (GLTF / GLB Modelleri)
1. 👷 **Müteahhit Bareti (Hard Hat)**
2. 🚜 **İş Makinesi / Kepçe (Excavator)**
3. 🚙 **Şantiye SUV'si (SUV)**
4. 🚄 **Yüksek Hızlı Tren (Train)**
5. 🏎️ **Kırmızı Spor Araba (Sports Car)**
6. 👟 **Retro Basketbol Ayakkabısı (Sneaker)**
7. 🚢 **Savaş Gemisi (WW2 Destroyer)**
8. 🏛️ **Roma Sfenksi (Roman Sphinx)**
9. 🛵 **Retro Şehir Scooterı (City Scooter)**
- **Boyutsal Dengeleme (Scale Multipliers):** Uzun/ince modeller ile küresel modellerin hacimleri matematiksel olarak eşitlenmiştir; tahtada hiçbir piyon devasa veya görünmeyecek kadar küçük kalmaz.
- **İnteraktif Lobi İnceleme (Pawn3DViewer):** Seçilen piyon lobide 360 derece döndürülebilir ve incelenebilir.

#### 🏛️ Canlı Açık Artırma & Müzayede (Auction)
- **Sahipsiz Arsa İhaleleri:** İlk tam harita turunun ardından satın alınmayan arsalar otomatik olarak taban fiyattan açık artırmaya çıkarılır.
- **Oyuncu Tapu İhalesi:** Oyuncular kendi mülklerini (otelli olanlar dahil) 50₺ belediye harcı ödeyerek istedikleri başlangıç fiyatıyla ihaleye çıkarabilir.
- **Akıllı Erken Bitirme:** Teklif verildikten sonra masada daha yüksek teklif verecek paraya sahip kimse kalmadığında geri sayım beklemeden **3 saniyede ihaleyi sonuçlandırır.**

#### 🏦 Bankacılık, İpotek & Varlık Yönetimi
- **Resmi İpotek Mekanizması:** Nakit sıkışıklığında mülkler bankaya ipotek edilerek bedelinin %50'si anında kasaya aktarılır.
- **İpotek Kaldırma:** %10 resmi banka faizi ödenerek mülk üzerindeki ipotek serbest bırakılır ve tekrar kira toplamaya başlar.
- **Eşit İnşaat Kuralı:** Bir renk grubunda tekel kurulduğunda, tüm parsellere eşit olarak ev ve otel inşa edilir.
- **Otomatik Likidasyon:** Borç anında tek tıkla en uygun binaları ve tapuları likide eden acil durum ipotek motoru.

#### 📜 Standart Emlak & Strateji Kural Motoru
- **Eşit & Dengeli Ev İnşaatı:** Renk grubundaki tüm arsalara 1 ev dikilmeden hiçbirine 2. ev dikilemez. 4 evden sonra Otel inşa edilir.
- **Banka Ev & Otel Rezervleri:** Bankada azami 32 ev ve 12 otel stoku bulunur; binalar tükendiğinde bina kısıtı kuralı uygulanır.
- **Resmi İpotek:** Binalar bankaya %50 bedelle satılır, arsalar %50 bedelle ipotek edilir. İpotek kaldırılırken bankaya sadece standart %10 faiz ödenir.
- **Resmi Kodes (Maliye Denetimi):** Kodesteki oyuncu 3 tur çift zar deneyebilir veya 50₺ ödeyerek çıkabilir. Kodesteyken mülklerinden %100 tam kira tahsil eder.
- **Sabit GO Maaşı:** Başlangıç karesinden geçen veya buraya inen her oyuncu sabit 200₺ tahsil eder.
- **Hediye ve Faizli Borç Yasağı:** Standart kurallar gereği karşılıksız para transferi (bağış) ve gayriresmi borçlanma kesinlikle engellenmiştir.

#### 🤖 Stratejik Yapay Zeka (AI Botlar)
- **3 Zorluk Seviyesi:** Kolay, Orta ve Zor bot profilleri.
- **Üç Ev Stratejisi (Three-House Rush):** Matematiksel olarak en yüksek kira getiri oranına sahip 3 evi hızlıca dikme önceliği.
- **Taktiksel Kodes:** Oyunun ileri aşamalarında yüksek kiralardan kaçınmak için bilerek içeride bekleme stratejisi.
- **Otomatik Borç Tasfiyesi:** İflas durumunda ipotek ve ev satışı optimizasyonu.

#### 🔊 Sıfır Assetli Web Audio API Ses Motoru
- Dışarıdan MP3/WAV indirmeden, tarayıcının yerel osilatörleriyle sentezlenen gerçekçi ses efektleri:
  - Zarların çuhada çalkalanması ve çarpışması
  - Yazar kasa çıngırağı ve para sayma efekti
  - Piyon adım pıtırtıları
  - Kodes demir kapı çarpması
  - İflas sireni ve şampiyonluk zafer fanfarı

#### 🛡️ Ağ Mimarisi, Reconnect & Spoiler Önleme
- **F5 / Yenileme Koruması:** `sessionToken` sayesinde tarayıcı yenilendiğinde oyuncunun parası, tapuları ve konumu kaybolmadan odaya geri bağlanılır.
- **Spoiler Tamponlama (Spoiler Buffering):** Zar atıldığında gelen kira ve kart olayları, piyon 3D animasyonunu tamamlayıp kareye ayak basana kadar olay günlüğünde bekletilir; sürpriz bozulmaz.
- **AFK Tur Devri:** 75 saniye içinde hamle yapmayan oyuncuların sırası oyunu kilitlemeden otomatik devredilir.

---

### 3. Kullanılan Teknolojiler

| Alan | Teknoloji | Açıklama |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18** | Bileşen tabanlı modern arayüz mimarisi |
| **Build & Tooling** | **Vite 6** | Yıldırım hızında HMR ve optimize üretim paketi |
| **3D Rendering** | **Three.js (r185)** | 3D piyon modelleri, aydınlatma ve tahta overlay |
| **Fizik Motoru** | **Cannon-es** | Gerçekçi rijit gövde çarpışmaları ve 3D zar dinamiği |
| **Styling** | **Tailwind CSS 3.4** | Modern karanlık mod ve responsive cam efektleri |
| **Backend & API** | **Node.js + Express** | Olay güdümlü sunucu ve REST endpointleri |
| **Gerçek Zamanlı Ağ** | **Socket.io 4.8** | Çift yönlü, düşük gecikmeli WebSocket iletişimi |
| **Ses Sentezi** | **Web Audio API** | Donanım hızlandırmalı prosedürel ses motoru |
| **İkon Seti** | **Lucide React** | Temiz ve tutarlı vektörel arayüz ikonları |
| **Birim Testleri** | **Node Test Runner** | 34 senaryodan oluşan kural ve denge test paketi |

---

### 4. Proje Mimarisi ve Dizin Yapısı

```text
VECHIRON/
├── client/                     # İstemci Uygulaması (React + Vite)
│   ├── public/
│   │   ├── images/tiles/       # 40 karenin orijinal Ankara fotoğrafları
│   │   ├── models/pawns/       # 3D GLTF/GLB piyon modelleri
│   │   └── sounds/             # Ses rehber dokümanları
│   ├── src/
│   │   ├── components/         # React Arayüz Bileşenleri
│   │   │   ├── Board.jsx           # 40 karelik mukavva harita & UI kontrolleri
│   │   │   ├── Board3DOverlay.jsx  # Three.js 3D piyon overlay katmanı
│   │   │   ├── DiceSidebarTray.jsx # 3D Cannon-es fizik zar tablası
│   │   │   ├── Lobby.jsx           # Oda oluşturma, renk/piyon seçimi, bot ekleme
│   │   │   ├── PlayerPanel.jsx     # Oyuncu varlıkları, portföy & tapu listesi
│   │   │   ├── TitleDeedCards.jsx  # Tapu senetleri ve portföy yönetim ekranı
│   │   │   ├── TradeModal.jsx      # Çoklu varlık interaktif takas ekranı
│   │   │   ├── DevToolsModal.jsx   # Süpervizör / hata ayıklama konsolu
│   │   │   └── ...
│   │   ├── sound/              # Web Audio API prosedürel ses sentezleyicisi
│   │   ├── three/              # Three.js & Cannon-es fizik motor kodları
│   │   │   ├── Dice3DTrayManager.js # 3D zar simülasyonu ve dönüş sönümlemesi
│   │   │   ├── Board3DManager.js    # 3D piyon yerleşimi ve zıplama animasyonu
│   │   │   └── proceduralTokens.js  # GLTF yükleyici ve boyut dengeleyici
│   │   └── App.jsx             # Ana oyun konteyneri & PeerJS P2P yöneticisi
│   ├── sound/                  # Ses efektleri kütüphanesi
│   ├── server/                 # Opsiyonel sunucu & P2P sinyalleşme katmanı
│   └── test/                   # Resmi emlak oyunu kural ve mekanik testleri
```

---

### 5. Kurulum ve Çalıştırma

#### Adım 1: Depoyu Klonlayın
```bash
git clone https://github.com/canerztk8/TEKELoNline.git
cd TEKELoNline
```

#### Adım 2: Bağımlılıkları Yükleyin
```bash
npm install
```

#### Adım 3: Geliştirme Modunda Başlatın
**Terminal 1 (Sunucu):**
```bash
npm run dev:server
# Sunucu http://localhost:3000 adresinde dinlemede
```

**Terminal 2 (İstemci):**
```bash
npm run dev:client
# Vite http://localhost:5173 adresinde çalışır ve 3000 portuna proxy yapar
```

#### Adım 4: Üretim (Production) Derlemesi
İstemciyi derleyip tek bir Express sunucusu üzerinden çalıştırmak için:
```bash
# İstemciyi optimize edip derleyin:
npm run build

# Tek komutla sunucuyu başlatın (dist klasörünü otomatik sunar):
npm start
# Uygulama http://localhost:3000 adresinde yayındadır!
```

---

### 6. Oyun Kuralları ve Stratejik Dinamikler

1. **Başlangıç Sermayesi:** Her oyuncu oyuna 1500₺ ile başlar.
2. **Arsa Edinimi:** Sahipsiz bir kareye gelen oyuncu arsayı liste fiyatından alabilir veya ihaleye bırakabilir (ihaleye herkes katılabilir).
3. **Grup Tekeli ve İnşaat:** Bir renk grubundaki tüm arsaları toplayan oyuncu grup hakimiyeti kurar; binalar **eşit ve dengeli inşa kuralına** göre dikilir (bir arsaya 2. ev dikilmeden önce diğerlerine 1. ev dikilmelidir). 4 evden sonra Otel inşa edilebilir.
4. **İpotek:** Nakit sıkıntısında binalar %50 bedelle geri satılır, arsalar ipotek edilerek bedelinin %50'si nakit alınır. İpotek kaldırılırken yalnızca resmi %10 faiz ödenir.
5. **Kodes (Maliye Denetimi):** Kodesteki oyuncu 3 tur boyunca çift zar atarak çıkmayı deneyebilir veya 50₺ ödeyerek hemen tahliye olabilir. Kodesteyken tapularından tam (%100) kira toplamaya devam eder.
6. **Başlangıç Karesi (GO):** Harita turlarında Başlangıç karesinden geçen veya buraya inen her oyuncu sabit 200₺ maaş tahsil eder.
7. **Bağış ve Borçlanma Yasağı:** Standart kurallar gereği karşılıksız para transferi (hediye/bağış) veya serbest borçlanma yapılamaz.

---

### 7. Klavye Kısayolları ve Kontroller

| Tuş / Kontrol | Eylem |
| :--- | :--- |
| `Space` (Boşluk) | Zarları fırlat / salla |
| `Sol Tık (Zar Tablası)` | 3D tablaya tıklayarak zarı elden at |
| `Sol Tık (Kare Üzerine)` | Arsa detaylarını, tapu senedini ve kira tarifesini incele |
| `F12 / DevTools Modalı` | Test amaçlı piyon ışınlama ve bakiye manipülasyonu (Kurucu) |

---

### 8. Otomasyon ve Testler

Oyun kuralları, eşit bina inşası, açık artırma mekanikleri, AFK süre aşımı devirleri ve kodes dinamikleri `test/testOfficialRules.js` dosyasında tanımlanan resmi kural testleri ile otomatik olarak denetlenir:

```bash
node test/testOfficialRules.js
```

**Çıktı:**
```text
=== MÜTEAHHİT KURAL & DENGE & YENİ ÖZELLİK TESTLERİ BAŞLIYOR ===
1. Başlangıç bakiyesi kontrolü (1500₺) [✓]
...
32. AFK WAITING_ROLL Süre Aşımında Sıranın Doğrudan Sonraki Oyuncuya Geçmesi Testi [✓]
33. Süre Aşımı (AFK) İhalesi Tamamlandığında Sıranın Otomatik Devredilmesi Testi [✓]
34. CARD_DRAWN Aşamasında Süre Aşımında Sıranın Temiz Devri Testi [✓]
=== TÜM TESTLER BAŞARIYLA GEÇTİ ===
```

---

<br />

# 🇬🇧 ENGLISH DOCUMENTATION

## 📌 Table of Contents
1. [About The Project](#1-about-the-project)
2. [Key Features](#2-key-features)
3. [Technology Stack](#3-technology-stack)
4. [Architecture & Directory Structure](#4-architecture--directory-structure)
5. [Installation & Setup](#5-installation--setup)
6. [Game Rules & Strategic Mechanics](#6-game-rules--strategic-mechanics)
7. [Controls & Shortcuts](#7-controls--shortcuts)
8. [Automated Test Suite](#8-automated-test-suite)

---

### 1. About The Project
**Müteahhit Online** (Contractor Online) is a real-time, browser-based **3D/2D hybrid multiplayer real estate board game** themed around Ankara's iconic districts, urban renewal, and architectural landmarks.

Far beyond a traditional board game clone, it features a **Cannon-es physics-simulated 3D dice rolling tray**, **9 authentic 3D GLTF token models**, an authentic **40-tile Ankara cardboard layout with real landmark medallions**, a **standard real estate and strategy rule engine**, **live synchronized real-time auctions**, **strategic AI bots**, and a **zero-asset procedural Web Audio API sound synthesizer**.

---

### 2. Key Features

#### 🎲 Hybrid 3D / 2D Board & Three.js Overlay
- **Transparent Alpha Canvas:** High-performance Three.js overlay situated directly above the responsive 2D board. It renders 3D tokens and movement arcs without intercepting UI clicks on buttons or cards.
- **Waypoint Arc Hopping:** Tokens calculate path waypoints around corners with realistic jump physics, bank tilts, and smooth landing interpolations.
- **Ankara Edition Board:** 40 custom tiles featuring real historical and urban photographs of Ankara (Kızılay, Tunalı Hilmi, Çankaya, Ulus, Anıtkabir, Atakule, Hamamönü, METU, etc.).

#### 🎯 Physics 3D Dice (Cannon-es + Continuous Spin Decay)
- **Zero-Jitter Baize Physics:** The dice are thrown with randomized velocities into a baize-felt tray with calibrated friction (`0.65`) and restitution (`0.20`).
- **Continuous Spin Decay Algorithm:** Eliminates unnatural orientation snapping at landing:
  The tumbling rotation smoothly attenuates such that both angular velocity and acceleration reach zero right at rest, landing cleanly on the target face.
- **Input Flexibility:** Roll using on-screen tray clicks or the `Spacebar` keyboard shortcut.

#### 🚘 9 Authentic 3D Tokens (GLTF / GLB)
1. 👷 **Contractor Hard Hat**
2. 🚜 **Construction Excavator**
3. 🚙 **Site SUV**
4. 🚄 **High-Speed Bullet Train**
5. 🏎️ **Red Sports Car**
6. 👟 **Retro Basketball Sneaker**
7. 🚢 **WW2 Destroyer Warship**
8. 🏛️ **Roman Sphinx**
9. 🛵 **Retro City Scooter**
- **Volumetric Scale Normalization:** Procedural scale matrix ensures long/slender models and compact spherical models occupy harmonized visual footprints.
- **Interactive 3D Lobby Preview (`Pawn3DViewer`):** Inspect and rotate your chosen 3D token in 360 degrees before entering the match.

#### 🏛️ Live Real-Time Auction System
- **Unowned Property Auctions:** Any unbought property declined by a player is placed on immediate auction for all players.
- **Player-Initiated Deeds:** Players can auction their own properties (even with hotels) at a custom starting bid for a 50₺ municipal deed fee.
- **Smart 3-Second Fast-Forward:** If the highest bidder cannot be outbid by any other player on the board, the countdown jumps immediately to **3 seconds** to eliminate unnecessary downtime.

#### 📜 Standard Real Estate & Strategy Rule Engine
- **Even Building Rule:** Houses must be built evenly across unimproved color monopolies before adding a 2nd house. 4 houses upgrade to a Hotel.
- **Bank Building Scarcity:** Bank maintains a strict reserve of 32 houses and 12 hotels.
- **Official Mortgages:** Properties mortgage for 50% face value; lifting mortgages costs principal + official 10% interest.
- **Official Incarceration:** Incarcerated players may roll doubles for 3 turns or pay 50₺ fine. Players continue to collect 100% full rent while in jail.
- **Fixed GO Salary:** Passing or landing on GO always awards a fixed 200₺ salary.
- **No Cash Gifts or P2P Loans:** Unilateral money transfers and loans are forbidden under standard rules.

#### 🤖 Strategic AI Bots
- **3 Difficulty Tiers:** Easy, Medium, and Hard strategic profiles.
- **Three-House Rush:** AI targets the optimal rental yield curve (3 houses per lot).
- **Tactical Jail Stalling:** Late-game bots strategically remain in jail to evade hazardous high-rent zones.
- **Auto Debt Liquidation:** Optimal mortgage and house deconstruction algorithms to prevent bankruptcy.

#### 🔊 Zero-Asset Procedural Web Audio API Sound Engine
- Zero external MP3/WAV assets; pure synthetic audio created via browser oscillators:
  - Rolling & shaking dice clicks
  - Cash register and paper bill counting
  - Rhythmic pawn footstep clicks
  - Heavy iron jail cell slamming
  - Bankruptcy warning buzzer and victory orchestral fanfare

#### 🛡️ Resilient Networking & Reconnect Support
- **F5 / Refresh Resilience:** Reconnect using `sessionToken` with preserved money, deeds, and board position.
- **Spoiler-Free Event Log:** Card draws and rent deductions are buffered client-side until the pawn completes its 3D traversal.
- **AFK Fail-Safe:** 75-second watchdog safely hands the turn to the next player without locking the table.

---

### 3. Technology Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18** | Modern reactive component architecture |
| **Build Tooling** | **Vite 6** | Ultra-fast HMR and optimized production bundles |
| **3D Rendering** | **Three.js (r185)** | 3D models, scene lighting, and transparent board overlay |
| **Physics Simulation** | **Cannon-es** | Rigid-body contact solver and 3D dice kinematics |
| **Styling** | **Tailwind CSS 3.4** | Modern dark theme, glassmorphism, and responsive design |
| **Backend Runtime** | **Node.js + Express** | Event-driven server and static file hosting |
| **Real-Time Network** | **Socket.io 4.8** | Low-latency bi-directional WebSocket channels |
| **Audio Engine** | **Web Audio API** | Zero-latency procedural sound synthesis |
| **Icons** | **Lucide React** | Clean, accessible vector UI icons |
| **Test Suite** | **Node Test Runner** | 34 comprehensive rule and balance assertion tests |

---

### 4. Architecture & Directory Structure

```text
VECHIRON/
├── client/                     # Frontend Application (React + Vite)
│   ├── public/
│   │   ├── images/tiles/       # 40 authentic Ankara landmark photos
│   │   ├── models/pawns/       # 3D GLTF/GLB token assets
│   │   └── sounds/             # Sound engine guides
│   ├── src/
│   │   ├── components/         # UI Components
│   │   │   ├── Board.jsx           # Main board layout & UI controls
│   │   │   ├── Board3DOverlay.jsx  # Three.js 3D pawn overlay layer
│   │   │   ├── DiceSidebarTray.jsx # 3D Cannon-es physics dice tray
│   │   │   ├── Lobby.jsx           # Lobby, custom avatars, bot configuration
│   │   │   ├── PlayerPanel.jsx     # Net worth, portfolio, deeds
│   │   │   ├── TitleDeedCards.jsx  # Deeds & portfolio manager
│   │   │   ├── TradeModal.jsx      # Multi-asset interactive trading
│   │   │   ├── DevToolsModal.jsx   # Supervisor / developer console
│   │   │   └── ...
│   │   ├── sound/              # Web Audio API sound synthesizer
│   │   ├── three/              # Three.js & Cannon-es core managers
│   │   │   ├── Dice3DTrayManager.js # 3D dice physics & decay solver
│   │   │   ├── Board3DManager.js    # 3D token placement & hopping math
│   │   │   └── proceduralTokens.js  # GLTF loader & volumetric normalizer
│   │   └── App.jsx             # Root container & PeerJS P2P coordinator
│   └── vite.config.js          # Vite config & WebSocket dev proxy
├── server/                     # Backend Application (Node.js + Socket.io)
│   ├── game/
│   │   ├── MonopolyGame.js     # Authoritative deterministic game state machine
│   │   ├── BotAI.js            # Strategic AI heuristics & debt resolution
│   │   ├── RoomManager.js      # Multiplayer room routing & session tracking
│   │   └── boardData.js        # Ankara tiles, rent matrices, color decks
│   └── index.js                # Express entrypoint & Socket.io router
├── test/
│   └── testGameRules.js        # 34 game rules & edge case unit tests
├── package.json                # Project manifest & build scripts
└── README.md                   # Project documentation
```

---

### 5. Installation & Setup

#### Prerequisites
- **Node.js:** v18.0.0 or higher ([Download](https://nodejs.org/))
- **npm:** v9.0.0 or higher

#### Step 1: Clone the Repository
```bash
git clone https://github.com/canerztk8/TEKELoNline.git
cd TEKELoNline
```

#### Step 2: Install Dependencies
```bash
npm install
```

#### Step 3: Run in Development Mode
Run server and client concurrently across two terminals:

**Terminal 1 (Backend):**
```bash
npm run dev:server
# Server listens at http://localhost:3000
```

**Terminal 2 (Frontend):**
```bash
npm run dev:client
# Vite runs at http://localhost:5173 with proxy to 3000
```

#### Step 4: Build for Production
To build the client and serve everything from a single Express instance:
```bash
# Build optimized static bundle:
npm run build

# Start production server:
npm start
# Game is live at http://localhost:3000
```

---

### 6. Game Rules & Strategic Mechanics

1. **Initial Liquidity:** Every player starts with 1,500₺.
2. **Title Deeds:** Landing on unowned property allows immediate acquisition or declines it to an open auction for all players.
3. **Color Group Monopolies & Construction:** Collecting all properties in a color set unlocks construction. Houses must be built evenly across the set before adding a second house. 4 houses upgrade to a Hotel.
4. **Mortgages:** Unimproved lots can be mortgaged to the bank for 50% value. Lifting mortgages incurs the official 10% bank interest premium.
5. **Jail (Incarceration):** Incarcerated players may attempt to roll doubles for up to 3 turns or pay a 50₺ bail fee for immediate release. Incarcerated players continue to collect 100% full rent.
6. **Pass GO:** Passing or landing on the GO square always awards a fixed 200₺ salary.
7. **No Unbacked Transfers:** Unilateral cash gifts and P2P lending are strictly disallowed under standard rules.

---

### 7. Controls & Shortcuts

| Key / Control | Action |
| :--- | :--- |
| `Spacebar` | Shake and roll 3D dice |
| `Left Click (Dice Tray)` | Manual physical throw into the tray |
| `Left Click (Board Tile)` | Inspect title deed, mortgage terms, and rent matrix |
| `DevTools (Host)` | Inspect live room state, teleport tokens, or debug balances |

---

### 8. Automated Test Suite

Deterministic game mechanics, even building construction, auction resolution, AFK turn handoffs, and official rules are verified with automated unit tests:

```bash
node test/testOfficialRules.js
```

**Output:**
```text
=== MÜTEAHHİT KURAL & DENGE & YENİ ÖZELLİK TESTLERİ BAŞLIYOR ===
1. Initial balance check (1500₺) [✓]
...
32. AFK WAITING_ROLL Timeout Turn Advancement Test [✓]
33. AFK Auction Completion Turn Advancement Test [✓]
34. CARD_DRAWN Timeout Card Clearance Test [✓]
=== TÜM TESTLER BAŞARIYLA GEÇTİ ===
```

---

<br />

<div align="center">

## 📜 Lisans & Telif / License & Credits

Bu proje [MIT Lisansı](./LICENSE) kapsamında açık kaynak olarak geliştirilmiştir.  
Developed as an open-source project under the [MIT License](./LICENSE).

*Ankara'nın ruhuyla tasarlandı • Designed with the spirit of Ankara.*

</div>
