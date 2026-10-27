import { api, type AnalyticsEvent } from './api';

/**
 * Fire-and-forget product analytics, stored in our own database (no third-party SDK).
 * Only event names and small counts — never titles, reflections, photos or names.
 */
export function track(name: AnalyticsEvent, props?: Record<string, number | string | boolean>) {
  api.track(name, props).catch(() => {});
}
