// public/js/login.js

const form = document.getElementById('loginForm');
const messageEl = document.getElementById('message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePassword = document.querySelector('.toggle-password');

// --- Form Submission Logic (from your original file) ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageEl.textContent = ''; // Clear previous messages

    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok) {
            // On successful login, redirect to the home page
            window.location.href = '/'; 
        } else {
            messageEl.textContent = result.message || 'Login failed.';
            messageEl.style.color = 'red';
        }
    } catch (error) {
        console.error('Error during login:', error);
        messageEl.textContent = 'Could not connect to the server.';
        messageEl.style.color = 'red';
    }
});

// --- NEW: Password Visibility Toggle ---
togglePassword.addEventListener('click', () => {
    // Check the current type of the password input
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);

    // Optional: Change the eye icon (not implemented here, but you could swap the SVG)
});