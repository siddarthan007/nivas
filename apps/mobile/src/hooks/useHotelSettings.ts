import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { setCurrencySymbol } from '@/utils/currency';

export interface HotelSettings {
  currency: string;
  timezone: string;
  dateFormat: string;
  checkInTime: string;
  checkOutTime: string;
  enableFoodOrdering: boolean;
  enableHousekeeping: boolean;
  enableGuestPortal: boolean;
}

export function useHotelSettings() {
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.settings.get()
      .then((res: any) => {
        if (cancelled) return;
        if (res.data?.data) {
          const s = res.data.data as any;
          const regional = s.regional || {};
          const features = s.features || {};
          const cfg: HotelSettings = {
            currency: regional.currency || 'NPR',
            timezone: regional.timezone || 'Asia/Kathmandu',
            dateFormat: regional.dateFormat || 'YYYY-MM-DD',
            checkInTime: regional.checkInTime || '14:00',
            checkOutTime: regional.checkOutTime || '12:00',
            enableFoodOrdering: features.enableFoodAndBeverage ?? true,
            enableHousekeeping: features.enableHousekeeping ?? true,
            enableGuestPortal: features.enableGuestPortal ?? false,
          };
          setSettings(cfg);
          setCurrencySymbol(cfg.currency);
        }
      })
      .catch(() => { /* silently fail */ })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { settings, isLoading };
}
