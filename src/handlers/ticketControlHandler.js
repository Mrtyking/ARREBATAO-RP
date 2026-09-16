const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
    OverwriteType,
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const { clientConfig, categories } = require('../config/config');
const {
    setTicketClaimed,
    getTicketState,
    addTicketBypass,
    setTicketCloseInitiator,
} = require('../utils/ticketState');

// Set en memoria para canales en proceso de cierre (evita ejecuciones dobles)
const closingTickets = new Set();

/**
 * Determina si un miembro tiene rol de staff o permisos de Administrador
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').GuildChannel} channel
 * @returns {boolean}
 */
function isStaffMember(member, channel) {
    if (!member) return false;

    // Administradores siempre tienen acceso
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    // Recopilar todos los roles de staff configurados en todas las categorías
    const allStaffRoles = new Set();
    for (const cat of Object.values(categories)) {
        if (Array.isArray(cat.staffRoles)) {
            for (const r of cat.staffRoles) {
                allStaffRoles.add(r);
            }
        }
    }

    // Verificar si el usuario posee alguno de los roles de staff
    if (member.roles?.cache) {
        for (const roleId of allStaffRoles) {
            if (member.roles.cache.has(roleId)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Extrae el ID del usuario creador del ticket a partir del topic del canal o sus sobreescrituras
 * @param {import('discord.js').GuildChannel} channel
 * @returns {string|null}
 */
function getTicketCreatorId(channel) {
    if (!channel) return null;

    // 1. Intentar obtenerlo desde el topic del canal
    if (channel.topic) {
        const match = channel.topic.match(/\((\d{17,20})\)/);
        if (match && match[1]) {
            return match[1];
        }
    }

    // 2. Buscar en sobreescrituras de permisos individuales (no rol, no bot)
    const botId = channel.guild.members.me?.id || channel.client.user.id;
    for (const [id, overwrite] of channel.permissionOverwrites.cache) {
        if (overwrite.type === OverwriteType.Member && id !== botId) {
            return id;
        }
    }

    return null;
}

/**
 * Inicia el proceso de cierre del ticket enviando un embed al canal con botones del 1 al 5 y botón de cancelar
 * para que el creador califique el servicio antes de cerrar.
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleCloseTicket(interaction) {
    try {
        const channel = interaction.channel;

        // Solo los miembros del Staff pueden cerrar tickets
        if (!isStaffMember(interaction.member, channel)) {
            return interaction.reply({
                content: 'Solo los miembros del equipo de Staff tienen autorización para cerrar este ticket.',
                ephemeral: true,
            });
        }

        if (closingTickets.has(channel.id)) {
            return interaction.reply({
                content: 'El ticket ya se encuentra en proceso de cierre.',
                ephemeral: true,
            });
        }

        const state = getTicketState(channel);
        if (state.closeRequested) {
            return interaction.reply({
                content: 'Ya se envió una solicitud de calificación a este canal. Si el usuario no responde, puedes presionar **Cerrar sin Calificar**.',
                ephemeral: true,
            });
        }

        const creatorId = state.creatorId || getTicketCreatorId(channel);
        setTicketCloseInitiator(channel, interaction.user.id);
        state.closeRequested = true;

        const rateEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('VALORACIÓN DEL SERVICIO')
            .setDescription(
                (creatorId ? `Hola <@${creatorId}>, nuestro equipo ha completado la atención de tu ticket.\n\n` : 'El equipo ha completado la atención de este ticket.\n\n') +
                'Por favor, califica la atención recibida seleccionando una opción del **1 al 5** a continuación.\n' +
                '*Al calificar, el ticket se archivará y cerrará automáticamente.*\n\n' +
                '*Si el usuario no está disponible o el staff desea cerrar de inmediato, presiona **Cerrar sin Calificar**.*'
            )
            .setFooter({ text: clientConfig.footerText });

        const starRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_rate_val_1').setLabel('1').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_rate_val_2').setLabel('2').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_rate_val_3').setLabel('3').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_rate_val_4').setLabel('4').setEmoji('⭐').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_rate_val_5').setLabel('5').setEmoji('⭐').setStyle(ButtonStyle.Success),
        );

        const cancelRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_rate_cancel').setLabel('Cerrar sin Calificar').setStyle(ButtonStyle.Danger),
        );

        await channel.send({
            content: creatorId ? `<@${creatorId}>` : undefined,
            embeds: [rateEmbed],
            components: [starRow, cancelRow],
        });

        await interaction.reply({
            content: 'Solicitud de valoración enviada al ticket.',
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error al iniciar cierre y calificación:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al preparar el cierre: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

/**
 * Maneja cuando el creador pulsa un botón de calificación (1 a 5)
 * Despliega un modal para que pueda dejar un comentario opcional sobre el servicio
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleRateButton(interaction) {
    try {
        const channel = interaction.channel;
        if (closingTickets.has(channel.id)) {
            return interaction.reply({
                content: 'El ticket ya se encuentra en proceso de cierre.',
                ephemeral: true,
            });
        }

        const state = getTicketState(channel);
        const creatorId = state.creatorId || getTicketCreatorId(channel);

        // Solo el creador puede calificar
        if (creatorId && interaction.user.id !== creatorId) {
            return interaction.reply({
                content: `Solo el usuario creador del ticket (<@${creatorId}>) puede calificar el servicio.`,
                ephemeral: true,
            });
        }

        const rating = parseInt(interaction.customId.replace('ticket_rate_val_', ''), 10) || 5;

        const modal = new ModalBuilder()
            .setCustomId(`modal_ticket_feedback_${rating}`)
            .setTitle(`Valoración (${rating}/5 Estrellas)`);

        const commentInput = new TextInputBuilder()
            .setCustomId('feedback_comment')
            .setLabel('Comentario u opinión (Opcional)')
            .setPlaceholder('Escribe tu opinión sobre el servicio recibido...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error al abrir modal de calificación:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al procesar la calificación: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

/**
 * Procesa el envío del modal de valoración:
 * Envía el embed formateado a # ✨・Valoraciones (1530125044603424868)
 * y cierra automáticamente el ticket generando transcripción y eliminando el canal.
 *
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleFeedbackModalSubmit(interaction) {
    try {
        const channel = interaction.channel;
        if (closingTickets.has(channel.id)) {
            return interaction.reply({
                content: 'El ticket ya se encuentra en proceso de cierre.',
                ephemeral: true,
            });
        }
        closingTickets.add(channel.id);

        const state = getTicketState(channel);
        const creatorId = state.creatorId || getTicketCreatorId(channel) || interaction.user.id;
        const rating = parseInt(interaction.customId.replace('modal_ticket_feedback_', ''), 10) || 5;
        const comment = interaction.fields.getTextInputValue('feedback_comment')?.trim() || 'Sin comentario adicional';

        await interaction.reply({
            content: '¡Muchas gracias por tu valoración! El ticket se está procesando para su cierre...',
            ephemeral: true,
        });

        await channel.send({
            content: `**Valoración registrada (${rating}/5 estrellas).** El canal se archivará y cerrará en 5 segundos...`,
        }).catch(() => {});

        // Enviar embed de valoración al canal configurado (1530125044603424868)
        try {
            const feedbackChannelId = clientConfig.feedbackChannelId;
            if (feedbackChannelId) {
                const feedbackChannel = interaction.guild.channels.cache.get(feedbackChannelId) ||
                    await interaction.guild.channels.fetch(feedbackChannelId).catch(() => null);

                if (feedbackChannel && feedbackChannel.isTextBased()) {
                    const starsString = '⭐'.repeat(rating);
                    const staffId = state.claimedBy || state.closeInitiatedBy;

                    const dateStr = new Intl.DateTimeFormat('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                    }).format(new Date());

                    const feedbackEmbed = new EmbedBuilder()
                        .setColor(clientConfig.embedColor)
                        .setTitle('NUEVA VALORACIÓN RECIBIDA')
                        .setDescription(`El usuario <@${interaction.user.id}> ha dejado su opinión sobre el servicio.`)
                        .addFields(
                            { name: 'Usuario', value: `<@${interaction.user.id}> ( \`${interaction.user.id}\` )`, inline: false },
                            { name: 'Calificación', value: `${rating} / 5 Estrellas ( ${starsString} )`, inline: false },
                            { name: 'Comentario', value: `*"${comment}"*`, inline: false }
                        );

                    if (staffId) {
                        feedbackEmbed.addFields({
                            name: 'Atendido por',
                            value: `<@${staffId}> ( \`${staffId}\` )`,
                            inline: false,
                        });
                    }

                    feedbackEmbed.setFooter({ text: `© ARREBATAO RP - Review enviada el ${dateStr}` });

                    await feedbackChannel.send({ embeds: [feedbackEmbed] }).catch(err => {
                        console.error('Error al enviar embed a canal de valoraciones:', err);
                    });
                }
            }
        } catch (fbErr) {
            console.error('Error al enviar valoración:', fbErr);
        }

        // Ejecutar cierre definitivo
        await executeTicketClosure(channel, interaction.user, `Ticket calificado (${rating}/5): ${comment}`, interaction.client, creatorId);
    } catch (error) {
        console.error('Error al procesar modal de valoración:', error);
        closingTickets.delete(interaction.channel.id);
    }
}

/**
 * Maneja cuando el staff (o el creador) cancela la espera de calificación y cierra directamente
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleRateCancel(interaction) {
    try {
        const channel = interaction.channel;
        if (closingTickets.has(channel.id)) {
            return interaction.reply({
                content: 'El ticket ya se encuentra en proceso de cierre.',
                ephemeral: true,
            });
        }

        const state = getTicketState(channel);
        const creatorId = state.creatorId || getTicketCreatorId(channel);
        const isStaff = isStaffMember(interaction.member, channel);
        const isCreator = creatorId && interaction.user.id === creatorId;

        if (!isStaff && !isCreator) {
            return interaction.reply({
                content: 'Solo los miembros del equipo de Staff o el creador del ticket pueden ejecutar esta acción.',
                ephemeral: true,
            });
        }

        closingTickets.add(channel.id);

        await interaction.reply({
            content: 'Cierre sin valoración confirmado. Archivando y eliminando ticket...',
            ephemeral: true,
        });

        await channel.send({
            content: '**Cierre sin valoración.** El ticket se archivará y eliminará en 5 segundos...',
        }).catch(() => {});

        await executeTicketClosure(channel, interaction.user, 'Ticket cerrado sin valoración', interaction.client, creatorId);
    } catch (error) {
        console.error('Error al cancelar valoración y cerrar ticket:', error);
        closingTickets.delete(interaction.channel.id);
    }
}

/**
 * Ejecuta el cierre definitivo de un canal de ticket:
 * Genera transcripción HTML, envía copias a logs y MD del creador, y elimina el canal
 *
 * @param {import('discord.js').GuildChannel} channel
 * @param {import('discord.js').User} closedByUser
 * @param {string} reason
 * @param {import('discord.js').Client} client
 * @param {string|null} creatorId
 */
async function executeTicketClosure(channel, closedByUser, reason, client, creatorId = null) {
    if (!channel) return;
    if (!creatorId) creatorId = getTicketCreatorId(channel);

    // 1. Generar transcripción HTML completa
    let transcriptAttachment = null;
    try {
        transcriptAttachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            returnType: 'attachment',
            fileName: `transcript-${channel.name}.html`,
            minify: true,
            saveImages: true,
            poweredBy: false,
        });
    } catch (transcriptError) {
        console.error('Error al generar transcripción HTML:', transcriptError);
    }

    // 2. Enviar al canal de logs si está configurado
    if (clientConfig.logsChannelId && transcriptAttachment) {
        try {
            const logsChannel = channel.guild.channels.cache.get(clientConfig.logsChannelId) ||
                await channel.guild.channels.fetch(clientConfig.logsChannelId).catch(() => null);

            if (logsChannel && logsChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor(clientConfig.embedColor)
                    .setTitle('Ticket Cerrado - Transcripción Archivada')
                    .addFields(
                        { name: 'Canal / Ticket', value: `\`${channel.name}\``, inline: true },
                        { name: 'Cerrado por', value: `<@${closedByUser.id}> (\`${closedByUser.id}\`)`, inline: true },
                        { name: 'Creador', value: creatorId ? `<@${creatorId}> (\`${creatorId}\`)` : '*Desconocido*', inline: true },
                        { name: 'Motivo / Estado', value: reason, inline: false },
                        { name: 'Fecha y Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: clientConfig.footerText })
                    .setTimestamp();

                await logsChannel.send({
                    embeds: [logEmbed],
                    files: [transcriptAttachment],
                }).catch(err => console.error('Error al enviar log de cierre:', err));
            }
        } catch (logErr) {
            console.error('Error al procesar logs de cierre:', logErr);
        }
    }

    // 3. Intentar enviar transcripción por mensaje directo (DM) al usuario creador
    if (creatorId && transcriptAttachment) {
        try {
            const creatorUser = await client.users.fetch(creatorId).catch(() => null);
            if (creatorUser) {
                const dmEmbed = new EmbedBuilder()
                    .setColor(clientConfig.embedColor)
                    .setTitle('Tu ticket en ARREBATAO RP ha sido cerrado')
                    .setDescription(
                        `Hola <@${creatorId}>, tu ticket **#${channel.name}** ha finalizado.\n\n` +
                        `• **Cerrado por:** ${closedByUser.tag || closedByUser.username}\n` +
                        `• **Motivo / Estado:** ${reason}\n\n` +
                        'Adjunto a este mensaje encontrarás la **transcripción completa en formato HTML** con todos los mensajes y archivos compartidos.'
                    )
                    .setFooter({ text: clientConfig.footerText })
                    .setTimestamp();

                await creatorUser.send({
                    embeds: [dmEmbed],
                    files: [transcriptAttachment],
                }).catch(() => {});
            }
        } catch (dmErr) {
            console.log(`No se pudo enviar MD al creador (${creatorId}): ${dmErr.message}`);
        }
    }

    // 4. Cuenta regresiva y eliminación segura del canal tras 5 segundos
    setTimeout(async () => {
        try {
            if (channel.deletable) {
                await channel.delete(`Ticket cerrado por ${closedByUser.tag || closedByUser.username}: ${reason}`);
            }
        } catch (delErr) {
            console.error('Error al eliminar canal de ticket:', delErr);
        } finally {
            closingTickets.delete(channel.id);
        }
    }, 5000);
}

/**
 * Fallback para modal de cierre manual si se utiliza
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleCloseTicketSubmit(interaction) {
    try {
        if (!isStaffMember(interaction.member, interaction.channel)) {
            return interaction.reply({
                content: 'Solo los miembros del equipo de Staff tienen autorización para cerrar este ticket.',
                ephemeral: true,
            });
        }

        const reason = interaction.fields.getTextInputValue('close_reason')?.trim() || 'Sin motivo especificado';
        await interaction.reply({
            content: '**Procesando cierre de ticket...** Generando transcripción y archivando.\n*El canal se eliminará en unos segundos.*',
            ephemeral: true,
        });

        await executeTicketClosure(interaction.channel, interaction.user, reason, interaction.client);
    } catch (error) {
        console.error('Error en handleCloseTicketSubmit:', error);
    }
}

/**
 * Maneja el botón de reclamar ticket
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleClaimTicket(interaction) {
    try {
        // Verificar que quien reclama sea Staff o Admin
        if (!isStaffMember(interaction.member, interaction.channel)) {
            return interaction.reply({
                content: 'Solo los miembros del equipo de Staff autorizados pueden reclamar tickets.',
                ephemeral: true,
            });
        }

        // Verificar si el ticket ya fue reclamado en los componentes del mensaje
        const message = interaction.message;
        let isAlreadyClaimed = false;

        const updatedComponents = message.components.map(topComp => {
            const raw = topComp.toJSON();
            if (raw.type === 17 && Array.isArray(raw.components)) {
                raw.components = raw.components.map(child => {
                    if (child.type === 1 && Array.isArray(child.components)) {
                        child.components = child.components.map(btn => {
                            if (btn.custom_id === 'ticket_control_claim') {
                                if (btn.disabled) isAlreadyClaimed = true;
                                return {
                                    ...btn,
                                    label: `Reclamado por ${interaction.user.username}`,
                                    style: ButtonStyle.Secondary,
                                    disabled: true,
                                };
                            }
                            return btn;
                        });
                    }
                    return child;
                });
            } else if (raw.type === 1 && Array.isArray(raw.components)) {
                raw.components = raw.components.map(btn => {
                    if (btn.custom_id === 'ticket_control_claim') {
                        if (btn.disabled) isAlreadyClaimed = true;
                        return {
                            ...btn,
                            label: `Reclamado por ${interaction.user.username}`,
                            style: ButtonStyle.Secondary,
                            disabled: true,
                        };
                    }
                    return btn;
                });
            }
            return raw;
        });

        if (isAlreadyClaimed) {
            return interaction.reply({
                content: 'Este ticket ya ha sido reclamado previamente por un miembro del Staff.',
                ephemeral: true,
            });
        }

        // Actualizar los botones del mensaje original
        await message.edit({ components: updatedComponents });

        // Registrar reclamo y otorgar permisos de escritura al staff
        await setTicketClaimed(interaction.channel, interaction.user.id);

        // Confirmar únicamente en privado al Staff que lo reclamó
        await interaction.reply({
            content: 'Has reclamado este ticket con éxito. Ahora tienes permisos exclusivos para responder.',
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error al reclamar ticket:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al reclamar el ticket: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

// Control de notificaciones independiente por cada canal de ticket:
// - Máximo 3 notificaciones en total durante todo el ciclo del ticket
// - Cooldown de 30 minutos estrictos entre cada notificación
// - Al llegar a 3, el botón se deshabilita permanentemente
const ticketNotifyState = new Map();
const NOTIFY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos entre alertas
const MAX_NOTIFICATIONS_PER_TICKET = 3;

/**
 * Obtiene el estado de notificaciones exclusivo de este canal de ticket
 * @param {import('discord.js').GuildChannel} channel
 * @returns {{ count: number, lastNotifiedAt: number }}
 */
function getChannelNotifyState(channel) {
    if (ticketNotifyState.has(channel.id)) {
        return ticketNotifyState.get(channel.id);
    }
    let count = 0;
    let lastNotifiedAt = 0;
    if (channel.topic) {
        const cMatch = channel.topic.match(/Alertas:\s*(\d+)/);
        if (cMatch) count = parseInt(cMatch[1], 10) || 0;
        const tMatch = channel.topic.match(/UltimaAlerta:\s*(\d+)/);
        if (tMatch) lastNotifiedAt = parseInt(tMatch[1], 10) || 0;
    }
    const state = { count, lastNotifiedAt };
    ticketNotifyState.set(channel.id, state);
    return state;
}

/**
 * Actualiza y persiste el estado de alertas de este canal de ticket
 * @param {import('discord.js').GuildChannel} channel
 * @param {number} count
 * @param {number} lastNotifiedAt
 */
function updateChannelNotifyState(channel, count, lastNotifiedAt) {
    const state = { count, lastNotifiedAt };
    ticketNotifyState.set(channel.id, state);

    try {
        let topic = channel.topic || '';
        if (topic.includes('Alertas:')) {
            topic = topic.replace(/Alertas:\s*\d+/, `Alertas: ${count}`);
        } else {
            topic = `${topic} | Alertas: ${count}`;
        }
        if (topic.includes('UltimaAlerta:')) {
            topic = topic.replace(/UltimaAlerta:\s*\d+/, `UltimaAlerta: ${lastNotifiedAt}`);
        } else {
            topic = `${topic} | UltimaAlerta: ${lastNotifiedAt}`;
        }
        channel.setTopic(topic).catch(() => {});
    } catch {}
}

/**
 * Modifica el botón de Notificar Staff en el mensaje original del ticket
 * @param {import('discord.js').Message} message
 * @param {number} count
 * @param {boolean} disabled
 */
function updateNotifyButtonInMessage(message, count, disabled) {
    return message.components.map(topComp => {
        const raw = topComp.toJSON();
        const updateBtn = (btn) => {
            if (btn.custom_id === 'ticket_control_notify') {
                return {
                    ...btn,
                    label: disabled ? 'Notificaciones Agotadas (3/3)' : `Notificar Staff (${count}/3)`,
                    style: disabled ? ButtonStyle.Secondary : btn.style,
                    disabled: disabled,
                };
            }
            return btn;
        };

        if (raw.type === 17 && Array.isArray(raw.components)) {
            raw.components = raw.components.map(child => {
                if (child.type === 1 && Array.isArray(child.components)) {
                    child.components = child.components.map(updateBtn);
                }
                return child;
            });
        } else if (raw.type === 1 && Array.isArray(raw.components)) {
            raw.components = raw.components.map(updateBtn);
        }
        return raw;
    });
}

/**
 * Maneja el botón de notificar al Staff cuando un usuario requiere atención
 * Envía una alerta con embed y ping de rol al canal de alertas del staff (1530125195694706769)
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleNotifyStaff(interaction) {
    try {
        const channel = interaction.channel;
        const now = Date.now();
        const notifyState = getChannelNotifyState(channel);

        // 1. Si ya se alcanzó el límite absoluto de 3 alertas para este ticket:
        if (notifyState.count >= MAX_NOTIFICATIONS_PER_TICKET) {
            // Deshabilitar botón visualmente si aún no lo estaba
            try {
                const updatedComponents = updateNotifyButtonInMessage(interaction.message, 3, true);
                await interaction.message.edit({ components: updatedComponents }).catch(() => {});
            } catch {}

            return interaction.reply({
                content: 'Se ha alcanzado el límite máximo de 3 notificaciones para este ticket. El botón ha sido deshabilitado.',
                ephemeral: true,
            });
        }

        // 2. Comprobar que hayan pasado 30 minutos desde la última notificación enviada
        if (notifyState.lastNotifiedAt > 0 && (now - notifyState.lastNotifiedAt) < NOTIFY_INTERVAL_MS) {
            const remainingMinutes = Math.ceil((NOTIFY_INTERVAL_MS - (now - notifyState.lastNotifiedAt)) / 60000);
            return interaction.reply({
                content: `Debes esperar ${remainingMinutes} minuto(s) antes de volver a notificar al Staff (solo se permite 1 notificación cada media hora).`,
                ephemeral: true,
            });
        }

        // 3. Obtener la categoría del ticket desde el topic del canal
        let categoryName = 'General';
        let staffMentions = '';
        if (channel.topic) {
            const match = channel.topic.match(/Categoría:\s*([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                const categoryConfig = categories[match[1]];
                if (categoryConfig) {
                    categoryName = categoryConfig.name;
                    if (Array.isArray(categoryConfig.staffRoles) && categoryConfig.staffRoles.length > 0) {
                        staffMentions = categoryConfig.staffRoles.map(roleId => `<@&${roleId}>`).join(' ');
                    }
                }
            }
        }

        // 4. Obtener el canal de alertas del Staff (1530125195694706769)
        const staffChannelId = clientConfig.staffAlertsChannelId || '1530125195694706769';
        const staffChannel = interaction.guild.channels.cache.get(staffChannelId);

        if (!staffChannel || !staffChannel.isTextBased()) {
            return interaction.reply({
                content: 'El canal de alertas del Staff no está disponible o no se encuentra configurado.',
                ephemeral: true,
            });
        }

        const newCount = notifyState.count + 1;
        const isMaxReached = newCount >= MAX_NOTIFICATIONS_PER_TICKET;

        // Embed para el canal de alertas del Staff
        const alertEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle(`Atención Staff Solicitada (Alerta ${newCount}/3)`)
            .setDescription(`El usuario <@${interaction.user.id}> está esperando atención en su ticket.`)
            .addFields(
                { name: 'Ticket', value: `<#${channel.id}> (\`${channel.name}\`)`, inline: true },
                { name: 'Solicitante', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
                { name: 'Categoría', value: categoryName, inline: true },
                { name: 'Alerta', value: `${newCount} de ${MAX_NOTIFICATIONS_PER_TICKET}`, inline: true },
                { name: 'Hora', value: `<t:${Math.floor(now / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: clientConfig.footerText })
            .setTimestamp();

        // Botón de enlace directo para que el Staff vaya al canal del ticket con un clic
        const jumpRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ir al Ticket')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${channel.id}`)
        );

        // Enviar la alerta al canal del staff con mención a los roles encargados
        await staffChannel.send({
            content: staffMentions ? staffMentions : undefined,
            embeds: [alertEmbed],
            components: [jumpRow],
        });

        // Registrar timestamp y contador actualizados para este canal específico
        updateChannelNotifyState(channel, newCount, now);

        // Actualizar el botón en el mensaje del ticket (si llega a 3, se deshabilita)
        try {
            const updatedComponents = updateNotifyButtonInMessage(interaction.message, newCount, isMaxReached);
            await interaction.message.edit({ components: updatedComponents }).catch(() => {});
        } catch {}

        // Confirmar de forma 100% privada (efímera) al usuario
        if (isMaxReached) {
            await interaction.reply({
                content: `Se ha notificado al equipo de Staff en el canal de guardia. Has utilizado tus 3 notificaciones permitidas para este ticket (3/3). El botón ha quedado deshabilitado.`,
                ephemeral: true,
            });
        } else {
            const remaining = MAX_NOTIFICATIONS_PER_TICKET - newCount;
            await interaction.reply({
                content: `Se ha notificado al equipo de Staff en el canal de guardia. Un miembro te atenderá en cuanto esté disponible.\n*(Alerta ${newCount}/3 enviada. Te quedan ${remaining} alerta(s). Podrás enviar la siguiente dentro de 30 minutos si aún no te han respondido).*`,
                ephemeral: true,
            });
        }
    } catch (error) {
        console.error('Error al notificar al staff:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al enviar la notificación al Staff: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

// Mantener compatibilidad de alias
const handleNotifyUser = handleNotifyStaff;

/**
 * Abre el modal para solicitar la ID del usuario a añadir al ticket
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleAddUserModalOpen(interaction) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('modal_add_user')
            .setTitle('Añadir Usuario al Ticket');

        const userIdInput = new TextInputBuilder()
            .setCustomId('add_user_id')
            .setLabel('ID de Discord del usuario a añadir')
            .setPlaceholder('Ej: 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(30);

        modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error al abrir modal para añadir usuario:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al abrir el formulario: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

/**
 * Procesa la adición de un usuario al ticket mediante su ID desde el modal
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleAddUserSubmit(interaction) {
    try {
        const rawInput = interaction.fields.getTextInputValue('add_user_id')?.trim() || '';
        const targetId = rawInput.replace(/\D/g, '');

        if (!targetId || targetId.length < 17 || targetId.length > 20) {
            return interaction.reply({
                content: 'Debes ingresar una ID numérica válida de Discord (17 a 20 dígitos).',
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

        // Otorgar permisos al usuario y registrarlo en bypassed
        await addTicketBypass(interaction.channel, targetMember.id);

        // Confirmación privada efímera
        await interaction.reply({
            content: `El usuario <@${targetMember.id}> (${targetMember.user.tag}) ha sido añadido exitosamente a este ticket.`,
            ephemeral: true,
        });

        // Mensaje sutil en el canal para notificar a la persona añadida con auto-eliminación
        const notice = await interaction.channel.send({
            content: `<@${targetMember.id}>, has sido añadido a este ticket por <@${interaction.user.id}>.`,
        }).catch(() => {});

        if (notice) {
            setTimeout(() => notice.delete().catch(() => {}), 15000);
        }
    } catch (error) {
        console.error('Error al procesar adición de usuario:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al añadir al usuario: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

/**
 * Genera una transcripción HTML bajo demanda y la envía al canal y logs
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleGenerateTranscript(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const creatorId = getTicketCreatorId(channel);

        const transcriptAttachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            returnType: 'attachment',
            fileName: `transcript-${channel.name}.html`,
            minify: true,
            saveImages: true,
            poweredBy: false,
        });

        const transcriptEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('Transcripción del Ticket Generada')
            .setDescription(`Transcripción generada bajo demanda por <@${interaction.user.id}>.`)
            .addFields(
                { name: 'Canal', value: `\`${channel.name}\``, inline: true },
                { name: 'Solicitado por', value: `${interaction.user.tag}`, inline: true },
                { name: 'Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: clientConfig.footerText })
            .setTimestamp();

        // Enviar al canal actual
        await channel.send({
            embeds: [transcriptEmbed],
            files: [transcriptAttachment],
        });

        // Enviar al canal de logs si está disponible
        if (clientConfig.logsChannelId) {
            const logsChannel = interaction.guild.channels.cache.get(clientConfig.logsChannelId);
            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [transcriptEmbed],
                    files: [transcriptAttachment],
                }).catch(() => {});
            }
        }

        await interaction.editReply({
            content: 'Transcripción generada y enviada al canal correctamente.',
        });
    } catch (error) {
        console.error('Error al generar transcripción:', error);
        const errorMessage = `Ocurrió un error al generar la transcripción: ${error.message}`;
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
}

module.exports = {
    isStaffMember,
    getTicketCreatorId,
    handleCloseTicket,
    handleCloseTicketSubmit,
    handleClaimTicket,
    handleNotifyStaff,
    handleNotifyUser,
    handleAddUserModalOpen,
    handleAddUserSubmit,
    handleGenerateTranscript,
    handleRateButton,
    handleRateCancel,
    handleFeedbackModalSubmit,
    executeTicketClosure,
};
