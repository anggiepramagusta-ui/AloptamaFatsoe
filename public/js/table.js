// public/js/table.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Elemen DOM ---
    const tableTitle = document.getElementById('table-title');
    const stationSubtitle = document.getElementById('station-subtitle');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const tableHead = document.getElementById('tableHeader');
    const tableBody = document.getElementById('dataTableBody');
    const fetchDataBtn = document.getElementById('fetchDataBtn');
    const exportDataBtn = document.getElementById('exportDataBtn'); 
    const paginationControls = document.getElementById('paginationControls');
    const paginationInfo = document.getElementById('paginationInfo');
    
    // Menggunakan ID ini untuk menampung Progress Bar
    const dataCompletenessContainer = document.getElementById('dataCompletenessContainer'); 

    // --- Variabel State ---
    let fullDataset = [];
    let currentPage = 1;
    const rowsPerPage = 10;
    let stationParameters = [];
    let currentStationId = null;
    
    // Interval pengiriman data AWOS yang diharapkan (disetel 1 menit sesuai permintaan terakhir)
    const expectedIntervalMinutes = 1; 

    // --- Fungsi Bantuan ---
    function getStationIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('stationId');
    }

    // --- Fungsi Render ---
    function updateTableHeader(parameters) {
        tableHead.innerHTML = '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<th>Waktu (UTC)</th>` + parameters.map(paramKey => {
            const config = parameterConfig[paramKey] || { label: paramKey, unit: '' };
            return `<th>${config.unit ? `${config.label} (${config.unit})` : config.label}</th>`;
        }).join('');
        tableHead.appendChild(tr);
    }

    function renderTablePage() {
        const totalPages = Math.ceil(fullDataset.length / rowsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const pageData = fullDataset.slice(start, end);

        populateTableBody(pageData, stationParameters);
        setupPagination(totalPages);

        // Perbarui informasi jumlah baris
        const startRow = fullDataset.length > 0 ? start + 1 : 0;
        const endRow = Math.min(end, fullDataset.length);
        paginationInfo.textContent = `Menampilkan ${startRow} - ${endRow} dari ${fullDataset.length} baris`;
    }

function populateTableBody(dataForPage, parameters) {
    tableBody.innerHTML = '';
    
    // Handle jika data kosong
    if (!dataForPage || dataForPage.length === 0) {
        // Hitung colspan dinamis
        const columnCount = (parameters?.length || 0) + 1;
        tableBody.innerHTML = `<tr><td colspan="${columnCount}" class="text-center p-4">Tidak ada data untuk ditampilkan.</td></tr>`;
        return;
    }

    dataForPage.forEach(row => {
        const tr = document.createElement('tr');
        const date = new Date(row._time);

        const pad = (num) => String(num).padStart(2, '0');
        const formattedTime = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;

        // 1. Kolom Waktu (Manual) - Perhatikan penambahan data-label="Waktu (UTC)"
        let cells = `<td data-label="Waktu (UTC)">${formattedTime}</td>`;
        
        // 2. Kolom Parameter (Looping)
        parameters.forEach(paramKey => {
            const config = parameterConfig[paramKey] || { label: paramKey, unit: '' };
            const value = row[paramKey];
            const displayValue = (value !== undefined && value !== null) ? (typeof value === 'number' ? value.toFixed(1) : value) : '--';
            
            // Perhatikan penambahan data-label="..."
            // Kita juga menambahkan unit ke label agar jelas di tampilan kartu
            const labelWithUnit = config.unit ? `${config.label} (${config.unit})` : config.label;
            
            cells += `<td data-label="${labelWithUnit}">${displayValue}</td>`;
        });
        
        tr.innerHTML = cells;
        tableBody.appendChild(tr);
    });
}

    // Fungsi Paginasi (dibiarkan seperti semula)
function setupPagination(totalPages) {
    paginationControls.innerHTML = '';
    if (totalPages <= 1) return;

    const createPageItem = (text, page, isDisabled = false, isActive = false) => {
        const li = document.createElement('li');
        li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.innerHTML = text;
        if (!isDisabled) {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = page;
                renderTablePage();
            });
        }
        li.appendChild(a);
        return li;
    };

    paginationControls.appendChild(createPageItem('← Previous', currentPage - 1, currentPage === 1));

    const maxPagesToShow = 5;
    let startPage, endPage;

    if (totalPages <= maxPagesToShow) {
        startPage = 1;
        endPage = totalPages;
    } else {
        const pagesBefore = Math.floor(maxPagesToShow / 2);
        const pagesAfter = Math.ceil(maxPagesToShow / 2) - 1;

        if (currentPage <= pagesBefore) {
            startPage = 1;
            endPage = maxPagesToShow;
        } else if (currentPage + pagesAfter >= totalPages) {
            startPage = totalPages - maxPagesToShow + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - pagesBefore;
            endPage = currentPage + pagesAfter;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationControls.appendChild(createPageItem(i, i, false, i === currentPage));
    }

    paginationControls.appendChild(createPageItem('Next →', currentPage + 1, currentPage === totalPages));
}

    // --- Fungsi Bantuan: Menghitung Kelengkapan Data ---
    function calculateDataCompleteness(startISO, endISO, actualCount) {
        if (!startISO || !endISO) return { expected: 0, percentage: 0 };

        const start = new Date(startISO);
        const end = new Date(endISO);
        
        // Hitung total durasi dalam milidetik
        const durationMs = end.getTime() - start.getTime(); 
        if (durationMs <= 0) return { expected: 0, percentage: 0 };
        
        // Hitung total interval (total durasi / intervalMs). 
        const intervalMs = expectedIntervalMinutes * 60 * 1000;
        
        // Jumlah interval yang diharapkan (menggunakan Math.round agar lebih akurat pada pembulatan)
        const expectedCount = Math.round(durationMs / intervalMs); 

        // Hitung persentase
        const percentage = expectedCount > 0 
            ? Math.min(100, (actualCount / expectedCount) * 100).toFixed(1)
            : 0;
            
        return { expected: expectedCount, percentage: parseFloat(percentage) };
    }
    
    // --- Fungsi Ekspor ke CSV ---
    function exportToCsv() {
        if (fullDataset.length === 0) {
            alert("Tidak ada data untuk diekspor.");
            return;
        }

        const headers = ['Waktu (UTC)', ...stationParameters.map(paramKey => {
            const config = parameterConfig[paramKey] || { label: paramKey, unit: '' };
            return config.unit ? `${config.label} (${config.unit})` : config.label;
        })];

        let csvContent = headers.join(',') + '\n';

        fullDataset.forEach(row => {
            const date = new Date(row._time);
            const pad = (num) => String(num).padStart(2, '0');
            
            // Format waktu menjadi YYYY-MM-DD HH:MM:SS (UTC)
            const formattedTime = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
            
            let rowData = [formattedTime];

            stationParameters.forEach(paramKey => {
                let value = row[paramKey];
                
                if (typeof value === 'string' && value.includes(',')) {
                    value = `"${value}"`;
                } else if (typeof value === 'number') {
                    value = value.toFixed(1);
                }
                rowData.push(value !== undefined && value !== null ? value : '');
            });

            csvContent += rowData.join(',') + '\n';
        });

        // Buat blob dan unduh file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const stationName = tableTitle.textContent.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        const fileName = `${stationName}_${new Date().toISOString().slice(0, 10)}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // --- Fungsi Utama ---
async function fetchDataForStation() {
        if (!currentStationId) return;
        
        // 1. TAMPILKAN SKELETON (Loading State)
        // Kita buat 5 baris dummy, masing-masing punya 5 kolom dummy
        const skeletonRows = Array(5).fill(0).map(() => `
            <tr>
                <td><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = skeletonRows;
        
        // Reset info pagination sementara
        paginationInfo.textContent = 'Mengambil data...';
        paginationControls.innerHTML = '';
        if (dataCompletenessContainer) dataCompletenessContainer.innerHTML = '<div class="skeleton skeleton-text" style="width: 100%; height: 80px;"></div>';

        const rawStartTime = startTimeInput.value;
        const rawEndTime = endTimeInput.value;
        const start = new Date(rawStartTime + ':00.000Z');
        let end = new Date(rawEndTime + ':00.000Z');
        end.setUTCMinutes(end.getUTCMinutes() + 1);

        const startTimeISO = start.toISOString();
        const endTimeISO = end.toISOString(); 
        const apiURL = `/api/weather/history?stationId=${currentStationId}&start=${startTimeISO}&end=${endTimeISO}`;
        
        try {
            // 2. FETCH DATA ASLI
            const response = await fetch(apiURL);
            const data = await response.json();
            
            data.sort((a, b) => new Date(b._time) - new Date(a._time));

            fullDataset = data;
            currentPage = 1;
            
            // 3. RENDER DATA ASLI (Skeleton otomatis tertimpa)
            renderTablePage();
            
            // Update Progress Bar
            if (dataCompletenessContainer) {
                const actualCount = fullDataset.length;
                const { expected, percentage } = calculateDataCompleteness(startTimeISO, endTimeISO, actualCount);
                let progressBarColor = 'bg-success';
                if (percentage < 90) progressBarColor = 'bg-warning';
                if (percentage < 50) progressBarColor = 'bg-danger';
                
                const completenessHTML = `
                    <div class="p-3 data-card mb-4" style="border: 1px solid var(--border-color);">
                        <div class="mb-2">Total Data Diharapkan: ${expected} baris.</div>
                        <div class="progress" style="height: 30px; margin-bottom: 8px;">
                            <div class="progress-bar ${progressBarColor}" role="progressbar" style="width: ${percentage}%;">${percentage}%</div>
                        </div>
                        <div class="${percentage < 100 ? 'text-danger' : 'text-success'} fw-bold">Kelengkapan: ${actualCount} / ${expected}</div>
                    </div>
                `;
                dataCompletenessContainer.innerHTML = completenessHTML;
            }

        } catch (error) {
            console.error("Gagal memuat data:", error);
            fullDataset = [];
            renderTablePage(); // Ini akan menampilkan "Tidak ada data"
            if (dataCompletenessContainer) dataCompletenessContainer.innerHTML = 'Gagal memuat data.';
        }
    }

    function setDefaultDateTime() {
        // Gunakan waktu server yang sudah disinkronkan dengan menggunakan timeOffset dari common.js
        const serverNow = new Date(new Date().getTime() + timeOffset);
        const oneHourAgoServer = new Date(serverNow.getTime() - 60 * 60 * 1000);

        // Fungsi bantuan untuk mendapatkan string YYYY-MM-DDTHH:MM yang TIDAK terpengaruh zona waktu lokal client
        const toLocalDatetimeString = (date) => {
            const pad = (num) => String(num).padStart(2, '0');
            // Menggunakan fungsi UTC untuk memastikan nilai output sesuai dengan UTC server
            return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
        };
        
        // Tetapkan nilai input menggunakan fungsi baru (memastikan tampilan UTC)
        endTimeInput.value = toLocalDatetimeString(serverNow);
        startTimeInput.value = toLocalDatetimeString(oneHourAgoServer);
    }

    async function initialize() {
        currentStationId = getStationIdFromUrl();
        if (currentStationId) {
            const allStations = await getStationList();
            const selectedStation = allStations.find(s => s.id_stasiun === currentStationId);
            if (selectedStation) {
                tableTitle.textContent = selectedStation.nama_stasiun;
                stationSubtitle.textContent = `ICAO: ${selectedStation.icao} / Runway ${selectedStation.runway}`;
                stationParameters = selectedStation.parameters;
                updateTableHeader(stationParameters);
            } else {
                tableTitle.textContent = "Stasiun Tidak Dikenali";
            }
            setDefaultDateTime();
            await fetchDataForStation();
        } else {
            tableTitle.textContent = "Stasiun Tidak Ditemukan";
            stationSubtitle.textContent = "Pilih stasiun dari halaman Peta.";
            document.querySelector('.filter-controls').style.display = 'none';
            document.querySelector('.table-container').style.display = 'none';
        }
        
        fetchDataBtn.addEventListener('click', fetchDataForStation);
        exportDataBtn.addEventListener('click', exportToCsv); 
    }
    
    if (typeof timeOffset !== 'undefined' && timeOffset !== 0) {
        // Kasus 1: Internet sangat cepat, common.js selesai duluan sebelum table.js
        initialize();
    } else {
        // Kasus 2: (Paling umum) Tunggu sinyal 'time-synchronized' dari common.js
        document.addEventListener('time-synchronized', () => {
            console.log("Sinyal waktu diterima di Table. Memulai inisialisasi...");
            initialize();
        });
    }
});
