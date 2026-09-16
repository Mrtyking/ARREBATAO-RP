const { Events } = require('discord.js');
const {
    handleTicketOpenTrigger,
    handleTicketModalSubmit,
} = require('../handlers/ticketModalHandler');
const {
    handleCloseTicket,
    handleCloseTicketSubmit,
    handleClaimTicket,
    handleNotifyStaff,
    handleNotifyUser,
    handleAddUserModalOpen,
    handleAddUserSubmit,
    handleGenerateTranscript,
} = require('../handlers/ticketControlHandler');

module.exports = {
    name: Events.InteractionCreate,
    once: false,

    async execute(interaction) {
        try {
            // 1. Enrutador de Comandos Slash (ChatInputCommand)
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    console.warn(`Comando no encontrado: ${interaction.commandName}`);
                    return;
                }

                await command.execute(interaction);
                return;
            }

            // 2. Enrutador de Botones (ButtonInteraction)
            if (interaction.isButton()) {
                const { customId } = interaction;

                // Botones rápidos de apertura de tickets
                if (customId.startsWith('ticket_btn_open_')) {
                    const categoryId = customId.replace('ticket_btn_open_', '');
                    await handleTicketOpenTrigger(interaction, categoryId);
                    return;
                }

                // Botones de control del ticket
                switch (customId) {
                    case 'ticket_control_close':
                        await handleCloseTicket(interaction);
                        return;
                    case 'ticket_control_claim':
                        await handleClaimTicket(interaction);
                        return;
                    case 'ticket_control_notify':
                        await handleNotifyStaff(interaction);
                        return;
                    case 'ticket_control_adduser':
                        await handleAddUserModalOpen(interaction);
                        return;
                    case 'ticket_control_transcript':
                        await handleGenerateTranscript(interaction);
                        return;
                    default:
                        break;
                }
                return;
            }

            // 3. Enrutador de Menús de Selección (SelectMenu)
            if (interaction.isAnySelectMenu()) {
                if (interaction.customId === 'ticket_select_category') {
                    const selectedCategory = interaction.values[0];
                    await handleTicketOpenTrigger(interaction, selectedCategory);
                    return;
                }
                return;
            }

            // 4. Enrutador de Formularios Modales (ModalSubmitInteraction)
            if (interaction.isModalSubmit()) {
                const { customId } = interaction;

                if (customId.startsWith('ticket_modal_')) {
                    await handleTicketModalSubmit(interaction);
                    return;
                }

                if (customId === 'modal_close_ticket_reason') {
                    await handleCloseTicketSubmit(interaction);
                    return;
                }

                if (customId === 'modal_add_user') {
                    await handleAddUserSubmit(interaction);
                    return;
                }
            }
        } catch (error) {
            console.error('Error no capturado en interactionCreate:', error);

            const errorMessage = 'Ocurrió un error inesperado al procesar esta acción.';
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
            }
        }
    },
};
