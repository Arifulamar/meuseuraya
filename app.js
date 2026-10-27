'use strict';
const $ = id => document.getElementById(id);
const students = [
  {id:'sim-001',name:'Aisyah (Simulasi)',meta:'Kelas 2 · Profil contoh'},
  {id:'sim-002',name:'Rafi (Simulasi)',meta:'Kelas 3 · Profil contoh'},
  {id:'sim-003',name:'Nadia (Simulasi)',meta:'Kelas 1 · Profil contoh'}
];
const roles = {
  guru:{title:'Ruang Guru',kicker:'CATATAN SEKOLAH',icon:'📘',description:'Catat observasi pembelajaran dan strategi yang dicoba di sekolah.',categories:['Observasi pembelajaran','Partisipasi dan interaksi','Strategi yang dicoba','Perkembangan keterampilan']},
  orangtua:{title:'Ruang Orang Tua',kicker:'CATATAN DI RUMAH',icon:'🏡',description:'Bagikan rutinitas belajar, aktivitas di rumah, dan tanggapan terhadap strategi sekolah.',categories:['Rutinitas belajar','Aktivitas di rumah','Hal yang membantu anak','Tanggapan untuk guru']},
  psikolog:{title:'Ruang Psikolog',kicker:'TINJAUAN PROFESIONAL',icon:'🧠',description:'Catat telaah profesional berdasarkan informasi yang diizinkan. Bukan diagnosis otomatis.',categories:['Telaah informasi yang diizinkan','Rekomendasi untuk ditinjau','Pertanyaan tindak lanjut','Rencana kolaborasi']}
};
const KEY = 'meuseuraya-inklusi-pwa-v1';
let role = null;
let promptEvent = null;
let records = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } })();

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function student() { return $('studentSelect').value; }
async function loadChildren() {
  const select = $('studentSelect');
  select.innerHTML = '<option value="">Memuat siswa…</option>';
  const { data: memberships, error: membershipError } = await supabaseClient
    .from('child_memberships')
    .select('child_id')
    .eq('user_id', signedInUser.id)
    .eq('can_read', true);
  if (membershipError) throw membershipError;

  const childIds = [...new Set((memberships || []).map(row => row.child_id).filter(Boolean))];
  if (!childIds.length) {
    cloudChildren = [];
    select.innerHTML = '<option value="">Belum ada penugasan siswa</option>';
    $('studentName').textContent = 'Belum ada penugasan';
    $('studentMeta').textContent = 'Akun ini belum ditugaskan ke anak simulasi.';
    $('studentAvatar').textContent = '?';
    return;
  }

  const { data: children, error: childrenError } = await supabaseClient
    .from('children')
    .select('id,display_label,class_label')
    .in('id', childIds)
    .is('archived_at', null)
    .order('display_label');
  if (childrenError) throw childrenError;

  cloudChildren = children || [];
  const previous = select.value;
  select.innerHTML = cloudChildren.map(c => '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.display_label) + '</option>').join('');
  if (cloudChildren.some(c => c.id === previous)) select.value = previous;
  if (!cloudChildren.length) {
    select.innerHTML = '<option value="">Data siswa belum dapat diakses</option>';
    $('studentName').textContent = 'Data siswa belum dapat diakses';
    $('studentMeta').textContent = 'Periksa penugasan dan kebijakan akses Supabase.';
    $('studentAvatar').textContent = '?';
  }
}
async function loadCloudNotes() {
  if (!student()) { cloudNotes = []; render(); return; }
  const { data, error } = await supabaseClient.from('notes')
    .select('id,child_id,author_id,kind,title,body,next_step,created_at')
    .eq('child_id', student()).is('deleted_at', null).order('created_at', {ascending:false});
  if (error) throw error;
  cloudNotes = data || [];
  render();
}
async function loadNotifications() {
  const { data, error } = await supabaseClient.from('notifications')
    .select('id,recipient_id,child_id,title,message,related_note_id,read_at,created_at')
    .eq('recipient_id', signedInUser.id).order('created_at', {ascending:false}).limit(50);
  if (error) throw error;
  notificationItems = data || [];
  renderNotifications();
}
function renderNotifications() {
  const badge = $('notificationCount'), list = $('notificationList');
  if (!badge || !list) return;
  const unread = notificationItems.filter(n => !n.read_at).length;
  badge.textContent = unread > 99 ? '99+' : String(unread);
  badge.classList.toggle('hidden', unread === 0);
  list.innerHTML = notificationItems.length ? notificationItems.map(n =>
    '<button type="button" class="notification-item ' + (n.read_at ? '' : 'unread') + '" data-notification-id="' + escapeHtml(n.id) + '"><strong>' + escapeHtml(n.title) + '</strong><span>' + escapeHtml(n.message) + '</span><small>' + escapeHtml(new Date(n.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})) + '</small></button>'
  ).join('') : '<p class="muted small">Belum ada notifikasi.</p>';
  list.querySelectorAll('[data-notification-id]').forEach(button => button.addEventListener('click', async () => {
    const item = notificationItems.find(n => n.id === button.dataset.notificationId);
    if (!item) return;
    if (!item.read_at) {
      const now = new Date().toISOString();
      const { error } = await supabaseClient.from('notifications').update({read_at:now}).eq('id',item.id).eq('recipient_id',signedInUser.id);
      if (error) { setAuthMessage('Gagal menandai notifikasi: ' + error.message); return; }
      item.read_at = now; renderNotifications();
    }
    if (item.child_id && cloudChildren.some(c => c.id === item.child_id)) {
      $('studentSelect').value = item.child_id;
      if (role) { try { await loadCloudNotes(); } catch (e) { setAuthMessage('Gagal memuat catatan: ' + e.message); } }
    }
    $('notificationPanel').classList.remove('open');
  }));
}
if ($('notificationBell')) $('notificationBell').addEventListener('click', () => $('notificationPanel').classList.toggle('open'));
async function startNotificationRealtime() {
  if (notificationChannel) await supabaseClient.removeChannel(notificationChannel);
  notificationChannel = supabaseClient.channel('meuseuraya-notifications-' + signedInUser.id)
    .on('postgres_changes', {event:'INSERT',schema:'public',table:'notifications',filter:'recipient_id=eq.' + signedInUser.id}, payload => {
      notificationItems.unshift(payload.new);
      notificationItems = notificationItems.slice(0,50);
      renderNotifications();
    }).subscribe();
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(records)); return true; }
  catch { return false; }
}
function openRole(next) {
  if (!roles[next]) return;
  role = next;
  const r = roles[role];
  $('homeView').classList.add('hidden');
  $('workspaceView').classList.remove('hidden');
  $('homeBtn').classList.remove('hidden');
  $('roleKicker').textContent = r.kicker;
  $('roleTitle').textContent = r.title;
  $('roleIcon').textContent = r.icon;
  $('roleDescription').textContent = r.description;
  $('category').innerHTML = r.categories.map(c => '<option>' + escapeHtml(c) + '</option>').join('');
  $('formMessage').textContent = '';
  render();
  if (supabaseClient && signedInUser) loadCloudNotes().catch(error => { $('formMessage').textContent = 'Gagal memuat catatan: ' + error.message; });
  window.scrollTo(0, 0);
}
function goHome() {
  role = null;
  $('workspaceView').classList.add('hidden');
  $('homeView').classList.remove('hidden');
  $('homeBtn').classList.add('hidden');
  window.scrollTo(0, 0);
}
function render() {
  const selected = student();
  const s = cloudChildren.find(x => x.id === selected);
  $('studentName').textContent = s?.display_label || 'Belum ada penugasan';
  $('studentMeta').textContent = s ? (s.class_label || 'Anak yang ditugaskan') : 'Hubungi administrator untuk penugasan anak.';
  $('studentAvatar').textContent = (s?.display_label || '?')[0];
  const list = cloudNotes.filter(n => n.child_id === selected).sort((a,b) => b.created_at.localeCompare(a.created_at));
  $('noteCount').textContent = list.length + ' catatan';
  $('emptyState').style.display = list.length ? 'none' : 'block';
  $('notesList').innerHTML = list.map(n =>
    '<article class="note"><div class="note-top"><span class="note-role">' + escapeHtml(n.kind) + '</span><time>' +
    escapeHtml(new Date(n.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})) +
    '</time></div><h3>' + escapeHtml(n.title) + '</h3><p>' + escapeHtml(n.body) + '</p>' +
    (n.next_step ? '<div class="next"><strong>Tindak lanjut</strong><p>' + escapeHtml(n.next_step) + '</p></div>' : '') +
    '</article>'
  ).join('');
}
$('studentSelect').addEventListener('change', async () => { try { await loadCloudNotes(); } catch (e) { $('formMessage').textContent = 'Gagal memuat catatan: ' + e.message; } });
document.querySelectorAll('[data-open-role]').forEach(button => button.addEventListener('click', () => openRole(button.dataset.openRole)));
$('homeBtn').addEventListener('click', goHome);

