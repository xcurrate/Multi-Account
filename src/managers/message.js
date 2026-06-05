const CONSTANTS = require('../constants');
const log = require('../../logger');

const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');





module.exports = (state, configManager, bossManager, captchaHandler, loopManager, channelManager, telegramService, macrodroidService, huntbotManager, commandSender) => ({
    async handle(msg) {
        if (!state.client?.isReady()) return;

        await this.handleControlCommands(msg);

        // ✅ FITUR BARU: Deteksi SEMUA pesan dari admin/orang lain di channel aktif
        await this.handleUserMessages(msg);

        if (CONSTANTS.OWO_IDS.includes(msg.author.id)) {
            await this.handleOwOMessage(msg);
        }

        if (msg.channel.type === 'DM' && CONSTANTS.OWO_IDS.includes(msg.author.id)) {
            if ((msg.content || '').toLowerCase().includes('verified')) {
                captchaHandler.resume();
                return;
            }
        }
    },
/*
    async handleControlCommands(msg) {
        const { startCmd, pauseCmd, allowIds } = configManager.getControlCommands();
        const text = msg.content.trim().toLowerCase();

        const isController = (state.client.user && msg.author.id === state.client.user.id) ||
                            allowIds.includes(msg.author.id);

        if (!isController) return;

        if (text === startCmd) {
            state.activeChannelId = msg.channel.id;
            state.config.botStatus.paused = false;
            state.config.botStatus.running = true;
            configManager.save();
            log.success(`▶️ Start via Discord control.`);
            loopManager.startAll();
            telegramService.send(`▶️ <b>Bot Started</b> via Discord command`);
            return;
        }

        if (text === pauseCmd) {
            state.config.botStatus.paused = true;
            state.config.botStatus.running = false;
            configManager.save();
            log.warn('⏸️ Pause via Discord control.');
            loopManager.stopAll();
            telegramService.send(`⏸️ <b>Bot Paused</b> via Discord command`);
            return;
        }
    },
*/
    async handleControlCommands(msg) {
        const { startCmd, pauseCmd, allowIds } = configManager.getControlCommands();
        const text = msg.content.trim().toLowerCase();

        // Keamanan: Hanya eksekusi jika pengirim adalah akun bot itu sendiri atau ID yang diizinkan
        const isController = (state.client.user && msg.author.id === state.client.user.id) ||
                            allowIds.includes(msg.author.id);

        if (!isController) return;

        if (text === startCmd) {
            state.activeChannelId = msg.channel.id;
            state.config.botStatus.paused = false;
            state.config.botStatus.running = true;
            configManager.save();
            log.success(`▶️ Start via Discord control.`);
            loopManager.startAll();
            telegramService.send(`▶️ <b>Bot Started</b> via Discord command`);
            return;
        }

        if (text === pauseCmd) {
            state.config.botStatus.paused = true;
            state.config.botStatus.running = false;
            configManager.save();
            log.warn('⏸️ Pause via Discord control.');
            loopManager.stopAll();
            telegramService.send(`⏸️ <b>Bot Paused</b> via Discord command`);
            return;
        }

        // --- 🔊 FITUR BARU: JOIN VC ---
        if (text.startsWith("vjoin ")) {
            const args = text.split(" ");
            const channelId = args[1];

            if (channelId) {
                try {
                    // Gunakan state.client sesuai arsitektur kodemu
                    const voiceChannel = state.client.channels.cache.get(channelId);

                    if (!voiceChannel || voiceChannel.type !== 'GUILD_VOICE') {
                        log.error("❌ Voice Channel tidak ditemukan atau ID salah!");
                        msg.react("❌").catch(()=>{});
                        return;
                    }

                    joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                        selfDeaf: true,
                        selfMute: true
                    });

                    log.success(`🔊 Berhasil nongkrong di VC: ${voiceChannel.name}`);
                    msg.react("✅").catch(()=>{});

                } catch (err) {
                    log.error("Gagal join VC: " + err.message);
                    msg.react("⚠️").catch(()=>{});
                }
            }
            return;
        }

        // --- 🔇 FITUR BARU: LEAVE VC ---
        if (text === "vleave") {
            try {
                // Pastikan bot keluar dari VC yang ada di server tempat pesan ini dikirim
                if (!msg.guildId) return; 

                const connection = getVoiceConnection(msg.guildId);
                
                if (connection) {
                    connection.destroy();
                    log.info(`🔇 Keluar dari VC di server ${msg.guild?.name || msg.guildId}`);
                    msg.react("👋").catch(()=>{});
                } else {
                    msg.react("❓").catch(()=>{}); // Reaksi jika bot tidak ada di VC manapun di server itu
                }
            } catch (err) {
                log.error("Gagal leave VC: " + err.message);
            }
            return;
        }
    },

    
    // ✅ FITUR BARU: Fungsi pengawas CCTV (Semua pesan dari user lain)
