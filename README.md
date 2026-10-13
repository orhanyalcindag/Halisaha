# ⚽ Halısaha Kadro & Saha Diziliş Sistemi

Haftalık aktivasyon kodlu halısaha davet linki, WhatsApp grubu üzerinden katılım, mevkilerin seçimi ve 14 kişi tamamlandığında otomatik dengeli 7v7 kura çekimi ve görsel halısaha dizilişi web uygulaması.

---

## 🌟 Temel Özellikler

1. **🔑 Haftalık Aktivasyon Kodu & WhatsApp Davet Linki:**
   - Her hafta için benzersiz bir aktivasyon kodu (örn: `SAHA-9A4Q`) üretilir.
   - WhatsApp grubuna atılan bağlantıya (`/?kod=SAHA-9A4Q`) tıklayanlar kodu tekrar girmek zorunda kalmadan doğrudan o haftanın maç odasına girer.
2. **🧤 Çoklu Mevki Seçimi:**
   - **Kaleci:** Tekil seçimdir (seçildiğinde diğer mevkiler kapanır).
   - **Defans, Orta Saha, Forvet:** Oyuncular aynı anda birden fazla mevki seçebilir (örn: *Defans + Orta Saha*).
3. **🎲 Otomatik & Dengeli 7v7 Kadro Dağıtımı:**
   - 14. oyuncu katıldığı anda sistem mevkileri ve çoklu mevki esnekliklerini dikkate alarak iki takımı eşit ve rastgele şekilde kurar.
   - **🔴 A Takımı (Kırmızı Forma - 7 Kişi)**
   - **🟢 B Takımı (Yeşil Forma - 7 Kişi)**
4. **🏟️ Görsel Halısaha & Numaralı Formalar:**
   - İki takım sahadaki gerçek pozisyonlarına numaralı Kırmızı ve Yeşil formalarla yerleşir.
   - Tam Saha (Karşılıklı) ve Yarı Saha (Taktik Tahtası) görünüm seçenekleri.
   - İki takım oyuncusuna tıklayarak aralarında oyuncu takası (yer değişikliği) yapabilme.
5. **📲 WhatsApp Kadro Paylaşımı:**
   - Dağıtılan A ve B takımı kadrolarını tek tıkla WhatsApp mesaj formatında kopyalama.
6. **⚙️ Organizatör / Yönetici Paneli (`PIN: 1234`):**
   - Yeni hafta maçı oluşturma ve yeni kod üretme.
   - Maç tarihi, saati ve saha adını düzenleme.
   - İptal eden oyuncuyu listeden çıkarma veya kadroları yeniden dağıtma.
   - Tek tıkla hızlı test (14 kişiyi doldurma).

---

## 🚀 Yerel Olarak Çalıştırma

```bash
# Projeyi başlatın
npm start
```

Tarayıcınızda açın:
- **Ana Sayfa:** `http://localhost:3000`
- **WhatsApp Linki Örneği:** `http://localhost:3000/?kod=SAHA-9A4Q`
- **Organizatör PIN:** `1234`

---

## ☁️ Vercel'e Dağıtım (Deploy to Vercel)

Proje Vercel için `vercel.json` ve `api/index.js` (Serverless Function) yapılandırmasına sahiptir.

### 1. GitHub Üzerinden Vercel'e Bağlama (Önerilen)
1. Bu projeyi GitHub hesabınızda yeni bir repoya yükleyin.
2. [Vercel Dashboard](https://vercel.com/dashboard) adresine gidin.
3. **"Add New Project"** diyerek GitHub reponuzu seçin.
4. **Deploy** butonuna basın.

### 2. Vercel KV / Upstash Redis ile Kalıcı Veritabanı (İsteğe Bağlı)
Vercel serverless ortamında birden fazla gün ve cihaz arasında maç verilerinin kalıcı olması için:
- Vercel projenizde **Storage** sekmesinden 1 tıkla **Vercel KV (veya Upstash Redis)** ekleyebilirsiniz.
- Sistem `KV_REST_API_URL` ve `KV_REST_API_TOKEN` değişkenlerini otomatik tanır ve verileri bulutta depolar.
