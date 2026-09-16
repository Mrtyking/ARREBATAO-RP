const { Events, PermissionFlagsBits } = require('discord.js');
const { categories } = require('../config/config');
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

                    const warnMsg = await channel.send({
                        content: `<@${message.author.id}>, no puedes responder en este ticket porque **aún no ha sido reclamado**. Por favor presiona el botón **Reclamar Ticket** primero (o utiliza \`/bypass\`).`,
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
                    const warnMsg = await channel.send({
                        content: `<@${message.author.id}>, este ticket está reclamado por ${claimerMention}. Solo el staff encargado puede responder, a menos que uses el comando \`/bypass\`.`,
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