async handleUserMessages(msg) {
    const myId = state.client?.user?.id;
    
    // CCTV tidak aktif ATAU tidak ada myId
    if (state.config.safety.cctv === false || !myId) return;
    

        // Abaikan pesan dari bot kita sendiri dan pesan dari OwO Bot
     //   if (msg.author.id === myId || CONSTANTS.OWO_IDS.includes(msg.author.id)) return;
        if (msg.author.id === myId || msg.author.bot) return;

        // Pastikan hanya memantau channel yang sedang aktif (atau channel di config)
        const isActiveChannel = (state.activeChannelId && msg.channel.id === state.activeChannelId) || 
                                (state.config.channels && state.config.channels.includes(msg.channel.id));
        
        if (!isActiveChannel) return;

        // Cek apakah pesan ini ngetag atau nge-reply kita (untuk info tambahan di Telegram)
        const isMentioned = msg.mentions?.users?.has(myId) || msg.content.includes(myId);
        const isReplyToMe = msg.type === 'REPLY' && msg.mentions?.repliedUser?.id === myId;

        // Tentukan jenis alert
        let alertType = "PESAN BARU";
        if (isMentioned) alertType = "MENTION / TAG";
        if (isReplyToMe) alertType = "REPLY MESSAGE";

        log.warn(`💬 ${alertType} terdeteksi dari ${msg.author.username}! Meneruskan ke Telegram...`);
        
        // Siapkan data untuk dikirim
        const senderName = msg.author.username;
        const channelName = msg.channel.name || 'DM/Unknown';
        const content = msg.content || '[Hanya Attachment / Kosong]';
        const serverId = msg.guild ? msg.guild.id : '@me';
        
        // Buat Link langsung (Direct Link) ke pesan tersebut di Discord
        const messageUrl = `https://discord.com/channels/${serverId}/${msg.channel.id}/${msg.id}`;

        // Format Pesan Telegram (menggunakan HTML)
        const tgMessage = `👀 <b>${alertType} DETECTED!</b>\n` +
                          `👤 <b>Dari:</b> ${senderName}\n` +
                          `🏠 <b>Channel:</b> #${channelName}\n` +
                          `📝 <b>Pesan:</b> <i>${content}</i>\n\n` +
                          `🔗 <a href="${messageUrl}">Klik untuk melihat pesan</a>`;

        // Kirim ke Telegram tanpa syarat apa pun selama dia di channel aktif!
        telegramService.send(tgMessage);
                    if (macrodroidService) {
                // Ini akan menembak URL: /685a5670-47a3-4293-a08d-4a2ddce2007c/kena_captcha
                await macrodroidService.trigger("pesanbaru"); 
            }
    },

    async handleOwOMessage(msg) {
        // Cek apakah ini respons untuk kita (bukan untuk orang lain)
        const isForMe = this._isResponseForMe(msg);
        
        // Hanya clear timeout jika respons memang untuk kita
        if (state.responseTimeout && isForMe) {
            commandSender.clearResponseTimeout();
        }
        
        if (captchaHandler.isCaptcha(msg.content)) {
            const myId = state.client?.user?.id;
            const isMentioned = myId ? (msg.mentions?.users?.has(myId) || msg.content.includes(myId)) : false;

            if (isMentioned) {
                captchaHandler.handle(msg);
                return;
            }
        }

        await bossManager.handle(msg);

if (msg.channel.id === state.config.tiketandhb.channelId) {
    bossManager.processTicketMessage(msg);
}

        
        // HuntBot Messages
        if (huntbotManager && typeof huntbotManager.processHuntBotMessage === 'function') {
            huntbotManager.processHuntBotMessage(msg);
        }
    },

    // Helper: Cek apakah respons OwO untuk user kita
    _isResponseForMe(msg) {
        try {
            // Dapatkan nama kita
            const myName = (msg.guild?.members?.me?.displayName || state.client.user.username).toLowerCase();
            
            // OwO biasanya kirim embed untuk battle/hunt
            if (msg.embeds && msg.embeds.length > 0) {
                const embed = msg.embeds[0];
                const authorName = (embed.author?.name || "").toLowerCase();
                const description = (embed.description || "").toLowerCase();
                
                // Format battle: "Username goes into battle"
                if (authorName.includes(myName) && authorName.includes("goes into battle")) {
                    return true;
                }
                
                // Format hunt: cek author atau description mengandung nama kita
                if (authorName.includes(myName) || description.includes(`**${myName}**`)) {
                    return true;
                }
                
                // Cek footer atau fields
                const footerText = (embed.footer?.text || "").toLowerCase();
                const fieldsText = embed.fields?.map(f => `${f.name} ${f.value}`.toLowerCase()).join(" ") || "";
                
                if (footerText.includes(myName) || fieldsText.includes(myName)) {
                    return true;
                }
            }
            
            // Cek plain text message (untuk respons sederhana)
            const content = (msg.content || "").toLowerCase();
            if (content.includes(myName)) {
                return true;
            }
            
            return false;
        } catch (err) {
            // Kalau error, anggap saja bukan untuk kita (safety)
            return false;
        }
    }
});
