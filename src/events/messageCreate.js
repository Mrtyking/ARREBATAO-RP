const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { categories, clientConfig } = require('../config/config');
const { getTicketState } = require('../utils/ticketState');
const { getTicketCreatorId } = require('../handlers/ticketControlHandler');

module.exports = {
    name: Events.MessageCreate,
    once: false,

    async execute(message) {
        try {
            // Ignorar mensajes de bots o fuera de servidores
            if (message.author.bot || !message.guild || !message.channel.isTextBased()) {
                return;
            }

            // Responder "𝐀𝐑𝐑𝐄𝐁𝐀𝐓𝐀𝐎 𝐑𝐏 𝐎𝐍 𝐓𝐎𝐏 @user" al poner un "." en cualquier canal
            if (message.content.trim() === '.') {
                await message.reply({
                    content: `𝐀𝐑𝐑𝐄𝐁𝐀𝐓𝐀𝐎 𝐑𝐏 𝐎𝐍 𝐓𝐎𝐏 <@${message.author.id}>`,
                    allowedMentions: { users: [message.author.id] },
                }).catch(() => {});
                return;
            }

            const channel = message.channel;

            // Verificar si el canal corresponde a un ticket
            const allPrefixes = Object.values(categories).map(c => c.ticketPrefix.toLowerCase());
            const isTicketChannel = (channel.topic && channel.topic.includes('Ticket:')) ||
                allPrefixes.some(p => channel.name.toLowerCase().startsWith(`${p}-`));

            if (!isTicketChannel) {
                return;
            }

            const state = getTicketState(channel);
            const creatorId = state.creatorId || getTicketCreatorId(channel);

            // 1. El usuario creador del ticket SIEMPRE puede hablar
            if (creatorId && message.author.id === creatorId) {
                return;
            }

            // 2. Si el ticket NO está reclamado:
            if (!state.claimed) {
                // Si el staff no tiene bypass activo, no puede hablar
                if (!state.bypassed.has(message.author.id)) {
                    await message.delete().catch(() => {});

                    const warnEmbed = new EmbedBuilder()
                        .setColor(clientConfig.embedColor)
                        .setTitle('Ticket No Reclamado')
                        .setDescription('Para responder en este canal debes presionar el botón **Reclamar Ticket** primero.')
                        .setFooter({ text: 'Este aviso se eliminará automáticamente en 5 segundos.' });

                    const warnMsg = await channel.send({
                        content: `<@${message.author.id}>`,
                        embeds: [warnEmbed],
                    }).catch(() => {});

                    if (warnMsg) {
                        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                    }
                    return;
                }
            }

            // 3. Si el ticket YA está reclamado:
            if (state.claimed) {
                // Puede hablar quien lo reclamó o quien tenga bypass activo
                const isClaimer = state.claimedBy === message.author.id;
                const hasBypass = state.bypassed.has(message.author.id);

                if (!isClaimer && !hasBypass) {
                    await message.delete().catch(() => {});

                    const claimerMention = state.claimedBy ? `<@${state.claimedBy}>` : 'otro miembro del Staff';
                    const warnEmbed = new EmbedBuilder()
                        .setColor(clientConfig.embedColor)
                        .setTitle('Ticket Asignado')
                        .setDescription(`Este caso está siendo atendido por ${claimerMention}. Solo el staff encargado tiene permitido responder.`)
                        .setFooter({ text: 'Este aviso se eliminará automáticamente en 5 segundos.' });

                    const warnMsg = await channel.send({
                        content: `<@${message.author.id}>`,
                        embeds: [warnEmbed],
                    }).catch(() => {});

                    if (warnMsg) {
                        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                    }
                    return;
                }
            }
        } catch (error) {
            console.error('Error en messageCreate de ticket:', error);
        }
    },
};
