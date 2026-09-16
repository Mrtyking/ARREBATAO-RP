const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildCreate,
    execute(guild) {
        console.log(`[BOT JOINED] El bot ha sido añadido al servidor: ${guild.name} (ID: ${guild.id})`);
    },
};
