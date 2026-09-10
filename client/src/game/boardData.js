export const BOARD_TILES = [
  {
    id: 0,
    image: '/images/tiles/tile_0.webp',
    name: "Merkez Şantiye",
    shortName: "ŞANTİYE",
    type: "go",
    icon: "👷",
    description: "Buradan geçtiğinde veya indiğinde 200₺ maaş alırsın."
  },
  {
    id: 1,
    image: '/images/tiles/tile_1.webp',
    name: "Ulus",
    shortName: "Ulus",
    type: "property",
    group: "brown",
    groupColor: "#92400e",
    icon: "🏛️",
    cost: 60,
    rent: [2, 10, 30, 90, 160, 250],
    houseCost: 50,
    mortgage: 30
  },
  {
    id: 2,
    image: '/images/tiles/tile_2.webp',
    name: "Belediye & İmar",
    shortName: "İmar",
    type: "chest",
    icon: "🏛️",
    description: "Belediye & İmar kartı çek."
  },
  {
    id: 3,
    image: '/images/tiles/tile_3.webp',
    name: "Dışkapı",
    shortName: "Dışkapı",
    type: "property",
    group: "brown",
    groupColor: "#92400e",
    icon: "🏢",
    cost: 60,
    rent: [4, 20, 60, 180, 320, 450],
    houseCost: 50,
    mortgage: 30
  },
  {
    id: 4,
    image: '/images/tiles/tile_4.webp',
    name: "Gelir Vergisi",
    shortName: "Vergi",
    type: "tax",
    icon: "💸",
    amount: 200,
    description: "200₺ Gelir Vergisi Öde"
  },
  {
    id: 5,
    image: '/images/tiles/tile_5.webp',
    name: "Ankara Tren Garı",
    shortName: "Ankara Gar",
    type: "railroad",
    group: "railroad",
    groupColor: "#334155",
    icon: "🚂",
    cost: 200,
    rent: [25, 50, 100, 200],
    mortgage: 100
  },
  {
    id: 6,
    image: '/images/tiles/tile_6.webp',
    name: "Mamak",
    shortName: "Mamak",
    type: "property",
    group: "light_blue",
    groupColor: "#0284c7",
    icon: "🏘️",
    cost: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
    mortgage: 50
  },
  {
    id: 7,
    image: '/images/tiles/tile_7.webp',
    name: "İhale & Fırsat",
    shortName: "İhale",
    type: "chance",
    icon: "📜",
    description: "İhale & Fırsat kartı çek."
  },
  {
    id: 8,
    image: '/images/tiles/tile_8.webp',
    name: "Keçiören",
    shortName: "Keçiören",
    type: "property",
    group: "light_blue",
    groupColor: "#0284c7",
    icon: "🚡",
    cost: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
    mortgage: 50
  },
  {
    id: 9,
    image: '/images/tiles/tile_9.webp',
    name: "Yenimahalle",
    shortName: "Yenimahalle",
    type: "property",
    group: "light_blue",
    groupColor: "#0284c7",
    icon: "🌳",
    cost: 120,
    rent: [8, 40, 100, 300, 450, 600],
    houseCost: 50,
    mortgage: 60
  },
  {
    id: 10,
    image: '/images/tiles/tile_10.webp',
    name: "Maliye Denetimi",
    shortName: "MALİYE",
    type: "jail",
    icon: "📋",
    description: "Yalnızca evrak bırakan ziyaretçisin veya incelemedesin."
  },
  {
    id: 11,
    image: '/images/tiles/tile_11.webp',
    name: "Altındağ",
    shortName: "Altındağ",
    type: "property",
    group: "pink",
    groupColor: "#db2777",
    icon: "🏰",
    cost: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
    mortgage: 70
  },
  {
    id: 12,
    image: '/images/tiles/tile_12.webp',
    name: "Başkent Elektrik Dağıtım",
    shortName: "Elektrik",
    type: "utility",
    group: "utility",
    groupColor: "#d97706",
    icon: "⚡",
    cost: 150,
    mortgage: 75
  },
  {
    id: 13,
    image: '/images/tiles/tile_13.webp',
    name: "Demetevler",
    shortName: "Demetevler",
    type: "property",
    group: "pink",
    groupColor: "#db2777",
    icon: "🏙️",
    cost: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
    mortgage: 70
  },
  {
    id: 14,
    image: '/images/tiles/tile_14.webp',
    name: "Etlik",
    shortName: "Etlik",
    type: "property",
    group: "pink",
    groupColor: "#db2777",
    icon: "🏥",
    cost: 160,
    rent: [12, 60, 180, 500, 700, 900],
    houseCost: 100,
    mortgage: 80
  },
  {
    id: 15,
    image: '/images/tiles/tile_15.webp',
    name: "Söğütözü Garı",
    shortName: "Söğütözü Gar",
    type: "railroad",
    group: "railroad",
    groupColor: "#334155",
    icon: "🚉",
    cost: 200,
    rent: [25, 50, 100, 200],
    mortgage: 100
  },
  {
    id: 16,
    image: '/images/tiles/tile_16.webp',
    name: "Etimesgut",
    shortName: "Etimesgut",
    type: "property",
    group: "orange",
    groupColor: "#ea580c",
    icon: "✈️",
    cost: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
    mortgage: 90
  },
  {
    id: 17,
    image: '/images/tiles/tile_17.webp',
    name: "Belediye & İmar",
    shortName: "İmar",
    type: "chest",
    icon: "🏛️",
    description: "Belediye & İmar kartı çek."
  },
  {
    id: 18,
    image: '/images/tiles/tile_18.webp',
    name: "Batıkent",
    shortName: "Batıkent",
    type: "property",
    group: "orange",
    groupColor: "#ea580c",
    icon: "🏬",
    cost: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
    mortgage: 90
  },
  {
    id: 19,
    image: '/images/tiles/tile_19.webp',
    name: "Eryaman",
    shortName: "Eryaman",
    type: "property",
    group: "orange",
    groupColor: "#ea580c",
    icon: "🏟️",
    cost: 200,
    rent: [16, 80, 220, 600, 800, 1000],
    houseCost: 100,
    mortgage: 100
  },
  {
    id: 20,
    image: '/images/tiles/tile_20.webp',
    name: "Dinlenme Tesisi",
    shortName: "MOLA",
    type: "parking",
    icon: "☕",
    description: "Şantiye dinlenme alanı."
  },
  {
    id: 21,
    image: '/images/tiles/tile_21.webp',
    name: "Bahçelievler 7. Cadde",
    shortName: "Bahçeli 7",
    type: "property",
    group: "red",
    groupColor: "#dc2626",
    icon: "☕",
    cost: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
    mortgage: 110
  },
  {
    id: 22,
    image: '/images/tiles/tile_22.webp',
    name: "İhale & Fırsat",
    shortName: "İhale",
    type: "chance",
    icon: "📜",
    description: "İhale & Fırsat kartı çek."
  },
  {
    id: 23,
    image: '/images/tiles/tile_23.webp',
    name: "Emek",
    shortName: "Emek",
    type: "property",
    group: "red",
    groupColor: "#dc2626",
    icon: "🍰",
    cost: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
    mortgage: 110
  },
  {
    id: 24,
    image: '/images/tiles/tile_24.webp',
    name: "Kızılay Meydanı",
    shortName: "Kızılay",
    type: "property",
    group: "red",
    groupColor: "#dc2626",
    icon: "🌆",
    cost: 240,
    rent: [20, 100, 300, 750, 925, 1100],
    houseCost: 150,
    mortgage: 120
  },
  {
    id: 25,
    image: '/images/tiles/tile_25.webp',
    name: "Marşandiz Garı",
    shortName: "Marşandiz",
    type: "railroad",
    group: "railroad",
    groupColor: "#334155",
    icon: "🚂",
    cost: 200,
    rent: [25, 50, 100, 200],
    mortgage: 100
  },
  {
    id: 26,
    image: '/images/tiles/tile_26.webp',
    name: "Tunalı Hilmi Caddesi",
    shortName: "Tunalı",
    type: "property",
    group: "yellow",
    groupColor: "#ca8a04",
    icon: "🦢",
    cost: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
    mortgage: 130
  },
  {
    id: 27,
    image: '/images/tiles/tile_27.webp',
    name: "Kocatepe",
    shortName: "Kocatepe",
    type: "property",
    group: "yellow",
    groupColor: "#ca8a04",
    icon: "🕌",
    cost: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
    mortgage: 130
  },
  {
    id: 28,
    image: '/images/tiles/tile_28.webp',
    name: "ASKİ Su İdaresi",
    shortName: "ASKİ Su",
    type: "utility",
    group: "utility",
    groupColor: "#0891b2",
    icon: "💧",
    cost: 150,
    mortgage: 75
  },
  {
    id: 29,
    image: '/images/tiles/tile_29.webp',
    name: "Gaziosmanpaşa (GOP)",
    shortName: "GOP",
    type: "property",
    group: "yellow",
    groupColor: "#ca8a04",
    icon: "🍸",
    cost: 280,
    rent: [24, 120, 360, 850, 1025, 1200],
    houseCost: 150,
    mortgage: 140
  },
  {
    id: 30,
    image: '/images/tiles/tile_30.webp',
    name: "Vergi İncelemesi!",
    shortName: "MÜFETTİŞ",
    type: "gotojail",
    icon: "🕵️‍♂️",
    description: "Doğrudan Maliye Denetimi'ne git. Merkez Şantiye'den geçemezsin."
  },
  {
    id: 31,
    image: '/images/tiles/tile_31.webp',
    name: "Çankaya Atakule",
    shortName: "Çankaya",
    type: "property",
    group: "green",
    groupColor: "#16a34a",
    icon: "🗼",
    cost: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
    mortgage: 150
  },
  {
    id: 32,
    image: '/images/tiles/tile_32.webp',
    name: "Çayyolu",
    shortName: "Çayyolu",
    type: "property",
    group: "green",
    groupColor: "#16a34a",
    icon: "🏡",
    cost: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
    mortgage: 150
  },
  {
    id: 33,
    image: '/images/tiles/tile_33.webp',
    name: "Belediye & İmar",
    shortName: "İmar",
    type: "chest",
    icon: "🏛️",
    description: "Belediye & İmar kartı çek."
  },
  {
    id: 34,
    image: '/images/tiles/tile_34.webp',
    name: "Ümitköy",
    shortName: "Ümitköy",
    type: "property",
    group: "green",
    groupColor: "#16a34a",
    icon: "🛍️",
    cost: 320,
    rent: [28, 150, 450, 1000, 1200, 1400],
    houseCost: 200,
    mortgage: 160
  },
  {
    id: 35,
    image: '/images/tiles/tile_35.webp',
    name: "Eryaman YHT Garı",
    shortName: "Eryaman YHT",
    type: "railroad",
    group: "railroad",
    groupColor: "#334155",
    icon: "🚉",
    cost: 200,
    rent: [25, 50, 100, 200],
    mortgage: 100
  },
  {
    id: 36,
    image: '/images/tiles/tile_36.webp',
    name: "İhale & Fırsat",
    shortName: "İhale",
    type: "chance",
    icon: "📜",
    description: "İhale & Fırsat kartı çek."
  },
  {
    id: 37,
    image: '/images/tiles/tile_37.webp',
    name: "Bilkent",
    shortName: "Bilkent",
    type: "property",
    group: "dark_blue",
    groupColor: "#1d4ed8",
    icon: "🎓",
    cost: 350,
    rent: [35, 175, 500, 1100, 1300, 1500],
    houseCost: 200,
    mortgage: 175
  },
  {
    id: 38,
    image: '/images/tiles/tile_38.webp',
    name: "Lüks Vergisi",
    shortName: "Lüks Vergi",
    type: "tax",
    icon: "💎",
    amount: 100,
    description: "100₺ Lüks Vergisi Öde"
  },
  {
    id: 39,
    image: '/images/tiles/tile_39.webp',
    name: "İncek Villaları",
    shortName: "İncek",
    type: "property",
    group: "dark_blue",
    groupColor: "#1d4ed8",
    icon: "🏰",
    cost: 400,
    rent: [50, 200, 600, 1400, 1700, 2000],
    houseCost: 200,
    mortgage: 200
  }
];

