const { default: makeWASocket, useMultiFileAuthState, isJidGroup } = require('@whiskeysockets/baileys');
const googleTTS = require("google-tts-api")
const fs = require("fs");
const { kill, send } = require('process');
const { isErrored } = require('stream');
const userConfigFile = './userconfig.json';
const AllowwedUID = "6289510305764@s.whatsapp.net"
const confessMode = {}
let userInventory = {}
let userCoins = {}
let lastClaim = {}
let userFishingRod = {}
let userCurrRodEq = {}
if (fs.existsSync(userConfigFile)) {
    const userConfig = JSON.parse(fs.readFileSync(userConfigFile));
    userInventory = userConfig.userInventory || {};
    userCoins = userConfig.userCoins || {};
    lastClaim = userConfig.lastClaim || {};
    userFishingRod = userConfig.userFishingRod || {};
    userCurrRodEq = userConfig.userCurrRodEq || {};
}

const PREFIX = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "!", "@", "#", "$", "%", "^", "&", "*", "-", "_", "=", "+", ";", ":", "'", "\"", "<", ">", ",", ".", "?", "/", "\\", "|", "~", "`"
];
const shopText = `Mau Beli Apa?\nKetik .rodshop untuk membuka Rod Shop\nShop Lain Akan Segera dibuat update kedepan!`
const rodList = [
    { id: 1, name: "Pancingan Biasa", price: 50, description: "Pancingan Normal Untuk Pemula (Tersedia secara default)" },
]
const rodShopTxt = `*Bot I Rod Shop*\n\n`
const anonymousQueue = [];
const activeChats = {};

async function matchAnonymousUser(sock, sender) {
    if (anonymousQueue.length > 0) {
        const partner = anonymousQueue.shift();
        activeChats[sender] = partner;
        activeChats[partner] = sender;
        
        await sock.sendMessage(sender, { text: "✅ Kamu telah dipasangkan dengan seseorang. Mulailah berbicara! Ketik '.stop' untuk mengakhiri percakapan." });
        await sock.sendMessage(partner, { text: "✅ Kamu telah dipasangkan dengan seseorang. Mulailah berbicara! Ketik '.stop' untuk mengakhiri percakapan." });
    } else {
        anonymousQueue.push(sender);
        await sock.sendMessage(sender, { text: "⏳ Menunggu pasangan anonim... Jika dalam 30 detik tidak ada yang bergabung, sesi akan dibatalkan." });
        
        setTimeout(async () => {
            if (anonymousQueue.includes(sender)) {
                anonymousQueue.splice(anonymousQueue.indexOf(sender), 1);
                await sock.sendMessage(sender, { text: "❌ Tidak ada pasangan yang tersedia. Coba lagi nanti." });
            }
        }, 30000);
    }
}

async function handleAnonymousMessage(sock, sender, message) {
    if (activeChats[sender]) {
        const partner = activeChats[sender];
        await sock.sendMessage(partner, { text: message });
    }
}

async function stopAnonymousChat(sock, sender) {
    if (activeChats[sender]) {
        const partner = activeChats[sender];
        delete activeChats[sender];
        delete activeChats[partner];
        
        await sock.sendMessage(sender, { text: "❌ Sesi anonim telah dihentikan." });
        await sock.sendMessage(partner, { text: "❌ Pasangan anonimmu telah meninggalkan percakapan." });
    }
}

function saveUserConfig() {
    const userConfig = {
      userInventory,
      userCoins,
      lastClaim,
      userFishingRod,
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
            const currcoin = userCoins[userId]
    
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
    .logupdate - Menampilkan Update Terbaru
    .confessmode <nomor> - Memulai Sesi Confess Dengan Membalas Langsung
    
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
                await sock.sendMessage(sender, { text: `Koin Mu Sekarang Adalah 💰${currcoin}💰`})
            } else if (command === "shop") {
                await sock.sendMessage(sender, { text: shopText })
            } else if (command ==="logupdate" ) {
                const updateLog = `*CHANGELOG:*\n\n- Memperbaiki Command .mycoin\n- Memperbaiki Beberapa Bug\n- Menambahkan Command .confessmode <nomor>\n*-- 10/03/2025*`;
                await sock.sendMessage(sender, { text: updateLog })
            } else if (command === "rodshop") {
                return await sock.sendMessage(sender, { text: rodShopTxt })
            } else if (command === "everyone") {
                if (userId !== AllowwedUID) {
                    return await sock.sendMessage(sender, { text: "Kamu Tidak Memiliki Izin Untuk Perintah ini!" })
                }
                if (userId === AllowwedUID) {
                    const groupMetadata = await sock.groupMetadata(userId)
                    const member = groupMetadata.participants.map(u => u.id)
                    await sock.sendMessage(sender, { text: `@${member.map(m => m.split('@').join(' @'))}`, mentions: member })
                }
            } else if (command.startsWith("buy ")) {
                const num = message.slice(6).trim()
                if (num > 6 || isNaN(num)) {
                    return await sock.sendMessage(sender, { text: "ID tidak valid! Silahkan Masukkan Angkan dari 1 - 6" })
                }
            } else if (sender.endsWith("@s.whatsapp.net") && command.startsWith("confessmode ")) {
                const args = message.trim().split(/\s+/);
            
                if (args.length !== 2) {
                    return sock.sendMessage(sender, { text: `⚠️ Format salah! Gunakan: .confessmode <nomor>` });
                }
            
                const number = args[1].replace(/\D/g, '');
            
                if (number.length < 10 || number.length > 15) {
                    return sock.sendMessage(sender, { text: `⚠️ Nomor tidak valid! Masukkan nomor yang benar tanpa simbol atau huruf.` });
                }
            
                const no = number + "@s.whatsapp.net";
            
                confessMode[sender] = no;
                confessMode[no] = sender;
            
                await sock.sendMessage(sender, { text: "✅ Mode Confess diaktifkan! Ketik apa saja, dan pesan akan dikirim ke nomor tujuan." });
                await sock.sendMessage(no, { text: "🔔 Seseorang memulai Confess Mode dengan Anda.\n\nKetik `.batalkan` untuk membatalkan atau balas langsung untuk merespons." });
            } 
            else if (sender.endsWith("@s.whatsapp.net") && confessMode[sender]) {
                const target = confessMode[sender];
            
                if (command.trim() === "batalkan") {
                    delete confessMode[sender];
                    delete confessMode[target];
            
                    await sock.sendMessage(sender, { text: "❌ Confess Mode telah dibatalkan. Kamu tidak bisa lagi mengirim atau menerima pesan." });
                    return await sock.sendMessage(target, { text: "❌ Confess Mode telah dibatalkan oleh pasangan confess-mu." });
                }
            
                await sock.sendMessage(target, { text: message });
            } else if (command === "start") {
                await matchAnonymousUser(sock, sender);
            } else if (command === "stop") {
                await stopAnonymousChat(sock, sender);
            } else if (activeChats[sender]) {
                await handleAnonymousMessage(sock, sender, message);
            }
            
            
        } catch (error) {
            console.error("❌ Gagal mengirim pesan:", error);
        }
    });
    
    sock.ev.on("creds.update", saveCreds);
}

start();

