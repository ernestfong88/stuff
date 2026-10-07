/**
 * Typed readers for the pick up, delivery, text and kiosk parts of the
 * service settings (src/store/serviceConfig.ts). Back Office edits them;
 * PU & Delivery and the Resident Kiosk read them.
 */
import { useShared } from '../../../lib/sharedStore';
import { serviceConfig, type ServiceConfig } from '../../../store/serviceConfig';
import type { MobileOverrides } from './phones';
import type { TextKey } from './texts';
import type { WindowSettings } from './windows';

export type { ServiceConfig };

export interface TextSetting {
  /** false turns the text off. */
  on?: boolean;
  /** Community wording; absent means the standard wording. */
  body?: string;
}

export type TextSettings = Partial<Record<TextKey, TextSetting>>;

export type FeaturedList = 'drinks' | 'sides';

const section = <T,>(cfg: ServiceConfig, key: string): T => ((cfg as Record<string, unknown>)[key] ?? {}) as T;

export const windowSettings = (cfg: ServiceConfig): WindowSettings => section<WindowSettings>(cfg, 'win');
export const textSettings = (cfg: ServiceConfig): TextSettings => section<TextSettings>(cfg, 'texts');
export const mobileOverrides = (cfg: ServiceConfig): MobileOverrides => section<MobileOverrides>(cfg, 'mobile');

/**
 * Per venue: staff mark a pick up collected (the default), or a pick up is
 * complete once it is packed and set out.
 */
export function tracksPickups(cfg: ServiceConfig, room: string): boolean {
  return section<{ track?: Record<string, boolean> }>(cfg, 'pud').track?.[room] !== false;
}

/** The featured order Back Office saved for a kiosk short list, or null for the standard picks. */
export function featuredOverride(cfg: ServiceConfig, list: FeaturedList): string[] | null {
  const v = section<Partial<Record<FeaturedList, string[]>>>(cfg, 'kioskFeat')[list];
  return Array.isArray(v) ? v : null;
}

/** Quarter turn for a kiosk tablet mounted in landscape: 90, -90 or 0. */
export function kioskRotation(cfg: ServiceConfig): 0 | 90 | -90 {
  const v = (cfg as Record<string, unknown>).kioskRotate;
  return v === 90 || v === -90 ? v : 0;
}

/** The whole service settings object; re-renders on any change. */
export function useServiceSettings(): ServiceConfig {
  return useShared(serviceConfig);
}
