import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Alert } from 'react-native';
import type { LocalMedia } from './api/types';
import { toISODate, type ISODate } from './week';

export const MAX_VIDEO_MS = 15_000;
const MAX_EDGE = 1600; // archive-quality, not a photo backup (§23)

export type PickResult = { media: LocalMedia[]; takenOn: ISODate | null };

/** Pick up to `limit` photos/short videos from the existing camera roll (§6 — no custom camera). */
export async function pickMedia(limit: number): Promise<PickResult | null> {
  // The system photo picker (PHPicker / Android Photo Picker) needs no library permission:
  // the person chooses exactly what Snippets can see.
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
    exif: true,
    quality: 1,
    videoMaxDuration: MAX_VIDEO_MS / 1000,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (res.canceled) return null;

  const tooLong = res.assets.filter((a) => a.type === 'video' && (a.duration ?? 0) > MAX_VIDEO_MS + 500);
  if (tooLong.length) {
    Alert.alert('Keep videos short', 'Videos can be up to 15 seconds. Longer ones were left out.');
  }

  const media: LocalMedia[] = res.assets
    .filter((a) => !tooLong.includes(a))
    .slice(0, limit)
    .map((a) => ({
      local: true,
      uri: a.uri,
      kind: a.type === 'video' ? 'video' : 'image',
      width: a.width,
      height: a.height,
      durationMs: a.type === 'video' ? Math.round(a.duration ?? 0) : null,
      mimeType: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    }));

  return { media, takenOn: exifDate(res.assets[0]?.exif) };
}

function exifDate(exif: Record<string, any> | null | undefined): ISODate | null {
  const raw: unknown = exif?.DateTimeOriginal ?? exif?.['{Exif}']?.DateTimeOriginal ?? exif?.DateTime;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
  if (!m) return null;
  return toISODate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export type Prepared = {
  uri: string;
  mimeType: string;
  ext: string;
  width: number;
  height: number;
  thumb: { uri: string; width: number; height: number } | null;
};

async function shrinkImage(uri: string, width: number, height: number, edge = MAX_EDGE) {
  const scale = Math.min(1, edge / Math.max(width || edge, height || edge));
  const ctx = ImageManipulator.manipulate(uri);
  if (scale < 1) {
    if (width >= height) ctx.resize({ width: Math.round(width * scale) });
    else ctx.resize({ height: Math.round(height * scale) });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Compress media to an archive-friendly size before upload. */
export async function prepareForUpload(m: LocalMedia): Promise<Prepared> {
  if (m.kind === 'image') {
    const img = await shrinkImage(m.uri, m.width, m.height);
    return { ...img, mimeType: 'image/jpeg', ext: 'jpg', thumb: null };
  }
  const frame = await VideoThumbnails.getThumbnailAsync(m.uri, { time: 0, quality: 0.8 });
  const thumb = await shrinkImage(frame.uri, frame.width, frame.height, 900);
  const isMov = m.mimeType.includes('quicktime') || m.uri.toLowerCase().endsWith('.mov');
  return {
    uri: m.uri,
    mimeType: isMov ? 'video/quicktime' : 'video/mp4',
    ext: isMov ? 'mov' : 'mp4',
    width: m.width,
    height: m.height,
    thumb,
  };
}

export async function pickAvatar(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled) return null;
  const a = res.assets[0];
  const out = await shrinkImage(a.uri, a.width, a.height, 512);
  return out.uri;
}
