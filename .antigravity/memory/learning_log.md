# Project Learnings & Anti-Pattern Log

## Active Rules & Hard Constraints
- [RULE-TILE-ASSETS]: Tüm tahta kareleri (0-39) için `/images/tiles/tile_{id}.jpg` yerel statik fotoğrafları kullanılır. `createTileIllustration` gibi karartıcı SVG üreticileriyle veya harici Unsplash linkleriyle asla ezilmemelidir.
- [RULE-BOARD-MINIMALISM]: Oyun cardboard tahtası üzerindeki karelerde (paranın üstünde) küçük iç çerçeve/resim kutuları yer almaz; kartlar sade kalmalıdır. Karelerin zeminindeki hafif saydam atmosferik arka plan fotoğrafı ve karta tıklandığında açılan detaylı modal fotoğrafları korunmalıdır.
- [RULE-GAME-MECHANICS]: Refaktör veya temizlik yapılırken hiçbir kural, oyun dengesi veya test senaryosu (34 testGameRules, 11 testNewBalanceMechanics, 7 testDicePhysics) bozulmamalıdır.
- [RULE-GIT-NO-AUTOPUSH]: Değişiklikler yapıldıktan sonra ASLA otomatik `git push` yapılmaz. Tüm işlemler yerelde (local) test edilip bırakılır. Sadece kullanıcı açıkça "pushla" dediğinde `git push` çalıştırılır.
- [RULE-NETWORK-DUAL-TRANSPORT]: WebRTC P2P ve WebSocket Relay her zaman paralel (Dual-Transport) çalışır. İstemci kimliği (`playerId`) sessionToken üzerinden deterministik atanır ve asla kanallar arası geçişte değişmez. Tüm aksiyonlar `actionId` ile gönderilir ve Host tarafında tekilleştirilir.
- [RULE-DISCONNECT-DETECTION]: Sunucu (`server/index.js`), bir soket kapandığında odaya mutlaka `relay:peer_left` yayını yapmalıdır. Host (`HostPeerService`), aktif oyuncuların son etkinlik zamanını (`_playerLastActivity`) liveness watchdog ile düzenli kontrol etmeli, hem `conn.peer` hem `playerId` üzerinden kopmaları tespit edip `disconnectNotice` bildirimini UI ve tahta üzerinde yayınlamalıdır.

## Incident & Correction History
- **Date / Session:** 2026-09-13
  - **Mistake Made:** Online modda oyuncu kopma uyarısı ("bağlantısı kesildi, bağlanmaya çalışıyor...") ekranda belirmemekteydi. Mobilden tarayıcı kapatıldığında Host bunu fark etmiyordu. Daha önceki oturumlarda ise Render WS proxy'sinin ham pingleri yutması ve TURN sunucusunun 120s tahsis sınırı nedeniyle oyunlar tam 2. dakikada donup çöküyordu.
  - **User Feedback:** "suan düzelmis multiplayeri ama oyuncu baglantisi kesildi baglanmaya calisiyor falan yazisi gelmiyor oyunun online modunu tekrar bozmadan bunlari da ekle mesela mobilden oynayan adam tarayiciyi kapatsa bile birsey olmuyor /self-improving-agent online modu neden hatali falan oldu hatalarini ögren"
  - **Root Cause & Prevention Rule:**
    1. `server/index.js` `ws.on('close')` anında odadaki diğer üyelere `relay:peer_left` eventi yollamıyordu; mobilden kapatılan soketler Host'a hiç haber verilmiyordu. Çözüm: `relay:peer_left` yayını eklendi.
    2. `_handleClientDisconnect(peerId)` metodu `peerId` parametresi olarak WebRTC `conn.peer` ID'sini alıyor, ancak oyun motorundaki oyuncu ID'si `p_session...` formatında olduğundan `players.find(p => p.id === peerId)` eşleşmeyip sessizce çıkıyordu. Çözüm: `conn.peer` -> `playerId` haritalaması ve çoklu kimlik çözümlemesi eklendi.
    3. Host üzerinde oyuncu etkinlik süresini (`_playerLastActivity`) periyodik denetleyen bir liveness watchdog yoktu. Çözüm: 6 saniye boyunca hiçbir kanaldan ping/aksiyon yollamayan aktif oyuncuları otomatik "disconnecting" durumuna alan canlılık bekçisi eklendi.
    4. Render WS proxy ham ping frame'lerini yuttuğu için `missedPings >= 3` öldürücüsü yerine uygulama düzeyinde JSON `relay:keepalive` ve 60sn oda grace period'u kalıcı hale getirildi.
