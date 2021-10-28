const path = require("path");
const WhatsApp = require("./app/WhatsApp");

const bot = new WhatsApp(path.join(__dirname, "manage", "session.json"))

bot.listenMessage(receive => {
    console.log({ receive });
    const {
        reply,
        // api
        resep,
        alquran,
        //
        message,
    } = receive;

    // API Activation
    resep();
    alquran();

    if ([
        "assalamu",
        "asalamu",
    ].some(v => String(message).toLowerCase().startsWith(v))) {
        reply("Wa'alaikumsalam...")
    } else if (String(message).toLowerCase() === "p") {
        reply("iso ngucap salam ra cok??...")
    }
})