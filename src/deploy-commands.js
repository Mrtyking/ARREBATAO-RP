require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { clientConfig } = require('./config/config');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`[DEPLOY] Comando cargado: /${command.data.name}`);
        } else {
            console.warn(`[DEPLOY] El archivo en ${filePath} no tiene las propiedades 'data' o 'execute'.`);
        }
    }
}

const rest = new REST({ version: '10' }).setToken(clientConfig.token);

(async () => {
    try {
        if (!clientConfig.token || !clientConfig.clientId) {
            console.warn('[DEPLOY AVISO] DISCORD_TOKEN o CLIENT_ID no están definidos en el entorno (.env). Configúralos antes de desplegar.');
            return;
        }

        console.log(`[DEPLOY] Iniciando actualización de ${commands.length} comando(s) slash (/)`);

        let data;
        if (clientConfig.guildId) {
            // Limpiar comandos globales para evitar duplicados en la lista de comandos
            await rest.put(Routes.applicationCommands(clientConfig.clientId), { body: [] });
            
            // Despliegue específico para el servidor de desarrollo / producción de ARREBATAO RP (instantáneo)
            data = await rest.put(
                Routes.applicationGuildCommands(clientConfig.clientId, clientConfig.guildId),
                { body: commands }
            );
            console.log(`[DEPLOY] ¡Éxito! Se registraron ${data.length} comando(s) en la guild ${clientConfig.guildId} (y se limpiaron globales).`);
        } else {
            // Despliegue global
            data = await rest.put(
                Routes.applicationCommands(clientConfig.clientId),
                { body: commands }
            );
            console.log(`[DEPLOY] ¡Éxito! Se registraron ${data.length} comando(s) de manera global.`);
        }
    } catch (error) {
        console.error('[DEPLOY ERROR] Ocurrió un error al desplegar los comandos:', error);
    }
})();