export const TILE_IMAGES = {
  0: "https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?w=400&auto=format&fit=crop&q=80", // Anıtkabir / Başlangıç
  1: "https://images.unsplash.com/photo-1580837119756-563d608dd119?w=400&auto=format&fit=crop&q=80", // Ulus Atatürk Anıtı & 1. Meclis
  2: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&auto=format&fit=crop&q=80", // Belediye & İmar
  3: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&auto=format&fit=crop&q=80", // Dışkapı Caddeleri
  4: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80", // Vergi
  5: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=400&auto=format&fit=crop&q=80", // Tarihi TCDD Ankara Tren Garı
  6: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=80", // Mamak Konutları
  7: "https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400&auto=format&fit=crop&q=80", // İhale & Fırsat
  8: "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=400&auto=format&fit=crop&q=80", // Keçiören Teleferik & Şelale
  9: "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=400&auto=format&fit=crop&q=80", // Yenimahalle & Şentepe
  10: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&auto=format&fit=crop&q=80", // Ulucanlar Cezaevi Maliye Denetimi
  11: "https://images.unsplash.com/photo-1628178129759-b1464df3ffae?w=400&auto=format&fit=crop&q=80", // Altındağ Ankara Kalesi & Hamamönü
  12: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&auto=format&fit=crop&q=80", // Başkent Elektrik Dağıtım
  13: "https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=400&auto=format&fit=crop&q=80", // Demetevler İvedik Caddesi
  14: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400&auto=format&fit=crop&q=80", // Batıkent Meydanı
  15: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400&auto=format&fit=crop&q=80", // Sincan Başkentray Tren İstasyonu
  16: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&auto=format&fit=crop&q=80", // Etimesgut Havacılık & Park
  17: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&auto=format&fit=crop&q=80", // Belediye & İmar
  18: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80", // Eryaman Göksu Parkı
  19: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&auto=format&fit=crop&q=80", // Bağlıca Modern Villaları
  20: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=400&auto=format&fit=crop&q=80", // Dinlenme Tesisi & Mola
  21: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80", // Gölbaşı Mogan Gölü Sahili
  22: "https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400&auto=format&fit=crop&q=80", // İhale & Fırsat
  23: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&auto=format&fit=crop&q=80", // İncek Kampüs & Villaları
  24: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&auto=format&fit=crop&q=80", // Kızılay Meydanı & Güvenpark
  25: "https://images.unsplash.com/photo-1532105956626-9569c03602f6?w=400&auto=format&fit=crop&q=80", // Kayaş Tren İstasyonu
  26: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&auto=format&fit=crop&q=80", // Tunalı Hilmi & Kuğulu Park
  27: "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=400&auto=format&fit=crop&q=80", // Gaziosmanpaşa Elçilikler
  28: "https://images.unsplash.com/photo-1527066579998-dbbae57f45ce?w=400&auto=format&fit=crop&q=80", // ASKİ İvedik Su Tesisleri
  29: "https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?w=400&auto=format&fit=crop&q=80", // Ayrancı Botanik Parkı
  30: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&auto=format&fit=crop&q=80", // Maliye Müfettişi & Vergi İncelemesi
  31: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80", // Çankaya Atakule Zirvesi
  32: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&auto=format&fit=crop&q=80", // Ümitköy Lüks Konutları
  33: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&auto=format&fit=crop&q=80", // Belediye & İmar
  34: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&auto=format&fit=crop&q=80", // Çayyolu Park Caddesi
  35: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400&auto=format&fit=crop&q=80", // Eryaman YHT Batı Terminali
  36: "https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400&auto=format&fit=crop&q=80", // İhale & Fırsat
  37: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400&auto=format&fit=crop&q=80", // Bilkent Üniversitesi & Kampüsü
  38: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80", // Lüks Vergisi
  39: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&auto=format&fit=crop&q=80"  // Beysukent Angora Evleri
};



