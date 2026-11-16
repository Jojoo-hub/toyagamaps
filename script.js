'use strict';

/* =====================================================
   TOYAGAMAPS - script.js

   Aplikasi pencatat minum + peta titik Toyagama di sekitar FMIPA UGM.
   Data disimpan di localStorage (hanya di browser pengguna).

   Isi file ini:
   1. Fungsi bantu
   2. Ikon
   3. Data (titik Toyagama, tingkat aktivitas, nama hari/bulan)
   4. State (data yang disimpan + kondisi tampilan)
   5. Perhitungan (target harian, total per hari, jarak)
   6. Halaman Beranda
   7. Jendela "Tambah minum"
   8. Halaman Peta
   9. Halaman Statistik
   10. Halaman Pengaturan
   11. Tema, tab, dan fungsi render utama
   12. Event (klik, input, keyboard, pengingat)
   ===================================================== */


/* ---------- 1. FUNGSI BANTU ---------- */

// Singkatan untuk document.querySelector
const $ = (selector) => document.querySelector(selector);

// Mengamankan teks sebelum dimasukkan ke innerHTML
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

// Angka dengan format Indonesia: 1500 -> "1.500"
const numberFormatter = new Intl.NumberFormat('id-ID');
const formatNumber = (n) => numberFormatter.format(Math.round(n));

// 5 -> "05"
const pad2 = (n) => String(n).padStart(2, '0');

// Tanggal -> teks "2026-11-15". Dipakai sebagai kunci pengelompokan per hari.
function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// "06:30" -> 390 (menit sejak tengah malam)
function timeToMinutes(text) {
  const [hours, minutes] = text.split(':');
  return Number(hours) * 60 + Number(minutes);
}

