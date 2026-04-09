import { BusinessLogicError } from '../../utils/errors';

const unsupported = () => {
    throw new BusinessLogicError('KOT persistence is not configured in the current database schema');
};

export const KotService = {
    async createKot() {
        return unsupported();
    },

    async updateKotStatus() {
        return unsupported();
    },

    async updateKotItemStatus() {
        return unsupported();
    },
};
