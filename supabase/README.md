# Backend Meuseuraya Inklusi (Supabase)

## Status
Ini adalah fondasi backend, bukan sistem produksi yang sudah siap dipakai untuk data anak. Frontend GitHub Pages belum terhubung sampai konfigurasi proyek Supabase ditambahkan dan diuji.

## 1. Buat proyek
1. Buat proyek di https://supabase.com/.
2. Simpan Project URL dan anon/publishable key.
3. Jangan pernah menaruh service_role key di frontend atau GitHub.
4. Buka SQL Editor dan jalankan `schema.sql` setelah meninjau kebijakan akses.

## 2. Profil dan peran
Tabel `profiles` memuat peran: guru, orangtua, psikolog, admin. Pembuatan/penetapan peran tidak boleh mempercayai input dari browser. Gunakan alur server tepercaya untuk membuat profil dan menetapkan peran. Jangan membuat kebijakan agar pengguna bisa mengubah role-nya sendiri.

## 3. Penetapan akses siswa
Buat baris `child_memberships` hanya melalui proses admin/server tepercaya setelah hubungan dan persetujuan diverifikasi. Setiap pengguna hanya dapat melihat anak yang ditugaskan kepadanya. Kebijakan RLS menolak pembacaan catatan tanpa keanggotaan yang eksplisit.

## 4. Frontend
- Project URL dan anon/publishable key boleh berada di frontend; keduanya bukan rahasia, tetapi harus dilindungi oleh RLS.
- Jangan menambahkan service_role key ke file JS, HTML, repository, atau GitHub Pages.
- Login, logout, reset password, dan pengambilan profil perlu diintegrasikan dan diuji sebelum mengganti pilihan peran demo.
- Data lokal yang ada tidak otomatis disinkronkan. Migrasi lokal ke cloud harus menjadi tindakan sadar pengguna, dengan konfirmasi dan validasi.

## 5. Sinkronisasi dan notifikasi
- Gunakan Realtime untuk menyegarkan catatan/notifikasi yang memang boleh diakses pengguna.
- Notifikasi dalam aplikasi dapat disimpan di tabel `notifications`.
- Buat notifikasi melalui Edge Function atau backend tepercaya setelah memverifikasi hak akses; jangan izinkan browser mengirim notifikasi ke sembarang user.
- Push notification iPhone memerlukan PWA yang memenuhi persyaratan iOS, izin pengguna, service worker push, VAPID dan endpoint server. Ini tahap terpisah dari notifikasi dalam aplikasi.

## 6. Offline
Pertahankan cache aset statis pada service worker. Untuk catatan offline yang nanti disinkronkan, tambahkan antrean lokal dengan ID unik, status pending/synced, retry idempoten, penanganan konflik, serta pilihan logout yang tidak membocorkan data lokal ke pengguna perangkat berikutnya.

## 7. Sebelum data nyata
Lakukan review keamanan, uji RLS menggunakan akun masing-masing peran, backup/restore, audit log, persetujuan orang tua, minimisasi data, retensi/penghapusan, dan prosedur insiden. Jangan masukkan data siswa/psikologi nyata selama konfigurasi ini belum diverifikasi.
