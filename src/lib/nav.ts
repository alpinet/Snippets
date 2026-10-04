import { router } from 'expo-router';
import type { ISODate } from './week';

export function openEditor(params: { weekStart: ISODate; day?: ISODate; id?: string }) {
  router.push({ pathname: '/snippet/edit', params });
}

/** Shareable image of my moments between two dates (inclusive). */
export function openRecap(params: { from: ISODate; to: ISODate; title: string }) {
  router.push({ pathname: '/recap', params });
}
