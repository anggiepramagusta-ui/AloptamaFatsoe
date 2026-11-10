# Menggunakan base image Node.js versi 22 yang ringan
FROM node:22-alpine

# Menetapkan direktori kerja di dalam container
WORKDIR /usr/src/app

# Salin file package.json dan package-lock.json terlebih dahulu
COPY package*.json ./

# Install semua dependensi yang dibutuhkan aplikasi
RUN npm install

# Salin semua sisa file proyek ke dalam direktori kerja
COPY . .

# Buka port 3000 agar bisa diakses dari luar container
EXPOSE 3000

# Perintah default untuk menjalankan aplikasi saat container dimulai
CMD [ "node", "server.js" ]
