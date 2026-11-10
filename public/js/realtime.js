// public/js/realtime.js - VERSI STABIL + SAFETY PATCH

document.addEventListener('DOMContentLoaded', () => {
    // --- Elemen DOM ---
    const dashboardTitle = document.getElementById('dashboard-title');
    const stationSubtitle = document.getElementById('station-subtitle');
    const windCardContainer = document.getElementById('wind-card-container');
    const lastUpdateSpan = document.getElementById('last-update');
    
    // Container untuk kartu parameter lain
    const eightCardLayout = document.getElementById('eight-card-layout');
    const eightCardLeftCol = document.getElementById('eight-card-left-col');
    const eightCardRightCol = document.getElementById('eight-card-right-col');
    const defaultCardsContainer = document.getElementById('default-cards-container');
    
    // Kontrol
    const toggleDragBtn = document.getElementById('toggle-drag-btn');
    const liveIndicator = document.getElementById('live-indicator');
    const darkModeBtn = document.getElementById('dark-mode-btn'); // Tambahan definisi tombol
    
    // --- State Variables ---
    let currentStationParameters = [];
    let sortableInstances = [];
    let isDragEnabled = true;
    let socket = null; 
    
    // Variabel PENTING untuk animasi halus
    let currentRotation = 0; 

    // --- Fungsi Bantuan ---
    function getStationIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('stationId');
    }

    // --- [PATCH] Generator Kartu Standar yang Lebih Aman ---
    function createStandardCardHTML(paramKey, value, columnClass) {
        // Default Config jika parameterConfig tidak ditemukan/error
        let config = { label: paramKey.replace(/_/g, ' '), unit: '' };

        // Cek apakah parameterConfig (dari common.js) sudah dimuat dengan benar?
        if (typeof parameterConfig !== 'undefined' && parameterConfig && parameterConfig[paramKey]) {
            config = parameterConfig[paramKey];
        }

        const displayValue = (value !== undefined && value !== null) ? (typeof value === 'number' ? value.toFixed(1) : value) : '--';
        
        return `
            <div class="${columnClass}" data-param-key="${paramKey}">
                <div class="data-card">
                    <div class="card-label">${config.label}</div>
                    <div class="card-value">${displayValue}</div>
                    <div class="card-unit">${config.unit || '&nbsp;'}</div>
                </div>
            </div>`;
    }

    // Generator Kartu Angin (Hanya dipanggil sekali saat inisialisasi)
    function createWindCardHTML(data) {
        // Buat Skala Nonius (Titik-titik melingkar)
        let vernierTicks = '';
        const centerX = 400, centerY = 300, radius = 148;
        for (let i = 10; i < 360; i += 10) {
            if (i % 30 === 0) continue;
            const angleRad = (i - 90) * (Math.PI / 180);
            const x = centerX + radius * Math.cos(angleRad);
            const y = centerY + radius * Math.sin(angleRad);
            vernierTicks += `<circle class="cls-2" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2"/>`;
        }

        // Return HTML dengan ID spesifik agar bisa di-update via JS
        return `
            <div class="card p-3 h-100 d-flex flex-column" id="wind-card-wrapper">
                <div class="card-title w-100 flex-row d-flex align-items-start justify-content-between">
                    <span class="fs-6 me-2">Wind Display</span>
                    <span class="badge bg-danger animate-pulse" style="font-size: 0.6em;">LIVE</span>
                </div>
                <div class="p-0 flex-grow-1 d-flex align-items-center justify-content-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="181 110 450 450">
                        <defs>
                            <style>.cls-1{fill:#fff;stroke:#fe3e3d;stroke-miterlimit:10;stroke-width:6px;}.cls-2,.cls-3,.cls-4{fill:#777;}.cls-3{font-family:Arial-Black,Arial;font-size:20px;}.cls-5{filter:url(#drop-shadow-1);}.cls-4{font-family:Arial-BoldMT,Arial;font-size:20px;font-weight:700;}.cls-6{fill:#fe3e3d;}.cls-7{font-family:Arial-BoldMT,Arial;font-size:45px;font-weight:700;text-align:center;fill:#fff;text-anchor:middle;}.cls-8{font-family:Arial-BoldMT,Arial;font-size:40px;font-weight:700;text-align:center;text-anchor:middle;}.cls-9{font-family:Arial-BoldMT,Arial;font-size:19px;font-weight:700;text-align:center;fill:#fff;text-anchor:middle;}</style>
                            <filter id="drop-shadow-1" filterUnits="userSpaceOnUse"><feOffset dx="0" dy="4"/><feGaussianBlur result="blur" stdDeviation="8"/><feFlood flood-color="#000" flood-opacity=".19"/><feComposite in2="blur" operator="in"/><feComposite in="SourceGraphic"/></filter>
                        </defs>
                        <g class="cls-5"><circle class="cls-6" cx="400" cy="270.75" r="75"/><circle class="cls-1" cx="400" cy="360.25" r="55"/></g>
                        
                        <g id="needle-group" transform="rotate(0, 400, 300)">
                            <polygon class="cls-6" transform="translate(400 300)" points="155,-15 120,0 155,15"/>
                        </g>

                        <g>
                            <circle class="cls-2" cx="400" cy="152" r="3"/><circle class="cls-2" cx="326" cy="171.83" r="3"/><circle class="cls-2" cx="271.83" cy="226" r="3"/><circle class="cls-2" cx="252" cy="300" r="3"/><circle class="cls-2" cx="271.83" cy="374" r="3"/><circle class="cls-2" cx="326" cy="428.17" r="3"/><circle class="cls-2" cx="400" cy="448" r="3"/><circle class="cls-2" cx="474" cy="428.17" r="3"/><circle class="cls-2" cx="528.17" cy="374" r="3"/><circle class="cls-2" cx="548" cy="300" r="3"/><circle class="cls-2" cx="528.17" cy="226" r="3"/><circle class="cls-2" cx="474" cy="171.83" r="3"/>
                            ${vernierTicks}
                            
                            <text class="cls-4" transform="translate(392.78 127.1)"><tspan x="0" y="0">N</tspan></text>
                            <text class="cls-3" transform="translate(296.56 161.43) rotate(-30)"><tspan x="0" y="0">330</tspan></text>
                            <text class="cls-3" transform="translate(241.42 232.79) rotate(-60)"><tspan x="0" y="0">300</tspan></text>
                            <text class="cls-4" transform="translate(229.35 308.69) rotate(-90)"><tspan x="0" y="0">W</tspan></text>
                            <text class="cls-3" transform="translate(263.68 405.69) rotate(-120)"><tspan x="0" y="0">240</tspan></text>
                            <text class="cls-3" transform="translate(335.04 460.83) rotate(-150)"><tspan x="0" y="0">210</tspan></text>
                            <text class="cls-4" transform="translate(407.72 472.9) rotate(-180)"><tspan x="0" y="0">S</tspan></text>
                            <text class="cls-3" transform="translate(507.94 438.57) rotate(150)"><tspan x="0" y="0">150</tspan></text>
                            <text class="cls-3" transform="translate(563.08 367.21) rotate(120)"><tspan x="0" y="0">120</tspan></text>
                            <text class="cls-4" transform="translate(575.15 293.08) rotate(90)"><tspan x="0" y="0">E</tspan></text>
                            <text class="cls-3" transform="translate(544.16 200.08) rotate(60)"><tspan x="0" y="0">60</tspan></text>
                            <text class="cls-3" transform="translate(475.24 142.5) rotate(30)"><tspan x="0"y="0">30</tspan></text>
                            
                            <text class="cls-7" transform="translate(400 280)">
                                <tspan id="wind-speed-text" x="0" y="0">--</tspan>
                            </text>
                            <text class="cls-9" transform="translate(400 300)"><tspan x="0" y="0">knot</tspan></text>
                            <text class="cls-8" transform="translate(404.72 375)">
                                <tspan id="wind-dir-text" x="0" y="0">--&#176;</tspan>
                            </text>
                        </g>
                    </svg>
                </div>
            </div>`;
    }

    // --- Drag & Drop ---
    function initializeSortable(stationId) {
        sortableInstances.forEach(s => s.destroy());
        sortableInstances = [];
        const containers = [defaultCardsContainer, eightCardLeftCol, eightCardRightCol];
        containers.forEach(container => {
            if (container) {
                sortableInstances.push(new Sortable(container, {
                    animation: 150,
                    group: 'shared-cards',
                    disabled: !isDragEnabled,
                    onEnd: () => saveNewOrder(stationId)
                }));
            }
        });
    }

    async function saveNewOrder(stationId) {
        const otherCardsOrder = Array.from(document.querySelectorAll('#default-cards-container [data-param-key], #eight-card-layout [data-param-key]')).map(el => el.dataset.paramKey);
        const windParams = ['wind_direction', 'wind_speed'];
        const existingWindParams = currentStationParameters.filter(p => windParams.includes(p));
        const finalParameterList = [...existingWindParams, ...otherCardsOrder];

        try {
            const response = await fetch(`/api/stations/${stationId}/parameters`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parameters: finalParameterList })
            });
            if (response.ok) {
                console.log("Urutan parameter tersimpan.");
                if(typeof updateCachedStationParameters === 'function') {
                    updateCachedStationParameters(stationId, finalParameterList);
                }
                currentStationParameters = finalParameterList;
            }
        } catch (error) { console.error("Gagal simpan urutan:", error); }
    }

    // --- LOGIKA UTAMA RENDER ---
    function renderDashboard(data, stationId) {
        if (!data || Object.keys(data).length === 0) {
            defaultCardsContainer.innerHTML = '<p class="text-center col-12">Menunggu data real-time...</p>';
            return;
        }

        // --- 1. UPDATE KARTU ANGIN (Smooth) ---
        const windDir = data.wind_direction !== null ? data.wind_direction : 0;
        const windSpeed = data.wind_speed !== null ? data.wind_speed.toFixed(1) : '--';
        
        // Cek apakah kartu angin sudah ada?
        const existingWindCard = document.getElementById('wind-card-wrapper');

        if (!existingWindCard) {
            // Render Awal (Buat Baru)
            if (currentStationParameters.includes('wind_direction')) {
                windCardContainer.innerHTML = createWindCardHTML(data);
            }
        } else {
            // Update Existing (Hanya ubah angka & rotasi)
            const speedText = document.getElementById('wind-speed-text');
            const dirText = document.getElementById('wind-dir-text');
            const needle = document.getElementById('needle-group');

            if (speedText) speedText.textContent = windSpeed;
            if (dirText) dirText.innerHTML = `${windDir.toFixed(0)}&#176;`;

            if (needle) {
                // Logika Jalur Terpendek
                let targetAngle = parseInt(windDir) - 90; // -90 koreksi gambar asli
                let delta = targetAngle - (currentRotation % 360);
                
                // Normalisasi -180 s/d 180
                if (delta > 180) delta -= 360;
                if (delta < -180) delta += 360;

                currentRotation += delta; // Akumulasi rotasi
                needle.style.transform = `rotate(${currentRotation}deg)`;
            }
        }

        // --- 2. UPDATE KARTU LAINNYA ---
        defaultCardsContainer.innerHTML = '';
        eightCardLayout.style.display = 'none';
        eightCardLeftCol.innerHTML = '';
        eightCardRightCol.innerHTML = '';
        defaultCardsContainer.style.display = 'flex';

        const otherParameters = currentStationParameters.filter(p => !['wind_direction', 'wind_speed'].includes(p));

        if (otherParameters.length > 0 && otherParameters.length % 2 === 0) {
            // Layout 2 Kolom (jika genap)
            const numCols = otherParameters.length / 2;
            let bootstrapColNum = numCols > 0 && 12 % numCols === 0 ? 12 / numCols : 6;
            const colClass = `col-lg-${bootstrapColNum} col-md-6 col-12`;
            otherParameters.forEach(paramKey => {
                defaultCardsContainer.insertAdjacentHTML('beforeend', createStandardCardHTML(paramKey, data[paramKey], colClass));
            });
        } else {
            // Layout Standar
            otherParameters.forEach(paramKey => {
                defaultCardsContainer.insertAdjacentHTML('beforeend', createStandardCardHTML(paramKey, data[paramKey], 'col-lg-4 col-md-6 col-12'));
            });
        }
        
        // --- 3. UPDATE WAKTU ---
        const updateTime = new Date(data._time);
        const pad = (n) => String(n).padStart(2, '0');
        if (lastUpdateSpan) {
            lastUpdateSpan.textContent = `${pad(updateTime.getUTCDate())}/${pad(updateTime.getUTCMonth() + 1)}/${updateTime.getUTCFullYear()} ${pad(updateTime.getUTCHours())}:${pad(updateTime.getUTCMinutes())}:${pad(updateTime.getUTCSeconds())} UTC`;
        }

        initializeSortable(stationId);
    }

    // --- FUNGSI SKELETON (Ilusi Loading) ---
    function showSkeletonDashboard() {
        // Skeleton Kiri
        windCardContainer.innerHTML = `
            <div class="card p-3 h-100 d-flex flex-column" style="min-height: 300px;">
                <div class="d-flex justify-content-between mb-3">
                    <div class="skeleton skeleton-text" style="width: 100px;"></div>
                    <div class="skeleton skeleton-text" style="width: 40px;"></div>
                </div>
                <div class="flex-grow-1 d-flex align-items-center justify-content-center">
                    <div class="skeleton" style="width: 200px; height: 200px; border-radius: 50%;"></div>
                </div>
            </div>
        `;
        // Skeleton Kanan
        defaultCardsContainer.innerHTML = '';
        defaultCardsContainer.style.display = 'flex';
        eightCardLayout.style.display = 'none';
        for(let i=0; i<6; i++) {
            defaultCardsContainer.insertAdjacentHTML('beforeend', `
                <div class="col-lg-4 col-md-6 col-12">
                    <div class="data-card p-4">
                        <div class="skeleton skeleton-text" style="width: 60%;"></div>
                        <div class="skeleton skeleton-text" style="width: 80%; height: 2.5rem; margin-top: 10px;"></div>
                        <div class="skeleton skeleton-text" style="width: 30%; margin-top: 5px;"></div>
                    </div>
                </div>
            `);
        }
    }

    // --- INISIALISASI ---
    async function initialize() {


        // --- B. LOGIKA UTAMA (STASIUN & DATA) ---
        const stationId = getStationIdFromUrl();

        if (stationId) {
            try {
                const allStations = await getStationList();
                const selectedStation = allStations.find(s => s.id_stasiun === stationId);
                
                if (selectedStation) {
                    currentStationParameters = selectedStation.parameters;
                    dashboardTitle.textContent = selectedStation.nama_stasiun;
                    stationSubtitle.textContent = `ICAO: ${selectedStation.icao} / Runway ${selectedStation.runway}`;

                    // TAMPILKAN SKELETON SEBELUM FETCH
                    showSkeletonDashboard();

                    // FETCH HTTP AWAL (SNAPSHOT)
                    try {
                        const response = await fetch(`/api/weather/latest?stationId=${stationId}`);
                        const initialData = await response.json();
                        renderDashboard(initialData, stationId);
                    } catch (e) { console.error("Fetch awal gagal", e); }

                    // WEBSOCKET CONNECTION
                    socket = io(); 
                    
                    socket.on('connect', () => {
                        console.log("WebSocket Terhubung.");
                        socket.emit('join_station', stationId);
                        if(liveIndicator) {
                            liveIndicator.className = 'status-dot connected'; 
                            liveIndicator.title = "Online: Standby";
                        }
                    });

                    socket.on('weather_update', (newData) => {
                        // Efek Kedip Dot
                        if(liveIndicator) {
                            liveIndicator.classList.add('active');
                            setTimeout(() => liveIndicator.classList.remove('active'), 300);
                            liveIndicator.title = "Data Live Diterima";
                        }
                        renderDashboard(newData, stationId);
                    });

                    socket.on('disconnect', () => {
                        if(liveIndicator) {
                            liveIndicator.className = 'status-dot disconnected';
                            liveIndicator.title = "Koneksi Terputus";
                        }
                    });

                } else {
                    dashboardTitle.textContent = "Stasiun Tidak Ditemukan";
                }
            } catch(e) {
                console.error("Gagal load stasiun:", e);
            }

            // Drag & Drop
            toggleDragBtn.addEventListener('click', () => {
                isDragEnabled = !isDragEnabled;
                sortableInstances.forEach(instance => instance.option('disabled', !isDragEnabled));
                if (isDragEnabled) {
                    toggleDragBtn.textContent = 'Drag&Drop Enable';
                    toggleDragBtn.classList.remove('btn-success');
                    toggleDragBtn.classList.add('btn-outline-primary');
                } else {
                    toggleDragBtn.textContent = 'Drag&Drop Disable';
                    toggleDragBtn.classList.remove('btn-outline-primary');
                    toggleDragBtn.classList.add('btn-success');
                }
            });
            toggleDragBtn.click(); // Default mati

        } else {
            dashboardTitle.textContent = "ID Stasiun Tidak Ada";
        }
    }
    
    initialize();
});
