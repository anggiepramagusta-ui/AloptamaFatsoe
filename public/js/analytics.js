// public/js/analytics.js - FINAL (CORRECT STACKING + SPEED LEGEND)

document.addEventListener('DOMContentLoaded', () => {
    const analyticsTitle = document.getElementById('analytics-title');
    const stationSubtitle = document.getElementById('station-subtitle');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const fetchDataBtn = document.getElementById('fetchDataBtn');
    const chartsGrid = document.getElementById('charts-grid');

    let currentStationId = null;
    let currentStationData = null;
    let chartInstances = []; 

    // --- 1. ASET GAMBAR PANAH ---
    const arrowSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4.5 20.29C4.5 20.29 4.38 21.32 5.5 20.95L12 18L18.5 20.95C19.62 21.32 19.5 20.29 19.5 20.29L12 2Z" 
              fill="#FFD700" stroke="#333333" stroke-width="2"/>
    </svg>`;
    const windArrowImage = new Image();
    windArrowImage.src = 'data:image/svg+xml;base64,' + btoa(arrowSvg);

    // --- 2. KONFIGURASI WARNA UMUM ---
    const colorMap = {
        'air_temperature': { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
        'dewpoint': { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' },
        'qnh': { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)' },      
        'qfe': { border: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },     
        'visibility': { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' },
        'precipitation': { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },
        'default': { border: '#6b7280', bg: 'rgba(107, 114, 128, 0.2)' }
    };

    const paramGroups = [
        { keys: ['air_temperature', 'dewpoint'], title: 'Temperature & Dew Point', type: 'standard' },
        { keys: ['qnh', 'qfe'], title: 'Pressure (QNH & QFE)', type: 'standard' },
        { keys: ['wind_speed', 'wind_direction'], title: 'Wind Speed & Direction', type: 'wind_combo' },
        { keys: ['visibility', 'present_weather'], title: 'Visibility & Present Weather', type: 'vis_weather_combo' }
    ];

    // --- 3. HELPER FUNCTIONS ---
    function getStationIdFromUrl() {
        return new URLSearchParams(window.location.search).get('stationId');
    }

    function formatDateDisplay(isoString) {
        if (!isoString) return '-';
        const d = new Date(isoString + ':00.000Z'); 
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    }

    function setDefaultDateTime() {
        const offset = (typeof timeOffset !== 'undefined') ? timeOffset : 0;
        const serverNow = new Date(new Date().getTime() + offset);
        const oneHourAgoServer = new Date(serverNow.getTime() - 60 * 60 * 1000); 

        const toLocalDatetimeString = (date) => {
            const pad = n => String(n).padStart(2, '0');
            return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
        };

        endTimeInput.value = toLocalDatetimeString(serverNow);
        startTimeInput.value = toLocalDatetimeString(oneHourAgoServer);
    }

    function parseToISO(rawString) {
        if (!rawString) return null;
        try { return new Date(rawString + ':00.000Z').toISOString(); } 
        catch (e) { return new Date(rawString).toISOString(); }
    }

    function downloadChartImage(chartInstance, chartTitle) {
        const originalCanvas = chartInstance.canvas;
        const width = originalCanvas.width;
        const height = originalCanvas.height;
        const headerHeight = 100;
        const totalHeight = height + headerHeight;

        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = totalHeight;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, totalHeight);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#1f2937'; 
        
        const centerX = width / 2;
        // Baris 1: Nama Stasiun (Bold, Besar)
        ctx.font = 'bold 24px Inter, sans-serif'; // Ukuran font menyesuaikan resolusi canvas
        const stationName = currentStationData ? currentStationData.nama_stasiun : 'Unknown Station';
        ctx.fillText(stationName, centerX, 40);

        // Baris 2: ICAO / Runway (Normal, Sedang)
        ctx.font = '16px Inter, sans-serif';
        const subInfo = currentStationData ? `ICAO: ${currentStationData.icao} / Runway ${currentStationData.runway}` : '';
        ctx.fillText(subInfo, centerX, 70);

        // Baris 3: Rentang Waktu (Normal, Kecil, Abu-abu)
        ctx.fillStyle = '#666666';
        ctx.font = '14px Inter, sans-serif';
        const startStr = formatDateDisplay(startTimeInput.value);
        const endStr = formatDateDisplay(endTimeInput.value);
        ctx.fillText(`Periode: ${startStr} - ${endStr} (UTC)`, centerX, 92);

        ctx.drawImage(originalCanvas, 0, headerHeight);

        const link = document.createElement('a');
        const cleanName = chartTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${cleanName}_${new Date().toISOString().slice(0,10)}.png`;
        link.href = tempCanvas.toDataURL('image/png', 1.0);
        link.click();
        link.remove();
    }

    // --- 4. LOGIKA WIND ROSE ---
    function calculateStackedWindRose(data) {
        const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        
        // Layering Logic:
        // L1: Semua Data (Base)
        // L2: > 4 kt
        // L3: > 10 kt
        // L4: > 20 kt
        
        const binsL1 = { 'N':0, 'NE':0, 'E':0, 'SE':0, 'S':0, 'SW':0, 'W':0, 'NW':0 };
        const binsL2 = { 'N':0, 'NE':0, 'E':0, 'SE':0, 'S':0, 'SW':0, 'W':0, 'NW':0 };
        const binsL3 = { 'N':0, 'NE':0, 'E':0, 'SE':0, 'S':0, 'SW':0, 'W':0, 'NW':0 };
        const binsL4 = { 'N':0, 'NE':0, 'E':0, 'SE':0, 'S':0, 'SW':0, 'W':0, 'NW':0 };
        
        let totalValid = 0;

        data.forEach(d => {
            if (d.wind_direction !== null && d.wind_speed !== null) {
                let deg = d.wind_direction % 360;
                let dirKey = '';

                if (deg >= 337.5 || deg < 22.5) dirKey = 'N';
                else if (deg >= 22.5 && deg < 67.5) dirKey = 'NE';
                else if (deg >= 67.5 && deg < 112.5) dirKey = 'E';
                else if (deg >= 112.5 && deg < 157.5) dirKey = 'SE';
                else if (deg >= 157.5 && deg < 202.5) dirKey = 'S';
                else if (deg >= 202.5 && deg < 247.5) dirKey = 'SW';
                else if (deg >= 247.5 && deg < 292.5) dirKey = 'W';
                else if (deg >= 292.5 && deg < 337.5) dirKey = 'NW';

                if (dirKey) {
                    binsL1[dirKey]++; // Selalu hitung (Base)
                    if (d.wind_speed >= 4) binsL2[dirKey]++;
                    if (d.wind_speed >= 10) binsL3[dirKey]++;
                    if (d.wind_speed >= 20) binsL4[dirKey]++;
                    totalValid++;
                }
            }
        });

        return {
            labels: labels,
            dataL1: labels.map(l => binsL1[l]),
            dataL2: labels.map(l => binsL2[l]),
            dataL3: labels.map(l => binsL3[l]),
            dataL4: labels.map(l => binsL4[l]),
            validCount: totalValid
        };
    }

    function createWindRoseCard(data) {
        const windData = calculateStackedWindRose(data);
        if (windData.validCount === 0) return;

        const colDiv = document.createElement('div');
        colDiv.className = 'col-lg-6 col-12';
        const cardDiv = document.createElement('div');
        cardDiv.className = 'chart-container p-3 d-flex flex-column';
        cardDiv.style.height = '480px';
        cardDiv.style.position = 'relative';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'd-flex justify-content-between align-items-center mb-2';
        const titleSpacer = document.createElement('span'); 
        const btnDownload = document.createElement('button');
        btnDownload.className = 'btn btn-sm btn-outline-secondary d-flex align-items-center gap-1';
        btnDownload.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span style="font-size:12px">Save</span>`;
        
        headerDiv.appendChild(titleSpacer);
        headerDiv.appendChild(btnDownload);
        cardDiv.appendChild(headerDiv);

        const canvasContainer = document.createElement('div');
        canvasContainer.style.flex = "1";
        canvasContainer.style.position = "relative";
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        cardDiv.appendChild(canvasContainer);
        colDiv.appendChild(cardDiv);
        chartsGrid.appendChild(colDiv);

        const chartTitle = "Wind Rose (Direction & Speed)";

        // --- KONFIGURASI GRAFIK ---
        const newChart = new Chart(canvas, {
            type: 'polarArea',
            data: {
                labels: windData.labels,
                datasets: [
                    
                    // Layer 4 (Paling Atas/Kecil) -> Merah
                    {
                        label: '> 20 kt (Storm)',
                        data: windData.dataL4,
                        backgroundColor: '#dc3545', 
                        borderWidth: 0, // Hapus border agar rapi
                        order: 1 // Z-Index Paling Depan
                    },
                    // Layer 3 -> Kuning
                    {
                        label: '10 - 20 kt (Strong)',
                        data: windData.dataL3,
                        backgroundColor: '#ffc107',
                        borderWidth: 0,
                        order: 2
                    },
                    // Layer 2 -> Hijau
                    {
                        label: '4 - 10 kt (Moderate)',
                        data: windData.dataL2,
                        backgroundColor: '#198754',
                        borderWidth: 0,
                        order: 3
                    },
                    // Layer 1 (Paling Bawah/Besar) -> Biru Muda (Calm/Light)
                    {
                        label: '< 4 kt (Light)',
                        data: windData.dataL1,
                        backgroundColor: '#0dcaf0',
                        borderWidth: 0,
                        order: 4 // Z-Index Paling Belakang
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: chartTitle, font: { size: 16 } },
                    
                    // CUSTOM LEGEND (Hanya Speed, Tanpa Arah)
                    legend: { 
                        position: 'right',
                        labels: {
                            // Override label generator untuk mengambil info dari Dataset, BUKAN Labels (Arah)
                            generateLabels: function(chart) {
                                const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                // Kita buat label manual berdasarkan dataset
                                return chart.data.datasets.map((ds, i) => ({
                                    text: ds.label,
                                    fillStyle: ds.backgroundColor,
                                    strokeStyle: ds.backgroundColor, // Warna kotak legend
                                    hidden: !chart.isDatasetVisible(i),
                                    datasetIndex: i
                                }));
                            }
                        },
                        onClick: function(e, legendItem, legend) {
                            // Default behavior: Toggle dataset visibility
                            const index = legendItem.datasetIndex;
                            const ci = legend.chart;
                            if (ci.isDatasetVisible(index)) {
                                ci.hide(index);
                                legendItem.hidden = true;
                            } else {
                                ci.show(index);
                                legendItem.hidden = false;
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            // Custom Tooltip Text
                            label: function(context) {
                                let label = context.dataset.label || '';
                                let value = context.raw;
                                return `${label}: ${value} Data`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        // [PERBAIKAN UTAMA]
                        // Memaksa label arah mata angin agar tegak lurus
                        startAngle: -22.5, // Geser -22.5 derajat agar label 'N' pas di tengah sektor utara
                        
                        ticks: { 
                            backdropColor: 'transparent', 
                            z: 10,
                            font: { size: 10 }
                        }, 
                        pointLabels: { 
                            display: true, 
                            centerPointLabels: true, 
                            font: { size: 12, weight: 'bold' } 
                        },
                        grid: { color: '#e5e7eb' }
                    }
                }
            }
        });

        chartInstances.push(newChart);
        btnDownload.addEventListener('click', () => downloadChartImage(newChart, chartTitle));
    }

    // --- 5. MAIN RENDER ---
    async function updateCharts() {
        if (!currentStationId || !currentStationData) return;

        const rawStart = startTimeInput.value;
        const rawEnd = endTimeInput.value;

        if(!rawStart || !rawEnd) { alert("Mohon pilih rentang waktu."); return; }

        chartsGrid.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Mengambil data...</p></div>`;

        try {
            const startTimeISO = parseToISO(rawStart);
            const endTimeISO = parseToISO(rawEnd);
            const minTime = new Date(startTimeISO).valueOf();
            const maxTime = new Date(endTimeISO).valueOf();

            const response = await fetch(`/api/weather/history?stationId=${currentStationId}&start=${startTimeISO}&end=${endTimeISO}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();

            chartInstances.forEach(chart => chart.destroy());
            chartInstances = [];
            chartsGrid.innerHTML = ''; 

            const stationParams = currentStationData.parameters;
            const processedParams = new Set();
            const chartsToRender = [];

            paramGroups.forEach(group => {
                let hasParams = false;
                if (group.type === 'wind_combo') hasParams = stationParams.includes('wind_speed');
                else if (group.type === 'vis_weather_combo') hasParams = stationParams.includes('visibility');
                else hasParams = group.keys.some(k => stationParams.includes(k));

                if (hasParams) {
                    const availableKeys = group.keys.filter(k => stationParams.includes(k));
                    chartsToRender.push({
                        title: group.title,
                        keys: availableKeys,
                        type: group.type,
                        unit: parameterConfig[availableKeys[0]]?.unit || '' 
                    });
                    availableKeys.forEach(k => processedParams.add(k));
                }
            });

            stationParams.forEach(param => {
                if (!processedParams.has(param)) {
                    if(parameterConfig[param] && parameterConfig[param].unit !== "") {
                        chartsToRender.push({
                            title: parameterConfig[param].label,
                            keys: [param],
                            type: 'standard',
                            unit: parameterConfig[param].unit
                        });
                    }
                }
            });

            chartsToRender.forEach((chartConfig, index) => {
                createChartCard(chartConfig, data, index, minTime, maxTime);
                if (chartConfig.type === 'wind_combo' && stationParams.includes('wind_direction') && data.length > 0) {
                    createWindRoseCard(data);
                }
            });

            if (data.length === 0) {
                 const msg = document.createElement('div');
                 msg.className = "col-12 text-center text-warning mt-2";
                 msg.innerHTML = "<small>Tidak ada data, grafik kosong ditampilkan.</small>";
                 chartsGrid.prepend(msg);
            }

        } catch (error) {
            console.error("Error:", error);
            chartsGrid.innerHTML = `<div class="col-12 text-center text-danger py-5">Gagal memuat data.</div>`;
        }
    }

    // --- 6. FUNGSI PEMBUAT CHART LINE/SCATTER (Existing - No Changes) ---
    function createChartCard(config, data, index, minTime, maxTime) {
        const colDiv = document.createElement('div');
        colDiv.className = 'col-lg-6 col-12'; 
        const cardDiv = document.createElement('div');
        cardDiv.className = 'chart-container p-3 d-flex flex-column'; 
        cardDiv.style.height = '480px'; 
        cardDiv.style.position = 'relative'; 
        const headerDiv = document.createElement('div');
        headerDiv.className = 'd-flex justify-content-between align-items-center mb-2';
        const titleSpacer = document.createElement('span'); titleSpacer.innerText = ""; 
        const btnDownload = document.createElement('button');
        btnDownload.className = 'btn btn-sm btn-outline-secondary d-flex align-items-center gap-1';
        btnDownload.title = 'Unduh Grafik';
        btnDownload.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span style="font-size:12px">Save</span>`;
        headerDiv.appendChild(titleSpacer); headerDiv.appendChild(btnDownload); cardDiv.appendChild(headerDiv);

        const canvasContainer = document.createElement('div');
        canvasContainer.style.flex = "1"; canvasContainer.style.position = "relative";
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${index}`;
        canvasContainer.appendChild(canvas); cardDiv.appendChild(canvasContainer);
        colDiv.appendChild(cardDiv); chartsGrid.appendChild(colDiv);

        const ctx = canvas.getContext('2d');
        let datasets = [];

        if (config.type === 'wind_combo') {
            const windData = data.map(d => ({ x: new Date(d._time), y: d.wind_speed, dir: d.wind_direction })).filter(d => d.y !== null && d.dir !== null);
            datasets.push({
                label: 'Wind Speed', type: 'line',
                data: windData.map(d => ({x: d.x, y: d.y})),
                borderColor: '#28a745', backgroundColor: '#28a745',
                borderWidth: 2, pointRadius: 0, fill: false, tension: 0.4, order: 2
            });
            const totalPoints = windData.length;
            const targetArrows = 50; 
            const arrowInterval = Math.max(1, Math.ceil(totalPoints / targetArrows));
            datasets.push({
                label: 'Wind Direction', type: 'scatter', data: windData, 
                pointStyle: (ctx) => {
                    const idx = ctx.dataIndex;
                    if (idx % arrowInterval === 0 || idx === totalPoints - 1) return windArrowImage; 
                    return false; 
                },
                rotation: (ctx) => { const val = ctx.raw; return val ? (val.dir + 180) : 0; },
                pointBackgroundColor: '#FFD700', pointBorderColor: '#333333', pointBorderWidth: 1,
                pointRadius: 12, pointHoverRadius: 14, showLine: false, order: 1
            });
        } else {
            datasets = config.keys.map(key => {
                if (key === 'present_weather') return null;
                const style = colorMap[key] || colorMap['default'];
                const labelName = parameterConfig[key]?.label || key;
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                let baseColor = style.bg; if(!baseColor.startsWith('rgba')) baseColor = 'rgba(100,100,100,0.2)'; 
                gradient.addColorStop(0, baseColor.replace(/[\d\.]+\)$/g, '0.5)')); 
                gradient.addColorStop(1, baseColor.replace(/[\d\.]+\)$/g, '0.0)'));
                return {
                    label: labelName, data: data.map(d => d[key]),
                    borderColor: style.border, backgroundColor: gradient, borderWidth: 2,
                    pointRadius: 0, pointHoverRadius: 6, fill: true, tension: 0.4, yAxisID: 'y'
                };
            }).filter(Boolean);
        }

        const isRain = config.keys.includes('precipitation');
        const scales = {
            x: {
                type: 'time', min: minTime, max: maxTime,
                time: { unit: 'minute', tooltipFormat: 'dd/MM/yyyy HH:mm', parser: (value) => new Date(value).toISOString() },
                ticks: { autoSkip: true, minRotation: 45, maxRotation: 45, major: { enabled: true }, callback: function(val) { const date = new Date(val); if (isNaN(date.getTime())) return ""; const pad = n => String(n).padStart(2, '0'); return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`; } },
                title: { display: true, text: 'Waktu (UTC)' }, grid: { display: false }
            },
            y: { beginAtZero: isRain, min: isRain ? 0 : undefined, suggestedMax: isRain ? 1 : undefined, title: { display: true, text: config.unit }, position: 'left' }
        };
        if (config.type === 'wind_combo') { scales.y1 = { display: false }; }

        const tooltipConfig = {
            enabled: true, mode: 'index', intersect: false,
            callbacks: {
                title: function(context) { const date = new Date(context[0].parsed.x); const pad = n => String(n).padStart(2, '0'); return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth()+1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`; },
                label: function(context) {
                    let label = context.dataset.label || ''; let raw = context.raw;
                    if (label === 'Wind Speed') return `Speed: ${raw.y} knot`;
                    if (label === 'Wind Direction') return `Direction: ${raw.dir}°`;
                    let valueText = context.parsed.y !== null ? context.parsed.y : '';
                    let unit = config.unit || ''; return `${label}: ${valueText} ${unit}`;
                },
                labelColor: function(context) {
                    if (context.dataset.label === 'Wind Speed') return { borderColor: '#28a745', backgroundColor: '#28a745' };
                    if (context.dataset.label === 'Wind Direction') return { borderColor: '#333333', backgroundColor: '#FFD700' };
                    return { borderColor: context.dataset.borderColor, backgroundColor: context.dataset.backgroundColor };
                },
                footer: function(tooltipItems) { if (config.type === 'vis_weather_combo') { const index = tooltipItems[0].dataIndex; const weather = data[index].present_weather; if (weather) return `Present Weather: ${weather}`; } return ''; }
            }
        };

        const newChart = new Chart(canvas, {
            type: config.type === 'wind_combo' ? 'line' : 'line',
            data: { labels: data.map(d => new Date(d._time)), datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'nearest', axis: 'x', intersect: false },
                plugins: { title: { display: true, text: config.title, font: { size: 16 } }, tooltip: tooltipConfig, legend: { display: config.type !== 'wind_combo' } },
                scales: scales
            }
        });
        chartInstances.push(newChart);
        btnDownload.addEventListener('click', () => downloadChartImage(newChart, config.title));
    }

    async function initialize() {
        currentStationId = getStationIdFromUrl();
        if (currentStationId) {
            const allStations = await getStationList();
            currentStationData = allStations.find(s => s.id_stasiun === currentStationId);
            if (currentStationData) {
                analyticsTitle.textContent = `Analitik: ${currentStationData.nama_stasiun}`;
                stationSubtitle.textContent = `ICAO: ${currentStationData.icao} / Runway ${currentStationData.runway}`;
                setDefaultDateTime();
            } else { analyticsTitle.textContent = "Stasiun Tidak Ditemukan"; }
        } else {
            analyticsTitle.textContent = "Pilih Stasiun dari Peta";
            document.querySelector('.filter-controls').style.display = 'none';
        }
        fetchDataBtn.addEventListener('click', updateCharts);
    }
    
    if (typeof timeOffset !== 'undefined' && timeOffset !== 0) { initialize(); } else { document.addEventListener('time-synchronized', initialize); }
});
