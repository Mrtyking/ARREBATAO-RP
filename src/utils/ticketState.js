const { STAFF_ACTIVE_PERMISSIONS } = require('./permissions');

// Cache en memoria para bypasses y estados rápidos: Map<channelId, { claimedBy: string|null, bypassed: Set<string> }>
const ticketStateCache = new Map();

/**
 * Obtiene el estado actual de un canal de ticket (si está reclamado, por quién y qué staffs tienen bypass)
 * @param {import('discord.js').GuildChannel} channel
 * @returns {{ claimed: boolean, claimedBy: string|null, bypassed: Set<string>, creatorId: string|null }}
 */
function getTicketState(channel) {
    if (!channel) return { claimed: false, claimedBy: null, bypassed: new Set(), creatorId: null };

    // Extraer creatorId
    let creatorId = null;
    let claimedBy = null;
    const bypassed = new Set();

    if (channel.topic) {
        const creatorMatch = channel.topic.match(/Creador:[^()]*\((\d{17,20})\)/);
        if (creatorMatch) creatorId = creatorMatch[1];

        const claimedMatch = channel.topic.match(/Reclamado:\s*\((\d{17,20})\)/);
        if (claimedMatch) claimedBy = claimedMatch[1];

        const bypassMatch = channel.topic.match(/Bypass:\s*([0-9,()]+)/);
        if (bypassMatch) {
            const ids = bypassMatch[1].match(/\d{17,20}/g);
            if (ids) {
                ids.forEach(id => bypassed.add(id));
            }
        }
    }

    // Combinar con la memoria en ejecución si existe
    const cached = ticketStateCache.get(channel.id);
    if (cached) {
        if (cached.claimedBy) claimedBy = cached.claimedBy;
        cached.bypassed.forEach(id => bypassed.add(id));
    }

    return {
        claimed: Boolean(claimedBy),
        claimedBy,
        bypassed,
        creatorId,
    };
}

/**
 * Registra que un staff ha reclamado el ticket
 * @param {import('discord.js').GuildChannel} channel
 * @param {string} staffId
 */
async function setTicketClaimed(channel, staffId) {
    const current = getTicketState(channel);
    current.claimed = true;
    current.claimedBy = staffId;
    ticketStateCache.set(channel.id, current);

    // Otorgar permisos de escritura al staff que reclamó
    try {
        await channel.permissionOverwrites.edit(staffId, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
            EmbedLinks: true,
            ReadMessageHistory: true,
            AddReactions: true,
        }, { reason: `Ticket reclamado por ${staffId}` });
    } catch (err) {
        console.error('Error al actualizar permisos de reclamo:', err);
    }

    // Actualizar topic persistente
    try {
        let newTopic = channel.topic || '';
        if (newTopic.includes('Reclamado:')) {
            newTopic = newTopic.replace(/Reclamado:\s*\(\d+\)/, `Reclamado: (${staffId})`);
        } else {
            newTopic = `${newTopic} | Reclamado: (${staffId})`;
        }
        await channel.setTopic(newTopic).catch(() => {});
    } catch (err) {
        console.error('Error al actualizar topic de reclamo:', err);
    }
}

/**
 * Otorga bypass a un miembro de staff en el ticket
 * @param {import('discord.js').GuildChannel} channel
 * @param {string} staffId
 */
async function addTicketBypass(channel, staffId) {
    const current = getTicketState(channel);
    current.bypassed.add(staffId);
    ticketStateCache.set(channel.id, current);

    // Otorgar permisos de escritura al staff con bypass
    try {
        await channel.permissionOverwrites.edit(staffId, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
            EmbedLinks: true,
            ReadMessageHistory: true,
            AddReactions: true,
        }, { reason: `Bypass activado para staff ${staffId}` });
    } catch (err) {
        console.error('Error al actualizar permisos de bypass:', err);
    }

    // Actualizar topic persistente
    try {
        let newTopic = channel.topic || '';
        const bypassStr = Array.from(current.bypassed).map(id => `(${id})`).join(',');
        if (newTopic.includes('Bypass:')) {
            newTopic = newTopic.replace(/Bypass:\s*[0-9,()]+/, `Bypass: ${bypassStr}`);
        } else {
            newTopic = `${newTopic} | Bypass: ${bypassStr}`;
        }
        await channel.setTopic(newTopic).catch(() => {});
    } catch (err) {
        console.error('Error al actualizar topic de bypass:', err);
    }
}

module.exports = {
    getTicketState,
    setTicketClaimed,
    addTicketBypass,
};