export const COLOR_GROUPS = {
  brown: [1, 3],
  light_blue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  dark_blue: [37, 39],
  railroad: [5, 15, 25, 35],
  utility: [12, 28]
};

export const CHANCE_CARDS = [
  { id: "ch1", title: "Merkez Şantiye'ye İlerle", desc: "Doğrudan Merkez Şantiye'ye git ve 200₺ maaşını al.", action: { type: "advance_to", tileId: 0, collectGo: true } },
  { id: "ch2", title: "Kızılay Meydanı'na İlerle", desc: "Kızılay projesine git. Merkez Şantiye'den geçersen 200₺ al.", action: { type: "advance_to", tileId: 24, collectGo: true } },
  { id: "ch3", title: "Altındağ'a İlerle", desc: "Altındağ projesine ilerle. Merkez Şantiye'den geçersen 200₺ al.", action: { type: "advance_to", tileId: 11, collectGo: true } },
  { id: "ch4", title: "En Yakın Gara İlerle", desc: "En yakın tren garına ilerle. Sahipsizse alabilirsin, birine aitse normal kiranın 2 katını öde.", action: { type: "advance_nearest_railroad" } },
  { id: "ch5", title: "En Yakın Altyapı Kurumuna İlerle", desc: "En yakın enerji/su kurumuna git. Sahipsizse al, birine aitse zarların 10 katı kira öde.", action: { type: "advance_nearest_utility" } },
  { id: "ch6", title: "Banka Temettü Geliri", desc: "Hisselerinden 50₺ kâr payı temettüsü aldın.", action: { type: "money", amount: 50 } },
  { id: "ch7", title: "Vergi Barışı & İmar Affı Belgesi", desc: "Bu resmi belge seni Maliye Denetimi'nden anında muaf tutar. Saklayabilir veya satabilirsin.", action: { type: "jail_free" } },
  { id: "ch8", title: "3 Kare Geri Git", desc: "Piyonunu 3 kare geriye çek.", action: { type: "move_relative", steps: -3 } },
  { id: "ch9", title: "Vergi Müfettişi Denetime Aldı!", desc: "Doğrudan Maliye Denetimi'ne git! Merkez Şantiye'den geçemezsin, 200₺ alamazsın.", action: { type: "go_to_jail" } },
  { id: "ch10", title: "Şantiye İSG & Tesisat Revizyonu", desc: "Yapı denetim ve tesisat güçlendirme masrafı: Her ev için 20₺, her otel için 90₺ öde.", action: { type: "repairs", houseCost: 20, hotelCost: 90 } },
  { id: "ch11", title: "Belediye Zabıta Harcı", desc: "Kaldırım işgali ve şantiye moloz cezası: 20₺ öde.", action: { type: "money", amount: -20 } },
  { id: "ch12", title: "Ortak Altyapı Dayanışması", desc: "Ortak altyapı gideri için diğer her oyuncuya 40₺ prim öde.", action: { type: "pay_all", amount: 40 } },
  { id: "ch13", title: "Konut İnşaat Kredisi Vadesi Doldu", desc: "Gayrimenkul yatırım fonundan 150₺ nakit hesabına yattı.", action: { type: "money", amount: 150 } },
  { id: "ch14", title: "İncek Villaları'na İlerle", desc: "Doğrudan İncek Villaları'na ilerle. Merkez Şantiye'den geçersen 200₺ al.", action: { type: "advance_to", tileId: 39, collectGo: true } },
  { id: "ch15", title: "Ankara Tren Garı'na Git", desc: "Ankara Tren Garı'na ilerle. Merkez Şantiye'den geçersen 200₺ al.", action: { type: "advance_to", tileId: 5, collectGo: true } },
  { id: "ch16", title: "Tatil Fonu Kazancı", desc: "Yatırım fonundan 100₺ kâr elde ettin.", action: { type: "money", amount: 100 } }
];

