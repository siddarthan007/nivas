import { api } from '@/api/client';
import Toast from 'react-native-toast-message';

/**
 * Trigger backend KOT printing for an order.
 * The backend handles printer routing, content generation, and actual printing.
 */
export async function printOrderKot(orderId: string | number) {
  try {
    const res = await (api as any).orders.kot['print']({ orderId }).post();
    if (res.error) throw res.error;

    const results = res.data?.data || [];
    const allOk = results.every((r: any) => r.status === 'PRINTED');

    if (allOk) {
      Toast.show({ type: 'success', text1: 'KOT printed successfully' });
    } else if (results.length > 0) {
      const failed = results.filter((r: any) => r.status !== 'PRINTED').map((r: any) => r.printerName || 'Unknown').join(', ');
      Toast.show({ type: 'error', text1: 'Some KOT printers failed', text2: `Failed: ${failed}` });
    } else {
      Toast.show({ type: 'info', text1: 'No KOT printers configured' });
    }

    return { success: allOk, results };
  } catch (error: any) {
    console.error('[KOT Print] Failed:', error);
    Toast.show({ type: 'error', text1: 'KOT print failed', text2: error.message || 'Check printer settings' });
    return { success: false, error };
  }
}

/**
 * Fetch KOT routing info for an order (for debugging or preview).
 */
export async function getKotRouting(orderId: string | number) {
  try {
    const res = await (api as any).orders.kot['route']({ orderId }).get();
    if (res.error) throw res.error;
    return res.data?.data || null;
  } catch (error: any) {
    console.error('[KOT Route] Failed:', error);
    return null;
  }
}
