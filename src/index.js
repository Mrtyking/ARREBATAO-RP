require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
} = require('discord.js');
const { clientConfig } = require('./config/config');

// Inicialización del cliente con los intents y partials requeridos
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
    ],
});

// Colección para almacenar comandos slash
client.commands = new Collection();

// 1. Cargador automático de comandos
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`[LOADER] Comando cargado: /${command.data.name}`);
        } else {
            console.warn(`[LOADER] El archivo ${filePath} carece de propiedad 'data' o 'execute'.`);
        }
    }
}

// 2. Cargador automático de eventos
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`[LOADER] Evento cargado: ${event.name}`);
    }
}

// 3. Manejo de excepciones no controladas para estabilidad
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ANTI-CRASH] Rechazo no controlado detectado:', reason);
});

process.on('uncaughtException', (error, origin) => {
    console.error('[ANTI-CRASH] Excepción no controlada detectada:', error);
});

// 4. Iniciar sesión en Discord
if (!clientConfig.token) {
    console.error('[AUTH ERROR] Token no encontrado en las variables de entorno (.env). Por favor configúralo.');
} else {
    client.login(clientConfig.token).catch(err => {
        console.error('[AUTH ERROR] Error al iniciar sesión en Discord:', err.message);
    });
}

module.exports = client;