$('noteForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = $('noteText').value.trim();
  if (!body || !role || !signedInUser || !student()) {
    $('formMessage').textContent = 'Pilih anak yang ditugaskan dan pastikan akun aktif.';
    return;
  }
  const button = $('noteForm').querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const kind = role === 'orangtua' ? 'aktivitas_rumah' : role === 'psikolog' ? 'rekomendasi' : 'observasi';
    const { data, error } = await supabaseClient.from('notes').insert({
      child_id: student(), author_id: signedInUser.id, kind,
      title: $('category').value, body, next_step: $('nextStep').value.trim() || null
    }).select('id,child_id,author_id,kind,title,body,next_step,created_at').single();
    if (error) throw error;
    cloudNotes.unshift(data);
    $('noteText').value = ''; $('nextStep').value = '';
    $('formMessage').textContent = 'Catatan tersimpan di Supabase. Notifikasi dibuat otomatis untuk anggota yang ditugaskan.';
    render();
  } catch (error) {
    console.error(error);
    $('formMessage').textContent = 'Catatan belum tersimpan: ' + (error.message || 'periksa penugasan dan kebijakan akses.');
  } finally { button.disabled = false; }
});

$('exportBtn').addEventListener('click', () => {
  const roleRecords = cloudNotes.filter(n => n.child_id === student());
  const blob = new Blob([JSON.stringify({app:'Meuseuraya Inklusi',version:3,role,exportedAt:new Date().toISOString(),records:roleRecords},null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meuseuraya-' + role + '-simulasi.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('clearBtn').addEventListener('click', () => {
  $('formMessage').textContent = 'Penghapusan catatan cloud dinonaktifkan di prototipe untuk mencegah kehilangan data.';
});

function connection() {
  const message = navigator.onLine ? 'Online · data tersinkron melalui Supabase' : 'Offline · pengiriman catatan memerlukan internet';
  $('connectionStatus').textContent = message;
  $('homeConnectionStatus').textContent = message;
}
window.addEventListener('online', connection);
window.addEventListener('offline', connection);
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  promptEvent = e;
  $('installBtn').classList.remove('hidden');
});
$('installBtn').addEventListener('click', async () => {
  if (!promptEvent) return;
  promptEvent.prompt();
  await promptEvent.userChoice;
  promptEvent = null;
  $('installBtn').classList.add('hidden');
});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}
connection();

// Supabase authentication gate. Notes remain local-only until cloud sync is implemented.
let supabaseClient = null;
let signedInUser = null;
let signedInProfile = null;
let cloudChildren = [];
let cloudNotes = [];
let notificationItems = [];
let notificationChannel = null;
function setAuthMessage(message) { const el = $('authMessage'); if (el) el.textContent = message; }
function showAuthOnly() {
  $('authView').classList.remove('hidden');
  $('homeView').classList.add('hidden');
  $('workspaceView').classList.add('hidden');
  $('homeBtn').classList.add('hidden');
  $('logoutTopBtn').classList.add('hidden');
  $('signedInLabel').classList.add('hidden');
  $('notificationWrap').classList.add('hidden');
}
function showSignedIn() {
  $('authView').classList.add('hidden');
  $('homeView').classList.remove('hidden');
  $('signedInLabel').textContent = signedInUser.email || 'Akun aktif';
  $('signedInLabel').classList.remove('hidden');
  $('logoutTopBtn').classList.remove('hidden');
  $('notificationWrap').classList.remove('hidden');
  // Display only the workspace matching the profile role; role assignment is not user-editable.
  document.querySelectorAll('[data-open-role]').forEach(btn => {
    btn.classList.toggle('hidden', btn.dataset.openRole !== signedInProfile?.role);
  });
  if (!['guru','orangtua','psikolog'].includes(signedInProfile?.role)) {
    $('homeView').classList.add('hidden');
    setAuthMessage('Akun belum memiliki peran kerja yang ditetapkan. Hubungi administrator.');
    $('authView').classList.remove('hidden');
    $('logoutBtn').classList.remove('hidden');
    $('loginForm').classList.add('hidden');
    return;
  }
  $('loginForm').classList.add('hidden');
  $('logoutBtn').classList.remove('hidden');
  setAuthMessage('Berhasil masuk. Peran akun: ' + signedInProfile.role + '.');
  Promise.all([loadChildren(), loadNotifications()]).then(() => startNotificationRealtime()).catch(error => { console.error(error); const message = error?.message || 'Kesalahan tidak diketahui'; const select = $('studentSelect'); if (select && select.innerHTML.includes('Memuat siswa')) select.innerHTML = '<option value="">Gagal memuat siswa</option>'; if ($('studentMeta')) $('studentMeta').textContent = 'Gagal memuat data: ' + message; setAuthMessage('Login berhasil, tetapi data belum bisa dimuat: ' + message); });
}
async function loadProfile(user) {
  const { data, error } = await supabaseClient.from('profiles').select('id,display_name,role').eq('id', user.id).single();
  if (error) throw error;
  return data;
}
async function acceptSession(session) {
  if (!session?.user) {
    signedInUser = null; signedInProfile = null;
    $('loginForm').classList.remove('hidden');
    $('logoutBtn').classList.add('hidden');
    showAuthOnly();
    setAuthMessage('Silakan masuk menggunakan akun Supabase.');
    return;
  }
  signedInUser = session.user;
  try {
    signedInProfile = await loadProfile(session.user);
    showSignedIn();
  } catch (error) {
    console.error(error);
    showAuthOnly();
    setAuthMessage('Login terdeteksi, tetapi profil gagal dimuat. Periksa tabel profiles dan koneksi.');
  }
}
if (window.supabase && window.MEUSEURAYA_SUPABASE_CONFIG &&
    window.MEUSEURAYA_SUPABASE_CONFIG.url.startsWith('https://') &&
    window.MEUSEURAYA_SUPABASE_CONFIG.anonKey) {
  supabaseClient = window.supabase.createClient(
    window.MEUSEURAYA_SUPABASE_CONFIG.url,
    window.MEUSEURAYA_SUPABASE_CONFIG.anonKey,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('loginButton');
    button.disabled = true;
    setAuthMessage('Memeriksa akun…');
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: $('loginEmail').value.trim(),
        password: $('loginPassword').value
      });
      if (error) throw error;
      await acceptSession(data.session);
    } catch (error) {
      setAuthMessage('Gagal masuk. Periksa email/kata sandi dan pengaturan Auth. (' + (error.message || 'kesalahan') + ')');
    } finally { button.disabled = false; }
  });
  async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) { setAuthMessage('Gagal keluar: ' + error.message); return; }
    await acceptSession(null);
  }
  $('logoutBtn').addEventListener('click', logout);
  $('logoutTopBtn').addEventListener('click', logout);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    // Avoid awaiting Supabase calls inside the auth callback.
    setTimeout(() => acceptSession(session), 0);
  });
  supabaseClient.auth.getSession().then(({data, error}) => {
    if (error) { showAuthOnly(); setAuthMessage('Gagal memeriksa sesi: ' + error.message); }
    else acceptSession(data.session);
  });
} else {
  showAuthOnly();
  setAuthMessage('Konfigurasi Supabase atau pustaka login belum tersedia. Periksa koneksi internet dan supabase-config.js.');
}
