import React from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

export function LegalModal({ type, onClose }) {
  if (!type) return null;

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Gizlilik Politikası ve KVKK Bildirimi' : 'Kullanım Koşulları';
  const Icon = isPrivacy ? ShieldCheck : FileText;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">Müteahhit Online Hizmet Standardı</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 text-xs leading-relaxed space-y-4 text-slate-300 overflow-y-auto pr-1">
          {isPrivacy ? (
            <>
              <section className="space-y-1.5">
                <h4 className="font-semibold text-white text-sm">1. Veri Sorumlusu ve Kapsam</h4>
                <p>
                  Bu bildirim, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ilgili mevzuat uyarınca,
                  Müteahhit Online web platformunu kullanan oyuncuların kişisel veri güvenliğine ilişkin haklarını açıklar.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-white text-sm">2. Tarayıcı Yerel Depolaması (LocalStorage)</h4>
                <p>
                  Platform, üçüncü taraf reklam çerezi veya izleme kodu kullanmaz. Yalnızca oyun oturumunun sürdürülebilmesi,
                  bağlantı kopması durumunda oyuncunun masaya geri dönebilmesi ve ses/tema tercihlerinin hatırlanması amacıyla
                  tarayıcınızın yerel depolama (<code className="font-mono bg-slate-800 px-1 py-0.5 rounded text-amber-400">localStorage</code>)
                  alanında takma ad ve oturum belirteci saklanır.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-white text-sm">3. P2P WebRTC Ağ Mimarisi</h4>
                <p>
                  Müteahhit Online, çok oyunculu oyun deneyimini eşler arası (Peer-to-Peer / WebRTC DataChannel) teknolojisi ile sağlar.
                  Bir odaya katıldığınızda, WebRTC el sıkışması gereği IP adresiniz oda dahilindeki yetkili sunucu/host ve diğer oyuncularla
                  doğrudan ağ bağlantısı kurmak üzere teknik bir zorunluluk olarak paylaşılır.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-white text-sm">4. Veri Saklama ve Haklarınız</h4>
                <p>
                  Oyun kayıtları, oturum sonlandığında veya oda kapatıldığında bellekten temizlenir. Herhangi bir kişisel bilginizin
                  silinmesini istediğinizde tarayıcı önbelleğinizi ve site verilerinizi temizlemeniz yeterlidir.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-1.5">
                <h4 className="font-semibold text-white text-sm">1. Hizmetin Niteliği</h4>
                <p>
                  Müteahhit Online, arkadaş grupları ve açık odalarda oynanabilen Ankara temalı, tarayıcı tabanlı bir kutu oyunudur.
                  Oyun içi para birimleri, tapular ve varlıklar yalnızca simülasyon amaçlı olup gerçek finansal değeri bulunmamaktadır.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-white text-sm">2. Adil Oyun ve Topluluk Kuralları</h4>
                <p>
                  Tüm oyuncuların adil ve keyifli bir deneyim yaşaması esastır. Hile girişimleri, istemci manipülasyonu,
                  sohbet alanında hakaret, küfür, nefret söylemi veya taciz edici içerik paylaşımı kesinlikle yasaktır.
                  Oda kurucusu, kuralları ihlal eden kullanıcıları odadan uzaklaştırma yetkisine sahiptir.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-white text-sm">3. Fikri Mülkiyet ve Marka</h4>
                <p>
                  Platformda yer alan özgün tasarımlar, 3D modeller ve kod mimarisi Müteahhit Online projesine aittir.
                  Oyun resmi kuralları kamuya açık kutu oyunu standartları ile uyumlu şekilde tasarlanmıştır.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Anladım, Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
