const fs = require("fs");

const {
    WAConnection,
    MessageType,
    Presence,
    MessageOptions,
    Mimetype,
    WALocationMessage,
    WA_MESSAGE_STUB_TYPES,
    ReconnectMode,
    ProxyAgent,
    waChatKey,
} = require("@adiwajshing/baileys");

// parsing data
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// https://zeks.me/
const zeks_api = "TupPKcsJUQGURt4XerDQp9EScVz"; // apivinz

class WhatsApp {
    /**
     * 
     * @param {string} SESSION_DATA menyimpan session 
     * @param {{debug:boolean, bot_name:string, prefix:string, autoReconnect:string}} option 
     */
    constructor(SESSION_DATA, option = {}) {
        // connecting
        const conn = new WAConnection();
        if (option.autoReconnect) {
            /**
             * onAllErrors
             * onConnectionLost // only automatically reconnect when the connection breaks
             */
            conn.autoReconnect = ReconnectMode[option.autoReconnect]; // specific
        } else {
            conn.autoReconnect = ReconnectMode.onAllErrors; // default
        }
        conn.connectOptions.maxRetries = 100000; // mampuz
        if (option.debug) {
            conn.logger.level = "debug";
            conn.chatOrderingKey = waChatKey(true); // order chats such that pinned chats are on top
        }
        if (fs.existsSync(SESSION_DATA)) {
            conn.loadAuthInfo(SESSION_DATA);
        }
        conn.on('open', async () => {
            await fs.writeFileSync(SESSION_DATA, JSON.stringify(conn.base64EncodedAuthInfo(), null, '\t')); // nyimpen sesi baru
        });
        conn.on('close', async ({ reason, isReconnecting }) => {
            if (option.debug) {
                console.log('oh no got disconnected: ' + reason + ', reconnecting: ' + isReconnecting);
            }
            if (reason === "invalid_session") {
                this.logout(async () => {
                    await conn.connect(); // reconnect
                })
            } else {
                if (option.reconnect) {
                    await conn.connect(); // reconnect
                }
            }
        })
        conn.connect(); // connect after declaration
        //
        this.conn = conn;

        this.SESSION_DATA = SESSION_DATA;

        // option management
        this.debug = option.debug ? option.debug : false;
        this.bot_name = option.bot_name ? option.bot_name : "*FROM BOT*";
        this.prefix = option.prefix ? option.prefix : "!";
        this.owner = option.owner ? option.owner : ["6285161392501"];
    }
    /**
     * 
     * @param {callback} onSuccess ketika selesai logout
     */
    logout(onSuccess) {
        this.#deleteSession(() => {
            this.conn.clearAuthInfo()
            setTimeout(() => {
                try {
                    this.sendMessage(this.conn.user.jid, "logout....")
                    onSuccess();
                } catch (error) {
                    onSuccess();
                }
            }, 1000);
        })
    }
    reconnect() {
        this.conn.connect(); // reconnect
    }
    // ================== hidden ==================
    async #deleteSession(onSuccess) {
        await fs.unlink(this.SESSION_DATA, (err) => {
            if (err) {
                console.error(err);
                return;
            } else {
                console.log("Session file deleted!");
                onSuccess();
            }
        });
    }


    // =============================== TEMPLATE ===============================
    templateFormat(title, text_array) {
        const text_inject = text_array.join("");
        return `┌─「 _*${title}*_ 」\n│\n${text_inject}│\n└─「 >> _*${this.bot_name}*_ << 」`;
    }
    templateItemNormal(text, before_enter = false) {
        const value_enter = before_enter ? "\n" : "";
        return `${value_enter}${text}${value_enter}\n`;
    }
    templateItemEnter() {
        return `\n`;
    }
    templateItemVariable(key, value, enter = false) {
        const value_enter = enter ? "\n" : "";
        let inject = "";
        if (this.isArray(value)) {
            inject += value
                .map((v) => {
                    return v;
                })
                .join("\n");
        } else {
            if (this.isObject(value)) {
                inject += Object.values(value)
                    .map((v) => {
                        return v;
                    })
                    .join("\n");
            } else {
                inject += value;
            }
        }
        return `├ ${key} : ${value_enter + value_enter}${inject}\n${value_enter}`;
    }
    templateItemTitle(title, array = false) {
        const length = String(title).length;
        const alinyemen = 10 - length;
        const kanan_kiri = "=".repeat(alinyemen + length / 2);
        let print = `${kanan_kiri} ${title} ${kanan_kiri}\n`;
        if (array && this.isArray(array)) {
            print += array
                .map((v) => {
                    return "- " + v + "\n";
                })
                .join("\n");
            print += "\n\n";
        }
        return print;
    }
    templateItemCommand(title, cmd, note = false) {
        const point_right = emoji.find("point_right").emoji;
        let inject = "";
        if (note) {
            inject += "\n";
            if (this.isArray(note)) {
                inject += note
                    .map((v) => {
                        return v + "\n";
                    })
                    .join("");
            } else {
                if (this.isObject(note)) {
                    inject += Object.keys(note)
                        .map((key) => {
                            return key + " : " + note[key] + "\n";
                        })
                        .join("");
                } else {
                    inject += note;
                }
            }
        }
        const inject_cmd = String(cmd).length > 0 ? `\n${point_right} ${cmd}\n` : "";
        return `├ ${title} :${inject_cmd} ${inject}\n`;
    }
    templateItemList(key, array, enter = false) {
        if (this.isArray(array)) {
            const value_enter = enter ? "\n" : "";
            const inject = array
                .map((v) => {
                    return "- " + v;
                })
                .join("");
            return `├ ${key} : \n${value_enter}${inject}${value_enter}\n`;
        }
    }
    templateItemNext(text = "") {
        return `│ ${text}\n`;
    }

    // ================ Function ================
    isArray(value) {
        return typeof value === "object" && Array.isArray(value) && value !== null;
    }
    isObject(value) {
        return typeof value === "object" && !Array.isArray(value) && value !== null;
    }
    formatter(number, standard = "@c.us") {
        let formatted = number;
        // const standard = '@c.us'; // @s.whatsapp.net / @c.us
        if (!String(formatted).endsWith("@g.us")) {
            // isGroup ? next
            // 1. Menghilangkan karakter selain angka
            formatted = number.replace(/\D/g, "");
            // 2. Menghilangkan angka 62 di depan (prefix)
            //    Kemudian diganti dengan 0
            if (formatted.startsWith("0")) {
                formatted = "62" + formatted.substr(1);
            }
            // 3. Tambahkan standar pengiriman whatsapp
            if (!String(formatted).endsWith(standard)) {
                formatted += standard;
            }
        }
        return formatted;
    }
    fetchJson = async (url, post = false) => new Promise(async (resolve, reject) => {
        const request = await fetch(url, {
            headers: { "User-Agent": "okhttp/4.5.0" },
            method: post ? "POST" : "GET",
        })
        console.log({ request });
        if ([
            200,
        ].some(v => request.status === v)) {
            const data = await request.json();
            data._status = request.status;
            resolve(data);
        } else {
            resolve({
                _status: request.status,
                message: request.statusText,
            })
        }
    })

    // ================ listener ================
    listenMessage(receive) {
        this.conn.on("chat-update", async (ct) => {
            let chat = ct;
            if (chat.presences) {
                // receive presence updates -- composing, available, etc.
                Object.values(chat.presences).forEach((presence) =>
                    console.log(
                        `${presence.name}'s presence is ${presence.lastKnownPresence} in ${chat.jid}`
                    )
                );
            }

            if (!chat.hasNewMessage) return;
            if (chat.key && chat.key.remoteJid === "status@broadcast") return; // negate status
            chat = JSON.parse(JSON.stringify(chat)).messages[0];
            if (!chat.message) return;
            if (chat.key.fromMe) return;

            // Lolos ...

            // ============ Meta Utama ============
            const from = chat.key.remoteJid;
            const isGroup = from.endsWith("@g.us");
            const content = JSON.stringify(chat.message);
            const type = Object.keys(chat.message)[0];
            const isMedia = type === MessageType.image || type === MessageType.video;
            const isQuotedImage = type === MessageType.extendedText && content.includes(MessageType.image);
            const isQuotedVideo = type === MessageType.extendedText && content.includes(MessageType.video);
            const isQuotedSticker = type === MessageType.extendedText && content.includes(MessageType.sticker);

            // ====================================================================
            const message_prefix = type === MessageType.text && chat.message.conversation.startsWith(this.prefix) ?
                chat.message.conversation : type === MessageType.image && chat.message.imageMessage.caption !== undefined && chat.message.imageMessage.caption.startsWith(this.prefix) ?
                    chat.message.imageMessage.caption : type === MessageType.video && chat.message.videoMessage.caption !== undefined && chat.message.videoMessage.caption.startsWith(this.prefix) ?
                        chat.message.videoMessage.caption : type === MessageType.extendedText && chat.message.extendedTextMessage.text.startsWith(this.prefix) ?
                            chat.message.extendedTextMessage.text : type === "buttonsResponseMessage" ?
                                chat.message.buttonsResponseMessage.selectedDisplayText : type === "listResponseMessage" ?
                                    chat.message.listResponseMessage.title : null
            // ====================================================================
            let message = type === MessageType.text ?
                chat.message.conversation : type === MessageType.extendedText ?
                    chat.message.extendedTextMessage.text : type === MessageType.contact ?
                        chat.message.contactMessage : type === "listResponseMessage" ?
                            chat.message.listResponseMessage.title : ""
            message = String(message).startsWith(this.prefix) ? null : message;
            // console.log({ message_prefix, message, type, pointer: chat.message });

            // ====================================================================
            let link = type === MessageType.text && chat.message.conversation ? chat.message.conversation :
                type === MessageType.image && chat.message.imageMessage.caption ? chat.message.imageMessage.caption :
                    type === MessageType.video && chat.message.videoMessage.caption ? chat.message.videoMessage.caption :
                        type === MessageType.extendedText && chat.message.extendedTextMessage.text ? chat.message.extendedTextMessage.text : "";
            const messagesLink = link.slice(0)
                .trim()
                .split(/ +/)
                .shift()
                .toLowerCase();
            // ====================================================================
            const command = String(message_prefix !== null ? message_prefix.slice(0).trim().split(/ +/).shift().toLowerCase() : "").toLowerCase();
            const args = message && typeof message !== "object"
                ? message.trim().split(/ +/).slice(1)
                : message_prefix !== null ? message_prefix.trim().split(/ +/).slice(1) : null;
            const far = args !== null ? args.join(" ") : null;
            const isCmd = message && typeof message !== "object"
                ? message.startsWith(this.prefix)
                : message_prefix !== null ? message_prefix.startsWith(this.prefix) : false;

            const ownerNumber = this.owner.map(nomor => {
                return this.formatter(nomor, "@s.whatsapp.net");
            });

            const user_id = isGroup ? chat.participant : chat.key.remoteJid;
            const botNumber = this.conn.user.jid;

            const totalchat = await this.conn.chats.all();
            const pushname = this.conn.contacts[user_id] != undefined ?
                this.conn.contacts[user_id].vname || this.conn.contacts[user_id].notify : undefined;

            // group meta
            const groupMetadata = isGroup ? await this.conn.groupMetadata(from) : null;
            const groupName = isGroup ? groupMetadata.subject : null;
            const groupId = isGroup ? groupMetadata.id : null;
            const groupMembers = isGroup ? groupMetadata.participants : null;
            const groupDesc = isGroup ? groupMetadata.desc : null;
            const groupAdmins = isGroup ? this.getGroupAdmins(groupMembers).map(v => {
                return v.jid;
            }) : [];
            const isBotGroupAdmins = groupAdmins.includes(botNumber) || false
            const isGroupAdmins = groupAdmins.includes(user_id) || false

            // ===============================================================================================

            receive({
                reply: async (message) => {
                    this.conn.sendMessage(from, message, MessageType.extendedText, { quoted: chat })
                },
                // ================================= API FUNCTION =================================
                resep: async () => {
                    if (command === this.prefix + "resep") {
                        const result = await this.fetchJson(`https://masak-apa.tomorisakura.vercel.app/api/search?q=${far}`)
                        if (result._status) {
                            const masak = []
                            for (let i = 0; i < result.results.length; i++) {
                                const msk = result.results[i];
                                masak.push(this.templateItemList(`> Resep #${i + 1}`, [
                                    this.templateItemNormal("Title : " + msk.title),
                                    this.templateItemNormal("Durasi Masak Sekitar : " + msk.times),
                                    this.templateItemNormal("Porsi : " + msk.serving),
                                    this.templateItemNormal("Tingkat Kesulitan : " + msk.difficulty),
                                    this.templateItemNormal("Link : " + `https://www.masakapahariini.com/resep/${msk.key}`),
                                ]));
                                if (i === 14) break;
                            }
                            await this.conn.sendMessage(from, this.templateFormat("RESEP MASAK", [
                                this.templateItemVariable(`Request`, pushname),
                                this.templateItemEnter(),
                                ...masak,
                            ]), MessageType.text, { quoted: chat, detectLinks: false })
                        } else {
                            await fungsi.reply(result.message);
                        }
                    }
                },
                alquran: async () => {
                    if (command === this.prefix + "alquran") {
                        const alquran = await this.fetchJson(`https://api.zeks.me/api/quran?no=${args[0]}&apikey=${zeks_api}`);
                        if (alquran._status === 200) {
                            await this.conn.sendMessage(from, this.templateFormat("AL-QURAN", [
                                this.templateItemVariable(`Request`, pushname),
                                this.templateItemEnter(),
                                this.templateItemNormal("Surah : " + alquran.surah),
                                this.templateItemNormal("Diturunkan : " + alquran.type),
                                this.templateItemNormal("Jumlah Ayat : " + alquran.jumlah_ayat),
                                this.templateItemNormal("MP3 : " + alquran.audio),
                                this.templateItemEnter(),
                                this.templateItemNormal("Keterangan : \n" + String(alquran.ket).replace(/<br\s*[\/]?>/gi, "\n")),
                            ]), MessageType.text, { quoted: chat, detectLinks: false })
                                .then(async () => {
                                    console.log("DONE...");
                                })
                                .catch((error) => {
                                    console.log("Error... : ", { error });
                                })
                        } else {
                            await fungsi.reply(alquran.message)
                        }
                    }
                },
                // ============= Message Management =============
                chat,
                isGroup,
                from,
                user_id,
                botNumber,
                totalchat,
                pushname,
                message_prefix,
                message,
                content,
                type,
                isMedia,
                isQuotedImage,
                isQuotedVideo,
                isQuotedSticker,
                //
                link,
                messagesLink,
                command,
                args,
                far,
                isCmd,
                ownerNumber,
                // grup
                groupMetadata,
                groupName,
                groupId,
                groupMembers,
                groupDesc,
                groupAdmins,
                isBotGroupAdmins,
                isGroupAdmins,
            })
        });
    }
}

module.exports = WhatsApp;