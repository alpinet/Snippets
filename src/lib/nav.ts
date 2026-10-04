import { router } from 'expo-router';
import type { ISODate } from './week';

export function openEditor(params: { weekStart: ISODate; day?: ISODate; id?: string }) {
  router.push({ pathname: '/snippet/edit', params });
}

