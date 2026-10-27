import { Alert, Share } from 'react-native';
import { track } from './analytics';
import { api } from './api';
import { inviteLink } from './config';
import { invalidateFriends } from './queries';

/** Open the share sheet with your invite link. */
export async function shareInvite(code: string) {
  const res = await Share.share({
    message: `Join me on Snippets — a few moments from our weeks, shared on Sundays. ${inviteLink(code)}`,
  });
  if (res.action === Share.sharedAction) track('invite_sent');
}

/** Pull an invite code out of a pasted link or typed code. */
export function parseInviteCode(input: string): string | null {
  const m = input.trim().toLowerCase().match(/([a-f0-9]{12})\/?$/);
  return m ? m[1] : null;
}

/** Become friends via an invite code, with a friendly confirmation. Returns true on success. */
export async function redeemInvite(code: string): Promise<boolean> {
  try {
    const friend = await api.acceptInvite(code);
    await invalidateFriends();
    track('invite_accepted');
    Alert.alert('You’re friends now', `You and ${friend.displayName} can now share weeks.`);
    return true;
  } catch (e) {
    Alert.alert('Invite link', e instanceof Error ? e.message : 'That invite didn’t work.');
    return false;
  }
}
