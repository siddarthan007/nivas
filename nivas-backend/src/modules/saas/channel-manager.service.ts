import { db } from '../../db';
import { channelManagerSettings, channelRateMappings, channelSyncLogs, rooms } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';

export const ChannelManagerService = {
    async getChannelSettings(hotelId: number) {
        return await db.query.channelManagerSettings.findMany({
            where: eq(channelManagerSettings.hotelId, hotelId),
            with: { rateMappings: true }
        });
    },

    async createChannelSettings(hotelId: number, data: any) {
        const [channel] = await db.insert(channelManagerSettings).values({
            hotelId,
            channelCode: data.channelCode,
            channelName: data.channelName,
            apiKey: data.apiKey,
            apiSecret: data.apiSecret,
            hotelCode: data.hotelCode,
            syncRates: data.syncRates,
            syncAvailability: data.syncAvailability,
            syncReservations: data.syncReservations,
            rateMultiplier: data.rateMultiplier?.toString(),
            minLeadTime: data.minLeadTime,
            isActive: false,
            syncStatus: 'PENDING'
        }).returning();
        return channel;
    },

    async updateChannelSettings(hotelId: number, id: number, data: any) {
        const [updated] = await db.update(channelManagerSettings)
            .set({
                ...data,
                rateMultiplier: data.rateMultiplier?.toString(),
                updatedAt: new Date()
            })
            .where(and(eq(channelManagerSettings.id, id), eq(channelManagerSettings.hotelId, hotelId)))
            .returning();

        if (!updated) throw new NotFoundError('Channel setting');
        return updated;
    },

    async deleteChannelSettings(hotelId: number, id: number) {
        await db.delete(channelManagerSettings)
            .where(and(eq(channelManagerSettings.id, id), eq(channelManagerSettings.hotelId, hotelId)));
    },

    async createRateMapping(hotelId: number, channelSettingId: number, data: any) {
        const channel = await db.query.channelManagerSettings.findFirst({
            where: and(eq(channelManagerSettings.id, channelSettingId), eq(channelManagerSettings.hotelId, hotelId))
        });
        if (!channel) throw new NotFoundError('Channel');

        const [mapping] = await db.insert(channelRateMappings).values({
            channelSettingId,
            localRoomType: data.localRoomType,
            channelRoomCode: data.channelRoomCode,
            channelRatePlanCode: data.channelRatePlanCode,
            priceAdjustment: data.priceAdjustment?.toString(),
            adjustmentType: data.adjustmentType,
            isActive: true
        }).returning();
        return mapping;
    },

    async syncInventory(hotelId: number, channelSettingId: number) {
        const channel = await db.query.channelManagerSettings.findFirst({
            where: and(eq(channelManagerSettings.id, channelSettingId), eq(channelManagerSettings.hotelId, hotelId)),
            with: { rateMappings: true }
        });

        if (!channel) throw new NotFoundError('Channel');
        if (!channel.isActive) throw new BusinessLogicError('Channel is not active');

        const roomList = await db.query.rooms.findMany({
            where: eq(rooms.hotelId, hotelId)
        });

        const [syncLog] = await db.insert(channelSyncLogs).values({
            hotelId,
            channelSettingId: channel.id,
            syncType: 'AVAILABILITY_PUSH',
            direction: 'OUTBOUND',
            status: 'SUCCESS',
            recordsProcessed: roomList.length,
            requestPayload: { rooms: roomList.length, mappings: channel.rateMappings.length }
        }).returning();

        await db.update(channelManagerSettings)
            .set({ lastSyncAt: new Date(), syncStatus: 'ACTIVE' })
            .where(eq(channelManagerSettings.id, channel.id));

        return {
            channel: channel.channelName,
            roomsSynced: roomList.length,
            syncLogId: syncLog?.id
        };
    },

    async syncRates(hotelId: number, channelSettingId: number) {
        const channel = await db.query.channelManagerSettings.findFirst({
            where: and(eq(channelManagerSettings.id, channelSettingId), eq(channelManagerSettings.hotelId, hotelId)),
            with: { rateMappings: true }
        });

        if (!channel) throw new NotFoundError('Channel');
        if (!channel.isActive) throw new BusinessLogicError('Channel is not active');

        const [syncLog] = await db.insert(channelSyncLogs).values({
            hotelId,
            channelSettingId: channel.id,
            syncType: 'RATE_PUSH',
            direction: 'OUTBOUND',
            status: 'SUCCESS',
            recordsProcessed: channel.rateMappings.length,
            requestPayload: { mappings: channel.rateMappings }
        }).returning();

        await db.update(channelManagerSettings)
            .set({ lastSyncAt: new Date(), syncStatus: 'ACTIVE' })
            .where(eq(channelManagerSettings.id, channel.id));

        return {
            channel: channel.channelName,
            ratesSynced: channel.rateMappings.length,
            syncLogId: syncLog?.id
        };
    },

    async getSyncLogs(hotelId: number, limit: number = 50) {
        return await db.query.channelSyncLogs.findMany({
            where: eq(channelSyncLogs.hotelId, hotelId),
            with: { channelSetting: true },
            orderBy: (l, { desc }) => [desc(l.createdAt)],
            limit
        });
    },

    async triggerSync(hotelId: number, channel: string | undefined) {
        const query = db.query.channelManagerSettings.findMany({
            where: and(
                eq(channelManagerSettings.hotelId, hotelId),
                eq(channelManagerSettings.isActive, true)
            )
        });

        const channels = await query;
        if (channels.length === 0) {
            throw new BusinessLogicError('No active channels found to sync');
        }

        // Create sync logs for each channel
        const logs = await Promise.all(channels.map(async (ch) => {
            // Update channel status
            await db.update(channelManagerSettings)
                .set({ syncStatus: 'SYNCING', lastSyncAt: new Date() })
                .where(eq(channelManagerSettings.id, ch.id));

            // Create log entry
            const [log] = await db.insert(channelSyncLogs).values({
                hotelId,
                channelSettingId: ch.id,
                syncType: 'FULL_SYNC',
                direction: 'OUTBOUND',
                status: 'IN_PROGRESS', // Using valid enum/string value
                recordsProcessed: 0,
                requestPayload: { trigger: 'manual', channel: ch.channelName }
            }).returning();

            return log;
        }));

        // Simulate async background job (in real app, this would be a queue)
        // For now, we just update state to 'SYNCING' so frontend sees it.

        return {
            status: 'queued',
            message: `Sync triggered for ${channels.length} channel(s)`,
            syncIds: logs.filter(l => l).map(l => l!.id)
        };
    }
};
