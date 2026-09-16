const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    AttachmentBuilder,
    MessageFlags,
    EmbedBuilder,
} = require('discord.js');
const fs = require('fs');
const { clientConfig } = require('../config/config');

// Deduplicación en memoria para evitar alertas duplicadas de boost en un intervalo corto
const recentBoosts = new Set();

/**
 * Construye el Contenedor Components V2 para bienvenida
 * @param {import('discord.js').GuildMember} member
 * @returns {ContainerBuilder}
 */
function createWelcomeContainer(member) {
    const container = new ContainerBuilder()
        .setAccentColor(0x990000)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## Tu historia comienza en este instante.\n' +
                `<@${member.id}> Esperamos que disfrutes de tu estadía y crees momentos increíbles.`
            )
        );

    if (fs.existsSync(clientConfig.welcomeImagePath)) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://welcome.png')
            )
        );
    }

    return container;
}

/**
 * Construye el Contenedor Components V2 para Nitro Boost
 * @param {import('discord.js').GuildMember} member
 * @returns {ContainerBuilder}
 */
function createBoostContainer(member) {
    const container = new ContainerBuilder()
        .setAccentColor(0x990000)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## ¡Nuevo Impulso en el Servidor!\n' +
                `<@${member.id}> ¡Muchísimas gracias por impulsar a **ARREBATAO RP**!\n` +
                'Tu apoyo ayuda a que nuestra comunidad siga creciendo y alcanzando el mejor nivel.'
            )
        );

    if (fs.existsSync(clientConfig.boostImagePath)) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://boost.png')
            )
        );
    }

    return container;
}

/**
 * Envía el mensaje oficial de bienvenida utilizando Discord Components V2
 * @param {import('discord.js').GuildMember} member
 */
async function sendWelcomeNotification(member) {
    try {
        if (!member || !member.guild) return;

        const channelId = clientConfig.welcomeChannelId;
        const channel = member.guild.channels.cache.get(channelId) ||
            await member.guild.channels.fetch(channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            console.warn(`[WELCOME V2] Canal de llegadas no disponible: ${channelId}`);
            return;
        }

        const files = [];
        if (fs.existsSync(clientConfig.welcomeImagePath)) {
            files.push(new AttachmentBuilder(clientConfig.welcomeImagePath, { name: 'welcome.png' }));
        }

        const container = createWelcomeContainer(member);

        try {
            // Envío con Discord Components V2 (content no está permitido en la raíz con IsComponentsV2)
            await channel.send({
                files,
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (v2Error) {
            console.error('[WELCOME V2] Error al enviar con Components V2, aplicando fallback:', v2Error);
            const fallbackEmbed = new EmbedBuilder()
                .setColor(clientConfig.embedColor)
                .setTitle('Tu historia comienza en este instante.')
                .setDescription(`<@${member.id}> Esperamos que disfrutes de tu estadía y crees momentos increíbles.`);

            if (files.length > 0) {
                fallbackEmbed.setImage('attachment://welcome.png');
            }

            await channel.send({
                content: `<@${member.id}>`,
                embeds: [fallbackEmbed],
                files,
            });
        }

        console.log(`[WELCOME V2] Bienvenida enviada para ${member.user?.tag || member.id} en #${channel.name}`);
    } catch (error) {
        console.error('[WELCOME V2] Error general al enviar bienvenida:', error);
    }
}

/**
 * Envía la notificación de Nitro Boost utilizando Discord Components V2
 * @param {import('discord.js').GuildMember} member
 */
async function sendBoostNotification(member) {
    try {
        if (!member || !member.guild) return;

        // Evitar duplicados si Discord envía doble evento
        if (recentBoosts.has(member.id)) return;
        recentBoosts.add(member.id);
        setTimeout(() => recentBoosts.delete(member.id), 60000);

        const channelId = clientConfig.boostChannelId;
        const channel = member.guild.channels.cache.get(channelId) ||
            await member.guild.channels.fetch(channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            console.warn(`[BOOST V2] Canal de boosters no disponible: ${channelId}`);
            return;
        }

        const files = [];
        if (fs.existsSync(clientConfig.boostImagePath)) {
            files.push(new AttachmentBuilder(clientConfig.boostImagePath, { name: 'boost.png' }));
        }

        const container = createBoostContainer(member);

        try {
            // Envío con Discord Components V2 (content no está permitido en la raíz con IsComponentsV2)
            await channel.send({
                files,
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (v2Error) {
            console.error('[BOOST V2] Error al enviar con Components V2, aplicando fallback:', v2Error);
            const fallbackEmbed = new EmbedBuilder()
                .setColor(clientConfig.embedColor)
                .setTitle('¡NUEVO BOOST EN EL SERVIDOR!')
                .setDescription(
                    `<@${member.id}>\n` +
                    '¡Muchísimas gracias por impulsar a **ARREBATAO RP**!\n' +
                    'Tu apoyo ayuda a que nuestra comunidad siga creciendo y alcanzando el mejor nivel.'
                );

            if (files.length > 0) {
                fallbackEmbed.setImage('attachment://boost.png');
            }

            await channel.send({
                content: `<@${member.id}>`,
                embeds: [fallbackEmbed],
                files,
            });
        }

        console.log(`[BOOST V2] Notificación de boost enviada para ${member.user?.tag || member.id} en #${channel.name}`);
    } catch (error) {
        console.error('[BOOST V2] Error general al enviar boost:', error);
    }
}

module.exports = {
    sendWelcomeNotification,
    sendBoostNotification,
    createWelcomeContainer,
    createBoostContainer,
};
