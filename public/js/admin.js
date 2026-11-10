// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Elemen DOM ---
    const showAddFormBtn = document.getElementById('showAddFormBtn');
    const addStationFormContainer = document.getElementById('addStationFormContainer');
    const addForm = document.getElementById('addStationForm');
    const stationsTableBody = document.getElementById('stationsTableBody');
    const editModal = document.getElementById('editStationModal');
    const editForm = document.getElementById('editStationForm');
    const closeModalButton = document.querySelector('#editStationModal .close-button');
    const addIcaoSelect = document.getElementById('add-icao');
    const addRunwaySelect = document.getElementById('add-runway');
    const addParamContainer = document.querySelector('#addStationFormContainer #parameter-selection .param-container');
    
    // Elemen untuk Manajemen User
    const showAddUserFormBtn = document.getElementById('showAddUserFormBtn');
    const addUserFormContainer = document.getElementById('addUserFormContainer');
    const addUserForm = document.getElementById('addUserForm');
    const usersTableBody = document.getElementById('usersTableBody');
    const editUserModal = document.getElementById('editUserModal');
    const editUserForm = document.getElementById('editUserForm');
    const closeUserModalButton = document.getElementById('closeUserModalButton');

    // Elemen untuk Paginasi
    const usersPagination = document.getElementById('usersPagination');
    const stationsPagination = document.getElementById('stationsPagination');

    // --- State untuk Paginasi dan Data ---
    let allUsersData = [];
    let allStationsData = [];
    let allAvailableParams = [];
    const rowsPerPage = 10;

    // --- KONFIGURASI UX (SweetAlert2 & Loading) ---
    
    // 1. Toast Notification Config
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    // 2. Fungsi Helper Loading Button
    function setLoading(btnElement, isLoading, loadingText = 'Menyimpan...') {
        if (!btnElement) return;
        if (isLoading) {
            btnElement.dataset.originalText = btnElement.innerHTML; // Simpan teks asli
            btnElement.disabled = true;
            btnElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${loadingText}`;
        } else {
            btnElement.disabled = false;
            btnElement.innerHTML = btnElement.dataset.originalText || 'Simpan';
        }
    }

    // --- Fungsi Inisialisasi ---
    async function initializePage() {
        // Tampilkan loading skeleton atau spinner di tabel jika perlu (opsional)
        await Promise.all([
            loadUsers(),
            loadExistingStations(),
            fetchAvailableParameters()
        ]);

        createAddFormParamButtons();
        const icaos = await getAvailableIcaoTags(); 
        if (typeof populateSelect === 'function') {
            populateSelect(addIcaoSelect, icaos, { defaultText: "Pilih ICAO" });
        }
    }

    // --- Fungsi Generik untuk Paginasi ---
    function setupPagination(wrapper, currentPage, totalPages, onPageClick) {
        wrapper.innerHTML = '';
        if (totalPages <= 1) return;

        const createPageItem = (content, page, isDisabled = false, isActive = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.innerHTML = content;
            if (!isDisabled) {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    onPageClick(page);
                });
            }
            li.appendChild(a);
            return li;
        };
        wrapper.appendChild(createPageItem('&laquo;', currentPage - 1, currentPage === 1));
        for (let i = 1; i <= totalPages; i++) {
            wrapper.appendChild(createPageItem(i, i, false, i === currentPage));
        }
        wrapper.appendChild(createPageItem('&raquo;', currentPage + 1, currentPage === totalPages));
    }

    // --- Fungsi Manajemen User ---
    function displayUsersPage(page) {
        usersTableBody.innerHTML = '';
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedUsers = allUsersData.slice(startIndex, endIndex);

        paginatedUsers.forEach(user => {
            const row = usersTableBody.insertRow();
            row.innerHTML = `
                <td>${user.username}</td>
                <td><span class="badge ${user.role === 'admin' ? 'bg-primary' : 'bg-secondary'}">${user.role}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit-btn user-edit-btn" data-username="${user.username}" data-role="${user.role}" title="Edit User">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button class="action-btn delete-btn user-delete-btn" data-username="${user.username}" title="Hapus User">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </td>
            `;
        });
        setupPagination(usersPagination, page, Math.ceil(allUsersData.length / rowsPerPage), displayUsersPage);
    }

    async function loadUsers() {
        try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Gagal mengambil data user');
            allUsersData = await response.json();
            displayUsersPage(1);
        } catch (error) {
            console.error("Gagal memuat daftar user:", error);
            usersTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Gagal memuat data user.</td></tr>`;
        }
    }

    async function handleAddUserSubmit(e) {
        e.preventDefault();
        const submitBtn = addUserForm.querySelector('button[type="submit"]');
        const username = document.getElementById('add-username').value;
        const password = document.getElementById('add-password').value;
        const role = document.getElementById('add-role').value;
        
        if (!username || !password || !role) {
            return Toast.fire({ icon: 'warning', title: 'Semua field harus diisi!' });
        }

        setLoading(submitBtn, true); // Aktifkan Loading

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });
            if (response.ok) {
                Toast.fire({ icon: 'success', title: 'User berhasil ditambahkan!' });
                addUserForm.reset();
                toggleAddUserForm(true);
                await loadUsers();
            } else {
                const result = await response.json();
                Toast.fire({ icon: 'error', title: result.error || 'Gagal menambah user.' });
            }
        } catch (error) { 
            Toast.fire({ icon: 'error', title: 'Gagal terhubung ke server.' });
        } finally {
            setLoading(submitBtn, false); // Matikan Loading
        }
    }
    
    async function handleDeleteUser(username) {
        // Ganti confirm() biasa dengan SweetAlert2
        const result = await Swal.fire({
            title: `Hapus user "${username}"?`,
            text: "Data yang dihapus tidak dapat dikembalikan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545', // Warna merah Bootstrap
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        });

        if (!result.isConfirmed) return;

        try {
            const response = await fetch(`/api/users/${username}`, { method: 'DELETE' });
            if (response.ok) {
                Toast.fire({ icon: 'success', title: 'User berhasil dihapus.' });
                await loadUsers();
            } else {
                const resData = await response.json();
                Toast.fire({ icon: 'error', title: resData.error || 'Gagal menghapus user.' });
            }
        } catch (error) { 
            Toast.fire({ icon: 'error', title: 'Terjadi kesalahan koneksi.' });
        }
    }

    function toggleAddUserForm(forceHide = false) {
        const isHidden = addUserFormContainer.style.display === 'none' || addUserFormContainer.style.display === '';
        if (forceHide || !isHidden) {
            addUserFormContainer.style.display = 'none';
            showAddUserFormBtn.textContent = 'Tambah User Baru';
            showAddUserFormBtn.classList.remove('btn-danger');
            showAddUserFormBtn.classList.add('btn-success');
        } else {
            addUserFormContainer.style.display = 'block';
            showAddUserFormBtn.textContent = 'Batal';
            showAddUserFormBtn.classList.remove('btn-success');
            showAddUserFormBtn.classList.add('btn-danger');
        }
    }

    function openEditUserModal(username, role) {
        document.getElementById('edit-username-hidden').value = username;
        document.getElementById('edit-username-display').value = username;
        document.getElementById('edit-role').value = role;
        editUserModal.style.display = 'block';
    }

    function closeEditUserModal() {
        editUserModal.style.display = 'none';
    }

    async function handleEditUserFormSubmit(e) {
        e.preventDefault();
        const submitBtn = editUserForm.querySelector('button[type="submit"]');
        const username = document.getElementById('edit-username-hidden').value;
        const role = document.getElementById('edit-role').value;

        setLoading(submitBtn, true);

        try {
            const response = await fetch(`/api/users/${username}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            if (response.ok) {
                Toast.fire({ icon: 'success', title: 'Role berhasil diperbarui!' });
                closeEditUserModal();
                await loadUsers();
            } else {
                const result = await response.json();
                Toast.fire({ icon: 'error', title: result.error || 'Gagal update user.' });
            }
        } catch (error) { 
            Toast.fire({ icon: 'error', title: 'Gagal terhubung ke server.' });
        } finally {
            setLoading(submitBtn, false);
        }
    }

    // --- Fungsi Manajemen Stasiun ---
    function displayStationsPage(page) {
        stationsTableBody.innerHTML = '';
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedStations = allStationsData.slice(startIndex, endIndex);

        paginatedStations.forEach(station => {
            const row = stationsTableBody.insertRow();
            row.innerHTML = `
                <td><code>${station.id_stasiun || ''}</code></td>
                <td><strong>${station.nama_stasiun || ''}</strong></td>
                <td>${station.icao || ''}</td>
                <td><small>${station.latitude?.toFixed(4) || '-'}, ${station.longitude?.toFixed(4) || '-'}</small></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit-btn" data-id="${station.id_stasiun}" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button class="action-btn delete-btn station-delete-btn" data-id="${station.id_stasiun}" title="Hapus">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </td>
            `;
        });
        setupPagination(stationsPagination, page, Math.ceil(allStationsData.length / rowsPerPage), displayStationsPage);
    }

    async function loadExistingStations() {
        try {
            const response = await fetch('/api/stations');
            if (!response.ok) throw new Error('Gagal mengambil data stasiun');
            let stations = await response.json();
            stations.sort((a, b) => a.id_stasiun.localeCompare(b.id_stasiun));
            allStationsData = stations;
            displayStationsPage(1);
        } catch (error) { 
            console.error("Gagal memuat daftar stasiun:", error); 
            stationsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Gagal memuat data stasiun.</td></tr>`;
        }
    }

    async function handleAddFormSubmit(e) {
        e.preventDefault();
        const submitBtn = addForm.querySelector('button[type="submit"]');
        setLoading(submitBtn, true);

        const selectedParameters = Array.from(addForm.querySelectorAll('input.btn-check:checked')).map(cb => cb.value);
        const newStation = {
            id_stasiun: document.getElementById('add-id_stasiun').value,
            nama_stasiun: document.getElementById('add-nama_stasiun').value,
            icao: addIcaoSelect.value,
            runway: addRunwaySelect.value,
            latitude: parseFloat(document.getElementById('add-latitude').value),
            longitude: parseFloat(document.getElementById('add-longitude').value),
            parameters: selectedParameters
        };
        try {
            const response = await fetch('/api/stations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newStation)
            });
            if (response.ok) {
                Toast.fire({ icon: 'success', title: 'Stasiun berhasil ditambahkan!' });
                addForm.reset();
                addForm.querySelectorAll('input.btn-check').forEach(cb => cb.checked = false);
                toggleAddForm(true);
                await loadExistingStations();
            } else {
                const result = await response.json();
                Toast.fire({ icon: 'error', title: result.error || 'Terjadi kesalahan' });
            }
        } catch (error) { 
            Toast.fire({ icon: 'error', title: "Gagal terhubung ke server." });
        } finally {
            setLoading(submitBtn, false);
        }
    }

    async function handleEditFormSubmit(e) {
        e.preventDefault();
        const submitBtn = editForm.querySelector('button[type="submit"]');
        setLoading(submitBtn, true);

        const originalId = document.getElementById('edit-original-id').value;
        const orderedParams = Array.from(editForm.querySelectorAll('#edit-parameter-selection .param-item .btn-check'))
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        const updatedStation = {
            id_stasiun: document.getElementById('edit-id_stasiun').value,
            nama_stasiun: document.getElementById('edit-nama_stasiun').value,
            icao: document.getElementById('edit-icao').value,
            runway: document.getElementById('edit-runway').value,
            latitude: parseFloat(document.getElementById('edit-latitude').value),
            longitude: parseFloat(document.getElementById('edit-longitude').value),
            parameters: orderedParams
        };
        try {
            const response = await fetch(`/api/stations/${originalId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedStation)
            });
            if (response.ok) {
                Toast.fire({ icon: 'success', title: 'Stasiun berhasil diperbarui!' });
                closeEditModal();
                await loadExistingStations();
            } else {
                const result = await response.json();
                Toast.fire({ icon: 'error', title: result.error || 'Terjadi kesalahan' });
            }
        } catch (error) { 
            Toast.fire({ icon: 'error', title: "Gagal terhubung ke server." });
        } finally {
            setLoading(submitBtn, false);
        }
    }

    async function handleDeleteStation(stationId) {
        const result = await Swal.fire({
            title: `Hapus Stasiun?`,
            text: `ID: ${stationId} akan dihapus permanen.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Ya, Hapus!'
        });

        if (!result.isConfirmed) return;

        try {
            const response = await fetch(`/api/stations/${stationId}`, { method: 'DELETE' });
            if (response.ok) {
                Toast.fire({ icon: 'success', title: 'Stasiun berhasil dihapus!' });
                await loadExistingStations();
            } else {
                const result = await response.json();
                Toast.fire({ icon: 'error', title: result.error || 'Terjadi kesalahan' });
            }
        } catch (error) { 
            Toast.fire({ icon: 'error', title: "Gagal terhubung ke server." });
        }
    }

    async function openEditModal(stationId) {
        const station = allStationsData.find(s => s.id_stasiun === stationId);
        if (!station) return;
        document.getElementById('edit-original-id').value = station.id_stasiun;
        document.getElementById('edit-id_stasiun').value = station.id_stasiun;
        document.getElementById('edit-nama_stasiun').value = station.nama_stasiun;
        document.getElementById('edit-latitude').value = station.latitude;
        document.getElementById('edit-longitude').value = station.longitude;
        const editIcaoSelect = document.getElementById('edit-icao');
        const editRunwaySelect = document.getElementById('edit-runway');
        const icaos = await getAvailableIcaoTags();
        populateSelect(editIcaoSelect, icaos, { defaultText: "Pilih ICAO" });
        editIcaoSelect.value = station.icao;
        const runways = await getAvailableRunwayTags(station.icao);
        populateSelect(editRunwaySelect, runways, { defaultText: "Pilih Runway" });
        editRunwaySelect.value = station.runway;
        const paramContainer = document.querySelector('#edit-parameter-selection .param-container');
        paramContainer.innerHTML = '';
        const stationParams = station.parameters || [];
        const otherParams = allAvailableParams.filter(p => !stationParams.includes(p));
        stationParams.forEach(paramKey => { paramContainer.insertAdjacentHTML('beforeend', createParamToggleButton(paramKey, true, true)); });
        otherParams.forEach(paramKey => { paramContainer.insertAdjacentHTML('beforeend', createParamToggleButton(paramKey, false, true)); });
        if (typeof Sortable !== 'undefined') {
            new Sortable(paramContainer, { animation: 150, handle: '.param-item' });
        }
        editModal.style.display = 'block';
    }

    function toggleAddForm(forceHide = false) {
        if (!addStationFormContainer) return;
        const isHidden = addStationFormContainer.style.display === 'none' || addStationFormContainer.style.display === '';
        if (forceHide || !isHidden) {
            addStationFormContainer.style.display = 'none';
            showAddFormBtn.textContent = 'Tambah Stasiun Baru';
            showAddFormBtn.classList.remove('btn-danger');
            showAddFormBtn.classList.add('btn-success');
        } else {
            addStationFormContainer.style.display = 'block';
            showAddFormBtn.textContent = 'Batal';
            showAddFormBtn.classList.remove('btn-success');
            showAddFormBtn.classList.add('btn-danger');
        }
    }

    async function fetchAvailableParameters() {
        try {
            const response = await fetch('/api/meta/parameters');
            if (!response.ok) throw new Error('Gagal mengambil parameter');
            allAvailableParams = await response.json();
        } catch (error) { console.error("Gagal memuat parameter:", error); }
    }
    
    function createAddFormParamButtons() {
        if (!addParamContainer) return;
        addParamContainer.innerHTML = '';
        allAvailableParams.forEach(paramKey => {
            addParamContainer.insertAdjacentHTML('beforeend', createParamToggleButton(paramKey, false, false));
        });
    }

    function createParamToggleButton(paramKey, isChecked, isEdit) {
        const uniqueId = `${isEdit ? 'edit' : 'add'}-${paramKey}`;
        const label = paramKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `
            <div class="param-item">
                <input type="checkbox" class="btn-check" id="${uniqueId}" value="${paramKey}" ${isChecked ? 'checked' : ''} autocomplete="off">
                <label class="btn btn-param" for="${uniqueId}">${label}</label>
            </div>
        `;
    }

    function closeEditModal() { editModal.style.display = 'none'; }

    // --- Event Listeners ---
    if (showAddUserFormBtn) showAddUserFormBtn.addEventListener('click', () => toggleAddUserForm());
    if (addUserForm) addUserForm.addEventListener('submit', handleAddUserSubmit);
    if (editUserForm) editUserForm.addEventListener('submit', handleEditUserFormSubmit);
    if (closeUserModalButton) closeUserModalButton.onclick = closeEditUserModal;
    if (usersTableBody) {
        usersTableBody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.user-delete-btn');
            const editBtn = e.target.closest('.user-edit-btn');
            if (deleteBtn) handleDeleteUser(deleteBtn.dataset.username);
            if (editBtn) openEditUserModal(editBtn.dataset.username, editBtn.dataset.role);
        });
    }

    if (showAddFormBtn) showAddFormBtn.addEventListener('click', () => toggleAddForm());
    if (addForm) addForm.addEventListener('submit', handleAddFormSubmit);
    if (editForm) editForm.addEventListener('submit', handleEditFormSubmit);
    if (addIcaoSelect) {
        addIcaoSelect.addEventListener('change', async () => {
            const runways = await getAvailableRunwayTags(addIcaoSelect.value);
            populateSelect(addRunwaySelect, runways, { defaultText: "Pilih Runway" });
        });
    }
    const editIcao = document.getElementById('edit-icao');
    if(editIcao) {
        editIcao.addEventListener('change', async (e) => {
            const runways = await getAvailableRunwayTags(e.target.value);
            populateSelect(document.getElementById('edit-runway'), runways, { defaultText: "Pilih Runway" });
        });
    }
    if (stationsTableBody) {
        stationsTableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.station-delete-btn');
            if (editBtn) openEditModal(editBtn.dataset.id);
            if (deleteBtn) handleDeleteStation(deleteBtn.dataset.id);
        });
    }
    if (closeModalButton) closeModalButton.onclick = closeEditModal;
    window.onclick = (e) => { 
        if (e.target == editModal) closeEditModal();
        if (e.target == editUserModal) closeEditUserModal();
    };

    initializePage();
});