export const CHEST_CARDS = [
  { id: "cc1", title: "Merkez Şantiye'ye İlerle", desc: "Doğrudan Merkez Şantiye'ye git ve 200₺ al.", action: { type: "advance_to", tileId: 0, collectGo: true } },
  { id: "cc2", title: "Kamu İstimlak Tazminatı", desc: "Arsanın bir bölümüne belediye kavşağı yapıldı: 250₺ istimlak bedeli tahsil et.", action: { type: "money", amount: 250 } },
  { id: "cc3", title: "Şantiye İSG Sağlık Taraması", desc: "Şantiye personeli periyodik sağlık muayenesi faturası: 50₺ öde.", action: { type: "money", amount: -50 } },
  { id: "cc4", title: "Hisse Senedi Satış Kârı", desc: "Hisse satışından hesabına 50₺ kâr payı yattı.", action: { type: "money", amount: 50 } },
  { id: "cc5", title: "Vergi Barışı & İmar Affı Belgesi", desc: "Bu resmi belge seni Maliye Denetimi'nden bedelsiz kurtarır. Saklayabilir veya satabilirsin.", action: { type: "jail_free" } },
  { id: "cc6", title: "Mali Suçlar İncelemesi Başlatıldı", desc: "Doğrudan Maliye Denetimi'ne git. Merkez Şantiye'den geçemezsin, 200₺ alamazsın.", action: { type: "go_to_jail" } },
  { id: "cc7", title: "Yıl Sonu Proje Teslim Primi", desc: "Konut projesini erken teslim ettin! Diğer her oyuncudan 15₺ tebrik primi al.", action: { type: "collect_from_all", amount: 15 } },
  { id: "cc8", title: "Vergi İadesi", desc: "Maliyeden 20₺ fazla ödenen vergi iadesi aldın.", action: { type: "money", amount: 20 } },
  { id: "cc9", title: "Hayat Sigortası Vadesi Doldu", desc: "Sigorta poliçesinden 100₺ tazminat aldın.", action: { type: "money", amount: 100 } },
  { id: "cc10", title: "Hastane Faturası Masrafı", desc: "Hastane tedavi masrafları için 100₺ öde.", action: { type: "money", amount: -100 } },
  { id: "cc11", title: "Mesleki Yeterlilik Harcı", desc: "Şantiye ustalarının Mesleki Yeterlilik Kurumu sertifikasyonu: 60₺ öde.", action: { type: "money", amount: -60 } },
  { id: "cc12", title: "Danışmanlık Hizmet Geliri", desc: "Yaptığın teknik müşavirlik için 25₺ danışmanlık ücreti aldın.", action: { type: "money", amount: 25 } },
  { id: "cc13", title: "Şantiye Altyapı Katılım Payı", desc: "Belediye asfalt ve kanalizasyon altyapı bedeli: Her ev için 35₺, her otel için 120₺ öde.", action: { type: "repairs", houseCost: 35, hotelCost: 120 } },
  { id: "cc14", title: "Mimari Tasarım Başarı Ödülü", desc: "TMMOB Mimari Tasarım Yarışması'nda dereceye girdin: 30₺ ödül kazandın.", action: { type: "money", amount: 30 } },
  { id: "cc15", title: "Miras İntikali", desc: "Eski bir kadastro parselinden sana 100₺ miras intikal etti.", action: { type: "money", amount: 100 } },
  { id: "cc16", title: "Yatırım Fonu Geliri", desc: "Gayrimenkul ortaklık fonundan 100₺ kâr payı aldın.", action: { type: "money", amount: 100 } }
];