// 390 -> "06:30"
function minutesToTime(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;   // jaga tetap di rentang 0-1439
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

// Pesan singkat di bawah layar, hilang sendiri setelah 2,6 detik
let toastTimer = null;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

// Mengisi isi sebuah halaman, lalu mengembalikan posisi scroll
// supaya halaman tidak melompat ke atas setiap kali di-render ulang.
function setView(selector, html) {
  const scrollY = window.scrollY;
  $(selector).innerHTML = html;
  window.scrollTo(0, scrollY);
}


/* ---------- 2. IKON ---------- */

function makeIcon(paths) {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
  drop:    makeIcon('<path d="M12 3c3.5 4.2 6 7.2 6 10.2A6 6 0 0 1 6 13.2C6 10.2 8.5 7.2 12 3z"/>'),
  home:    makeIcon('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  pin:     makeIcon('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  chart:   makeIcon('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
  sliders: makeIcon('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  plus:    makeIcon('<path d="M12 5v14M5 12h14"/>'),
  x:       makeIcon('<path d="M6 6l12 12M18 6L6 18"/>'),
  bell:    makeIcon('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>'),
  locate:  makeIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  sun:     makeIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>'),
  moon:    makeIcon('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
  auto:    makeIcon('<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>'),
  external: makeIcon('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
};

$('#mark').innerHTML = ICONS.drop;


/* ---------- 3. DATA ---------- */

// Titik Toyagama di sekitar FMIPA UGM.
// CATATAN: koordinat dan nama titik ini CONTOH. Cek di lapangan
// (atau ganti dengan data dari UGM) sebelum dirilis.
const POINTS = [
  { id: 'dekanat', name: 'Dekanat FMIPA',          short: 'Dekanat',    where: 'Lobi, lantai 1',      lat: -7.76625, lng: 110.37395 },
  { id: 'kimia',   name: 'Gedung Kimia',           short: 'Kimia',      where: 'Selasar, lantai 1',   lat: -7.76590, lng: 110.37350 },
  { id: 'mat',     name: 'Gedung Matematika',      short: 'Matematika', where: 'Lobi, lantai 1',      lat: -7.76670, lng: 110.37345 },
  { id: 'fisika',  name: 'Gedung Fisika',          short: 'Fisika',     where: 'Selasar, lantai 1',   lat: -7.76560, lng: 110.37410 },
  { id: 'ike',     name: 'Gedung IKE',             short: 'IKE',        where: 'Lobi, lantai 1',      lat: -7.76700, lng: 110.37410 },
  { id: 'geo',     name: 'Gedung Geofisika',       short: 'Geofisika',  where: 'Selasar, lantai 1',   lat: -7.76545, lng: 110.37360 },
  { id: 'timur',   name: 'Sisi timur Sekip Utara', short: 'Sisi timur', where: 'Dekat jalan masuk',   lat: -7.76610, lng: 110.37450 },
];

// Pilihan posisi awal untuk pengguna
const START_POINTS = [
  { id: 's-mat',   name: 'Gedung Matematika', lat: -7.76680, lng: 110.37330 },
  { id: 's-kimia', name: 'Gedung Kimia',      lat: -7.76595, lng: 110.37335 },
  { id: 's-ike',   name: 'Gedung IKE',        lat: -7.76715, lng: 110.37425 },
  { id: 's-fis',   name: 'Gedung Fisika',     lat: -7.76550, lng: 110.37425 },
  { id: 's-timur', name: 'Jalan masuk timur', lat: -7.76600, lng: 110.37470 },
];

const CENTER = { lat: -7.7663, lng: 110.3738 };

// true = tampilkan Google Maps di bawah peta skematis (hanya jika di-hosting sendiri)
const EMBED_GOOGLE = false;

// Tingkat aktivitas: "add" = tambahan target air (mL)
const ACTIVITIES = [
  { id: 'rare',    title: 'Jarang',  add: 0 },
  { id: 'some',    title: 'Kadang',  add: 300 },
  { id: 'regular', title: 'Teratur', add: 600 },
  { id: 'often',   title: 'Sering',  add: 900 },
];

const WEEKDAYS    = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG  = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const findActivity = (id) => ACTIVITIES.find((a) => a.id === id) || ACTIVITIES[1];


/* ---------- 4. STATE ---------- */

// Nama kunci localStorage dibiarkan seperti versi awal supaya data lama tetap terbaca.
const STORAGE_KEY = 'tayogamaps.v1';
const THEME_KEY = 'tayogamaps.theme';

// "cup" = jumlah mL untuk tombol cepat, "remind" = interval pengingat (jam, 0 = mati)
const DEFAULT_SETTINGS = { cup: 350, remind: 2 };

// Profil bawaan (dipakai sampai pengguna mengubahnya di Pengaturan)
const DEFAULT_PROFILE = { gender: 'm', weight: 60, activity: 'regular', wake: '06:00', sleep: '23:00', meals: 3, def: true };

// state = data yang disimpan: profil, pengaturan (set), dan riwayat minum (logs)
let state = loadState();

function loadState() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    // data rusak atau localStorage tidak tersedia -> mulai dari kosong
  }
  if (!saved || typeof saved !== 'object') saved = {};
  return {
    profile: saved.profile || null,
    set: Object.assign({}, DEFAULT_SETTINGS, saved.set),
    logs: saved.logs || [],
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // abaikan jika penyimpanan penuh / diblokir
  }
}

// Kondisi tampilan (tidak disimpan)
let currentTab = 'home';
let selectedDay = dateKey(Date.now());   // hari yang sedang dilihat di Beranda
let statsMode = 'week';                  // 'week' | 'month' | 'year'
let statsOffset = 0;                     // 0 = periode ini, -1 = sebelumnya, dst
let confirmingClear = false;             // tombol "Hapus semua data" menunggu konfirmasi
let userPos = Object.assign({ src: 'manual' }, START_POINTS[0]);   // posisi pengguna di peta
let selectedPointId = null;              // titik Toyagama yang dipilih di peta
let geoMessage = '';                     // pesan status pencarian lokasi
let sheet = null;                        // data jendela "Tambah minum" (null = tertutup)
let lastReminderKey = '';                // mencegah pengingat muncul dua kali di menit yang sama
let theme = 'auto';                      // 'auto' | 'light' | 'dark'

try {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
} catch (error) {
  // abaikan
}


/* ---------- 5. PERHITUNGAN ---------- */

// Target minum harian (mL) dari berat badan, aktivitas, dan jam terjaga.
function calculateGoal(profile) {
  const genderFactor = profile.gender === 'f' ? 0.92 : 1;
  const base = Math.round(profile.weight * 30 * genderFactor);
  const activityExtra = findActivity(profile.activity).add;

  // Lama terjaga (jam). Jika bangun = tidur, anggap 16 jam.
  let awakeHours = ((timeToMinutes(profile.sleep) - timeToMinutes(profile.wake) + 1440) % 1440) / 60;
  if (awakeHours === 0) awakeHours = 16;
  const awakeExtra = Math.round(Math.max(0, awakeHours - 12) * 50);

  // Dibulatkan ke 10 mL terdekat, dibatasi 1500 - 5000 mL
  const rounded = Math.round((base + activityExtra + awakeExtra) / 10) * 10;
  const total = Math.min(5000, Math.max(1500, rounded));

  return { base, activityExtra, awakeHours, awakeExtra, total };
}

// Menjumlahkan riwayat minum per hari.
// Hasil: { "2026-11-15": { total: 1200, fromToyagama: 500, count: 4 }, ... }
function calculateDayTotals() {
  const totals = {};
  state.logs.forEach((log) => {
    const key = dateKey(log.t);
    if (!totals[key]) totals[key] = { total: 0, fromToyagama: 0, count: 0 };
    totals[key].total += log.eff;
    // Catatan yang punya lokasi dianggap berasal dari titik Toyagama
    // ("drink === 'tayo'" untuk data versi lama)
    if (log.loc || log.drink === 'tayo') totals[key].fromToyagama += log.ml;
    totals[key].count++;
  });
  return totals;
}

// Berapa hari berturut-turut target tercapai (sampai hari ini / kemarin)
function countStreak(totals, goal) {
  let streak = 0;
  const day = new Date();

  // Jika hari ini belum tercapai, hitung mundur mulai dari kemarin
  const today = totals[dateKey(day)];
  if (!(today && today.total >= goal)) day.setDate(day.getDate() - 1);

  while (streak < 4000) {
    const item = totals[dateKey(day)];
    if (item && item.total >= goal) {
      streak++;
      day.setDate(day.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Tanggal hari Senin pada minggu dari tanggal tertentu
function mondayOf(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (result.getDay() + 6) % 7;   // getDay(): Minggu = 0
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

// Jarak dua koordinat dalam meter (rumus Haversine)
function distance(a, b) {
  const earthRadius = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const h = Math.sin(dLat / 2) ** 2
          + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

// 1250 -> "1,3 km", 80 -> "80 m"
function formatDistance(meters) {
  if (meters >= 1000) return (meters / 1000).toFixed(1).replace('.', ',') + ' km';
  return (Math.round(meters / 10) * 10 || 10) + ' m';
}

// Perkiraan menit jalan kaki (75 meter per menit)
const walkMinutes = (meters) => Math.max(1, Math.ceil(meters / 75));

// Daftar jam pengingat (dalam menit) di antara jam bangun dan tidur
function getReminderSlots(profile, intervalHours) {
  const wake = timeToMinutes(profile.wake);
  const span = (timeToMinutes(profile.sleep) - wake + 1440) % 1440 || 960;
  const slots = [];
  for (let m = 0; m <= span - 30; m += intervalHours * 60) {
    slots.push((wake + m) % 1440);
  }
  return slots;
}

// Pengingat berikutnya: { t: menit, today: true/false } atau null jika pengingat mati
function nextReminder() {
  const profile = state.profile;
  const interval = state.set.remind;
  if (!interval) return null;

  const wake = timeToMinutes(profile.wake);
  const span = (timeToMinutes(profile.sleep) - wake + 1440) % 1440 || 960;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sinceWake = (nowMinutes - wake + 1440) % 1440;

  for (const slot of getReminderSlots(profile, interval)) {
    const slotSinceWake = (slot - wake + 1440) % 1440;
    if (slotSinceWake > sinceWake && sinceWake <= span) return { t: slot, today: true };
  }
  // Tidak ada lagi hari ini -> pengingat pertama besok pagi
  return { t: wake, today: nowMinutes < wake };
}


/* ---------- 6. HALAMAN BERANDA ---------- */

// Path ombak untuk animasi air di dalam lingkaran
function makeWavePath(width, height, amplitude, length) {
  let d = `M0 ${amplitude}`;
  for (let x = 0; x < width; x += length) {
    d += ` q ${length / 4} ${-amplitude * 2} ${length / 2} 0 t ${length / 2} 0`;
  }
  return `${d} V${height} H0Z`;
}

// Lingkaran target dengan air yang naik sesuai progres
function buildRing(fraction, percent, drunk, goal) {
  const waterLevel = 186 - 164 * fraction;
  const circumference = 553.1;   // keliling lingkaran r = 88
  return `
    <svg viewBox="0 0 200 200" class="ring" role="img" aria-label="${percent} persen dari target">
      <defs><clipPath id="rc"><circle cx="100" cy="100" r="78"/></clipPath></defs>
      <g clip-path="url(#rc)">
        <g transform="translate(-40,${waterLevel})">
          <path class="wave b" d="${makeWavePath(300, 200, 5, 40)}"/>
          <path class="wave" d="${makeWavePath(300, 200, 4, 40)}" style="animation-duration:5s"/>
        </g>
      </g>
      <circle class="track" cx="100" cy="100" r="88"/>
      <circle class="prog" cx="100" cy="100" r="88" stroke-dasharray="${circumference}" stroke-dashoffset="${(circumference * (1 - fraction)).toFixed(1)}" transform="rotate(-90 100 100)"/>
      <text x="100" y="98" text-anchor="middle" font-size="38" font-weight="700" font-family="var(--font-display)">${percent}%</text>
      <text x="100" y="120" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">${formatNumber(drunk)} / ${formatNumber(goal)} mL</text>
    </svg>`;
}

// Tujuh tombol hari (Senin - Minggu) minggu ini
function buildWeekButtons(totals, goal, todayKey) {
  const monday = mondayOf(new Date());
  let html = '';
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const key = dateKey(date);
    const isFuture = key > todayKey;
    const reached = totals[key] && totals[key].total >= goal;

    html += `
      <button class="day" data-act="day" data-k="${key}" aria-pressed="${key === selectedDay}"${isFuture ? ' disabled' : ''} aria-label="${WEEKDAYS[i]} ${date.getDate()}${reached ? ', target tercapai' : ''}">
        <span>${WEEKDAYS[i]}</span>
        <b>${date.getDate()}</b>
        <span class="ck${reached ? ' on' : ''}"></span>
      </button>`;
  }
  return html;
}

// Daftar catatan minum pada hari yang dipilih
function buildLogRows(isToday) {
  const logs = state.logs
    .filter((log) => dateKey(log.t) === selectedDay)
    .sort((a, b) => b.t - a.t);   // terbaru di atas

  if (logs.length === 0) {
    const emptyText = isToday
      ? 'Belum ada catatan hari ini. Ketuk Tambah minum, atau isi tumbler di titik Toyagama.'
      : 'Tidak ada catatan di hari ini.';
    return `<p class="muted" style="padding:6px 0">${emptyText}</p>`;
  }

  return logs.map((log) => {
    const time = new Date(log.t);
    const place = log.loc ? `<small class="muted" style="display:block">${escapeHtml(log.loc)}</small>` : '';
    const equivalent = log.eff !== log.ml
      ? `<small class="muted" style="display:block;text-align:right">setara ${formatNumber(log.eff)}</small>`
      : '';
    return `
      <div class="logrow">
        <span class="num muted">${pad2(time.getHours())}:${pad2(time.getMinutes())}</span>
        <span>Air putih${place}</span>
        <span class="num"><b>${formatNumber(log.ml)} mL</b>${equivalent}</span>
        <button class="x" data-act="del" data-id="${log.id}" aria-label="Hapus catatan">${ICONS.x}</button>
      </div>`;
  }).join('');
}

function renderHome() {
  const profile = state.profile;
  const goal = calculateGoal(profile).total;
  const totals = calculateDayTotals();
  const todayKey = dateKey(Date.now());
  const isToday = selectedDay === todayKey;

  const day = totals[selectedDay] || { total: 0, fromToyagama: 0, count: 0 };
  const percent = Math.round(day.total / goal * 100);
  const fraction = Math.min(1, day.total / goal);
  const remaining = Math.max(0, goal - day.total);
  const streak = countStreak(totals, goal);

  const hour = new Date().getHours();
  let greeting = 'Selamat malam';
  if (hour < 11) greeting = 'Selamat pagi';
  else if (hour < 15) greeting = 'Selamat siang';
  else if (hour < 18) greeting = 'Selamat sore';

  // Kalimat di bawah sapaan
  let statusText = `Riwayat ${selectedDay.split('-').reverse().join('/')}`;
  if (percent >= 100) statusText = 'Target hari ini tercapai.';
  else if (isToday) statusText = `Sisa ${formatNumber(remaining)} mL untuk hari ini.`;
  if (profile.def) statusText += ' Target ini memakai profil contoh.';

  // Teks pengingat berikutnya (hanya untuk hari ini)
  let reminderHtml = '';
  if (isToday && state.set.remind) {
    const next = nextReminder();
    if (next) {
      reminderHtml = `<p class="muted reminder" style="font-size:13px">${ICONS.bell} Pengingat berikutnya ${minutesToTime(next.t)}${next.today ? '' : ' besok'}</p>`;
    }
  }

  // Tombol aksi: hari ini bisa tambah minum, hari lain hanya tombol kembali
  const actionsHtml = isToday
    ? `<div class="stack" style="gap:10px">
         <button class="btn block" data-act="open-sheet">${ICONS.plus} Tambah minum</button>
         <div class="row" style="flex-wrap:nowrap">
           <button class="btn soft" style="flex:1" data-act="quick">+ ${state.set.cup} mL air putih</button>
           <button class="btn ghost" data-act="goto" data-v="map">${ICONS.pin} Isi di Toyagama</button>
         </div>
       </div>`
    : `<button class="btn ghost block" data-act="day" data-k="${todayKey}">Kembali ke hari ini</button>`;

  setView('#v-home', `
    <div class="hero">
      <span class="label" style="color:var(--accent)">Air minum gratis UGM · sekitar FMIPA</span>
      <h1>Minum cukup. Isi ulang gratis di Toyagama.</h1>
      <p>Catat minummu, lihat target harian yang dihitung dari tubuh dan jadwalmu, lalu temukan titik Toyagama terdekat dari tempatmu kuliah.</p>
      <div class="row">
        <button class="btn" data-act="goto" data-v="map">${ICONS.pin} Cari Toyagama terdekat</button>
        ${profile.def ? '<button class="btn ghost" data-act="goto" data-v="set">Hitung targetku</button>' : ''}
      </div>
    </div>

    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div>
        <h2>${greeting}.</h2>
        <p class="muted">${statusText}</p>
      </div>
      ${streak > 0 ? `<span class="pill">${ICONS.drop} Beruntun ${streak} hari</span>` : ''}
    </div>

    <div class="week" style="margin-bottom:16px">${buildWeekButtons(totals, goal, todayKey)}</div>

    <div class="home">
      <div class="card stack">
        <div class="ringbox">${buildRing(fraction, percent, day.total, goal)}${reminderHtml}</div>
        ${actionsHtml}
      </div>
      <div class="card">
        <h2 style="margin-bottom:6px">Catatan hari ini</h2>
        <div>${buildLogRows(isToday)}</div>
      </div>
    </div>
  `);
}

// Menambah satu catatan minum (selalu air putih)
function addLog(ml, location) {
  const log = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    t: Date.now(),
    drink: 'air',
    ml: Math.round(ml),
    eff: Math.round(ml),
  };
  if (location) log.loc = location;

  state.logs.push(log);
  saveState();
  selectedDay = dateKey(Date.now());
  showToast(`Ditambahkan ${formatNumber(log.ml)} mL`);
}


/* ---------- 7. JENDELA "TAMBAH MINUM" ---------- */

// location (opsional): nama titik Toyagama, jika dibuka dari halaman Peta
function openSheet(location, defaultAmount) {
  sheet = {
    amount: defaultAmount || state.set.cup || 250,
    location: location || null,
  };

  // Garis skala di gelas: 250, 500, 750, 1000 mL
  let ticks = '';
  for (let i = 1; i <= 4; i++) {
    const y = 157 - 145 * (i / 4);
    ticks += `<line x1="64" x2="72" y1="${y}" y2="${y}" stroke="var(--ink-2)" stroke-width="1.5"/>
              <text x="58" y="${y + 3.5}" text-anchor="end">${250 * i}</text>`;
  }

  $('#sheet').innerHTML = `
    <div class="scrim" data-act="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="row" style="justify-content:space-between">
        <div>
          <h2 id="sheet-title">Tambah minum</h2>
          <p class="muted" style="font-size:13px">${sheet.location ? 'Isi ulang di ' + escapeHtml(sheet.location) : ''}</p>
        </div>
        <button class="btn ghost" style="min-height:40px;padding:0 10px" data-act="close-sheet" aria-label="Tutup">${ICONS.x}</button>
      </div>

      <div class="cupbox">
        <svg viewBox="0 0 230 170" class="cup" role="img" aria-label="Gelas berisi air putih">
          <defs>
            <clipPath id="cupclip"><path d="M70 12h80l-8 140a6 6 0 0 1-6 5H84a6 6 0 0 1-6-5z"/></clipPath>
            <linearGradient id="wg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style="stop-color:var(--water-1)"/>
              <stop offset="1" style="stop-color:var(--water-2)"/>
            </linearGradient>
          </defs>
          <g clip-path="url(#cupclip)"><rect id="cup-water" x="60" width="110" y="157" height="0" fill="url(#wg)"/></g>
          <path d="M70 12h80l-8 140a6 6 0 0 1-6 5H84a6 6 0 0 1-6-5z" class="cup-line"/>
          <g>${ticks}</g>
          <g id="cup-tag">
            <rect class="tag" x="162" y="-12" width="62" height="24" rx="12"/>
            <text id="cup-tag-text" class="tagt" x="193" y="4" text-anchor="middle"></text>
          </g>
        </svg>
      </div>

      <div class="field">
        <label class="label" for="ml-input">Berapa mL air putih yang kamu minum?</label>
        <input id="ml-input" class="ml-input" type="number" inputmode="numeric" min="10" max="3000" step="10" placeholder="Contoh: 350" value="${sheet.amount}">
      </div>

      <p class="muted" id="sheet-note" style="font-size:13px"></p>
      <button class="btn block" id="sheet-add" data-act="add"></button>
    </div>`;

  $('#sheet').hidden = false;
  updateSheet();
  $('#ml-input').focus();
}

// Memperbarui gambar gelas, catatan, dan tombol sesuai jumlah mL yang diketik
function updateSheet() {
  if (!sheet) return;
  const amount = Math.max(0, Math.round(sheet.amount || 0));
  const waterHeight = 145 * Math.min(1, amount / 1000);   // gelas penuh di 1000 mL

  $('#cup-water').setAttribute('y', 157 - waterHeight);
  $('#cup-water').setAttribute('height', waterHeight);
  $('#cup-tag').setAttribute('transform', `translate(0,${157 - waterHeight})`);
  $('#cup-tag-text').textContent = `${formatNumber(amount)} mL`;
  $('#sheet-note').textContent = amount > 1000
    ? 'Gambar gelas penuh di 1.000 mL, tetapi jumlahmu tetap dicatat utuh.'
    : 'Hanya air putih yang dicatat.';
  $('#sheet-add').innerHTML = `${ICONS.plus} Tambah ${formatNumber(amount)} mL`;
  $('#sheet-add').disabled = !(amount > 0);
}

function closeSheet() {
  $('#sheet').hidden = true;
  sheet = null;
}


/* ---------- 8. HALAMAN PETA ---------- */

// Menyiapkan "kamera" peta: mengubah koordinat (lat, lng) menjadi posisi piksel di SVG.
function createMapProjection() {
  const width = 420;
  const height = 320;
  const margin = 46;

  // Kumpulkan semua koordinat yang harus muat di peta
  const coords = POINTS.map((p) => [p.lat, p.lng]);
  if (distance(userPos, CENTER) < 700) coords.push([userPos.lat, userPos.lng]);

  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Lebar 1 derajat bujur lebih sempit dari 1 derajat lintang, jadi dikoreksi dengan cos(lintang)
  const lngScale = Math.cos(CENTER.lat * Math.PI / 180);
  const spanX = Math.max((maxLng - minLng) * lngScale, 1e-5);
  const spanY = Math.max(maxLat - minLat, 1e-5);

  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return {
    width,
    height,
    metersPerPixel: 111320 / scale,
    // koordinat -> piksel
    project(lat, lng) {
      return [offsetX + (lng - minLng) * lngScale * scale, offsetY + (maxLat - lat) * scale];
    },
    // piksel -> koordinat (dipakai saat peta diketuk)
    unproject(x, y) {
      return { lat: maxLat - (y - offsetY) / scale, lng: minLng + (x - offsetX) / (lngScale * scale) };
    },
  };
}

function googleMapsUrl(point) {
  return `https://www.google.com/maps/dir/?api=1&origin=${userPos.lat},${userPos.lng}&destination=${point.lat},${point.lng}&travelmode=walking`;
}

// Gambar peta skematis (SVG)
function buildMapSvg(map, rankedPoints, selectedPoint, tooFar) {
  const { width, height } = map;
  let svg = `<svg class="map" viewBox="0 0 ${width} ${height}" data-act="mapclick" role="img" aria-label="Peta skematis titik Toyagama di sekitar FMIPA UGM">
    <rect class="m-bg" width="${width}" height="${height}"/>`;

  // Garis kotak-kotak latar
  for (let x = 0; x <= width; x += 42) {
    svg += `<line class="m-grid" x1="${x}" x2="${x}" y1="0" y2="${height}"/>`;
  }
  for (let y = 0; y <= height; y += 40) {
    svg += `<line class="m-grid" x1="0" x2="${width}" y1="${y}" y2="${y}"/>`;
  }

  // Garis putus-putus dari posisimu ke titik yang dipilih
  const me = map.project(userPos.lat, userPos.lng);
  if (selectedPoint && !tooFar) {
    const target = map.project(selectedPoint.lat, selectedPoint.lng);
    svg += `<path class="m-route" d="M${me[0].toFixed(1)} ${me[1].toFixed(1)}L${target[0].toFixed(1)} ${target[1].toFixed(1)}"/>`;
  }

  // Penanda titik Toyagama (nomor 1 = terdekat)
  rankedPoints.forEach((point, index) => {
    const [x, y] = map.project(point.lat, point.lng);
    const isSelected = selectedPointId === point.id;
    svg += `
      <g class="m-pin${isSelected ? ' sel' : ''}" data-act="sel" data-id="${point.id}" tabindex="0" role="button" aria-label="${escapeHtml(point.name)}, ${formatDistance(point.dist)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
        <circle class="p" r="${isSelected ? 13 : 11}"/>
        <text class="n" y="4">${index + 1}</text>
        <text class="l" y="27">${escapeHtml(point.short)}</text>
      </g>`;
  });

  // Titik posisimu
  if (!tooFar) {
    svg += `<g class="m-me" transform="translate(${me[0].toFixed(1)} ${me[1].toFixed(1)})"><circle class="halo" r="14"/><circle class="core" r="7"/></g>`;
  }

  // Skala 50 m dan arah utara
  const barWidth = 50 / map.metersPerPixel;
  svg += `
    <g transform="translate(16 ${height - 18})">
      <path d="M0 0v-5M0 0H${barWidth.toFixed(1)}M${barWidth.toFixed(1)} 0v-5" stroke="var(--ink-2)" stroke-width="1.5" fill="none"/>
      <text class="m-txt" x="${(barWidth + 6).toFixed(1)}" y="3">50 m</text>
    </g>
    <g transform="translate(${width - 24} 26)">
      <path d="M0 8V-8M-5 -2L0 -8L5 -2" stroke="var(--ink-2)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <text class="m-txt" x="0" y="22" text-anchor="middle">U</text>
    </g>
  </svg>`;

  return svg;
}

function renderMap() {
  const map = createMapProjection();

  // Urutkan titik dari yang terdekat
  const rankedPoints = POINTS
    .map((point) => Object.assign({ dist: distance(userPos, point) }, point))
    .sort((a, b) => a.dist - b.dist);

  const tooFar = distance(userPos, CENTER) >= 700;
  const selectedPoint = POINTS.find((p) => p.id === selectedPointId);

  let positionLabel = userPos.name;
  if (userPos.src === 'gps') positionLabel = 'Lokasi GPS';
  else if (userPos.src === 'tap') positionLabel = 'Titik yang kamu tandai';

  const embedHtml = EMBED_GOOGLE && selectedPoint
    ? `<iframe class="embed" title="Google Maps" loading="lazy" src="https://www.google.com/maps?q=${selectedPoint.lat},${selectedPoint.lng}&z=19&output=embed"></iframe>`
    : '';

  const startButtons = START_POINTS.map((start) => `
    <button class="chip" style="min-height:40px;padding:8px 12px" data-act="start" data-id="${start.id}" aria-pressed="${userPos.id === start.id}">${escapeHtml(start.name)}</button>`).join('');

  const pointList = rankedPoints.map((point, index) => `
    <button class="pt${index < 3 ? ' top' : ''}" data-act="sel" data-id="${point.id}" aria-pressed="${selectedPointId === point.id}">
      <span class="rk">${index + 1}</span>
      <span><b>${escapeHtml(point.name)}</b><small class="muted" style="display:block">${escapeHtml(point.where)}</small></span>
      <span class="d">${formatDistance(point.dist)}<small>± ${walkMinutes(point.dist)} mnt jalan</small></span>
    </button>`).join('');

  // Kartu detail titik yang dipilih (atau petunjuk jika belum memilih)
  let detailHtml = '<p class="note">Pilih satu titik untuk melihat rute dan membukanya di Google Maps.</p>';
  if (selectedPoint) {
    const dist = distance(userPos, selectedPoint);
    detailHtml = `
      <div class="card stack" style="gap:12px">
        <div>
          <span class="label">Titik pilihanmu</span>
          <h2 style="margin-top:4px">${escapeHtml(selectedPoint.name)}</h2>
          <p class="muted">${escapeHtml(selectedPoint.where)} · ${formatDistance(dist)} · ± ${walkMinutes(dist)} menit jalan kaki</p>
        </div>
        <a class="btn block" href="${googleMapsUrl(selectedPoint)}" target="_blank" rel="noopener">${ICONS.external} Buka rute di Google Maps</a>
        <button class="btn soft block" data-act="refill">${ICONS.drop} Catat isi tumbler di sini</button>
      </div>`;
  }

  setView('#v-map', `
    <div class="view-head">
      <h1>Toyagama terdekat</h1>
      <p class="muted">Air minum gratis UGM di sekitar FMIPA. Isi tumblermu, kurangi botol plastik.</p>
    </div>

    <div class="map-layout">
      <div class="stack">
        <div class="card map-card">
          ${buildMapSvg(map, rankedPoints, selectedPoint, tooFar)}
          ${embedHtml}
          <div class="map-hint">
            <span>Peta skematis. Ketuk peta untuk menandai posisimu.</span>
            <span>Data titik: contoh, perlu diverifikasi</span>
          </div>
        </div>

        <div class="card stack" style="gap:12px">
          <div class="row" style="justify-content:space-between">
            <div>
              <span class="label">Posisimu</span>
              <div><b>${escapeHtml(positionLabel)}</b>${userPos.src === 'manual' ? ' <span class="muted" style="font-size:13px">(pilihan manual)</span>' : ''}</div>
            </div>
            <button class="btn soft" data-act="locate">${ICONS.locate} Gunakan lokasiku</button>
          </div>
          ${geoMessage ? `<p class="note" role="status">${escapeHtml(geoMessage)}</p>` : ''}
          ${tooFar ? `<p class="note">Kamu sekitar ${formatDistance(distance(userPos, CENTER))} dari FMIPA. Jarak dihitung garis lurus dari posisimu.</p>` : ''}
          <div class="field">
            <span class="label">Atau pilih posisimu</span>
            <div class="row">${startButtons}</div>
          </div>
        </div>
      </div>

      <div class="stack">
        <div class="card stack" style="gap:10px">
          <h2>Titik terdekat</h2>
          <div class="stack" style="gap:8px">${pointList}</div>
        </div>
        ${detailHtml}
        <p class="note">Air Toyagama berasal dari mata air Umbul Pace yang diolah UGM, dan gratis untuk diisi ke tumblermu.</p>
      </div>
    </div>
  `);
}

// Mencari lokasi pengguna lewat GPS browser
function locateUser() {
  geoMessage = 'Mencari lokasimu…';
  renderMap();

  const onFail = () => {
    geoMessage = 'Lokasi tidak bisa diakses di tampilan ini. Pilih posisimu di bawah atau ketuk peta.';
    renderMap();
  };

  try {
    if (!navigator.geolocation) {
      onFail();
      return;
    }
    navigator.geolocation.getCurrentPosition((result) => {
      userPos = { src: 'gps', lat: result.coords.latitude, lng: result.coords.longitude, name: 'Lokasi GPS' };
      selectedPointId = null;
      geoMessage = 'Lokasimu ditemukan.';
      renderMap();
    }, onFail, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
  } catch (error) {
    onFail();
  }
}


/* ---------- 9. HALAMAN STATISTIK ---------- */

// Membulatkan batas atas sumbu Y ke kelipatan 400 (minimal 400)
function roundUpAxis(value) {
  return Math.max(400, Math.ceil(value / 400) * 400);
}

// Menyiapkan data grafik sesuai mode (minggu / bulan / tahun) dan periode
function getStatsRange() {
  const now = new Date();
  const totals = calculateDayTotals();
  const todayKey = dateKey(now);
  const items = [];   // satu item = satu batang grafik
  const days = [];    // semua hari dalam rentang
  let title = '';

  if (statsMode === 'week') {
    const monday = mondayOf(now);
    monday.setDate(monday.getDate() + 7 * statsOffset);
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push(date);
      const key = dateKey(date);
      items.push({ label: WEEKDAYS[i], key, value: key > todayKey ? null : (totals[key] || { total: 0 }).total });
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    title = `${monday.getDate()} ${MONTHS_SHORT[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getFullYear()}`;

  } else if (statsMode === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth() + statsOffset, 1);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d);
      days.push(date);
      const key = dateKey(date);
      // label hanya di tanggal 1, 5, 10, 15, ... supaya tidak berdesakan
      const label = (d === 1 || d % 5 === 0) ? String(d) : '';
      items.push({ label, key, value: key > todayKey ? null : (totals[key] || { total: 0 }).total });
    }
    title = `${MONTHS_LONG[first.getMonth()]} ${first.getFullYear()}`;

  } else {
    // Mode tahun: satu batang = rata-rata per hari dalam sebulan
    const year = now.getFullYear() + statsOffset;
    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let sum = 0;
      let counted = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        days.push(date);
        const key = dateKey(date);
        if (key <= todayKey) {
          counted++;
          sum += (totals[key] || { total: 0 }).total;
        }
      }
      items.push({ label: MONTHS_SHORT[month], key: `${year}-${pad2(month + 1)}`, value: counted ? sum / counted : null });
    }
    title = String(year);
  }

  // Hanya hari yang sudah lewat (sampai hari ini) yang dihitung di ringkasan
  const pastDays = days.filter((date) => dateKey(date) <= todayKey);
  return { items, days: pastDays, totals, title };
}

// Grafik batang (SVG)
function buildChart(items, goal) {
  const W = 600, H = 270;
  const left = 48, right = 10, top = 14, bottom = 28;
  const innerWidth = W - left - right;
  const innerHeight = H - top - bottom;

  const maxValue = Math.max(goal, ...items.map((item) => item.value || 0));
  const axisMax = roundUpAxis(maxValue * 1.05);
  const yOf = (value) => top + innerHeight - (value / axisMax) * innerHeight;

  const slotWidth = innerWidth / items.length;
  const barWidth = Math.min(38, slotWidth * 0.62);
  let svg = '';

  // Garis bantu horizontal + angka sumbu Y
  for (let i = 0; i <= 4; i++) {
    const value = axisMax * i / 4;
    const y = yOf(value).toFixed(1);
    svg += `<line class="gl" x1="${left}" x2="${W - right}" y1="${y}" y2="${y}"/>
            <text class="ax" x="${left - 6}" y="${(yOf(value) + 4).toFixed(1)}" text-anchor="end">${formatNumber(value)}</text>`;
  }

  // Batang
  items.forEach((item, index) => {
    const centerX = left + slotWidth * index + slotWidth / 2;
    if (item.value != null && item.value > 0) {
      const barHeight = Math.max(2, top + innerHeight - yOf(item.value));
      const cssClass = item.value >= goal ? 'b-hit' : 'b-low';
      svg += `<rect class="${cssClass}" x="${(centerX - barWidth / 2).toFixed(1)}" y="${(top + innerHeight - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="3"><title>${escapeHtml(item.label || item.key)}: ${formatNumber(item.value)} mL</title></rect>`;
    }
    if (item.label) {
      svg += `<text class="ax" x="${centerX.toFixed(1)}" y="${H - 8}" text-anchor="middle">${item.label}</text>`;
    }
  });

  // Garis target
  const goalY = yOf(goal).toFixed(1);
  svg += `<line class="goal" x1="${left}" x2="${W - right}" y1="${goalY}" y2="${goalY}"/>
          <text class="ax" x="${W - right}" y="${(yOf(goal) - 5).toFixed(1)}" text-anchor="end" style="fill:var(--ink)">Target ${formatNumber(goal)}</text>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik minum">${svg}</svg>`;
}

function renderStats() {
  const goal = calculateGoal(state.profile).total;
  const range = getStatsRange();

  let sum = 0;           // total diminum
  let daysReached = 0;   // jumlah hari target tercapai
  let fromToyagama = 0;  // total dari titik Toyagama
  range.days.forEach((date) => {
    const item = range.totals[dateKey(date)];
    if (item) {
      sum += item.total;
      fromToyagama += item.fromToyagama;
      if (item.total >= goal) daysReached++;
    }
  });

  const dayCount = range.days.length;
  const average = dayCount ? sum / dayCount : 0;
  const bottlesSaved = fromToyagama / 600;   // dibandingkan botol 600 mL

  const modeNames = { week: 'Minggu', month: 'Bulan', year: 'Tahun' };
  const modeButtons = ['week', 'month', 'year']
    .map((mode) => `<button data-act="smode" data-v="${mode}" aria-pressed="${statsMode === mode}">${modeNames[mode]}</button>`)
    .join('');

  const totalLiters = (Math.round(sum / 100) / 10).toString().replace('.', ',');
  const bottlesText = bottlesSaved >= 1 ? Math.round(bottlesSaved) : bottlesSaved.toFixed(1).replace('.', ',');

  setView('#v-stats', `
    <div class="view-head">
      <h1>Statistik</h1>
      <p class="muted">${sum > 0 ? 'Seberapa konsisten kamu minum.' : 'Belum ada catatan di rentang ini.'}</p>
    </div>

    <div class="stack">
      <div class="row" style="justify-content:space-between">
        <div class="seg" style="min-width:min(100%,280px)">${modeButtons}</div>
        <div class="row" style="flex-wrap:nowrap">
          <button class="btn ghost" style="min-height:42px;padding:0 14px" data-act="soff" data-d="-1" aria-label="Sebelumnya">‹</button>
          <b class="num" style="min-width:150px;text-align:center">${range.title}</b>
          <button class="btn ghost" style="min-height:42px;padding:0 14px" data-act="soff" data-d="1" aria-label="Berikutnya"${statsOffset >= 0 ? ' disabled' : ''}>›</button>
        </div>
      </div>

      <div class="tiles">
        <div class="tile">
          <span class="label">Rata-rata per hari</span>
          <b>${formatNumber(average)} <small style="font-size:14px;font-weight:600">mL</small></b>
          <span class="muted" style="font-size:13px">${Math.round(average / goal * 100)}% dari target</span>
        </div>
        <div class="tile">
          <span class="label">Target tercapai</span>
          <b>${daysReached} <small style="font-size:14px;font-weight:600">dari ${dayCount} hari</small></b>
        </div>
        <div class="tile">
          <span class="label">Total diminum</span>
          <b>${totalLiters} <small style="font-size:14px;font-weight:600">L</small></b>
        </div>
        <div class="tile">
          <span class="label">Dari Toyagama</span>
          <b>${formatNumber(fromToyagama)} <small style="font-size:14px;font-weight:600">mL</small></b>
          <span class="muted" style="font-size:13px">≈ ${bottlesText} botol 600 mL terhindar</span>
        </div>
      </div>

      <div class="card stack" style="gap:12px">
        <div class="chartwrap">${buildChart(range.items, goal)}</div>
        <div class="legend">
          <span><i class="b-hit"></i>Mencapai target</span>
          <span><i class="b-low"></i>Di bawah target</span>
          ${statsMode === 'year' ? '<span>Rata-rata per hari tiap bulan</span>' : ''}
        </div>
      </div>
    </div>
  `);
}


/* ---------- 10. HALAMAN PENGATURAN ---------- */

// Membuat daftar <option> untuk <select>. list = [[nilai, teks], ...]
function buildOptions(list, selectedValue) {
  return list
    .map(([value, text]) => `<option value="${value}"${String(selectedValue) === String(value) ? ' selected' : ''}>${text}</option>`)
    .join('');
}

function renderSettings() {
  const profile = state.profile;
  const goal = calculateGoal(profile);
  const hasDemoData = state.logs.some((log) => log.demo);

  const genderOptions = buildOptions([['m', 'Laki-laki'], ['f', 'Perempuan']], profile.gender);
  const activityOptions = buildOptions(ACTIVITIES.map((a) => [a.id, a.title]), profile.activity);
  const reminderOptions = buildOptions([[0, 'Mati'], [1, 'Setiap jam'], [2, 'Setiap 2 jam'], [3, 'Setiap 3 jam']], state.set.remind);

  setView('#v-set', `
    <div class="view-head">
      <h1>Pengaturan</h1>
      <p class="muted">Ubah profilmu dan target ikut menyesuaikan.</p>
    </div>

    <div class="setgrid">
      <div class="card stack">
        <h2>Profil dan rutinitas</h2>
        <div class="form">
          <div class="field"><label class="label" for="f-gender">Jenis kelamin</label><select id="f-gender" data-f="profile.gender">${genderOptions}</select></div>
          <div class="field"><label class="label" for="f-weight">Berat (kg)</label><input id="f-weight" type="number" inputmode="numeric" min="30" max="150" value="${profile.weight}" data-f="profile.weight"></div>
          <div class="field"><label class="label" for="f-activity">Aktivitas</label><select id="f-activity" data-f="profile.activity">${activityOptions}</select></div>
          <div class="field"><label class="label" for="f-meals">Makan per hari</label><input id="f-meals" type="number" inputmode="numeric" min="1" max="6" value="${profile.meals}" data-f="profile.meals"></div>
          <div class="field"><label class="label" for="f-wake">Bangun</label><input id="f-wake" type="time" value="${profile.wake}" data-f="profile.wake"></div>
          <div class="field"><label class="label" for="f-sleep">Tidur</label><input id="f-sleep" type="time" value="${profile.sleep}" data-f="profile.sleep"></div>
        </div>
        <div class="note">Target harian: <b class="num">${formatNumber(goal.total)} mL</b> (dasar ${formatNumber(goal.base)} + aktivitas ${formatNumber(goal.activityExtra)} + jam terjaga ${formatNumber(goal.awakeExtra)})</div>
      </div>

      <div class="stack">
        <div class="card stack">
          <h2>Kebiasaan</h2>
          <div class="form">
            <div class="field"><label class="label" for="f-cup">Jumlah tombol cepat (mL)</label><input id="f-cup" type="number" inputmode="numeric" min="10" max="3000" step="10" value="${state.set.cup}" data-f="set.cup"></div>
            <div class="field"><label class="label" for="f-remind">Pengingat</label><select id="f-remind" data-f="set.remind">${reminderOptions}</select></div>
          </div>
          <button class="btn soft" data-act="notif">${ICONS.bell} Izinkan notifikasi browser</button>
          <p class="muted" style="font-size:13px">Pengingat muncul saat halaman ini terbuka, hanya di antara jam bangun dan tidur.</p>
        </div>

        <div class="card stack">
          <h2>Data</h2>
          <p class="muted" style="font-size:13px">Catatan tersimpan di browser ini saja.</p>
          <div class="row">
            <button class="btn ghost" data-act="demo">${hasDemoData ? 'Hapus riwayat contoh' : 'Isi riwayat contoh'}</button>
            <button class="btn ghost" data-act="clear" style="${confirmingClear ? 'border-color:var(--bad);color:var(--bad)' : ''}">${confirmingClear ? 'Yakin? Ketuk sekali lagi' : 'Hapus semua data'}</button>
          </div>
        </div>
      </div>
    </div>
  `);
}

// Mengisi 40 hari riwayat contoh dengan angka acak (supaya grafik terlihat)
function fillDemoData() {
  const goal = calculateGoal(state.profile).total;

  // Pengacak sederhana dengan seed tetap, jadi hasilnya selalu sama
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = 1; i <= 40; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const dayTarget = goal * (0.45 + random() * 0.75);   // 45% - 120% dari target
    const parts = 4 + Math.floor(random() * 3);          // 4 - 6 kali minum
    const mlPerPart = dayTarget / parts;

    for (let j = 0; j < parts; j++) {
      const time = new Date(date);
      time.setHours(7 + j * 3, Math.floor(random() * 50), 0, 0);
      const ml = Math.round(mlPerPart / 10) * 10;

      const log = { id: `d${i}-${j}`, t: time.getTime(), drink: 'air', ml, eff: ml, demo: true };
      if (random() < 0.4) log.loc = 'Toyagama';   // sebagian diisi di titik Toyagama
      state.logs.push(log);
    }
  }
  saveState();
}

// Mengubah satu nilai pengaturan. path contoh: "profile.weight" atau "set.cup"
function setValue(path, value) {
  const [group, key] = path.split('.');
  state[group][key] = value;
  saveState();
}


/* ---------- 11. TEMA, TAB, DAN RENDER UTAMA ---------- */

// Memasang data-theme="light" / "dark" di <html>. Mode "auto" mengikuti pengaturan perangkat.
function applyTheme() {
  const deviceIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = theme === 'dark' || (theme === 'auto' && deviceIsDark);
  document.documentElement.setAttribute('data-theme', useDark ? 'dark' : 'light');
}

function renderThemeButtons() {
  const options = [
    ['auto', 'Otomatis (ikuti perangkat)', ICONS.auto],
    ['light', 'Terang', ICONS.sun],
    ['dark', 'Gelap', ICONS.moon],
  ];
  $('#theme').innerHTML = options.map(([value, label, icon]) =>
    `<button data-act="theme" data-v="${value}" aria-pressed="${theme === value}" aria-label="${label}" title="${label}">${icon}</button>`
  ).join('');
}

// Daftar tab. "hash" = bagian URL setelah #, misalnya index.html#peta
const TABS = [
  { id: 'home',  title: 'Beranda',    icon: ICONS.home,    hash: 'beranda' },
  { id: 'map',   title: 'Toyagama',   icon: ICONS.pin,     hash: 'toyagama' },
  { id: 'stats', title: 'Statistik',  icon: ICONS.chart,   hash: 'statistik' },
  { id: 'set',   title: 'Pengaturan', icon: ICONS.sliders, hash: 'pengaturan' },
];

function renderTabs() {
  $('#tabs').innerHTML = TABS.map((tab) =>
    `<button class="tab" data-act="tab" data-v="${tab.id}"${currentTab === tab.id ? ' aria-current="page"' : ''}>${tab.icon}<span>${tab.title}</span></button>`
  ).join('');
}

// Menggambar ulang tab dan halaman yang sedang aktif
function renderAll() {
  // Jika belum ada profil, pakai profil bawaan
  if (!state.profile) state.profile = Object.assign({}, DEFAULT_PROFILE);

  $('#app').hidden = false;
  renderTabs();
  TABS.forEach((tab) => { $('#v-' + tab.id).hidden = tab.id !== currentTab; });

  if (currentTab === 'home') renderHome();
  else if (currentTab === 'map') renderMap();
  else if (currentTab === 'stats') renderStats();
  else renderSettings();
}

// Pindah tab
function goToTab(id) {
  currentTab = id;
  const tab = TABS.find((t) => t.id === id);
  try {
    if (tab && location.hash !== '#' + tab.hash) location.hash = tab.hash;
  } catch (error) {
    // abaikan
  }
  renderAll();
  window.scrollTo(0, 0);
}


/* ---------- 12. EVENT ---------- */

// Setiap elemen yang bisa diklik punya atribut data-act="nama-aksi".
// Saat diklik, fungsi dengan nama itu di bawah ini yang dijalankan.
// el = elemen yang diklik, event = data klik (untuk posisi ketukan di peta)
const actions = {
  // --- tema dan navigasi ---
  theme(el) {
    theme = el.dataset.v;
    try {
      if (theme === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // abaikan
    }
    applyTheme();
    renderThemeButtons();
  },
  tab(el)  { goToTab(el.dataset.v); },
  goto(el) { goToTab(el.dataset.v); },

  // --- Beranda ---
  day(el) {
    selectedDay = el.dataset.k;
    renderHome();
  },
  'open-sheet'() { openSheet(); },
  'close-sheet'() { closeSheet(); },
  quick() {
    addLog(state.set.cup);
    renderAll();
  },
  del(el) {
    state.logs = state.logs.filter((log) => log.id !== el.dataset.id);
    saveState();
    renderAll();
  },

  // --- jendela Tambah minum ---
  add() {
    const amount = Math.round(sheet.amount || 0);
    if (amount > 0) {
      state.set.cup = Math.min(3000, Math.max(10, amount));   // diingat untuk tombol cepat
      addLog(amount, sheet.location);
    }
    closeSheet();
    renderAll();
  },

  // --- Peta ---
  sel(el) {
    selectedPointId = el.dataset.id;
    renderMap();
  },
  start(el) {
    const start = START_POINTS.find((s) => s.id === el.dataset.id);
    userPos = Object.assign({ src: 'manual' }, start);
    geoMessage = '';
    selectedPointId = null;
    renderMap();
  },
  locate() { locateUser(); },
  refill() {
    const point = POINTS.find((p) => p.id === selectedPointId);
    if (point) openSheet(point.name, state.set.cup);
  },
  mapclick(el, event) {
    // Ubah posisi ketukan di layar menjadi koordinat peta
    const box = el.getBoundingClientRect();
    const map = createMapProjection();
    const x = (event.clientX - box.left) / box.width * map.width;
    const y = (event.clientY - box.top) / box.height * map.height;
    const coords = map.unproject(x, y);
    userPos = { src: 'tap', lat: coords.lat, lng: coords.lng, name: 'Titik yang kamu tandai' };
    geoMessage = '';
    renderMap();
  },

  // --- Statistik ---
  smode(el) {
    statsMode = el.dataset.v;
    statsOffset = 0;
    renderStats();
  },
  soff(el) {
    statsOffset = Math.min(0, statsOffset + Number(el.dataset.d));
    renderStats();
  },

  // --- Pengaturan ---
  demo() {
    if (state.logs.some((log) => log.demo)) state.logs = state.logs.filter((log) => !log.demo);
    else fillDemoData();
    saveState();
    renderSettings();
    showToast('Riwayat diperbarui');
  },
  clear() {
    if (!confirmingClear) {
      // Ketukan pertama: minta konfirmasi, batalkan otomatis setelah 4 detik
      confirmingClear = true;
      renderSettings();
      setTimeout(() => {
        if (confirmingClear) {
          confirmingClear = false;
          if (currentTab === 'set') renderSettings();
        }
      }, 4000);
    } else {
      // Ketukan kedua: hapus semua data
      confirmingClear = false;
      state = { profile: null, set: Object.assign({}, DEFAULT_SETTINGS), logs: [] };
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // abaikan
      }
      renderAll();
      showToast('Data dihapus');
    }
  },
  notif() {
    try {
      Notification.requestPermission()
        .then((result) => showToast(result === 'granted' ? 'Notifikasi aktif' : 'Notifikasi tidak diizinkan'))
        .catch(() => showToast('Notifikasi tidak tersedia di sini'));
    } catch (error) {
      showToast('Notifikasi tidak tersedia di sini');
    }
  },
};

// Satu pendengar klik untuk seluruh halaman ("event delegation")
document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const action = actions[el.dataset.act];
  if (action) action(el, event);
});

document.addEventListener('keydown', (event) => {
  // Esc menutup jendela Tambah minum
  if (event.key === 'Escape' && sheet) {
    closeSheet();
    return;
  }
  // Enter / spasi pada penanda titik di peta = sama dengan mengklik
  const onPin = event.target.matches && event.target.matches('g[data-act]');
  if ((event.key === 'Enter' || event.key === ' ') && onPin) {
    event.preventDefault();
    actions[event.target.dataset.act](event.target, event);
  }
});

// Saat mengetik jumlah mL di jendela Tambah minum
document.addEventListener('input', (event) => {
  if (event.target.id === 'ml-input' && sheet) {
    sheet.amount = Math.min(3000, Math.max(0, Number(event.target.value) || 0));
    updateSheet();
  }
});

// Saat mengubah isian di halaman Pengaturan (atribut data-f = nama data yang diubah)
document.addEventListener('change', (event) => {
  const input = event.target;
  const path = input.dataset && input.dataset.f;
  if (!path) return;

  let value = input.value;
  if (input.type === 'number' || path === 'set.remind') {
    value = Number(value);
    if (path === 'profile.weight') value = Math.min(150, Math.max(30, value || 60));
    if (path === 'profile.meals')  value = Math.min(6, Math.max(1, value || 3));
    if (path === 'set.cup')        value = Math.min(3000, Math.max(10, value || 250));
  }
  if (input.type === 'time' && !value) return;   // abaikan jika jam dikosongkan

  // Mengubah profil berarti profil bukan lagi "contoh"
  if (path.startsWith('profile.')) state.profile.def = false;

  setValue(path, value);
  renderSettings();
});

// Tombol back/forward browser atau mengetik #toyagama di URL
window.addEventListener('hashchange', () => {
  const tab = TABS.find((t) => '#' + t.hash === location.hash);
  if (tab && tab.id !== currentTab && state.profile) {
    currentTab = tab.id;
    renderAll();
  }
});

// Jika tema "auto" dan pengaturan perangkat berubah, ikuti
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// Pengingat minum: dicek tiap 20 detik selama halaman terbuka
setInterval(() => {
  if (!state.profile || !state.set.remind) return;

  const now = new Date();
  const nowText = minutesToTime(now.getHours() * 60 + now.getMinutes());
  const slots = getReminderSlots(state.profile, state.set.remind).map(minutesToTime);
  const reminderKey = dateKey(now) + nowText;

  const todayTotal = calculateDayTotals()[dateKey(now)];
  const goalReached = todayTotal && todayTotal.total >= calculateGoal(state.profile).total;

  if (slots.includes(nowText) && lastReminderKey !== reminderKey && !goalReached) {
    lastReminderKey = reminderKey;
    showToast('Waktunya minum. Isi tumblermu.');
    try {
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('Waktunya minum', { body: 'Isi tumblermu di titik Toyagama terdekat.' });
      }
    } catch (error) {
      // abaikan
    }
    if (currentTab === 'home') renderHome();
  }
}, 20000);


/* ---------- MULAI ---------- */
const startTab = TABS.find((t) => '#' + t.hash === location.hash);
if (startTab) currentTab = startTab.id;

applyTheme();
renderThemeButtons();
renderAll();
