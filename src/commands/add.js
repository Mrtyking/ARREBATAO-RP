const { SlashCommandBuilder } = require('discord.js');
const { addTicketBypass } = require('../utils/ticketState');
const { categories } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Añade un usuario al ticket actual mediante su ID o mención')
        .addStringOption(option =>
            option
                .setName('usuario')
                .setDescription('ID de Discord o mención del usuario a añadir')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const channel = interaction.channel;

            // Verificar si estamos en un canal de ticket
            const allPrefixes = Object.values(categories).map(c => c.ticketPrefix.toLowerCase());
            const isTicketChannel = (channel.topic && channel.topic.includes('Ticket:')) ||
                allPrefixes.some(p => channel.name.toLowerCase().startsWith(`${p}-`));

            if (!isTicketChannel) {
                return interaction.reply({
                    content: 'Este comando solo puede ejecutarse dentro de un canal de ticket.',
                    ephemeral: true,
                });
            }

            const rawInput = interaction.options.getString('usuario')?.trim() || '';
            const targetId = rawInput.replace(/\D/g, ''); // Extrae los dígitos numéricos de la ID

            if (!targetId || targetId.length < 17 || targetId.length > 20) {
                return interaction.reply({
                    content: 'Debes proporcionar una ID numérica válida de Discord o mencionar al usuario.',
                    ephemeral: true,
                });
            }

            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetId);
            } catch {
                targetMember = null;
            }

            if (!targetMember) {
                return interaction.reply({
                    content: `No se encontró ningún miembro con la ID \`${targetId}\` en este servidor.`,
                    ephemeral: true,
                });
            }

            // Añadir permisos y bypass para el usuario en el ticket
            await addTicketBypass(channel, targetMember.id);

            // Confirmación privada
            await interaction.reply({
                content: `El usuario <@${targetMember.id}> (${targetMember.user.tag}) ha sido añadido exitosamente a este ticket.`,
                ephemeral: true,
            });

            // Mensaje informativo temporal en el canal
            const notice = await channel.send({
                content: `<@${targetMember.id}>, has sido añadido a este ticket por <@${interaction.user.id}>.`,
            }).catch(() => {});

            if (notice) {
                setTimeout(() => notice.delete().catch(() => {}), 15000);
            }
        } catch (error) {
            console.error('Error en comando /add:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `Ocurrió un error al añadir al usuario: ${error.message}`,
                    ephemeral: true,
                });
            }
        }
    },
};
