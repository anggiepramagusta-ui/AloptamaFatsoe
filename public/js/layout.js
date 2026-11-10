// public/js/layout.js

// Fungsi untuk memuat dan menyisipkan komponen HTML (Header)
async function includeHTML() {
    const elements = document.querySelectorAll('[include-html]');
    await Promise.all(Array.from(elements).map(async (el) => {
        const file = el.getAttribute('include-html');
        if (file) {
            try {
                const response = await fetch(file);
                if (response.ok) el.innerHTML = await response.text();
            } catch (error) { console.error('Error loading component:', error); }
        }
    }));

    // Inisialisasi Tema setelah Header dimuat
    initTheme();

    if (typeof initializePageFeatures === 'function') {
        initializePageFeatures();
    }
}

function initTheme() {
    const toggleBtn = document.getElementById('header-theme-toggle');
    const iconSun = document.getElementById('icon-sun');
    const iconMoon = document.getElementById('icon-moon');
    const htmlEl = document.documentElement;

    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme); // Terapkan tema awal tanpa animasi

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            // 1. AKTIFKAN TRANSISI HALUS
            htmlEl.classList.add('app-transition');

            // 2. LOGIKA GANTI TEMA
            const currentTheme = htmlEl.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);

            // 3. MATIKAN TRANSISI SETELAH SELESAI (Supaya tidak berat saat resize window)
            // Waktu timeout harus sama dengan durasi CSS (0.3s = 300ms)
            setTimeout(() => {
                htmlEl.classList.remove('app-transition');
            }, 300);
        });
    }

    function applyTheme(theme) {
        htmlEl.setAttribute('data-theme', theme);
        
        // Logika Icon (Tetap sama)
        if (iconSun && iconMoon) {
            if (theme === 'dark') {
                iconMoon.style.display = 'none';
                iconSun.style.display = 'block';
                iconSun.style.color = '#ffc107'; 
                document.body.classList.add('dark-mode');
            } else {
                iconMoon.style.display = 'block';
                iconSun.style.display = 'none';
                iconMoon.style.color = '#343a40'; 
                document.body.classList.remove('dark-mode');
            }
        }
    }
}

// Panggil fungsi ini saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', includeHTML);
