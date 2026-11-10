// server.js

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { InfluxDB } = require('@influxdata/influxdb-client');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Server } = require("socket.io");

// --- Konfigurasi ---
const PORT = process.env.PORT || 3000;
const influxUrl = process.env.INFLUX_URL;
const influxToken = process.env.INFLUX_TOKEN;
const influxOrg = process.env.INFLUX_ORG;
const influxBucket = process.env.INFLUX_BUCKET;

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
});

// MEMBUAT OBJEK DB DARI POOL
const db = {
    query: (text, params) => pool.query(text, params),
};

const influxDB = new InfluxDB({ url: influxUrl, token: influxToken, timeout: 20000 });
const queryApi = influxDB.getQueryApi(influxOrg);
console.log(`🔌 Siap membaca data dari InfluxDB bucket: "${influxBucket}"`);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new pgSession({ pool: pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// --- Middleware Autentikasi ---
const checkAuth = (req, res, next) => { if (req.session.user) { next(); } else { res.redirect('/login'); } };
const checkAdmin = (req, res, next) => { if (req.session.user && req.session.user.role === 'admin') { next(); } else { res.status(403).send('<h1>Akses Ditolak</h1><p>Halaman ini hanya untuk admin.</p><a href="/">Kembali ke Peta</a>'); } };

// --- RUTE HALAMAN ---
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'map.html')));
app.get('/analytics', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'analytics.html')));
app.get('/table', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'table.html')));
app.get('/admin', checkAuth, checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/realtime', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'realtime.html')));
app.get('/inclino', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'inclino.html')));

// --- RUTE DASHBOARD SPAREPART BARU ---
app.get('/spareparts', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'spareparts.html'))); 
// ------------------------------------


// --- API AUTENTIKASI ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ message: "Username dan password dibutuhkan." }); }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users(username, password_hash, role) VALUES($1, $2, $3)', [username, hashedPassword, 'user']);
        res.status(201).json({ message: "Registrasi berhasil!" });
    } catch (error) { res.status(500).json({ message: "Username sudah digunakan atau terjadi error server." }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'irm' && password === 'MvSdigi2016!-1rm') {
        req.session.user = { username: 'irm', role: 'admin' };
        return res.json({ success: true, message: "Login admin berhasil!" });
    }
    try {
        const result = await pool.query('SELECT username, password_hash, role FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (user && await bcrypt.compare(password, user.password_hash)) {
            req.session.user = { username: user.username, role: user.role };
            res.json({ success: true, message: "Login berhasil!" });
        } else {
            res.status(401).json({ success: false, message: "Username atau password salah." });
        }
    } catch (error) { res.status(500).json({ success: false, message: "Terjadi error pada server." }); }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.redirect('/'); }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

app.get('/api/user/current', checkAuth, (req, res) => {
    if (req.session.user) {
        res.json({ username: req.session.user.username, role: req.session.user.role });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// --- API MANAJEMEN USER ---
app.get('/api/users', checkAuth, checkAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT username, role FROM users ORDER BY username ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil data pengguna.' });
    }
});

app.post('/api/users', checkAuth, checkAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, dan role dibutuhkan.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
            [username, hashedPassword, role]
        );
        res.status(201).json({ message: 'Pengguna berhasil dibuat.' });
    } catch (error) {
        if (error.code === '23505') { 
            return res.status(409).json({ error: 'Username sudah digunakan.' });
        }
        res.status(500).json({ error: 'Gagal membuat pengguna baru.' });
    }
});

