const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    AttachmentBuilder,
    ChannelType,
    MessageFlags,
} = require('discord.js');
const fs = require('fs');
const { clientConfig } = require('../config/config');
const { createTicketContainer } = require('../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-panel')
        .setDescription('Publica el panel oficial de tickets v2 de ARREBATAO RP.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option
                .setName('canal')
                .setDescription('Canal donde se publicará el panel (por defecto este canal)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const targetChannel = interaction.options.getChannel('canal') || interaction.channel;

            // Verificar permisos del bot en el canal de destino
            const botPermissions = targetChannel.permissionsFor(interaction.guild.members.me);
            if (!botPermissions || !botPermissions.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
            ])) {
                return interaction.editReply({
                    content: `No tengo permisos suficientes para enviar mensajes o adjuntar archivos en ${targetChannel}.`,
                });
            }

            // Preparar attachment del banner y contenedor Components V2
            const files = [];
            if (fs.existsSync(clientConfig.bannerPath)) {
                const attachment = new AttachmentBuilder(clientConfig.bannerPath, { name: 'banner.jpg' });
                files.push(attachment);
            }

            const container = createTicketContainer();

            await targetChannel.send({
                files: files,
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });

            await interaction.editReply({
                content: `Panel de tickets v2 desplegado con éxito en ${targetChannel}.`,
            });
        } catch (error) {
            console.error('Error al ejecutar /ticket-panel:', error);
            const errorMessage = `Ocurrió un error al intentar publicar el panel: ${error.message}`;
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: errorMessage,
                });
            } else {
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true,
                });
            }
        }
    },
};
