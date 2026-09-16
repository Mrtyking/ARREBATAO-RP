const { PermissionFlagsBits } = require('discord.js');

/**
 * Permisos base asignados a usuarios y staff dentro de un ticket
 */
const BASE_TICKET_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
];

/**
 * Permisos para el personal de Staff antes de reclamar el ticket
 * Pueden ver el canal y leer el historial, pero NO pueden hablar hasta reclamar
 */
const STAFF_PRE_CLAIM_ALLOW = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
];

const STAFF_PRE_CLAIM_DENY = [
    PermissionFlagsBits.SendMessages,
];

/**
 * Permisos completos otorgados al staff que reclama el ticket o usa /bypass
 */
const STAFF_ACTIVE_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
];

/**
 * Permisos administrativos para el bot dentro del canal de ticket
 */
const BOT_TICKET_PERMISSIONS = [
    ...BASE_TICKET_PERMISSIONS,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageMessages,
];

/**
 * Genera la lista de sobreescrituras de permisos dinámicos para el canal del ticket
 *
 * @param {import('discord.js').Guild} guild - Servidor de Discord
 * @param {import('discord.js').User} user - Usuario creador del ticket
 * @param {object} categoryConfig - Configuración de la categoría seleccionada
 * @returns {Array<object>} Array de sobreescrituras de permisos para Discord
 */
function getTicketPermissions(guild, user, categoryConfig) {
    const overwritesMap = new Map();

    // 1. Denegar ViewChannel a @everyone
    if (guild.roles.everyone) {
        overwritesMap.set(guild.roles.everyone.id, {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
        });
    }

    // 2. Permitir permisos base al usuario creador del ticket
    const userId = typeof user === 'string' ? user : user.id;
    overwritesMap.set(userId, {
        id: userId,
        allow: BASE_TICKET_PERMISSIONS,
    });

    // 3. Permitir permisos al bot (guild.members.me o cliente)
    const botId = guild.members.me?.id || guild.client.user.id;
    overwritesMap.set(botId, {
        id: botId,
        allow: BOT_TICKET_PERMISSIONS,
    });

    // 4. Permitir ver historial a cada staffRole configurado pero DENEGAR SendMessages hasta que reclamen
    if (Array.isArray(categoryConfig.staffRoles)) {
        for (const roleId of categoryConfig.staffRoles) {
            if (roleId && typeof roleId === 'string') {
                overwritesMap.set(roleId, {
                    id: roleId,
                    allow: STAFF_PRE_CLAIM_ALLOW,
                    deny: STAFF_PRE_CLAIM_DENY,
                });
            }
        }
    }

    // 5. Si higherRolesAllowed es true (Donaciones con rol 1530124417244598312):
    // Buscar rol base en guild.roles.cache; si existe, encontrar todos los roles con position >= baseRole.position
    // y otorgarles ViewChannel pero denegarles SendMessages hasta que reclamen
    if (categoryConfig.higherRolesAllowed) {
        const targetRoleId = categoryConfig.staffRoles?.[0] || '1530124417244598312';
        const baseRole = guild.roles.cache.get(targetRoleId);

        if (baseRole) {
            const higherRoles = guild.roles.cache.filter(role =>
                role.position >= baseRole.position &&
                role.id !== guild.roles.everyone.id &&
                !role.managed
            );

            for (const [roleId] of higherRoles) {
                if (!overwritesMap.has(roleId)) {
                    overwritesMap.set(roleId, {
                        id: roleId,
                        allow: STAFF_PRE_CLAIM_ALLOW,
                        deny: STAFF_PRE_CLAIM_DENY,
                    });
                }
            }
        }
    }

    return Array.from(overwritesMap.values());
}

module.exports = {
    BASE_TICKET_PERMISSIONS,
    BOT_TICKET_PERMISSIONS,
    STAFF_PRE_CLAIM_ALLOW,
    STAFF_PRE_CLAIM_DENY,
    STAFF_ACTIVE_PERMISSIONS,
    getTicketPermissions,
};
