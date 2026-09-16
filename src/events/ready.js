const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,

    execute(client) {
        console.log(`[BOT] Conectado exitosamente como ${client.user.tag}`);
        console.log(`[BOT] Listo para servir en ${client.guilds.cache.size} servidor(es)`);

        client.guilds.cache.forEach(guild => {
            console.log(`[GUILD] Conectado a: ${guild.name} (ID: ${guild.id})`);
        });

        // Configuración de presencia del bot rotando entre los dos enlaces
        const statusList = [
            'https://nexoauth2.com/',
            'https://discord.gg/nexoauth2',
        ];
        let statusIndex = 0;

        const updatePresence = () => {
            const current = statusList[statusIndex];
            client.user.setPresence({
                activities: [
                    {
                        name: current,
                        type: ActivityType.Custom,
                        state: current,
                    },
                ],
                status: 'online',
            });
            statusIndex = (statusIndex + 1) % statusList.length;
        };

        updatePresence();
        setInterval(updatePresence, 15000);
    },
};
