import { threshold, useSetting, type ThresholdKey } from '../../store/serviceConfig';

/** Minutes before an alert turns red (Infinity when off); re-renders when the Back Office changes it. */
export function useThreshold(key: ThresholdKey): number {
  useSetting(`t.${key}`);
  return threshold(key);
}