- **Date / Session:** 2026-09-13 (Oturum 2)
  - **Mistake Made:** Host sayfayı yenilediğinde (F5) oyuna tekrar giremiyor, lobiye veya "Oda bulunamadı" / "Odaya Bağlanılıyor..." ekranına kilitleniyordu. Ayrıca Host yenilerken client'lara anında `HOST_DROPPED` gidip tüm oyunu kapatıyordu.
  - **User Feedback:** "host f5 atinca oyuna bir daha giremiyor digerleri f5 atinca tekrar girip devam edebiliyor ama host yapinca olmuyor oyunu bozmadan düzelt bunu"
  - **Root Cause & Prevention Rule:**
    1. `HostPeerService.destroy()` `beforeunload` tetiklendiğinde koşulsuz olarak tüm client'lara `HOST_DROPPED` yayınlıyordu. Çözüm: `destroy(isPermanent = false)` eklendi; F5 veya geçici sekme yenilemede (`isPermanent === false`) soketler sessizce kapatılır, client'lar 30 saniyelik toleransla bekler.
    2. `Lobby.jsx` URL'de `?room=CODE` gördüğünde `onJoinRoom` çağırarak Host'u bir Client gibi odaya bağlamaya çalışıyordu (kendine bağlanamayan istemci "Odaya Bağlanılıyor..."da takılıyordu). Çözüm: `Lobby.jsx` ve `App.jsx` içinde `muteahhit_is_host_CODE` ve `muteahhit_host_state_CODE` denetimi yapılarak Host doğrudan `onCreateRoom` üzerinden aynı oda kodu ve kaydedilmiş tam oyun durumu ile ayağa kaldırılır.
    3. `MonopolyGame.loadState()` metodu eklenerek tüm mülkler, evler/oteller, ipotekler, oyuncu bakiyeleri, tur sırası, açık artırma ve desteler F5 sonrası 0ms içinde eksiksiz restore edildi.
    4. PeerJS sinyal sunucusunda eski Host ID'sinin serbest kalması 1-2sn sürdüğünde `unavailable-id` hatası fırlatılıyordu; eski kod yeni rastgele oda kodu türetiyordu. Çözüm: Host F5 / migration durumunda oda kodu asla değiştirilmez; oyun kesintisiz WebSocket Relay üzerinden devam ederken WebRTC 2sn sonra aynı ID ile yeniden denenir.

- **Date / Session:** 2026-09-09
  - **Mistake Made:** `boardData.js` dosyasında `BOARD_TILES.forEach(tile => tile.image = createTileIllustration(tile))` kodu kullanılarak kullanıcının indirdiği yerel Ankara fotoğrafları siyah vektör görselleriyle ezildi; ayrıca tahta karelerinin içine küçük siyah kutu çerçeveleri kondu.
  - **User Feedback:** "koydugun fotolar calismiyor böyle bos gözüküyor", sonrasında "fiyatin üstünde yazan resimleri kaldir kartlar sade olsun arka planda hafif resim gözüküyor ya o kalsin ve karta tiklayinca gelen resim kalsin".
  - **Root Cause & Prevention Rule:** `tile.image` atamaları sunucu tarafında asla programatik SVG ile ezilmemeli; tahta kareleri minimal tutulup detay görseller sadece modal ve arka plan olarak sunulmalıdır.

