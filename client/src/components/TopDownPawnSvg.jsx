import React from 'react';

/**
 * TopDownPawnSvg
 * ==============================================================================
 * 2D Masaüstü Piyonları için Otantik Kuşbakışı (Bird's-Eye View) Vektör Çizimleri.
 * Düz ve kalitesiz yüz emojileri (👷, 🏎️ vb.) yerine, tahta oyununda masaya
 * yukarıdan bakıldığında piyonun nasıl görüneceğini gerçekçi, detaylı ve
 * sistem/GPU yükü oluşturmayan %100 saf SVG ile çizer.
 */
export function TopDownPawnSvg({ tokenId, className = 'w-14 h-14', color }) {
  switch (tokenId) {
    // --------------------------------------------------------------------------
    // 1. SARI BARET (hard_hat) - Kuşbakışı Güvenlik Bareti
    // --------------------------------------------------------------------------
    case 'hard_hat':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="hh-dome" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>
            <linearGradient id="hh-brim" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#854d0e" />
            </linearGradient>
            <linearGradient id="hh-ridge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#713f12" />
            </linearGradient>
          </defs>

          {/* Dış Siperlik / Brim (Geniş oval taban ve öne uzanan güneşlik) */}
          <path
            d="M 18,22 C 18,10 24,7 32,7 C 40,7 46,10 46,22 C 50,30 50,44 45,52 C 40,58 24,58 19,52 C 14,44 14,30 18,22 Z"
            fill="url(#hh-brim)"
            stroke="#713f12"
            strokeWidth="1.2"
          />

          {/* Siperlik İç Çevre Kanalı / Rain Gutter Groove */}
          <ellipse
            cx="32"
            cy="33"
            rx="16.5"
            ry="20.5"
            fill="none"
            stroke="#713f12"
            strokeWidth="1"
            opacity="0.4"
          />

          {/* Ana Kubbe (Dome) */}
          <ellipse
            cx="32"
            cy="34"
            rx="14.5"
            ry="18.5"
            fill="url(#hh-dome)"
            stroke="#854d0e"
            strokeWidth="1.2"
          />

          {/* Merkez Güçlendirme Omurgası (Crown Ridge - Baretlerin üstündeki ikonik kaburga) */}
          <path
            d="M 30.5,15 C 30.5,15 30,34 30,51 L 34,51 C 34,34 33.5,15 33.5,15 Z"
            fill="url(#hh-ridge)"
          />
          <line x1="32" y1="16" x2="32" y2="50" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />

          {/* Yan Havalandırma / Takviye Kaburgaları */}
          <path
            d="M 23,26 C 21,32 21,38 23,42"
            fill="none"
            stroke="#854d0e"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M 41,26 C 43,32 43,38 41,42"
            fill="none"
            stroke="#854d0e"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Ön Tepe Işıltısı / Specular Highlight */}
          <ellipse
            cx="26"
            cy="24"
            rx="3.5"
            ry="7"
            transform="rotate(-25 26 24)"
            fill="#ffffff"
            opacity="0.45"
          />

          {/* Ön Siperlik Ucu Vurgusu */}
          <path
            d="M 27,9 C 30,8 34,8 37,9"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      );

    // --------------------------------------------------------------------------
    // 2. KIRMIZI SPOR ARABA (sports_car) - Kuşbakışı Yarış Otomobili
    // --------------------------------------------------------------------------
    case 'sports_car':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="car-body" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="35%" stopColor="#ef4444" />
              <stop offset="65%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
            <linearGradient id="car-glass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>

          {/* 4 Tekerlek (Geniş Yarış Lastikleri) */}
          <rect x="15" y="14" width="5.5" height="10" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
          <rect x="43.5" y="14" width="5.5" height="10" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
          <rect x="14" y="39" width="6.5" height="12" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
          <rect x="43.5" y="39" width="6.5" height="12" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />

          {/* Gövde Silüeti (Aerodinamik burun, dar bel, geniş arka çamurluklar) */}
          <path
            d="M 32,8 C 27,8 24,10 22,14 C 20,18 20,24 23,26 C 24,28 23,35 21,37 C 19,39 18,43 20,50 C 22,54 26,55 32,55 C 38,55 42,54 44,50 C 46,43 45,39 43,37 C 41,35 40,28 41,26 C 44,24 44,18 42,14 C 40,10 37,8 32,8 Z"
            fill="url(#car-body)"
            stroke="#7f1d1d"
            strokeWidth="1.2"
          />

          {/* Ön Kaput Hava Çıkışları / Vents */}
          <path d="M 28,15 L 30,19 L 27,19 Z" fill="#450a0a" />
          <path d="M 36,15 L 34,19 L 37,19 Z" fill="#450a0a" />

          {/* Ön Cam (Windshield) */}
          <path
            d="M 24,22 C 28,19 36,19 40,22 L 38,30 C 34,29 30,29 26,30 Z"
            fill="url(#car-glass)"
            stroke="#1e293b"
            strokeWidth="0.8"
          />
          {/* Cam Üstü Işık Yansıması */}
          <line x1="28" y1="21" x2="31" y2="28" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />

          {/* Tavan Paneli (Cockpit Roof) */}
          <path d="M 26,30 L 38,30 L 37,38 L 27,38 Z" fill="#991b1b" />

          {/* Arka Cam & Motor Kapağı Panjurları */}
          <path d="M 27,39 L 37,39 L 36,46 L 28,46 Z" fill="#0f172a" />
          <line x1="29" y1="41" x2="35" y2="41" stroke="#334155" strokeWidth="0.8" />
          <line x1="29" y1="44" x2="35" y2="44" stroke="#334155" strokeWidth="0.8" />

          {/* Arka GT Rüzgarlığı / Spoiler */}
          <rect x="16" y="50" width="32" height="3" rx="1" fill="#0f172a" stroke="#475569" strokeWidth="0.8" />
          <rect x="25" y="47" width="2" height="4" fill="#0f172a" />
          <rect x="37" y="47" width="2" height="4" fill="#0f172a" />

          {/* Farlar (LED Çizgileri) */}
          <path d="M 23,10 L 26,13" stroke="#fef08a" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 41,10 L 38,13" stroke="#fef08a" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    // --------------------------------------------------------------------------
    // 3. RETRO BASKETBOL AYAKKABISI (sneaker) - Kuşbakışı Spor Ayakkabı
    // --------------------------------------------------------------------------
    case 'sneaker':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="snk-sole" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="50%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <linearGradient id="snk-upper" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>

          {/* Taban Dış Hattı (Geniş kauçuk taban perimetresi) */}
          <path
            d="M 31,8 C 22,8 18,15 18,24 C 18,34 21,38 22,46 C 23,54 28,57 33,57 C 38,57 43,54 44,46 C 45,38 46,31 46,24 C 46,15 40,8 31,8 Z"
            fill="url(#snk-sole)"
            stroke="#94a3b8"
            strokeWidth="1.4"
          />

          {/* Saya / Üst Deri Kaplama */}
          <path
            d="M 31,10 C 24,10 20,16 20,24 C 20,33 23,37 24,45 C 25,52 28,55 33,55 C 37,55 41,52 42,45 C 43,37 44,30 44,24 C 44,16 38,10 31,10 Z"
            fill="url(#snk-upper)"
          />

          {/* Burun Koruma (Toe Box & Perforasyonlar) */}
          <path
            d="M 23,17 C 26,12 36,12 39,17 C 37,21 25,21 23,17 Z"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="0.8"
          />
          {/* Burun Delikleri (Hava Perforasyonları) */}
          <circle cx="28" cy="16" r="0.7" fill="#64748b" />
          <circle cx="31" cy="15" r="0.7" fill="#64748b" />
          <circle cx="34" cy="16" r="0.7" fill="#64748b" />
          <circle cx="31" cy="18" r="0.7" fill="#64748b" />

          {/* Dil & Bağcık Bölgesi (Lacing Throat) */}
          <path d="M 27,22 L 35,22 L 36,40 L 26,40 Z" fill="#0f172a" />
          {/* Beyaz Çapraz Bağcıklar */}
          <line x1="26" y1="24" x2="36" y2="24" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="26" y1="28" x2="36" y2="28" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="26" y1="32" x2="36" y2="32" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="26" y1="36" x2="36" y2="36" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />

          {/* Bilek Boşluğu / Yaka (Padded Collar & Insole Opening) */}
          <ellipse cx="32" cy="45" rx="6" ry="5" fill="#020617" stroke="#ffffff" strokeWidth="1" />
          {/* Taban İçi Marka İması */}
          <circle cx="32" cy="45" r="2" fill="#ef4444" opacity="0.8" />

          {/* Arka Çekme Halkası (Heel Tab) */}
          <rect x="30.5" y="54" width="3" height="3" rx="0.5" fill="#0f172a" />
        </svg>
      );

    // --------------------------------------------------------------------------
    // 4. SAVAŞ GEMİSİ (warship) - Kuşbakışı Zırhlı Muhrip
    // --------------------------------------------------------------------------
    case 'warship':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="ship-hull" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="ship-deck" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
          </defs>

          {/* Gövde (Jilet Keskinliğinde Burun & Düz Kıç) */}
          <path
            d="M 32,5 C 28,12 22,20 22,35 L 22,53 C 25,56 39,56 42,53 L 42,35 C 42,20 36,12 32,5 Z"
            fill="url(#ship-hull)"
            stroke="#1e293b"
            strokeWidth="1.2"
          />

          {/* İç Güverte (Deck Plate) */}
          <path
            d="M 32,8 C 29,14 24,22 24,35 L 24,51 C 27,53 37,53 40,51 L 40,35 C 40,22 35,14 32,8 Z"
            fill="url(#ship-deck)"
          />

          {/* 1. Ön Ana Batarya Topu (Döner Taret & İkiz Namlu) */}
          <line x1="30.5" y1="8" x2="30.5" y2="17" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="33.5" y1="8" x2="33.5" y2="17" stroke="#0f172a" strokeWidth="1.2" />
          <circle cx="32" cy="17" r="4.5" fill="#334155" stroke="#0f172a" strokeWidth="1" />

          {/* 2. Ön Yüksek Batarya Topu */}
          <line x1="31" y1="16" x2="31" y2="23" stroke="#0f172a" strokeWidth="1" />
          <line x1="33" y1="16" x2="33" y2="23" stroke="#0f172a" strokeWidth="1" />
          <circle cx="32" cy="24" r="3.5" fill="#475569" stroke="#0f172a" strokeWidth="0.8" />

          {/* Komuta Köprüsü / Üst Yapı (Superstructure & Radar) */}
          <rect x="27" y="30" width="10" height="9" rx="1.5" fill="#1e293b" />
          {/* Radar Anteni */}
          <line x1="28" y1="34" x2="36" y2="34" stroke="#f8fafc" strokeWidth="1" />
          <line x1="32" y1="31" x2="32" y2="37" stroke="#f8fafc" strokeWidth="1" />

          {/* Baca / Egzoz Panjuru */}
          <rect x="29" y="41" width="6" height="4" rx="1" fill="#0f172a" />

          {/* Arka Helikopter İniş Pisti (Helipad 'H') */}
          <circle cx="32" cy="49" r="4" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.85" />
          <text
            x="32"
            y="51.5"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="5.5"
            fontWeight="900"
            fontFamily="sans-serif"
            opacity="0.9"
          >
            H
          </text>
        </svg>
      );

    // --------------------------------------------------------------------------
    // 5. ROMA SFENKSİ (sphinx) - Kuşbakışı Mermer Kaideli Heykel Anıtı
    // --------------------------------------------------------------------------
    case 'sphinx':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="sph-base" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id="sph-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>

          {/* Mermer Kaide Kaidesi (Antik Roma Taş Platformu) */}
          <rect x="14" y="10" width="36" height="44" rx="4" fill="url(#sph-base)" stroke="#64748b" strokeWidth="1.2" />
          {/* Kaide Kenar Pahlama Çizgisi */}
          <rect x="16.5" y="12.5" width="31" height="39" rx="2" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.8" />

          {/* Altın Köşe Rozetleri */}
          <circle cx="17" cy="13" r="1.5" fill="url(#sph-gold)" />
          <circle cx="47" cy="13" r="1.5" fill="url(#sph-gold)" />
          <circle cx="17" cy="51" r="1.5" fill="url(#sph-gold)" />
          <circle cx="47" cy="51" r="1.5" fill="url(#sph-gold)" />

          {/* Sfenks Aslan Gövdesi - Kuşbakışı */}
          {/* Öne Uzatılmış Ön Pençeler (Left & Right Forepaws) */}
          <rect x="23" y="14" width="4.5" height="11" rx="2" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.8" />
          <rect x="36.5" y="14" width="4.5" height="11" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />

          {/* Pençe Tırnak Çizgileri */}
          <line x1="24.5" y1="14" x2="24.5" y2="17" stroke="#475569" strokeWidth="0.7" />
          <line x1="26" y1="14" x2="26" y2="17" stroke="#475569" strokeWidth="0.7" />
          <line x1="38" y1="14" x2="38" y2="17" stroke="#475569" strokeWidth="0.7" />
          <line x1="39.5" y1="14" x2="39.5" y2="17" stroke="#475569" strokeWidth="0.7" />

          {/* Aslan Göğsü & Sağrıları (Lion Torso & Flanks) */}
          <path
            d="M 23,24 C 21,30 20,40 23,45 C 26,48 38,48 41,45 C 44,40 43,30 41,24 Z"
            fill="#cbd5e1"
            stroke="#475569"
            strokeWidth="1"
          />

          {/* Kıvrılmış Kuyruk (Tail curled around rear haunch) */}
          <path
            d="M 38,46 C 43,47 43,51 37,51"
            fill="none"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Sfenks Başı & Kraliyet Başlığı (Nemes Headdress from top) */}
          <ellipse cx="32" cy="24" rx="7.5" ry="5.5" fill="#f8fafc" stroke="#334155" strokeWidth="1" />
          {/* Başlık Yan Kanatları (Hotoz/Nemes Flaps) */}
          <path d="M 24.5,23 L 22,27 L 26,28 Z" fill="url(#sph-gold)" />
          <path d="M 39.5,23 L 42,27 L 38,28 Z" fill="url(#sph-gold)" />

          {/* Altın Taç / Defne Çelengi Vurgusu */}
          <circle cx="32" cy="23" r="2.5" fill="url(#sph-gold)" />
        </svg>
      );

    // --------------------------------------------------------------------------
    // 6. RETRO ŞEHİR SCOOTERI (scooter) - Kuşbakışı Vespa
    // --------------------------------------------------------------------------
    case 'scooter':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="sc-body" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
            <linearGradient id="sc-seat" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>
          </defs>

          {/* Gidon (Handlebars - Yatay Krom Bar & Elcikler) */}
          <line x1="16" y1="13" x2="48" y2="13" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
          {/* Elcikler (Rubber Grips) */}
          <rect x="15" y="11.5" width="6" height="3" rx="1" fill="#0f172a" />
          <rect x="43" y="11.5" width="6" height="3" rx="1" fill="#0f172a" />
          {/* Krom Yan Aynalar */}
          <circle cx="15" cy="9" r="2" fill="#f8fafc" stroke="#64748b" strokeWidth="0.8" />
          <circle cx="49" cy="9" r="2" fill="#f8fafc" stroke="#64748b" strokeWidth="0.8" />

          {/* Ön Far / Headlight Pod */}
          <circle cx="32" cy="12" r="3.5" fill="#fef08a" stroke="#cbd5e1" strokeWidth="1.2" />

          {/* Ön Çamurluk & Ön Lastik Ucu */}
          <rect x="30" y="5" width="4" height="5" rx="1.5" fill="#0f172a" />
          <ellipse cx="32" cy="11" rx="4" ry="2" fill="url(#sc-body)" />

          {/* Bacak Koruma Kalkanı (Front Legshield Apron) */}
          <path
            d="M 23,16 C 26,14 38,14 41,16 C 43,20 43,26 40,28 C 36,29 28,29 24,28 C 21,26 21,20 23,16 Z"
            fill="url(#sc-body)"
            stroke="#0e7490"
            strokeWidth="1"
          />

          {/* Ayak Basma Tabanı (Floorboard & Kauçuk Çıtalar) */}
          <rect x="25" y="27" width="14" height="11" rx="2" fill="#0891b2" stroke="#164e63" strokeWidth="0.8" />
          <line x1="28" y1="29" x2="28" y2="36" stroke="#0f172a" strokeWidth="1" />
          <line x1="32" y1="29" x2="32" y2="36" stroke="#0f172a" strokeWidth="1" />
          <line x1="36" y1="29" x2="36" y2="36" stroke="#0f172a" strokeWidth="1" />

          {/* İkonik Şişkin Arka Motor Kapakları (Bulbous Engine Cowls) */}
          <ellipse cx="23" cy="46" rx="5" ry="8" fill="url(#sc-body)" stroke="#0e7490" strokeWidth="0.8" />
          <ellipse cx="41" cy="46" rx="5" ry="8" fill="url(#sc-body)" stroke="#0e7490" strokeWidth="0.8" />

          {/* Deri Sele (Retro İkili Koltuk) */}
          <path
            d="M 28,34 C 30,33 34,33 36,34 C 38,38 39,47 37,51 C 35,53 29,53 27,51 C 25,47 26,38 28,34 Z"
            fill="url(#sc-seat)"
            stroke="#fef3c7"
            strokeWidth="0.8"
          />
          {/* Sele Dikiş Çizgisi */}
          <path d="M 29,43 C 32,44 32,44 35,43" stroke="#fef3c7" strokeWidth="0.7" fill="none" opacity="0.8" />

          {/* Arka Stop Lambası & Bagaj Demiri */}
          <rect x="30" y="54" width="4" height="2" rx="0.5" fill="#ef4444" />
        </svg>
      );

    // --------------------------------------------------------------------------
    // 7. LÜKS SUV (suv) - Kuşbakışı 4x4 Arazi Aracı (G-Wagon Stili)
    // --------------------------------------------------------------------------
    case 'suv':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="suv-body" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="suv-glass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="40%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>

          {/* 4 Geniş Arazi Lastiği (All-Terrain Tires) */}
          <rect x="13" y="13" width="6" height="11" rx="2" fill="#020617" stroke="#475569" strokeWidth="0.8" />
          <rect x="45" y="13" width="6" height="11" rx="2" fill="#020617" stroke="#475569" strokeWidth="0.8" />
          <rect x="13" y="40" width="6" height="11" rx="2" fill="#020617" stroke="#475569" strokeWidth="0.8" />
          <rect x="45" y="40" width="6" height="11" rx="2" fill="#020617" stroke="#475569" strokeWidth="0.8" />

          {/* SUV Köşeli Gövdesi */}
          <rect x="18" y="9" width="28" height="45" rx="3" fill="url(#suv-body)" stroke="#0f172a" strokeWidth="1.2" />

          {/* Yan Aynalar */}
          <rect x="13" y="21" width="4" height="2" rx="0.5" fill="#334155" />
          <rect x="47" y="21" width="4" height="2" rx="0.5" fill="#334155" />

          {/* Kaput Izgarası & Hava Girişleri */}
          <line x1="22" y1="12" x2="42" y2="12" stroke="#475569" strokeWidth="1.5" />
          <line x1="24" y1="15" x2="40" y2="15" stroke="#475569" strokeWidth="1.5" />

          {/* Ön Cam (Windshield) */}
          <path d="M 20,20 L 44,20 L 42,28 L 22,28 Z" fill="url(#suv-glass)" stroke="#0f172a" strokeWidth="0.8" />
          {/* Cam Silecekleri */}
          <line x1="24" y1="27" x2="30" y2="24" stroke="#64748b" strokeWidth="0.8" />
          <line x1="34" y1="27" x2="40" y2="24" stroke="#64748b" strokeWidth="0.8" />

          {/* Tavan & Portbagaj Rayları (Roof Rack Rails) */}
          <rect x="22" y="30" width="20" height="18" rx="1" fill="#1e293b" />
          <line x1="21" y1="29" x2="21" y2="49" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="43" y1="29" x2="43" y2="49" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          {/* Portbagaj Enine Barlar */}
          <line x1="22" y1="35" x2="42" y2="35" stroke="#64748b" strokeWidth="0.8" />
          <line x1="22" y1="43" x2="42" y2="43" stroke="#64748b" strokeWidth="0.8" />

          {/* Arka Kapıya Monte Stepne Lastik Kapağı (Iconic Tailgate Spare Tire) */}
          <circle cx="32" cy="52" r="5.5" fill="#020617" stroke="#cbd5e1" strokeWidth="1.2" />
          <circle cx="32" cy="52" r="2.5" fill="#334155" />
        </svg>
      );

    // --------------------------------------------------------------------------
    // 8. KEPÇE / EKSKAVATÖR (excavator) - Kuşbakışı İş Makinesi
    // --------------------------------------------------------------------------
    case 'excavator':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="ex-yellow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="60%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="ex-track" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* Paletler (Sol ve Sağ Kauçuk/Çelik Paletler) */}
          <rect x="12" y="17" width="8" height="36" rx="3" fill="url(#ex-track)" stroke="#020617" strokeWidth="1" />
          <rect x="44" y="17" width="8" height="36" rx="3" fill="url(#ex-track)" stroke="#020617" strokeWidth="1" />

          {/* Palet Tırnak Çizgileri */}
          {[21, 26, 31, 36, 41, 46].map((y) => (
            <React.Fragment key={y}>
              <line x1="12" y1={y} x2="20" y2={y} stroke="#64748b" strokeWidth="0.8" />
              <line x1="44" y1={y} x2="52" y2={y} stroke="#64748b" strokeWidth="0.8" />
            </React.Fragment>
          ))}

          {/* Döner Kule Tabla Çemberi (Turntable Slew Ring) */}
          <circle cx="32" cy="35" r="11" fill="#1e293b" stroke="#0f172a" strokeWidth="1.2" />

          {/* Ana Gövde / Üst Yapı (Sarı Konstrüksiyon Kasası) */}
          <rect x="21" y="22" width="22" height="26" rx="3" fill="url(#ex-yellow)" stroke="#b45309" strokeWidth="1.2" />

          {/* Sol Operatör Kabini (Camlı Güvenlik Kabini) */}
          <rect x="22" y="23" width="8.5" height="14" rx="1.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
          <rect x="23.5" y="24.5" width="5.5" height="5" fill="#38bdf8" opacity="0.6" />

          {/* Arka Motor Bölmesi & Karşı Ağırlık (Counterweight & Grilles) */}
          <rect x="22" y="41" width="20" height="6" rx="1" fill="#0f172a" />
          <line x1="24" y1="43" x2="33" y2="43" stroke="#f59e0b" strokeWidth="0.8" />
          <line x1="24" y1="45" x2="33" y2="45" stroke="#f59e0b" strokeWidth="0.8" />

          {/* Öne Uzanan Hidrolik Bom (Boom & Arm extending forward) */}
          <path d="M 33,32 L 37,32 L 36,15 L 34,15 Z" fill="#0f172a" />
          {/* Hidrolik Pistonlar */}
          <line x1="33" y1="30" x2="33" y2="17" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="37" y1="30" x2="37" y2="17" stroke="#cbd5e1" strokeWidth="1" />

          {/* İkinci Kol (Arm / Dipper) */}
          <rect x="33.5" y="7" width="3" height="9" fill="url(#ex-yellow)" stroke="#b45309" strokeWidth="0.8" />

          {/* Dişli Kazıcı Kova (Toothed Bucket at the very front) */}
          <path d="M 30,7 L 40,7 L 39,2 L 31,2 Z" fill="#334155" stroke="#0f172a" strokeWidth="0.8" />
          {/* Kova Çelik Dişleri */}
          <line x1="32" y1="2" x2="32" y2="0" stroke="#f8fafc" strokeWidth="1" />
          <line x1="35" y1="2" x2="35" y2="0" stroke="#f8fafc" strokeWidth="1" />
          <line x1="38" y1="2" x2="38" y2="0" stroke="#f8fafc" strokeWidth="1" />
        </svg>
      );

    // --------------------------------------------------------------------------
    // 9. HIZLI TREN (train) - Kuşbakışı Aerodinamik Lokomotif
    // --------------------------------------------------------------------------
    case 'train':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`overflow-visible select-none drop-shadow-md ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="trn-body" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="40%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <linearGradient id="trn-stripe" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
          </defs>

          {/* Gövde - İkonik Sivri Gagalı Aerodinamik Burun ve Düz Vagon Gövdesi */}
          <path
            d="M 32,5 C 28,11 23,20 23,30 L 23,56 C 26,57 38,57 41,56 L 41,30 C 41,20 36,11 32,5 Z"
            fill="url(#trn-body)"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />

          {/* Kokpit Ön Camı (Aerodynamic Cockpit Visor) */}
          <path
            d="M 27,17 C 30,15 34,15 37,17 L 36,22 C 34,21 30,21 28,22 Z"
            fill="#0f172a"
            stroke="#38bdf8"
            strokeWidth="0.8"
          />

          {/* Hız Şeritleri (Turkuaz/Mavi YHT Gövde Şeritleri) */}
          <path d="M 23,26 L 25,26 L 25,56 L 23,56 Z" fill="url(#trn-stripe)" />
          <path d="M 41,26 L 39,26 L 39,56 L 41,56 Z" fill="url(#trn-stripe)" />

          {/* Tavan Havalandırma Panjurları */}
          <rect x="28" y="27" width="8" height="8" rx="1" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" />
          <line x1="30" y1="29" x2="34" y2="29" stroke="#94a3b8" strokeWidth="0.8" />
          <line x1="30" y1="31" x2="34" y2="31" stroke="#94a3b8" strokeWidth="0.8" />
          <line x1="30" y1="33" x2="34" y2="33" stroke="#94a3b8" strokeWidth="0.8" />

          {/* Yüksek Hızlı Elektrik Pantoğrafı (Diamond Pantograph on Roof) */}
          <polygon points="32,41 35,45 32,49 29,45" fill="none" stroke="#dc2626" strokeWidth="1.2" />
          <line x1="28" y1="41" x2="36" y2="41" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="32" cy="45" r="1" fill="#0f172a" />

          {/* Vagon Geçiş Körüklü Ucu (Rear Articulation Diaphragm) */}
          <rect x="25" y="55" width="14" height="2" fill="#0f172a" />
        </svg>
      );

    // --------------------------------------------------------------------------
    // Varsayılan / Fallback (Genel Piyon Diski)
    // --------------------------------------------------------------------------
    default:
      return (
        <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="22" fill={color || '#ef4444'} stroke="#ffffff" strokeWidth="3" />
          <circle cx="32" cy="32" r="10" fill="#ffffff" opacity="0.8" />
        </svg>
      );
  }
}
