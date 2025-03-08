const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const googleTTS = require("google-tts-api")
const fs = require("fs");
const { kill } = require('process');

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
        let userId = msg.key.participant || sender
        const message = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!message) return;
        console.log(`📩 Pesan diterima dari ${sender}: ${message}`);
        try {
            if (message.startsWith('.menu')) {
                const menuText = `Halo, @${sender}!
                Menu Bot:
            .says <kata>
            .tts <kata>
            .confess <pesan> <no tujuan> <dari siapa>
            .confesstts <pesan> <no tujuan> <dari siapa>`;
                await sock.sendMessage(sender, { text: menuText });
            } else if (message.startsWith(".says ")) {
                const txt = message.slice(6).trim();
                await sock.sendMessage(sender, { text: txt });
            } else if (message.startsWith(".tts ")) {
                const ttsMsg = message.slice(5).trim();
                const url = googleTTS.getAudioUrl(ttsMsg, { lang: "id", slow: false });
                const filePath = "tts.mp3";
                await saveAudio(url, filePath);
                await sock.sendMessage(sender, {
                    audio: { url: filePath },
                    mimetype: "audio/mpeg",
                    ptt: true 
                });
                await killAudio()
            } else if (message.startsWith(".confess ")) {
                const args = message.split(" ");
                if (args.length < 4) {
                    await sock.sendMessage(sender, { text: "⚠️ Format salah! Gunakan: .confess [pesan] [no tujuan] [pengirim]" });
                    return;
                }
                let fromWho = args.pop();
                let id = args.pop() + "@s.whatsapp.net";
                let pesan = args.slice(1).join(" ");
                const confessMsg = `💌 Kamu Telah Menerima Pesan Rahasia Dari *${fromWho}*:\n\n"${pesan}"`;
                await sock.sendMessage(id, { text: confessMsg });
                await sock.sendMessage(sender, { text: "✅ Pesan rahasia berhasil dikirim!" });
            } else if (message.startsWith(".confesstts ")) {
                const args = message.split(" ");
                if (args.length < 4) {
                    await sock.sendMessage(sender, { text: "⚠️ Format salah! Gunakan: .confesstts [pesan] [no tujuan] [pengirim]" });
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
                await killAudio()
                
            }
        } catch (error) {
            console.error("❌ Gagal mengirim pesan:", error);
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

start();

async function saveAudio(url, filePath) {
    const response = await globalThis.fetch(url);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
    console.log(`✅ Audio berhasil disimpan di ${filePath}`);
}
async function killAudio(filePath) {
    fs.unlinkSync(filePath)
}

