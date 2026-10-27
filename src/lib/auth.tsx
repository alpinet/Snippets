import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Session } from './api';
import { queryClient } from './queries';
import { timezone } from './week';

type AuthState = { ready: boolean; session: Session };
const Ctx = createContext<AuthState>({ ready: false, session: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false, session: null });

  useEffect(() => {
    let alive = true;
    api.getSession().then((session) => alive && setState({ ready: true, session }));
    const off = api.onAuthChange((session) => {
      setState((prev) => {
        if (prev.session?.userId !== session?.userId) queryClient.clear();
        return { ready: true, session };
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Keep the server's idea of "Sunday" in sync with the device timezone.
  useEffect(() => {
    if (state.session) api.syncTimezone(timezone()).catch(() => {});
  }, [state.session]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

// Invite links can arrive before sign-in; hold the code until we can accept it.
const INVITE_KEY = 'pending-invite';
export const savePendingInvite = (code: string) => AsyncStorage.setItem(INVITE_KEY, code);
export async function takePendingInvite(): Promise<string | null> {
  const code = await AsyncStorage.getItem(INVITE_KEY);
  if (code) await AsyncStorage.removeItem(INVITE_KEY);
  return code;
}
