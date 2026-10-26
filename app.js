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
  const s = students.find(x => x.id === selected) || students[0];
  $('studentName').textContent = s.name;
  $('studentMeta').textContent = s.meta;
  $('studentAvatar').textContent = s.name[0];
  const list = records.filter(n => n.studentId === selected && n.role === role).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  $('noteCount').textContent = list.length + ' catatan';
  $('emptyState').style.display = list.length ? 'none' : 'block';
  $('notesList').innerHTML = list.map(n =>
    '<article class="note"><div class="note-top"><span class="note-role">' + escapeHtml(roles[n.role]?.title || n.role) + ' · ' + escapeHtml(n.category) + '</span><time>' +
    escapeHtml(new Date(n.createdAt).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})) +
    '</time></div><h3>' + escapeHtml(n.category) + '</h3><p>' + escapeHtml(n.text) + '</p>' +
    (n.nextStep ? '<div class="next"><strong>Tindak lanjut</strong><p>' + escapeHtml(n.nextStep) + '</p></div>' : '') +
    '</article>'
  ).join('');
}
$('studentSelect').innerHTML = students.map(s => '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>').join('');
$('studentSelect').addEventListener('change', render);
document.querySelectorAll('[data-open-role]').forEach(button => button.addEventListener('click', () => openRole(button.dataset.openRole)));
$('homeBtn').addEventListener('click', goHome);

$('noteForm').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('noteText').value.trim();
  if (!text || !role) return;
  const n = {id:Date.now().toString(),studentId:student(),role,category:$('category').value,text,nextStep:$('nextStep').value.trim(),createdAt:new Date().toISOString()};
  records.push(n);
  if (!persist()) {
    records.pop();
    $('formMessage').textContent = 'Penyimpanan gagal. Periksa ruang penyimpanan browser.';
    return;
  }
  $('noteText').value = '';
  $('nextStep').value = '';
  $('formMessage').textContent = 'Catatan disimpan di perangkat ini.';
  render();
});

$('exportBtn').addEventListener('click', () => {
  const roleRecords = records.filter(n => n.role === role);
  const blob = new Blob([JSON.stringify({app:'Meuseuraya Inklusi Prototype',version:2,role,exportedAt:new Date().toISOString(),records:roleRecords},null,2)], {type:'application/json'});
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
  if (!role || !confirm('Hapus semua catatan untuk ' + roles[role].title + ' di browser ini? Catatan peran lain tidak akan dihapus.')) return;
  const previous = records;
  records = records.filter(n => n.role !== role);
  if (!persist()) {
    records = previous;
    $('formMessage').textContent = 'Penghapusan gagal karena penyimpanan browser bermasalah.';
    return;
  }
  render();
  $('formMessage').textContent = 'Catatan untuk ruang ini telah dihapus dari perangkat.';
});

function connection() {
  const message = navigator.onLine ? 'Online · data tetap lokal' : 'Offline · aplikasi tetap dapat dibuka';
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