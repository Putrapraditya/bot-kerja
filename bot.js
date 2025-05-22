const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// File untuk menyimpan data nomor yang sudah dikirimi pesan
const DATA_FILE = 'sent_numbers.json';

// Nomor yang dikecualikan
const NOMOR_DIKECUALIKAN = [
    '6285697541380', 
    '6281386234176',
    '62895326162732',
    '62895383486470'
];

// Baca data yang sudah tersimpan atau buat file baru jika belum ada
let sentNumbers = {};
try {
    const data = fs.readFileSync(DATA_FILE);
    sentNumbers = JSON.parse(data);
} catch (err) {
    // File belum ada, buat yang baru
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

// Fungsi untuk menyimpan data ke file
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(sentNumbers));
}

// Fungsi untuk memeriksa apakah sudah 1 hari sejak terakhir dikirimi pesan
function canSendMessage(phoneNumber) {
    if (!sentNumbers[phoneNumber]) return true;
    
    const lastSentDate = new Date(sentNumbers[phoneNumber]);
    const now = new Date();
    
    // Bandingkan hanya tanggalnya (abaikan jam)
    return now.toDateString() !== lastSentDate.toDateString();
}

// Fungsi untuk memeriksa apakah sekarang di luar jam kerja
function isOutsideWorkingHours() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Jam kerja 09:00 - 15:00
    const before9 = hours < 10 || (hours === 10 && minutes < 0);
    const after15 = hours > 18 || (hours === 18 && minutes > 0);
    
    return before9 || after15;
}

// Inisialisasi client WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Tampilkan QR code saat ready
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Saat client ready
client.on('ready', () => {
    console.log('Client is ready!');
});

// Tangani pesan masuk
client.on('message', async message => {
    // Dapatkan nomor pengirim (tanpa @c.us)
    const phoneNumber = message.from.split('@')[0];
    // Abaikan jika nomor ada di daftar NOMOR_DIKECUALIKAN
    if (NOMOR_DIKECUALIKAN.includes(phoneNumber)) {
        console.log(`Pesan dari ${phoneNumber} diabaikan`);
        return;
    }
    // Abaikan jika pesan berasal dari grup
    if (message.from.includes('@g.us')) {
        try {
            // Dapatkan info grup
            const chat = await message.getChat();
            if (chat.isGroup) {
                const sender = await message.getContact();
                const clientInfo = client.info; // Informasi tentang client/bot
                 
                console.log('\n==================================');
                console.log(`[${new Date().toLocaleString()}] Pesan dari grup:`);
                console.log(`Nama Grup: ${chat.name}`);
                console.log(`ID Grup: ${chat.id._serialized}`);
                console.log(`Pengirim: ${sender.pushname || sender.phoneNumber}`);
                console.log(`Isi Pesan: ${message.body}`);
                console.log('==================================\n');
            }
        } catch (error) {
            console.error('Error mendapatkan info grup:', error);
        }
        return;
    }
    
    
    // Periksa apakah di luar jam kerja dan belum dikirimi pesan hari ini
    if (isOutsideWorkingHours() && canSendMessage(phoneNumber)) {
        // Kirim pesan balasan
                const replyMessage = `⚠️ Saat ini Anda menghubungi di luar jam operasional (09:00 - 18:00) ⚠️\n\nMohon maaf jika terdapat keterlambatan dalam merespons pesan Anda.\n\nTerima kasih atas pengertiannya.`;
        await message.reply(replyMessage);
        
        // Update data terakhir dikirim
        sentNumbers[phoneNumber] = new Date().toISOString();
        saveData();
        
        console.log(`Pesan otomatis terkirim ke ${phoneNumber}`);
    }
});

// Mulai client
client.initialize();
