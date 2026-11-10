// public/js/spareparts.js

document.addEventListener('DOMContentLoaded', () => {
    // Memastikan header di-load menggunakan fungsi includeHTML
    if (typeof includeHTML === 'function') {
        includeHTML(() => {
            initDataTable();
        });
    } else {
        initDataTable();
    }
});

function initDataTable() {
    // Hapus pesan loading manual
    $('#station-subtitle').text('Memuat data dari server...'); 
    
    // Inisialisasi DataTables pada elemen #sparepart-table
    $('#sparepart-table').DataTable({
        // 1. Konfigurasi Ajax untuk Server-Side Processing
        ajax: {
            url: '/api/spareparts',
            dataSrc: 'data', // Ambil array data dari properti 'data' pada respons JSON
            data: function (d) {
                // Tambahkan parameter DataTables (start, length, search) ke request
                return $.extend({}, d);
            },
            error: function (xhr, error, thrown) {
                console.error("AJAX Error:", error);
                $('#station-subtitle').text('❌ Error memuat data. Cek log server.');
            }
        },
        // 2. Tentukan Server-Side Processing
        serverSide: true, // PENTING: Aktifkan Server-Side Processing
        processing: true, // Menampilkan pesan "Processing..."
        
        // 3. Definisikan pemetaan kolom
        columns: [
            { data: 'katalog_id', title: 'ID Katalog' },
            { data: 'Nama Barang', title: 'Nama Standar' },
            { data: 'Merk', title: 'Merk' },
            { data: 'Type', title: 'Tipe' },
            { data: 'Serial Number', title: 'Serial Number' },
            // Kolom Kondisi menggunakan fungsi render untuk styling
            { 
                data: 'Kondisi', 
                title: 'Kondisi',
                render: function(data, type, row) {
                    if (type === 'display') {
                        let kondisi = data ? data.toUpperCase() : 'T/A';
                        let cssClass = '';
                        if (kondisi === 'BAIK') {
                            cssClass = 'bg-success text-white';
                        } else if (kondisi === 'RUSAK') {
                            cssClass = 'bg-danger text-white';
                        } else {
                            cssClass = 'bg-warning';
                        }
                        // Menggunakan badge Bootstrap
                        return `<span class="badge ${cssClass}">${kondisi}</span>`;
                    }
                    return data; 
                }
            },
            { data: 'Lokasi Pemasangan', title: 'Lokasi' }
        ],
        // 4. Konfigurasi Tampilan
        pageLength: 10,    // Default hanya 10 baris
        lengthMenu: [ [10, 25, 50], [10, 25, 50] ], // Opsi tampilan baris (dihapus opsi "Semua")
        dom: 'lfrtip', 
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/id.json' 
        },
        initComplete: function(settings, json) {
            // Update total setelah data dimuat
            $('#station-subtitle').text(`Total ${json.recordsTotal} item terdaftar.`);
        }
    });
}
