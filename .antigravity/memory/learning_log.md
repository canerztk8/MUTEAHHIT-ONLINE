# Project Learnings & Anti-Pattern Log

## Active Rules & Hard Constraints
- [RULE-TILE-ASSETS]: Tüm tahta kareleri (0-39) için `/images/tiles/tile_{id}.jpg` yerel statik fotoğrafları kullanılır. `createTileIllustration` gibi karartıcı SVG üreticileriyle veya harici Unsplash linkleriyle asla ezilmemelidir.
- [RULE-BOARD-MINIMALISM]: Oyun cardboard tahtası üzerindeki karelerde (paranın üstünde) küçük iç çerçeve/resim kutuları yer almaz; kartlar sade kalmalıdır. Karelerin zeminindeki hafif saydam atmosferik arka plan fotoğrafı ve karta tıklandığında açılan detaylı modal fotoğrafları korunmalıdır.
- [RULE-GAME-MECHANICS]: Refaktör veya temizlik yapılırken hiçbir kural, oyun dengesi veya test senaryosu (34 testGameRules, 11 testNewBalanceMechanics, 7 testDicePhysics) bozulmamalıdır.
- [RULE-GIT-NO-AUTOPUSH]: Değişiklikler yapıldıktan sonra ASLA otomatik `git push` yapılmaz. Tüm işlemler yerelde (local) test edilip bırakılır. Sadece kullanıcı açıkça "pushla" dediğinde `git push` çalıştırılır.

## Incident & Correction History
- **Date / Session:** 2026-09-10
  - **Correction:** Kullanıcı otomatik push yapılmasını kesin olarak yasakladı.
  - **Rule:** Tüm değişiklikler yerelde kalacak, toplu test edilecek; sadece kullanıcı "pushla" talimatı verince pushlanacak.
- **Date / Session:** 2026-09-09
  - **Mistake Made:** `boardData.js` dosyasında `BOARD_TILES.forEach(tile => tile.image = createTileIllustration(tile))` kodu kullanılarak kullanıcının indirdiği yerel Ankara fotoğrafları siyah vektör görselleriyle ezildi; ayrıca tahta karelerinin içine küçük siyah kutu çerçeveleri kondu.
  - **User Feedback:** "koydugun fotolar calismiyor böyle bos gözüküyor", sonrasında "fiyatin üstünde yazan resimleri kaldir kartlar sade olsun arka planda hafif resim gözüküyor ya o kalsin ve karta tiklayinca gelen resim kalsin".
  - **Root Cause & Prevention Rule:** `tile.image` atamaları sunucu tarafında asla programatik SVG ile ezilmemeli; tahta kareleri minimal tutulup detay görseller sadece modal ve arka plan olarak sunulmalıdır.

