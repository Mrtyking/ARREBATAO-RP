const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendWelcomeNotification } = require('../utils/welcomeBoost');
const { clientConfig } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-welcome')
        .setDescription('Simula y envía el mensaje de bienvenida oficial con embed e imagen')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario para simular la bienvenida (opcional)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('usuario') || interaction.user;
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => interaction.member);

            await sendWelcomeNotification(targetMember);

            await interaction.editReply({
                content: `Mensaje de bienvenida simulado exitosamente en <#${clientConfig.welcomeChannelId}> para <@${targetMember.id}>.`,
            });
        } catch (error) {
            console.error('Error al ejecutar /test-welcome:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: `Error al probar bienvenida: ${error.message}`,
                });
            } else {
                await interaction.reply({
                    content: `Error al probar bienvenida: ${error.message}`,
                    ephemeral: true,
                });
            }
        }
    },
};
