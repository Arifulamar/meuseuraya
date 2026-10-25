# Meuseuraya Inklusi PWA v1

Prototipe kolaborasi triadik guru, orang tua, dan psikolog dengan data simulasi, penyimpanan browser, ekspor JSON, manifest PWA, dan service worker.

## Coba lokal
Jalankan `python3 -m http.server 8000` dari folder `pwa-v1`, lalu buka `http://localhost:8000`.

## GitHub Pages
Di repo GitHub, buka Settings → Pages. Pilih Deploy from a branch, branch `main`, folder `/ (root)` jika ingin menerbitkan root repo. Versi ini berada di subfolder `pwa-v1`; jika Pages aktif untuk repo, coba URL `/pwa-v1/`. Pastikan konfigurasi Pages sesuai kebijakan repositori.

## Batasan keselamatan
Data hanya tersimpan di browser/perangkat ini, tidak dienkripsi dan tidak tersinkron. Pemilihan peran bukan autentikasi. Gunakan data simulasi saja. Jangan masukkan data siswa nyata sampai tersedia login, otorisasi server, persetujuan, enkripsi, audit, backup, dan kebijakan retensi yang sesuai. Catatan psikolog bukan diagnosis otomatis.