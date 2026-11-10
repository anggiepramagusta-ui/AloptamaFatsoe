// public/js/common.js

// --- Global DOM Elements ---
const stationSelector = document.getElementById('stationSelector'); 

// --- Objek Konfigurasi Bersama ---
const parameterConfig = {
    "air_temperature": { label: "Temperature", unit: "°C" },
    "humidity": { label: "Humidity", unit: "%" },
    "wind_speed": { label: "Wind Speed", unit: "knot" },
    "wind_direction": { label: "Wind Direction", unit: "°" },
    "barometric_pressure": { label: "Pressure", unit: "hPa" },
    "precipitation": { label: "Rain", unit: "mm" },
    "visibility": { label: "Visibility", unit: "m" },
    "dewpoint": { label: "Dew Point", unit: "°C" },
    "present_weather": { label: "Present Weather", unit: "" },
    "qfe": { label: "QFE", unit: "hPa" },
    "qnh": { label: "QNH", unit: "hPa" },
    "sky_condition": { label: "Sky Condition", unit: "" },
    "nws_Lightning": { label: "Lightning Detector", unit: "" },
    "solar_radiation": { label: "Solar Radiation", unit: "W/m2" }
};

// --- Cache untuk Daftar Stasiun ---
let cachedStations = null;

// --- Variabel untuk sinkronisasi waktu ---
let timeOffset = 0;

// --- Fungsi untuk mengambil waktu server dan menghitung offset ---
async function synchronizeClock() {
    try {
        const response = await fetch('/api/server-time');
        const data = await response.json();
        const serverTime = new Date(data.serverTime).getTime();
        const clientTime = new Date().getTime();
        timeOffset = serverTime - clientTime; // Hitung selisih waktu
    } catch (error) {
        console.error('Gagal sinkronisasi waktu dengan server:', error);
    }
}

// --- Main Initializer on Page Load ---
async function initializePageFeatures() {
    await synchronizeClock(); // Tunggu hingga offset selesai dihitung
    
    // 🔥 PERBAIKAN: Kirim sinyal bahwa waktu sudah siap
    // Ini memberitahu script lain (table.js/analytics.js) untuk mulai bekerja
    const event = new CustomEvent('time-synchronized', { detail: { offset: timeOffset } });
    document.dispatchEvent(event);
    console.log("System Clock Synchronized. Offset:", timeOffset);

    loadUserData();
    
    const clockContainer = document.getElementById('utc-clock-container');
    const currentPage = window.location.pathname;
    const pagesWithClock = ['/', '/map.html', '/realtime', '/realtime.html', '/table', '/table.html', '/analytics', '/analytics.html'];

    if (clockContainer && pagesWithClock.includes(currentPage)) {
        clockContainer.style.display = 'block'; 
        updateUtcClock();
        setInterval(updateUtcClock, 1000);
    }
}

// Fungsi jam
function updateUtcClock() {
    const dateDisplay = document.getElementById('utc-date-display');
    const timeDisplay = document.getElementById('utc-time-display');
    if (!dateDisplay || !timeDisplay) return;

    // Gunakan waktu klien + offset untuk mendapatkan waktu server yang disimulasikan
    const clientNow = new Date().getTime();
    const serverNow = new Date(clientNow + timeOffset);

    const pad = (num) => num.toString().padStart(2, '0');

    // Format Tanggal (DD/MM/YYYY)
    const day = pad(serverNow.getUTCDate());
    const month = pad(serverNow.getUTCMonth() + 1); // Bulan dimulai dari 0
    const year = serverNow.getUTCFullYear();

    // Format Waktu (HH:MM:SS)
    const hours = pad(serverNow.getUTCHours());
    const minutes = pad(serverNow.getUTCMinutes());
    const seconds = pad(serverNow.getUTCSeconds());

    dateDisplay.textContent = `${day}/${month}/${year}`;
    timeDisplay.textContent = `${hours}:${minutes}:${seconds} UTC`;
}

// --- User & Header Functions ---
async function loadUserData() {
    try {
        const response = await fetch('/api/user/current');
        if (response.ok) {
            const user = await response.json();
            const usernameDisplay = document.getElementById('username-display');
            if (usernameDisplay) {
                usernameDisplay.textContent = user.username.toUpperCase();
            }
            if (user.role !== 'admin') {
                const adminLink = document.querySelector('a[href="/admin"]');
                if (adminLink) adminLink.style.display = 'none';
            }
        }
    } catch (error) { console.error('Gagal memuat data pengguna:', error); }
}

// --- Fungsi-fungsi Bersama ---
async function getStationList() {
    if (cachedStations) {
        return cachedStations;
    }
    try {
        const response = await fetch('/api/stations');
        const stations = await response.json();
        cachedStations = stations.sort((a, b) => a.nama_stasiun.localeCompare(b.nama_stasiun));
        return cachedStations;
    } catch (error) {
        console.error("Gagal memuat daftar stasiun:", error);
        return [];
    }
}

function updateCachedStationParameters(stationId, newParameters) {
    if (cachedStations) {
        const stationIndex = cachedStations.findIndex(s => s.id_stasiun === stationId);
        if (stationIndex > -1) {
            cachedStations[stationIndex].parameters = newParameters;
        }
    }
}

// --- FUNGSI UNTUK KEBUTUHAN ADMIN ---
async function getAvailableIcaoTags() {
    try {
        const response = await fetch('/api/meta/icaos');
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Gagal memuat ICAO tags:", error);
        return [];
    }
}

async function getAvailableRunwayTags(icao) {
    if (!icao) return [];
    try {
        const response = await fetch(`/api/meta/runways?icao=${icao}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Gagal memuat Runway tags:", error);
        return [];
    }
}

// --- Helper Function ---
function populateSelect(selectElement, options, config) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">${config.defaultText}</option>`;
    options.forEach(opt => {
        const value = (typeof opt === 'object' && config.valueKey) ? opt[config.valueKey] : opt;
        const text = (typeof opt === 'object' && config.textKey) ? opt[config.textKey] : opt;
        selectElement.add(new Option(text, value));
    });
}

// --- FUNGSI KHUSUS UNTUK HALAMAN DENGAN FILTER UTAMA ---
async function fetchAndPopulateSelectors() {
    if (!stationSelector) return;
    
    try {
        const stations = await getStationList();
        
        populateSelect(stationSelector, stations, {
            defaultText: "Pilih Stasiun",
            valueKey: "id_stasiun",
            textKey: "nama_stasiun"
        });

        if (stations.length > 0) {
            stationSelector.selectedIndex = 1;
        }

        if (typeof window.updateDashboard === 'function') {
            await window.updateDashboard();
        }

    } catch (error) { console.error("Gagal memuat filter:", error); }
}

// Event listener untuk filter utama
if (stationSelector) {
    stationSelector.addEventListener('change', async () => {
        if (typeof window.updateDashboard === 'function') {
            await window.updateDashboard();
        }
    });
}

// Panggil fungsi inisialisasi filter setelah DOM dimuat
document.addEventListener('DOMContentLoaded', fetchAndPopulateSelectors);
