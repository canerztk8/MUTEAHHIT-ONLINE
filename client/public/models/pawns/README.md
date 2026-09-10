# 3D Piyon Modelleri (Custom Pawn Models)

Bu dizin, oyundaki oyuncu piyonları için kendi özel 3D `.glb` veya `.gltf` modellerinizi ekleyebileceğiniz yerdir.

## Nasıl Kullanılır?
1. 3D model dosyanızı `.glb` formatında dışa aktarın (Blender, Sketchfab vb.).
2. Modeli bu klasöre aşağıdaki isimlerden biriyle kaydedin:
   - `hard_hat.glb` -> Sarı Baret piyonu yerine geçer.
   - `sports_car.glb` -> Kırmızı Spor Araba piyonu yerine geçer.
   - `sneaker.glb` -> Retro Spor Ayakkabı piyonu yerine geçer.
   - `warship_ww12_us_dd.glb` -> Savaş Gemisi (Destroyer) piyonu yerine geçer.
   - `roman_sphinx.glb` -> Roma Sfenksi piyonu yerine geçer.
   - `scooter.glb` -> Retro Şehir Scooterı piyonu yerine geçer.
   - `suv.glb` -> Arazi Aracı / Araba piyonu yerine geçer.
   - `excavator.glb` -> Kepçe / İş Makinesi yerine geçer.
   - `train.glb` -> Hızlı Tren yerine geçer.

## Otomatik Optimizasyonlar
- **Otomatik Ölçeklendirme:** Modelinizin boyutu ne olursa olsun oyun motoru otomatik olarak `Box3` ile piyon boyutuna (~0.65 birim) normalize eder.
- **Oyuncu Rengi Kaplama:** Modelin üzerindeki ana materyaller otomatik olarak oyuncunun rengine boyanır.
- **Fallback Güvencesi:** Eğer bir model bulunamazsa veya henüz eklenmemişse, oyun otomatik olarak yerleşik şık prosedürel 3D metalik piyonu kullanır.

## Lisans ve Model Atıfları (Attributions & Credits)
- **Kırmızı Spor Araba (sports_car.glb):** Karol Miklas ([CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/))
- **Retro Spor Ayakkabı (sneaker.glb):** makoto ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- **Retro Şehir Scooterı (scooter.glb):** minghauLoh ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- **Savaş Gemisi & Diğer Modeller:** Açık kaynak 3D topluluk modelleri ([CC-BY](https://creativecommons.org/licenses/by/4.0/))
