const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, writeExifImg } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const googleTTS = require('google-tts-api');
const puppeteer = require("puppeteer-core");
const fs = require('fs');
const path = require("path");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static')
const { promisify } = require('util');
const axios = require('axios');
const userConfigFile = './userconfig.json';
const confessFile = './confess.json'
const AllowwedUID = "6289510305764@s.whatsapp.net"
const unlinkAsync = promisify(fs.unlink)
let confessMode = {}
let confesstts = {}
let userInventory = {}
let userCoins = {}
let lastClaim = {}
let userName = {}
let userFishingRod = {}
let userCurrRodEquipped = {}
ffmpeg.setFfmpegPath(ffmpegPath); 
if (fs.existsSync(confessFile)) {
    const confess = JSON.parse(fs.readFileSync(confessFile));
    confessMode = confess.confessMode || {};
    confesstts = confess.confesstts || {};
}
if (fs.existsSync(userConfigFile)) {
    const userConfig = JSON.parse(fs.readFileSync(userConfigFile));
    userInventory = userConfig.userInventory || {};
    userCoins = userConfig.userCoins || {};
    lastClaim = userConfig.lastClaim || {};
    userFishingRod = userConfig.userFishingRod || {};
    userName = userConfig.userName || {};
    userCurrRodEquipped = userConfig.userCurrRodEquipped || {};
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
const waitingUsers = new Set()

async function getContactName(sock, jid) {
    const contact = await sock.onWhatsApp(jid);
    return contact?.[0]?.verifiedName || "Pengguna";
}

const CHROME_PATH = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
async function matchAnonymousUser(sock, sender) {
    if (activeChats[sender]) {
        await sock.sendMessage(sender, { text: "⚠️ Kamu sudah dalam sesi anonim. Ketik '.stop' untuk keluar." });
        return;
    }
    
    if (anonymousQueue.length > 0) {
        const partner = anonymousQueue.shift();
        
        if (partner === sender) {
            await sock.sendMessage(sender, { text: "⏳ Masih menunggu pasangan. Mohon tunggu..." });
            return;
        }
        
        activeChats[sender] = partner;
        activeChats[partner] = sender;
        
        await sock.sendMessage(sender, { text: "✅ Kamu telah dipasangkan dengan seseorang. Mulailah berbicara! Ketik '.stop' untuk mengakhiri percakapan." });
        await sock.sendMessage(partner, { text: "✅ Kamu telah dipasangkan dengan seseorang. Mulailah berbicara! Ketik '.stop' untuk mengakhiri percakapan." });
    } else {
        if (!waitingUsers.has(sender)) {
            anonymousQueue.push(sender);
            waitingUsers.add(sender);
            await sock.sendMessage(sender, { text: "⏳ Menunggu pasangan anonim... Jika dalam 30 detik tidak ada yang bergabung, sesi akan dibatalkan." });
        }
        
        setTimeout(async () => {
            if (anonymousQueue.includes(sender)) {
                anonymousQueue.splice(anonymousQueue.indexOf(sender), 1);
                waitingUsers.delete(sender);
                await sock.sendMessage(sender, { text: "❌ Tidak ada pasangan yang tersedia. Coba lagi nanti." });
            }
        }, 30000);
    }
}

async function handleAnonymousMessage(sock, sender, message) {
    if (activeChats[sender]) {
        const partner = activeChats[sender];
        await sock.sendMessage(partner, { text: message });
    } else {
        await sock.sendMessage(sender, { text: "⚠️ Kamu tidak dalam sesi anonim. Ketik '.start' untuk memulai." });
    }
}

async function stopAnonymousChat(sock, sender) {
    if (activeChats[sender]) {
        const partner = activeChats[sender];
        delete activeChats[sender];
        delete activeChats[partner];
        
        await sock.sendMessage(sender, { text: "❌ Sesi anonim telah dihentikan." });
        await sock.sendMessage(partner, { text: "❌ Pasangan anonimmu telah meninggalkan percakapan." });
    } else {
        await sock.sendMessage(sender, { text: "⚠️ Kamu tidak sedang dalam sesi anonim." });
    }
}
async function restartBot(sock, sender) {
    await sock.sendMessage(sender, { text: "🔄 Bot sedang restart..." });
    console.log("🔄 Restarting bot...");
    process.exit(1);
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
        const messageType = Object.keys(msg.message)[0];
        let sender = msg.key.remoteJid;
        let userId = msg.key.participant || msg.key.remoteJid;
        const message = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!message) return;
    
        console.log(`📩 Pesan diterima dari ${sender}: ${message}`);
        if (sender.endsWith("@g.us")) {
            console.log(`📩 Pesan diterima dari grup dan dikirim oleh ${userId}: ${message}`)
        }
        const getProfilePicture = async (jid) => {
            try {
                const ppUrl = await sock.profilePictureUrl(jid, 'image'); 
                return ppUrl;
            } catch (error) {
                console.log("Gagal mengambil foto profil:", error);
                return 'https://i.ibb.co/4pDNDk1/default-profile.png';
            }
        };
        const sendProfilePicture = async (jid) => {
            const ppUrl = await getProfilePicture(jid);
            if (!userName[sender]) {
                userName[sender] = {}
            }
            const username = getContactName(sock, sender)
            await sock.sendMessage(jid, {
                image: { url: ppUrl },
                caption: `🔹 Profil Anda 🔹\n\nNama: ${username}`
            });
        };
        try {
            const prefixUsed = PREFIX.find(p => message.startsWith(p));
            if (!prefixUsed) return;
    
            const command = message.slice(prefixUsed.length).trim();
            const currcoin = userCoins[userId]
    
            if (command === "menu") {
                const menuText = `Halo, @${userId}!
                
Menu
     ________________________
    |.menu
    |.start
    |.says
    |.tts
    |.profile
    |.identitybot
    |.setname
    |.confess 
    |.confesstts 
    |.mycoin
    |.c / .coinly
    |.logupdate
    |.confessmode
    
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
                    sock.sendMessage(sender, { text: "Terjadi kesalahan!" }, { quoted: msg })
                }
            } else if (command === "confess") {
                const imgurl = "https://files.catbox.moe/3qtf7q.jpg"
                const response = await axios.get(imgurl, { responseType: "arraybuffer" });
                let buffer = Buffer.from(response.data, "binary");
                sock.sendMessage(sender, {
                     image: buffer,
                     caption: "Gunakan Seperti Di Gambar!"
                     }, {
                         quoted: msg 
                        })
                     buffer = null
            } else if (command.startsWith("confess ")) {
                const number = command.split(" ")[1]?.replace(/\D/g, '');
                if (!number) return sock.sendMessage(sender, { text: "⚠️ Format salah! Gunakan: .confess <nomor>" }, { quoted: msg });
                const no = number + "@s.whatsapp.net";
                confessMode[sender] = no;
        
                await sock.sendMessage(sender, { text: "✅ Mode Confess teks aktif! Ketik pesan dan akan dikirim ke nomor tujuan." }, { quoted: msg });
            } 
            else if (command === ".hentikan" && confessMode[sender]) {
                delete confessMode[sender];
                await sock.sendMessage(sender, { text: "❌ Confess mode dihentikan." }, { quoted: msg });
            } 
            else if (confessMode[sender]) {
                await sock.sendMessage(confessMode[sender], { text: message });
            } else if (command === "stiker" || command === "sticker" || command === "s") {
                let mediaMessage;
            
                if (msg.message?.imageMessage || msg.message?.videoMessage) {
                    mediaMessage = msg;
                } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                    mediaMessage = {
                        message: msg.message.extendedTextMessage.contextInfo.quotedMessage,
                        key: msg.message.extendedTextMessage.contextInfo.stanzaId
                    };
                } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage) {
                    mediaMessage = {
                        message: msg.message.extendedTextMessage.contextInfo.quotedMessage,
                        key: msg.message.extendedTextMessage.contextInfo.stanzaId
                    };
                }
            
                if (!mediaMessage) {
                    sock.sendMessage(sender, { text: "❌ Kirim atau reply gambar/video untuk dijadikan stiker!" }, { quoted: msg });
                    return;
                }
            
                console.log("✅ Media terdeteksi:", mediaMessage);
            
                // Download media
                const buffer = await downloadMediaMessage(mediaMessage, "buffer", {});
            
                if (msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                    // Konversi ke WebP (untuk gambar)
                    const webpSticker = await sharp(buffer)
                        .resize(512, 512)  // Resize ke 512x512 px
                        .toFormat("webp")   // Konversi ke WebP
                        .toBuffer();
            
                    // Kirim sebagai sticker
                    await sock.sendMessage(sender, { sticker: webpSticker }, { quoted: msg });
                    console.log("✅ Sticker gambar berhasil dikirim!");
                } else if (msg.message?.videoMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage) {
                    // Simpan sementara file video
                    const videoPath = "temp_video.mp4";
                    const outputPath = "temp_sticker.webp";
                    fs.writeFileSync(videoPath, buffer);
            
                    await new Promise((resolve, reject) => {
                        ffmpeg(videoPath)
                            .outputOptions([
                                "-vcodec libwebp",
                                "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=10",
                                "-loop 0",
                                "-preset default",
                                "-an",
                                "-vsync 0"
                            ])
                            .toFormat("webp")
                            .save(outputPath)
                            .on("end", resolve)
                            .on("error", reject);
                    });
                                                  
            
                    // Baca output WebP
                    const webpSticker = fs.readFileSync(outputPath);
            
                    // Kirim sebagai sticker
                    await sock.sendMessage(sender, { sticker: webpSticker }, { quoted: msg });
            
                    // Hapus file sementara
                    fs.unlinkSync(videoPath);
                    fs.unlinkSync(outputPath);
            
                    console.log("✅ Sticker video berhasil dikirim!");
                }
            } else if (command.startsWith("brat")) {
                const bratText = message.slice(6).trim(); // Ambil teks setelah .brat
                
                if (!bratText) {
                    sock.sendMessage(sender, { text: "❌ Masukkan teks brat!" }, { quoted: msg });
                    return;
                }
            
                console.log("Teks yang dimasukkan untuk brat:", bratText);

            
                // Tambahkan async di sini untuk menjalankan fungsi asinkron
                (async () => {
                    try {
                        // Mulai Puppeteer dengan mode non-headless
                        const browser = await puppeteer.launch({
                            executablePath: CHROME_PATH,
                            headless: 'new',  // Mode non-headless untuk melihat browser
                            args: ["--no-sandbox", "--disable-setuid-sandbox"],
                        });
                        console.log("🚀 Puppeteer launched in non-headless mode!");
            
                        const page = await browser.newPage();
                        console.log("🌐 Navigating to bratgenerator.com...");
                        await page.goto("https://bratgenerator.com", { waitUntil: "domcontentloaded", timeout: 60000 });
            
                        console.log("⚙️ Setting theme to white...");
                        await page.evaluate(() => setupTheme("white"));
            
                        console.log("✏️ Emptying the input text...");
                        await page.evaluate(() => {
                            const inputElement = document.querySelector("#textInput");
                            if (inputElement) inputElement.value = ""; // Kosongkan teks input
                        });
            
                        console.log("✏️ Typing the brat text...");
                        await page.type("#textInput", bratText, { delay: 50 });
            
                        console.log("⏳ Waiting for brat element...");
                        await page.waitForSelector("#textOverlay", { timeout: 10000 });
            
                        console.log("📸 Taking screenshot...");
                        const bratElement = await page.$("#textOverlay");
                        if (!bratElement) {
                            throw new Error("❌ Elemen brat tidak ditemukan!");
                        }
                        const bratImagePath = path.join(__dirname, "brat.png");
                        await bratElement.screenshot({ path: bratImagePath });
            
                        console.log("✅ Brat image saved:", bratImagePath);
            
                        // Mengonversi gambar brat ke WebP
                        await sharp(bratImagePath)
                            .resize(512, 512, { fit: "inside" }) // Sesuaikan ukuran
                            .webp({ quality: 100 }) // Kualitas maksimal
                            .toFile(path.join(__dirname, "brat.webp"));
            
                        console.log("✅ Sticker created successfully!");
            
                        const stickerPath = path.join(__dirname, "brat.webp");
                        const stickerBuffer = fs.readFileSync(stickerPath);
                        await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: msg });
            
                        // Hapus file sementara
                        fs.unlinkSync(bratImagePath);
                        fs.unlinkSync(stickerPath);
                    } catch (err) {
                        console.error("❌ Gagal membuat brat:", err);
                        await sock.sendMessage(sender, { text: "❌ Gagal membuat brat!" }, { quoted: msg });
                    }
                })();
            }                    
            else if (command.startsWith("spam")) {
                const args = message.split(" ");
                
                if (args.length < 3) {
                    return sock.sendMessage(from, { text: "Format salah! Gunakan: .spam <jumlah> <pesan>" }, { quoted: msg });
                }
            
                const count = parseInt(args[1]); 
                const spamMessage = args.slice(2).join(" "); 
                
                if (isNaN(count) || count <= 0 || count > 20) { 
                    return sock.sendMessage(from, { text: "Jumlah spam tidak boleh kurang atau lebih dari 1-20!" }, { quoted: msg });
                }
            
                for (let i = 0; i < count; i++) {
                    sock.sendMessage(from, { text: spamMessage });
                }
            }
            
        
            // CONFESS TTS
            else if (command === "profile") {
                sendProfilePicture(sender)
            }
            else if (command.startsWith(".confesstts ")) {
                const number = command.split(" ")[1]?.replace(/\D/g, '');
                if (isNaN(number)) return sock.sendMessage(sender, { text: "⚠️ Format salah! Gunakan: .confesstts <nomor>" });
        
                const no = number + "@s.whatsapp.net";
                confesstts[sender] = no;
        
                await sock.sendMessage(sender, { text: "✅ Mode Confess TTS aktif! Ketik pesan dan akan dikirim sebagai suara." });
                await sock.sendMessage(no, { text: "Seseorang telah confess tts ke anda ketik .batalkan untuk membatalkan nya!" })
                if (command === ".batalkan" && confesstts[sender]) {
                    delete confesstts[sender];
                    await sock.sendMessage(sender, { text: "❌ Confess TTS dihentikan." });
                } 
            } 
            else if (confesstts[sender]) {
                const url = googleTTS.getAudioUrl(message, { lang: "id", slow: false });
                await sock.sendMessage(confesstts[sender], { audio: { url }, mimetype: "audio/mpeg", ptt: true });
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
                await sock.sendMessage(sender, { text: `Koin Mu Sekarang Adalah ${currcoin}💰`})
            } else if (command === "shop") {
                await sock.sendMessage(sender, { text: shopText })
            } else if (command ==="logupdate" ) {
                const updateLog = `*CHANGELOG:*\n\n- Memperbaiki Bug Ngeselin\n- Memperbaiki Beberapa Bug\n- Menghapus command .confessmode\n- Menambahkan commmand .sticker - Cara menggunakan command sticker\n1. kirim gambar atau video(max. 10 dtk)\n2. lalu reply gambar/video tsb dan tunggu sampai proses selsai\nMenambahkan command .brat <text>\n\n*-- 23/03/2025*`;
                await sock.sendMessage(sender, { text: updateLog })
            } else if (command === "rodshop") {
                return await sock.sendMessage(sender, { text: rodShopTxt })
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
            } else if (command === "restart") {
                if (userId !== AllowwedUID) {
                    return sock.sendMessage(sender, { text: "Kamu Tak Memiliki Izin Untuk Menggunakan Command ini!" })
                }
                if (userId === AllowwedUID) {
                    return sock.sendMessage(sender, { text: "Merestart Bot..." })
                    restartBot(sock, sender)
                }
            }
            
            
        } catch (error) {
            console.error("❌ Gagal mengirim pesan:", error);
        }
    });
    
    sock.ev.on("creds.update", saveCreds);
}

start();

