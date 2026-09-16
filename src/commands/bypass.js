const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');
const { clientConfig, categories } = require('../config/config');
const { isStaffMember } = require('../handlers/ticketControlHandler');
const { getTicketState, addTicketBypass } = require('../utils/ticketState');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bypass')
        .setDescription('Permite a un miembro del Staff responder en un ticket reclamado o no reclamado.'),

    async execute(interaction) {
        try {
            const channel = interaction.channel;

            // Verificar si es un canal de ticket
            const allPrefixes = Object.values(categories).map(c => c.ticketPrefix.toLowerCase());
            const isTicketChannel = (channel.topic && channel.topic.includes('Ticket:')) ||
                allPrefixes.some(p => channel.name.toLowerCase().startsWith(`${p}-`));

            if (!isTicketChannel) {
                return interaction.reply({
                    content: 'Este comando solo puede ser utilizado dentro de un canal de ticket.',
                    ephemeral: true,
                });
            }

            // Verificar si el usuario es staff o admin
            if (!isStaffMember(interaction.member, channel)) {
                return interaction.reply({
                    content: 'Solo los miembros del equipo de Staff autorizados pueden usar el comando de bypass.',
                    ephemeral: true,
                });
            }

            const state = getTicketState(channel);

            // Si es el staff que lo tiene reclamado
            if (state.claimedBy === interaction.user.id) {
                return interaction.reply({
                    content: 'Ya eres el staff encargado de este ticket, no necesitas activar el bypass.',
                    ephemeral: true,
                });
            }

            // Si ya tiene bypass activo
            if (state.bypassed.has(interaction.user.id)) {
                return interaction.reply({
                    content: 'Ya posees el bypass activo en este ticket.',
                    ephemeral: true,
                });
            }

            // Activar bypass y permisos
            await addTicketBypass(channel, interaction.user.id);

            // Embed público en el canal notificando la autorización de bypass
            const bypassEmbed = new EmbedBuilder()
                .setColor(clientConfig.embedColor)
                .setTitle('Bypass de Staff Activado')
                .setDescription(
                    `El miembro del Staff <@${interaction.user.id}> ha activado el **bypass** en este ticket.\n` +
                    'Ahora tiene autorización para responder e intervenir en este caso.'
                )
                .addFields(
                    { name: 'Staff con Bypass', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
                    { name: 'Hora', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: clientConfig.footerText })
                .setTimestamp();

            await channel.send({ embeds: [bypassEmbed] });

            await interaction.reply({
                content: 'Has activado el bypass con éxito. Ya puedes responder en este ticket.',
                ephemeral: true,
            });
        } catch (error) {
            console.error('Error al ejecutar /bypass:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `Ocurrió un error al activar el bypass: ${error.message}`,
                    ephemeral: true,
                });
            }
        }
    },
};
