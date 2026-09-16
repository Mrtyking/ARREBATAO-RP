const { Events } = require('discord.js');
const { sendBoostNotification } = require('../utils/welcomeBoost');

module.exports = {
    name: Events.GuildMemberUpdate,
    once: false,

    async execute(oldMember, newMember) {
        try {
            // Verificar si el usuario comenzó a boostear el servidor
            const wasBoosting = Boolean(oldMember.premiumSince);
            const isBoosting = Boolean(newMember.premiumSince);

            // También verificar si se le añadió el rol de Nitro Booster
            const hadBoosterRole = oldMember.roles.premiumSubscriberRole ? oldMember.roles.cache.has(oldMember.roles.premiumSubscriberRole.id) : false;
            const hasBoosterRole = newMember.roles.premiumSubscriberRole ? newMember.roles.cache.has(newMember.roles.premiumSubscriberRole.id) : false;

            const startedBoosting = (!wasBoosting && isBoosting) || (!hadBoosterRole && hasBoosterRole);

            if (startedBoosting) {
                await sendBoostNotification(newMember);
            }
        } catch (error) {
            console.error('[EVENTO BOOST] Error al detectar boost en guildMemberUpdate:', error);
        }
    },
};
