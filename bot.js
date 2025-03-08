const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const googleTTS = require("google-tts-api")
const fs = require("fs");
const { kill } = require('process');
const { isErrored } = require('stream');
const userConfigFile = './userconfig.json';
let userInventory = {}
let userCoins = {}
let lastClaim = {}
if (fs.existsSync(userConfigFile)) {
    const userConfig = JSON.parse(fs.readFileSync(userConfigFile));
    userInventory = userConfig.userInventory || {};
    userCoins = userConfig.userCoins || {};
    lastClaim = userConfig.lastClaim || {};
}

const PREFIX = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "!", "@", "#", "$", "%", "^", "&", "*", "-", "_", "=", "+", ";", ":", "'", "\"", "<", ">", ",", ".", "?", "/", "\\", "|", "~", "`"
];


function saveUserConfig() {
    const userConfig = {
      userInventory,
      userCoins,
      lastClaim,
    };
    fs.writeFileSync(userConfigFile, JSON.stringify(userConfig, null, 2));
  }
async function start() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state
    });
    

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("✅ Berhasil konek ke WhatsApp Web");
        } else if (connection === "close") {
            console.log("❌ Koneksi terputus:", lastDisconnect);
            start()
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages || !m.messages[0].message) return;
        const msg = m.messages[0];
        if (msg.key.fromMe) return;
    
        let sender = msg.key.remoteJid;
        let userId = msg.key.participant || msg.key.remoteJid;
        const message = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!message) return;
    
        console.log(`📩 Pesan diterima dari ${sender}: ${message}`);
    
        try {
            const prefixUsed = PREFIX.find(p => message.startsWith(p));
            if (!prefixUsed) return;
    
            const command = message.slice(prefixUsed.length).trim();
    
            if (command === "menu") {
                const menuText = `Halo, @${userId}!
                
    Menu Bot:
    .menu - Menampilkan menu
    .says <kata> - Mengulangi kata
    .tts <kata> - Mengubah teks menjadi suara
    .confess <pesan> <no tujuan> <dari siapa> - Kirim pesan rahasia
    .confesstts <pesan> <no tujuan> <dari siapa> - Kirim pesan rahasia dengan suara
    .mycoin - Tampilkan Koin Anda!
    .c / .coinly - Klaim Koin Per-hari
    
    Semua Huruf Maupun Besar dan Kecil Bisa Menjadi PREFIX.`;
                await sock.sendMessage(sender, { text: menuText });
            } else if (command.startsWith("says ")) {
                const txt = command.slice(5).trim();
                await sock.sendMessage(sender, { text: txt });
            } else if (command.startsWith("tts ")) {
                const ttsMsg = command.slice(4).trim();
                const url = googleTTS.getAudioUrl(ttsMsg, { lang: "id", slow: false });
                await sock.sendMessage(sender, {
                    audio: { url },
                    mimetype: "audio/mpeg",
                    ptt: true
                });
                if (error) {
                    sock.sendMessage(sender, { text: "Terjadi kesalahan!" })
                }
            } else if (command.startsWith("confess ")) {
                const args = command.split(" ");
                if (args.length < 3) {
                    await sock.sendMessage(sender, { text: `⚠️ Format salah! Gunakan: .confess [pesan] [no tujuan] [pengirim]` });
                    return;
                }
                let fromWho = args.pop();
                let id = args.pop() + "@s.whatsapp.net";
                let pesan = args.slice(1).join(" ");
    
                const confessMsg = `💌 Kamu Telah Menerima Pesan Rahasia Dari *${fromWho}*:\n\n"${pesan}"`;
                await sock.sendMessage(id, { text: confessMsg });
                await sock.sendMessage(sender, { text: "✅ Pesan rahasia berhasil dikirim!" });
            } else if (command.startsWith("confesstts ")) {
                const args = command.split(" ");
                if (args.length < 3) {
                    await sock.sendMessage(sender, { text: `⚠️ Format salah! Gunakan: .confesstts [pesan] [no tujuan] [pengirim]` });
                    return;
                }
                let fromWho = args.pop();
                let id = args.pop() + "@s.whatsapp.net";
                let pesan = args.slice(1).join(" ");
    
                const confessMsg = `💌 Kamu Telah Menerima Pesan Rahasia Dari *${fromWho}*:\n\n"${pesan}"`;
                const url = googleTTS.getAudioUrl(pesan, { lang: "id", slow: false });
    
                await sock.sendMessage(id, { text: confessMsg });
                await sock.sendMessage(id, { audio: { url }, mimetype: "audio/mpeg", ptt: true });
                await sock.sendMessage(sender, { text: "✅ Pesan rahasia (TTS) berhasil dikirim!" });
            } else if (command === "c" || command === "coinly") {
                const now = Date.now(); 
                const oneDay = 24 * 60 * 60 * 1000; 
                
                if (!userCoins[userId]) userCoins[userId] = 0;
                if (!lastClaim[userId]) lastClaim[userId] = 0; 
            
                console.log(`🔍 DEBUG: User ${userId} terakhir klaim pada: ${new Date(lastClaim[userId])}`);
            
                if (now - lastClaim[userId] < oneDay) {
                    const timeLeft = oneDay - (now - lastClaim[userId]);
                    const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
                    const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
                    await sock.sendMessage(sender, { 
                        text: `⏳ Kamu sudah klaim koin hari ini! Coba lagi dalam ${hoursLeft} jam ${minutesLeft} menit.` 
                    });
                    return;
                }
            
                const coinsEarned = Math.floor(Math.random() * 10) + 1;
                userCoins[userId] += coinsEarned;
                lastClaim[userId] = now; 
                saveUserConfig(); 
            
                console.log(`✅ DEBUG: User ${userId} berhasil klaim ${coinsEarned} koin pada: ${new Date(now)}`);
            
                await sock.sendMessage(sender, { 
                    text: `🎉 Kamu mendapatkan ${coinsEarned} koin! 💰 Total koin kamu sekarang: ${userCoins[userId]}` 
                });
            } else if (command === "mycoin") {
                await sock.sendMessage(sender, { text: `Koin Mu Sekarang Adalah ${userCoins}`})
            }
            
        
        } catch (error) {
            console.error("❌ Gagal mengirim pesan:", error);
        }
    });
    
    sock.ev.on("creds.update", saveCreds);
}

start();