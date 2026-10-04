import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MediaItem } from '../lib/api';
import { colors, radius } from '../theme';

/** Still image for any media item (video → poster frame with a quiet play mark). */
export function MediaThumb({ item, style, rounded = radius.sm, showPlay = true, size = 'thumb' }: {
  item: MediaItem; style?: StyleProp<ViewStyle>; rounded?: number; showPlay?: boolean;
  /** 'thumb' (default) loads the small rendition when there is one; 'full' for large surfaces. */
  size?: 'thumb' | 'full';
}) {
  const useThumb = !!item.thumbUrl && (item.kind === 'video' || size === 'thumb');
  const uri = useThumb ? item.thumbUrl! : item.url;
  const cacheKey = useThumb ? `${item.cacheKey}-thumb` : item.cacheKey;
  return (
    <View style={[{ borderRadius: rounded, overflow: 'hidden', backgroundColor: colors.fill }, style]}>
      {item.kind === 'video' && !item.thumbUrl ? (
        <InlineVideo item={item} />
      ) : (
        <Image
          source={{ uri, cacheKey }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          recyclingKey={cacheKey}
        />
      )}
      {item.kind === 'video' && showPlay ? (
        <View style={styles.play}>
          <Play size={14} color="#fff" fill="#fff" strokeWidth={1.75} />
        </View>
      ) : null}
    </View>
  );
}

function InlineVideo({ item }: { item: MediaItem }) {
  const player = useVideoPlayer(item.url, (p) => {
    p.muted = true;
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

/** Full playback for the detail view. */
export function MediaPlayer({ item, style }: { item: MediaItem; style?: StyleProp<ViewStyle> }) {
  if (item.kind === 'image') {
    return (
      <View style={[{ backgroundColor: colors.fill }, style]}>
        <Image source={{ uri: item.url, cacheKey: item.cacheKey }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      </View>
    );
  }
  return <VideoPlayerView item={item} style={style} />;
}

function VideoPlayerView({ item, style }: { item: MediaItem; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(item.url, (p) => {
    p.loop = true;
  });
  return (
    <View style={[{ backgroundColor: '#000' }, style]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
    </View>
  );
}

/** 1 → full, 2 → split, 3 → one large + two stacked (§12). */
export function Collage({ media, height = 220, onPress }: { media: MediaItem[]; height?: number; onPress?: () => void }) {
  const gap = 4;
  const [a, b, c] = media;
  if (!a) return null;
  let body;
  if (media.length === 1) body = <MediaThumb item={a} style={{ flex: 1 }} rounded={radius.md - 4} size="full" />;
  else if (media.length === 2) {
    body = (
      <View style={{ flex: 1, flexDirection: 'row', gap }}>
        <MediaThumb item={a} style={{ flex: 1 }} rounded={radius.md - 4} size="full" />
        <MediaThumb item={b} style={{ flex: 1 }} rounded={radius.md - 4} size="full" />
      </View>
    );
  } else {
    body = (
      <View style={{ flex: 1, flexDirection: 'row', gap }}>
        <MediaThumb item={a} style={{ flex: 1.6 }} rounded={radius.md - 4} size="full" />
        <View style={{ flex: 1, gap }}>
          <MediaThumb item={b} style={{ flex: 1 }} rounded={radius.md - 4} size="full" />
          <MediaThumb item={c} style={{ flex: 1 }} rounded={radius.md - 4} size="full" />
        </View>
      </View>
    );
  }
  if (!onPress) return <View style={{ height }}>{body}</View>;
  return (
    <Pressable style={({ pressed }) => [{ height }, pressed && { opacity: 0.9 }]} onPress={onPress}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  play: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(40, 30, 25, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
});