app.put('/api/users/:username', checkAuth, checkAdmin, async (req, res) => {
    const { username } = req.params;
    const { role } = req.body;

    if (!role || (role !== 'admin' && role !== 'user')) {
        return res.status(400).json({ error: 'Role tidak valid. Harus "admin" atau "user".' });
    }

    if (username === 'irm' || username === req.session.user.username) {
        return res.status(403).json({ error: 'Tidak dapat mengubah role pengguna ini.' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE username = $2',
            [role, username]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }

        res.json({ message: 'Role pengguna berhasil diperbarui.' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Gagal memperbarui role pengguna.' });
    }
});

app.delete('/api/users/:username', checkAuth, checkAdmin, async (req, res) => {
    const { username } = req.params;
    if (username === 'irm' || username === req.session.user.username) {
        return res.status(403).json({ error: 'Tidak dapat menghapus pengguna ini.' });
    }
    try {
        const result = await pool.query('DELETE FROM users WHERE username = $1', [username]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }
        res.json({ message: 'Pengguna berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menghapus pengguna.' });
    }
});


// --- API SPAREPART DENGAN DATATABLES SERVER-SIDE PROCESSING (SSP) ---
app.get('/api/spareparts', checkAuth, async (req, res) => {
    try {
        const { start, length, draw, search } = req.query;
        const limit = parseInt(length) || 10;
        const offset = parseInt(start) || 0;
        const searchValue = search.value ? search.value.toLowerCase() : '';

        // 1. Hitung Total Baris Data (Tanpa Filter)
        const totalResult = await db.query('SELECT COUNT(*) AS total FROM master_item');
        const totalRecords = parseInt(totalResult.rows[0].total);
        
        // 2. Tentukan Filter dan Pencarian
        let whereClause = '';
        const searchParams = [];
        let paramIndex = 1;

        if (searchValue) {
            // Kolom yang dicari:
            const searchFields = [
                'katalog_id', '"Nama Barang"', 'Merk', 'Type', '"Serial Number"', 
                '"Kondisi"', '"Lokasi Pemasangan"'
            ];
            
            // Buat klausa OR untuk setiap kolom
            whereClause = ' WHERE ' + searchFields.map(field => {
                searchParams.push(`%${searchValue}%`);
                return `${field} ILIKE $${paramIndex++}`;
            }).join(' OR ');
        }
        
        // 3. Hitung Total Baris Setelah Filter
        const filteredCountQuery = `SELECT COUNT(*) FROM master_item ${whereClause}`;
        const filteredCountResult = await db.query(filteredCountQuery, searchParams);
        const totalFiltered = parseInt(filteredCountResult.rows[0].count);

        // 4. Ambil Data Sesuai Pagination (LIMIT & OFFSET)
        const dataQuery = `
            SELECT 
                katalog_id, 
                "Nama Barang", 
                "Merk", 
                "Type", 
                "Kondisi", 
                "Lokasi Pemasangan",
                "Serial Number"
            FROM 
                master_item 
            ${whereClause}
            ORDER BY id ASC 
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        
        searchParams.push(limit, offset);
        
        const dataResult = await db.query(dataQuery, searchParams);
        
        // 5. Kembalikan format JSON yang diharapkan DataTables
        res.json({
            draw: parseInt(draw), // Nilai yang dikirim kembali
            recordsTotal: totalRecords,
            recordsFiltered: totalFiltered,
            data: dataResult.rows
        });
        
    } catch (err) {
        console.error("❌ Error mengambil data spareparts (SSP):", err);
        // Kirim array kosong jika gagal
        res.status(500).json({ draw: parseInt(req.query.draw || 1), recordsTotal: 0, recordsFiltered: 0, data: [] });
    }
});
// -------------------------------------------------------------------


// --- API DATA & MANAJEMEN STASIUN ---
const stationsFilePath = path.join(__dirname, 'stations.json');

const readStations = () => {
    try { 
        return JSON.parse(fs.readFileSync(stationsFilePath, 'utf8')); 
    } catch (err) { 
        console.error("Gagal membaca stations.json:", err.message);
        return []; 
    }
};

const writeStations = (data) => {
    fs.writeFileSync(stationsFilePath, JSON.stringify(data, null, 4));
};

app.get('/api/stations', checkAuth, (req, res) => {
    fs.readFile(stationsFilePath, 'utf8', (err, data) => {
        if (err) { return res.status(500).json({ error: 'Gagal memuat data stasiun. Pastikan file stations.json ada.' }); }
        res.json(JSON.parse(data));
    });
});

app.get('/api/stations/status', checkAuth, async (req, res) => {
    try {
        const stationsData = fs.readFileSync(stationsFilePath, 'utf8');
        const stations = JSON.parse(stationsData);

        const fluxQuery = `
            from(bucket: "${influxBucket}")
              |> range(start: -2d)
              |> filter(fn: (r) => r._measurement == "awos_data")
              |> drop(columns: ["_start", "_stop", "_field", "_value"])
              |> group(columns: ["ICAO", "Runway"])
              |> max(column: "_time")
              |> keep(columns: ["_time", "ICAO", "Runway"])
        `;
        
        const latestDataRows = await queryApi.collectRows(fluxQuery);

        const statusMap = new Map();
        latestDataRows.forEach(row => {
            const key = `${row.ICAO}-${row.Runway}`;
            statusMap.set(key, row._time);
        });

        const stationsWithStatus = stations.map(station => {
            const key = `${station.icao}-${station.runway}`;
            return {
                ...station,
                last_update: statusMap.get(key) || null 
            };
        });

        res.json(stationsWithStatus);

    } catch (error) {
        console.error('Gagal mengambil status stasiun:', error);
        res.status(500).json({ error: 'Gagal memuat status stasiun.' });
    }
});

app.post('/api/stations', checkAuth, checkAdmin, (req, res) => {
    const newStation = req.body;
    if (!newStation.id_stasiun || !newStation.nama_stasiun) { return res.status(400).json({ error: 'Data tidak lengkap.' }); }
    fs.readFile(stationsFilePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Gagal membaca data stasiun.' });
        const stations = JSON.parse(data);
        stations.push(newStation);
        fs.writeFile(stationsFilePath, JSON.stringify(stations, null, 4), (err) => {
            if (err) return res.status(500).json({ error: 'Gagal menyimpan stasiun baru.' });
            res.status(201).json({ message: 'Stasiun berhasil ditambahkan', data: newStation });
        });
    });
});

app.put('/api/stations/:id', checkAuth, checkAdmin, (req, res) => {
    const stationId = req.params.id;
    const updatedStationData = req.body;
    fs.readFile(stationsFilePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Gagal membaca data stasiun.' });
        let stations = JSON.parse(data);
        const stationIndex = stations.findIndex(s => s.id_stasiun === stationId);
        if (stationIndex === -1) { return res.status(404).json({ error: 'Stasiun tidak ditemukan.' }); }
        stations[stationIndex] = updatedStationData;
        fs.writeFile(stationsFilePath, JSON.stringify(stations, null, 4), (err) => {
            if (err) return res.status(500).json({ error: 'Gagal memperbarui stasiun.' });
            res.json({ message: 'Stasiun berhasil diperbarui', data: stations[stationIndex] });
        });
    });
});

app.delete('/api/stations/:id', checkAuth, checkAdmin, (req, res) => {
    const stationId = req.params.id;
    if (stationId === 'irm' || stationId === req.session.user.username) {
        return res.status(403).json({ error: 'Tidak dapat menghapus pengguna ini.' });
    }
    try {
        const result = pool.query('DELETE FROM users WHERE username = $1', [stationId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        }
        res.json({ message: 'Pengguna berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menghapus pengguna.' });
    }
});


app.put('/api/stations/:stationId/parameters', checkAuth, (req, res) => {
    const { stationId } = req.params;
    const { parameters } = req.body;
    if (!parameters) return res.status(400).json({ error: 'Parameter "parameters" (array) dibutuhkan.' });
    fs.readFile(stationsFilePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Gagal membaca data stasiun.' });
        let stations = JSON.parse(data);
        const stationIndex = stations.findIndex(s => s.id_stasiun === stationId);
        if (stationIndex === -1) return res.status(404).json({ error: 'Stasiun tidak ditemukan.' });
        stations[stationIndex].parameters = parameters;
        fs.writeFile(stationsFilePath, JSON.stringify(stations, null, 4), (err) => {
            if (err) return res.status(500).json({ error: 'Gagal menyimpan urutan parameter baru.' });
            res.json({ message: 'Urutan parameter berhasil diperbarui.' });
        });
    });
});

// --- API LAINNYA ---
app.get('/api/weather/history', checkAuth, async (req, res) => {
    const { stationId, start, end, range = '-1h' } = req.query;
    if (!stationId) return res.status(400).json({ error: 'Parameter stationId dibutuhkan' });
    let stationDetails;
    try {
        const stationsData = fs.readFileSync(stationsFilePath, 'utf8');
        const stations = JSON.parse(stationsData);
        stationDetails = stations.find(s => s.id_stasiun === stationId);
    } catch (fsError) { return res.status(500).json({ error: 'Gagal membaca data stasiun.' }); }
    if (!stationDetails) return res.status(404).json({ error: `Stasiun dengan ID "${stationId}" tidak ditemukan.` });
    const { icao, runway } = stationDetails;
    let rangeQueryPart = start && end ? `start: time(v: "${start}"), stop: time(v: "${end}")` : `start: ${range}`;
    const fluxQuery = `
        from(bucket: "${influxBucket}")
          |> range(${rangeQueryPart}) 
          |> filter(fn: (r) => r._measurement == "awos_data" and r.ICAO == "${icao}" and r.Runway == "${runway}")
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
    `;
    try {
        const data = await queryApi.collectRows(fluxQuery);
        res.json(data);
    } catch (error) { res.status(500).json({ error: 'Gagal mengambil data dari database', details: error.message }); }
});

app.get('/api/weather/latest', checkAuth, async (req, res) => {
    const { stationId, range = '-1d' } = req.query; 
    
    if (!stationId) return res.status(400).json({ error: 'Parameter stationId dibutuhkan' });
    
    let stationDetails;
    try {
        const stationsData = fs.readFileSync(stationsFilePath, 'utf8');
        const stations = JSON.parse(stationsData);
        stationDetails = stations.find(s => s.id_stasiun === stationId);
    } catch (fsError) { return res.status(500).json({ error: 'Gagal membaca data stasiun.' }); }
    
    if (!stationDetails) return res.status(404).json({ error: `Stasiun tidak ditemukan.` });
    
    const { icao, runway } = stationDetails;
    
    // Gunakan variable 'range' di dalam query Flux
    const fluxQuery = `
        from(bucket: "${influxBucket}")
          |> range(start: ${range}) 
          |> filter(fn: (r) => r._measurement == "awos_data" and r.ICAO == "${icao}" and r.Runway == "${runway}")
          |> last()
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;
    
    try {
        const data = await queryApi.collectRows(fluxQuery);
        res.json(data[0] || {});
    } catch (error) { res.status(500).json({ error: 'Gagal mengambil data dari database' }); }
});

app.get('/api/meta/icaos', checkAuth, async (req, res) => {
    const fluxQuery = `import "influxdata/influxdb/schema" schema.tagValues(bucket: "${influxBucket}", tag: "ICAO", start: -30d)`;
    try {
        const data = await queryApi.collectRows(fluxQuery);
        res.json(data.map(row => row._value).sort());
    } catch (error) { res.status(500).json({ error: 'Gagal mengambil data dari database' }); }
});

app.get('/api/meta/runways', checkAuth, async (req, res) => {
    const { icao } = req.query;
    if (!icao) return res.status(400).json({ error: 'Parameter icao dibutuhkan' });
    const fluxQuery = `import "influxdata/influxdb/schema" schema.tagValues(bucket: "${influxBucket}", tag: "Runway", start: -30d, predicate: (r) => r.ICAO == "${icao}")`;
    try {
        const data = await queryApi.collectRows(fluxQuery);
        res.json(data.map(row => row._value).sort());
    } catch (error) { res.status(500).json({ error: 'Gagal mengambil data dari database' }); }
});

app.get('/api/meta/parameters', checkAuth, async (req, res) => {
    const fluxQuery = `import "influxdata/influxdb/schema" schema.measurementFieldKeys(bucket: "${influxBucket}", measurement: "awos_data", start: -30d)`;
    try {
        const data = await queryApi.collectRows(fluxQuery);
        res.json(data.map(row => row._value).sort());
    } catch (error) { res.status(500).json({ error: 'Gagal mengambil data dari database' }); }
});

app.get('/api/server-time', (req, res) => {
    res.json({ serverTime: new Date() });
});

io.on('connection', (socket) => {
    // console.log('⚡ Client connected:', socket.id);
    
    // Client meminta data spesifik station (Join Room)
    socket.on('join_station', (stationId) => {
        socket.join(stationId);
    });

    socket.on('leave_station', (stationId) => {
        socket.leave(stationId);
    });
});

// INTERVAL PUSH DATA (Setiap 2 Detik)
setInterval(async () => {
    const stations = readStations();
    
    // Loop setiap stasiun untuk cek data baru
    for (const station of stations) {
        const roomId = station.id_stasiun;
        
        // Cek apakah ada user yang sedang melihat stasiun ini?
        const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
        
        // Hanya query DB jika ada user yang online di room tersebut (Efisiensi)
        if (socketsInRoom && socketsInRoom.size > 0) {
            try {
                // Ambil 1 data terakhir
                const fluxQuery = `
                    from(bucket: "${influxBucket}")
                      |> range(start: -5m) 
                      |> filter(fn: (r) => r._measurement == "awos_data" and r.ICAO == "${station.icao}" and r.Runway == "${station.runway}")
                      |> last()
                      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
                `;
                
                const dataRows = await queryApi.collectRows(fluxQuery);
                
                if (dataRows.length > 0) {
                    const latestData = dataRows[0];
                    // Kirim data hanya ke user di room ini
                    io.to(roomId).emit('weather_update', latestData);
                }
            } catch (err) {
                console.error(`Broadcast error ${roomId}:`, err.message);
            }
        }
    }
}, 2000);


// --- JALANKAN SERVER ---
server.listen(PORT, () => {
    console.log(`
    🚀 SERVER DASHBOARD SIAP
    ------------------------
    URL    : http://localhost:${PORT}
    Socket : Aktif (Real-time Push)
    DB     : ${process.env.POSTGRES_DB}
    ------------------------
    `);
});