export const PLAYER_TOKENS = [
  { id: "hard_hat", name: "Sarı Baret", icon: "👷" },
  { id: "sports_car", name: "Kırmızı Spor Araba", icon: "🏎️" },
  { id: "sneaker", name: "Retro Basketbol Ayakkabısı", icon: "👟" },
  { id: "warship", name: "Savaş Gemisi", icon: "🚢" },
  { id: "sphinx", name: "Roma Sfenksi", icon: "🏛️" },
  { id: "scooter", name: "Retro Şehir Scooterı", icon: "🛵" },
  { id: "suv", name: "Lüks SUV", icon: "🚙" },
  { id: "excavator", name: "Kepçe / Ekskavatör", icon: "🚜" },
  { id: "train", name: "Hızlı Tren", icon: "🚄" }
];

export const PLAYER_COLORS = [
  "#ef4444", // Kırmızı
  "#3b82f6", // Mavi
  "#10b981", // Yeşil
  "#f59e0b", // Turuncu/Sarı
  "#8b5cf6", // Mor
  "#ec4899"  // Pembe
];

// Otantik Ankara Semt Görselleri ve Tapu İllüstrasyon Üreteci (Temiz, Arka Plan Odaklı, HTML Metinleriyle Çakışmaz)
function createTileIllustration(tile) {
  const color = tile.groupColor || '#334155';
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">
    <defs>
      <linearGradient id="bgGrad_${tile.id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.85"/>
        <stop offset="35%" stop-color="#0b1322" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="#020617" stop-opacity="0.98"/>
      </linearGradient>
      <radialGradient id="sunburst_${tile.id}" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
        <stop offset="45%" stop-color="rgba(255,255,255,0.03)"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <linearGradient id="glow_${tile.id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="transparent"/>
        <stop offset="50%" stop-color="${color}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="transparent"/>
      </linearGradient>
    </defs>
    <rect width="320" height="200" fill="url(#bgGrad_${tile.id})"/>
    <rect width="320" height="200" fill="url(#sunburst_${tile.id})"/>
    <path d="M0,150 L20,150 L20,135 L40,135 L40,150 L60,150 L60,120 L75,120 L75,110 L85,110 L85,120 L100,120 L100,150 L140,150 L140,128 L155,128 L160,105 L165,128 L180,128 L180,150 L220,150 L220,130 L235,130 L235,150 L260,150 L260,118 L275,118 L275,150 L320,150 L320,200 L0,200 Z" fill="rgba(0,0,0,0.55)"/>
    <line x1="0" y1="150" x2="320" y2="150" stroke="${color}" stroke-opacity="0.5" stroke-width="1.5"/>
    <rect x="0" y="148" width="320" height="4" fill="url(#glow_${tile.id})"/>
    <circle cx="160" cy="80" r="42" fill="#070b14" stroke="${color}" stroke-opacity="0.3" stroke-width="1.5"/>
    <circle cx="160" cy="80" r="36" fill="rgba(255,255,255,0.02)" stroke="${color}" stroke-opacity="0.2" stroke-width="1" stroke-dasharray="4,3"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export { createTileIllustration };




