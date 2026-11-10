// public/js/map.js - FINAL COMPLETE VERSION
// Fitur: Icon Kecil, Cluster Tooltip, Single Marker Tooltip, Clean Name

document.addEventListener('DOMContentLoaded', () => {

    // 1. Inisialisasi Peta
    const map = L.map('map').setView([-2.5489, 118.0149], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // --- KONFIGURASI ICON [UPDATED SIZE] ---
    const baseIconConfig = {
        iconSize: [25, 30],
        iconAnchor: [12, 30],
        popupAnchor: [1, -34]
    };

    const greenIcon = L.icon({ ...baseIconConfig, iconUrl: 'assets/img/green_plane.png' });
    const yellowIcon = L.icon({ ...baseIconConfig, iconUrl: 'assets/img/yellow_plane.png' });
    const redIcon = L.icon({ ...baseIconConfig, iconUrl: 'assets/img/red_plane.png' });

    // Helper: Ambil Objek Icon Leaflet
    function getAirplaneIcon(status) {
        if (status === 'green') return greenIcon;
        if (status === 'yellow') return yellowIcon;
        return redIcon;
    }

    // Helper: Ambil URL Gambar untuk Cluster HTML
    function getAirplaneImgUrl(status) {
        if (status === 'green') return 'assets/img/green_plane.png';
        if (status === 'yellow') return 'assets/img/yellow_plane.png';
        return 'assets/img/red_plane.png';
    }

    // --- FUNGSI CUSTOM CLUSTER (PESAWAT DENGAN BADGE) ---
    function createAirplaneClusterIcon(status, count) {
        const imgUrl = getAirplaneImgUrl(status);
        
        // Tentukan warna badge
        let badgeClass = 'badge-green';
        if (status === 'yellow') badgeClass = 'badge-yellow';
        if (status === 'red') badgeClass = 'badge-red';

        return L.divIcon({
            html: `
                <div class="cluster-wrapper">
                    <img src="${imgUrl}" style="width:100%; height:100%;">
                    <span class="cluster-badge ${badgeClass}">${count}</span>
                </div>
            `,
            className: 'custom-airplane-cluster',
            iconSize: [25, 30],
            iconAnchor: [12, 30],
            popupAnchor: [1, -34]
        });
    }

    // Global Variables
    let singleMarkers = [];
    let allStationsData = []; 
    let markerMap = {}; 

    // --- FUNGSI UTAMA: LOAD STATIONS ---
    async function loadStations() {
        try {
            const response = await fetch('/api/stations/status');
            const stationsWithStatus = await response.json();
            
            // Simpan data global
            allStationsData = stationsWithStatus;
            singleMarkers = []; 
            markerMap = {};
            
            // Counter Summary
            let countTotal = stationsWithStatus.length;
            let countGreen = 0, countYellow = 0, countRed = 0;

            // 1. Grouping Data by ICAO
            const stationsByIcao = {};

            stationsWithStatus.forEach(station => {
                let statusIndividu = 'red';
                if (station.last_update) {
                    const diffHours = (new Date() - new Date(station.last_update)) / (1000 * 60 * 60);
                    if (diffHours < 12) statusIndividu = 'green';
                    else if (diffHours < 24) statusIndividu = 'yellow';
                }

                // Simpan status
                station.computedStatus = statusIndividu;

                // Update Counter
                if (statusIndividu === 'green') countGreen++;
                else if (statusIndividu === 'yellow') countYellow++;
                else countRed++;

                if (!stationsByIcao[station.icao]) stationsByIcao[station.icao] = [];
                stationsByIcao[station.icao].push(station);
            });

            // 2. Render Cluster Per ICAO
            Object.keys(stationsByIcao).forEach(icao => {
                const stationList = stationsByIcao[icao];
                const isSingleStation = (stationList.length === 1); 

                // --- [NAMA BERSIH] ---
                // Ambil nama stasiun pertama & hapus teks mulai dari tanda kurung '('
                const rawName = stationList[0].nama_stasiun;
                const cleanName = rawName.split('(')[0].trim();

                // Tentukan Status Terburuk ICAO
                let icaoStatus = 'green';
                let hasRed = false, hasYellow = false;
                stationList.forEach(s => {
                    if (s.computedStatus === 'red') hasRed = true;
                    if (s.computedStatus === 'yellow') hasYellow = true;
                });
                if (hasRed) icaoStatus = 'red';
                else if (hasYellow) icaoStatus = 'yellow';

                // Config Cluster Group
                const icaoClusterGroup = L.markerClusterGroup({
                    disableClusteringAtZoom: 15,
                    spiderfyOnMaxZoom: true,
                    showCoverageOnHover: false,
                    zoomToBoundsOnClick: true,
                    maxClusterRadius: 80,
                    
                    // Custom Icon: Pesawat + Badge
                    iconCreateFunction: function (cluster) {
                        const count = cluster.getChildCount();
                        return createAirplaneClusterIcon(icaoStatus, count);
                    }
                });

                // --- [TOOLTIP CLUSTER (Angka 2+)] ---
                icaoClusterGroup.on('clustermouseover', function (e) {
                    if (!e.layer.getTooltip()) {
                        e.layer.bindTooltip(cleanName, {
                            direction: 'top',
                            offset: [0, -20],
                            opacity: 0.95,
                            className: 'fw-bold px-2 py-1 border-0 shadow-sm rounded'
                        }).openTooltip();
                    }
                });

                // Tambah Marker ke Cluster
                stationList.forEach(station => {
                    let initialIcon;
                    
                    // Logika Tampilan Awal
                    if (isSingleStation) {
                        if (map.getZoom() < 15) {
                            // Jauh: Pesawat + Badge "1"
                            initialIcon = createAirplaneClusterIcon(station.computedStatus, 1);
                        } else {
                            // Dekat: Pesawat Biasa
                            initialIcon = getAirplaneIcon(station.computedStatus);
                        }
                    } else {
                        initialIcon = getAirplaneIcon(station.computedStatus);
                    }

                    const marker = L.marker([station.latitude, station.longitude], { icon: initialIcon });

                    // --- [TOOLTIP MARKER (Angka 1 / Single)] ---
                    // Muncul saat hover di marker satuan agar konsisten dengan cluster
                    marker.bindTooltip(cleanName, {
                        direction: 'top',
                        offset: [0, -20],
                        opacity: 0.95,
                        className: 'fw-bold px-2 py-1 border-0 shadow-sm rounded'
                    });

                    // Simpan referensi
                    markerMap[station.id_stasiun] = { marker: marker, station: station, isSingle: isSingleStation };

                    // Event Klik Marker
                    marker.on('click', () => { handleMarkerClick(station, marker, isSingleStation); });

                    if (isSingleStation) {
                        singleMarkers.push({ marker: marker, status: station.computedStatus });
                    }

                    icaoClusterGroup.addLayer(marker);
                });

                map.addLayer(icaoClusterGroup);
            });

            // 3. Update Summary & Setup Events
            updateSummary(countTotal, countGreen, countYellow, countRed);
            setupFilterEvents();

        } catch (error) {
            console.error("Gagal memuat daftar stasiun:", error);
        }
    }

    // Update UI Summary Card
    function updateSummary(total, green, yellow, red) {
        if(document.getElementById('count-total')) {
            document.getElementById('count-total').innerText = total;
            document.getElementById('count-green').innerText = green;
            document.getElementById('count-yellow').innerText = yellow;
            document.getElementById('count-red').innerText = red;
        }
    }

    // --- FITUR LIST & FILTER ---
    function setupFilterEvents() {
        const modal = document.getElementById('station-list-modal');
        const summaryCard = document.querySelector('.map-summary-card');

        // Close Button
        document.getElementById('close-list-btn').onclick = () => { modal.style.display = 'none'; };

        // Klik Baris Summary
        document.getElementById('btn-filter-green').onclick = () => showStationList('green', 'Online');
        document.getElementById('btn-filter-yellow').onclick = () => showStationList('yellow', 'Warning');
        document.getElementById('btn-filter-red').onclick = () => showStationList('red', 'Offline');

        // Klik Outside to Close
        document.addEventListener('click', function(event) {
            if (modal.style.display === 'flex') {
                const isClickInsideModal = modal.contains(event.target);
                const isClickInsideSummary = summaryCard.contains(event.target);
                if (!isClickInsideModal && !isClickInsideSummary) {
                    modal.style.display = 'none';
                }
            }
        });
    }

    function showStationList(statusFilter, title) {
        const listContainer = document.getElementById('station-list-ul');
        const modal = document.getElementById('station-list-modal');
        const titleEl = document.getElementById('list-title');

        const filtered = allStationsData.filter(s => s.computedStatus === statusFilter);

        listContainer.innerHTML = '';
        titleEl.innerText = `${title} (${filtered.length})`;
        
        titleEl.className = 'mb-0 fw-bold';
        if(statusFilter === 'green') titleEl.classList.add('text-success');
        else if(statusFilter === 'yellow') titleEl.classList.add('text-warning');
        else titleEl.classList.add('text-danger');

        if (filtered.length === 0) {
            listContainer.innerHTML = '<li class="list-group-item text-muted text-center py-3">Tidak ada data.</li>';
        } else {
            filtered.forEach(s => {
                const li = document.createElement('li');
                li.className = 'station-list-item';
                
                let timeStr = '-';
                if(s.last_update) {
                    const d = new Date(s.last_update);
                    timeStr = `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;
                }

                li.innerHTML = `<span class="item-time">${timeStr}</span><span class="item-name">${s.nama_stasiun}</span><span class="item-meta">${s.icao} / ${s.runway}</span>`;
                
                li.onclick = () => {
                    const target = markerMap[s.id_stasiun];
                    if (target) {
                        modal.style.display = 'none'; 
                        map.flyTo([s.latitude, s.longitude], 16, { duration: 1.5 });
                        map.once('moveend', () => {
                            if(target.isSingle) target.marker.setIcon(getAirplaneIcon(s.computedStatus));
                            setTimeout(() => { fetchWeatherData(s, target.marker); }, 200);
                        });
                    }
                };
                listContainer.appendChild(li);
            });
        }
        modal.style.display = 'flex';
    }

    // Logika Klik Marker
    function handleMarkerClick(station, marker, isSingleStation) {
        const currentZoom = map.getZoom();
        
        // Jika stasiun tunggal dan jauh, zoom dulu
        if (isSingleStation && currentZoom < 15) {
            map.flyTo([station.latitude, station.longitude], 16, { duration: 1.2 });
            map.once('moveend', () => {
                marker.setIcon(getAirplaneIcon(station.computedStatus));
                setTimeout(() => { fetchWeatherData(station, marker); }, 150); 
            });
        } else {
            fetchWeatherData(station, marker);
        }
    }

    // Event Zoom: Update Icon Single Station
    map.on('zoomend', () => {
        const currentZoom = map.getZoom();
        singleMarkers.forEach(item => {
            if (currentZoom >= 15) {
                item.marker.setIcon(getAirplaneIcon(item.status));
            } else {
                // Kembali ke Pesawat+Badge saat zoom out
                item.marker.setIcon(createAirplaneClusterIcon(item.status, 1));
            }
        });
    });

    // Helper: Hitung Persentase Kelengkapan Data
    function calculateDataQuality(dataItem, parameterList) {
        if (!dataItem || !parameterList || parameterList.length === 0) return 0;
        
        let validCount = 0;
        parameterList.forEach(key => {
            // Cek apakah nilai tidak null, tidak undefined, dan bukan string kosong
            const val = dataItem[key];
            if (val !== null && val !== undefined && val !== '') {
                validCount++;
            }
        });

        return (validCount / parameterList.length) * 100;
    }

    // --- FUNGSI POPUP ---
    async function fetchWeatherData(station, marker) {
        try {
            marker.unbindPopup();

            // 1. Tentukan Status Awal Berdasarkan Waktu
            let statusClass = 'status-border-red'; // Default Merah
            let isTimeOnline = false;

            if (station.last_update) {
                const diffHours = (new Date() - new Date(station.last_update)) / 36e5;
                if (diffHours < 12) {
                    statusClass = 'status-border-green';
                    isTimeOnline = true;
                } else if (diffHours < 24) {
                    statusClass = 'status-border-yellow';
                }
            }

// 2. Loading State
            const loadingContent = `
                <div class="popup-container">
                    <div class="popup-header ${statusClass}">
                        <h6>${station.nama_stasiun}</h6>
                        <p>${station.icao} / Runway ${station.runway}</p>
                    </div>
                    <div class="popup-body" style="text-align:center; padding: 40px 20px;">
                        <div style="display:inline-block; width:24px; height:24px; border:3px solid #eee; border-top-color:#0d6efd; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                        <p style="margin:10px 0 0 0; font-size:12px; color:#999; font-weight:500;">Validasi data...</p>
                    </div>
                </div>
                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
            `;
            marker.bindPopup(loadingContent, { maxWidth: 320 }).openPopup();

            let lastData = null;
            let displayMode = 'OFFLINE'; // Bisa 'LIVE', 'OFFLINE', 'BAD_QUALITY'

            // 3. Logika Utama Pengambilan Data
            
            // A. Coba ambil data Live (-20 menit)
            if (isTimeOnline) {
                try {
                    const response = await fetch(`/api/weather/history?stationId=${station.id_stasiun}&range=-20m`);
                    const apiData = await response.json();
                    
                    if (Array.isArray(apiData) && apiData.length > 0) {
                        const candidateData = apiData[apiData.length - 1]; // Data paling baru
                        
                        // CEK KUALITAS: Apakah > 25% parameter terisi?
                        const quality = calculateDataQuality(candidateData, station.parameters);
                        
                        if (quality >= 25) {
                            lastData = candidateData;
                            displayMode = 'LIVE';
                        } else {
                            // Waktu Online, tapi Data Jelek (< 25%)
                            // Kita paksa status jadi merah dan cari data lama yang bagus
                            console.warn(`Station ${station.icao} Live but Low Quality (${quality.toFixed(1)}%). Fallback search.`);
                            statusClass = 'status-border-red'; // Ubah header jadi merah
                            displayMode = 'BAD_QUALITY';
                        }
                    }
                } catch (e) { console.error("Gagal fetch live", e); }
            }

            // B. Jika tidak Live atau Kualitas Jelek -> Cari Data Lama yang Bagus (Fallback)
            if (!lastData) {
                // Kita ambil history 7 hari ke belakang (Array)
                // Kenapa array? Karena kita harus loop mundur mencari data yang > 25%
                // Endpoint 'latest' hanya mengembalikan 1 baris terakhir (yang mungkin juga jelek)
                const response = await fetch(`/api/weather/history?stationId=${station.id_stasiun}&range=-7d`); 
                const historyData = await response.json();

                if (Array.isArray(historyData) && historyData.length > 0) {
                    // Loop dari belakang (paling baru) ke depan
                    for (let i = historyData.length - 1; i >= 0; i--) {
                        const row = historyData[i];
                        const q = calculateDataQuality(row, station.parameters);
                        if (q >= 25) {
                            lastData = row;
                            break; // Ketemu data bagus terakhir
                        }
                    }
                }
            }

            // 4. Update Header Warna (Jika fallback karena kualitas buruk, paksa merah)
            // Kita lakukan manipulasi DOM string nanti di newPopupContent

            // 5. Render Konten
            let contentBody = '';
            if (lastData) {
                const date = new Date(lastData._time);
                const pad = (num) => num.toString().padStart(2, '0');
                const timeString = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} (UTC)`;

                let rowsHtml = '';
                if (station.parameters && Array.isArray(station.parameters)) {
                    station.parameters.forEach(paramKey => {
                        const config = parameterConfig[paramKey] || { label: paramKey, unit: "" };
                        const rawValue = lastData[paramKey];
                        const value = (rawValue !== undefined && rawValue !== null) ? (typeof rawValue === 'number' ? rawValue.toFixed(1) : rawValue) : '--'; 
                        const unit = config.unit ? ` ${config.unit}` : '';
                        rowsHtml += `<tr><td>${config.label}</td><td>${value}${unit}</td></tr>`;
                    }); 
                }
                
                // Label Status
                let badgeHtml = '';
                if (displayMode === 'LIVE') {
                    badgeHtml = `<span class="badge bg-success" style="font-size:9px;">LIVE</span>`;
                } else if (displayMode === 'BAD_QUALITY') {
                    badgeHtml = `<span class="badge bg-danger" style="font-size:9px;">SENSOR ERROR (Last Good Data)</span>`;
                } else {
                    badgeHtml = `<span class="badge bg-secondary" style="font-size:9px;">OFFLINE (Last Record)</span>`;
                }

                contentBody = `
                    <div class="popup-time" style="justify-content: space-between;">
                        <span>${timeString}</span>
                        ${badgeHtml}
                    </div>
                    <table class="popup-table"><tbody>${rowsHtml}</tbody></table>`;
            } else {
                contentBody = `<div style="padding:20px; text-align:center; color:#dc3545;"><p style="margin-top:5px; font-size:13px;">Data valid tidak ditemukan (> 7 hari).</p></div>`;
            }

            const newPopupContent = `
                <div class="popup-container">
                    <div class="popup-header ${statusClass}">
                        <h6>${station.nama_stasiun}</h6>
                        <p>${station.icao} / Runway ${station.runway}</p>
                    </div>
                    <div class="popup-body">${contentBody}</div>
                    <div class="popup-footer">
                        <a href="/realtime?stationId=${station.id_stasiun}" class="popup-btn btn-realtime">Live</a>
                        <a href="/table?stationId=${station.id_stasiun}" class="popup-btn btn-datatable">Table</a>
                        <a href="/analytics?stationId=${station.id_stasiun}" class="popup-btn btn-analytics">Chart</a>
                    </div>
                </div>
            `;
            marker.setPopupContent(newPopupContent);

        } catch (error) {
            console.error(`Gagal data cuaca ${station.icao}:`, error);
            marker.setPopupContent(`<div style="padding:20px; text-align:center; color:red;">Gagal memuat data.</div>`);
        }
    }

    loadStations();
});
