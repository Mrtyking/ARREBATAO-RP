const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const { clientConfig } = require('../config/config');

// Deduplicación en memoria para evitar boosts duplicados en un intervalo corto
const recentBoosts = new Set();

/**
 * Envía el mensaje y embed de bienvenida cuando un usuario entra al servidor
 * @param {import('discord.js').GuildMember} member
 */
async function sendWelcomeNotification(member) {
    try {
        if (!member || !member.guild) return;

        const channelId = clientConfig.welcomeChannelId;
        const channel = member.guild.channels.cache.get(channelId) ||
            await member.guild.channels.fetch(channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            console.warn(`[WELCOME] Canal de llegadas/bienvenida no disponible: ${channelId}`);
            return;
        }

        const welcomeEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('Tu historia comienza en este instante.')
            .setDescription(`<@${member.id}>\nEsperamos que disfrutes de tu estadía y crees momentos increíbles.`);

        const files = [];
        if (fs.existsSync(clientConfig.welcomeImagePath)) {
            files.push(new AttachmentBuilder(clientConfig.welcomeImagePath, { name: 'welcome.png' }));
            welcomeEmbed.setImage('attachment://welcome.png');
        }

        await channel.send({
            content: `<@${member.id}>`,
            embeds: [welcomeEmbed],
            files,
        });

        console.log(`[WELCOME] Mensaje de bienvenida enviado para ${member.user.tag} (${member.id}) en #${channel.name}`);
    } catch (error) {
        console.error('[WELCOME] Error al enviar mensaje de bienvenida:', error);
    }
}

/**
 * Envía el mensaje y embed de agradecimiento cuando un usuario impulsa (boostea) el servidor
 * @param {import('discord.js').GuildMember} member
 */
async function sendBoostNotification(member) {
    try {
        if (!member || !member.guild) return;

        // Evitar spam de alertas duplicadas en 60 segundos
        if (recentBoosts.has(member.id)) return;
        recentBoosts.add(member.id);
        setTimeout(() => recentBoosts.delete(member.id), 60000);

        const channelId = clientConfig.boostChannelId;
        const channel = member.guild.channels.cache.get(channelId) ||
            await member.guild.channels.fetch(channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            console.warn(`[BOOST] Canal de boosters no disponible: ${channelId}`);
            return;
        }

        const boostEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('¡NUEVO BOOST EN EL SERVIDOR!')
            .setDescription(
                `<@${member.id}>\n` +
                '¡Muchísimas gracias por impulsar a **ARREBATAO RP**!\n' +
                'Tu apoyo ayuda a que nuestra comunidad siga creciendo y alcanzando el mejor nivel.'
            );

        const files = [];
        if (fs.existsSync(clientConfig.boostImagePath)) {
            files.push(new AttachmentBuilder(clientConfig.boostImagePath, { name: 'boost.png' }));
            boostEmbed.setImage('attachment://boost.png');
        }

        await channel.send({
            content: `<@${member.id}>`,
            embeds: [boostEmbed],
            files,
        });

        console.log(`[BOOST] Alerta de boost enviada para ${member.user.tag} (${member.id}) en #${channel.name}`);
    } catch (error) {
        console.error('[BOOST] Error al enviar mensaje de boost:', error);
    }
}

module.exports = {
    sendWelcomeNotification,
    sendBoostNotification,
};
