import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  normalizeFullName,
  normalizePhoneE164,
} from '../../../../../packages/core/src/index';
import { supabase } from '../../lib/supabase';
import type { PendingPhoneOnboarding } from './auth-service';
import { previewManagerPersona } from './preview-persona';

const previewAuthEnabled = process.env.EXPO_PUBLIC_AUTH_MODE?.trim().toLowerCase() === 'preview';

function createPreviewSession(fullNameInput: string, phoneInput: string): Session {
  const fullName = normalizeFullName(fullNameInput);
  const phone = normalizePhoneE164(phoneInput);
  const now = new Date().toISOString();

  return {
    access_token: 'ibex-had-preview-access-token',
    token_type: 'bearer',
    expires_in: 31_536_000,
    expires_at: Math.floor(Date.now() / 1000) + 31_536_000,
    refresh_token: 'ibex-had-preview-refresh-token',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      phone,
      phone_confirmed_at: now,
      confirmed_at: now,
      last_sign_in_at: now,
      app_metadata: { provider: 'preview', providers: ['preview'] },
      user_metadata: {
        full_name: fullName,
        preview: true,
        preview_role: previewManagerPersona.role,
      },
      identities: [],
      created_at: now,
      updated_at: now,
      is_anonymous: false,
    },
  };
}

type AuthContextValue = {
  readonly session: Session | null;
  readonly isLoading: boolean;
  readonly isPreviewMode: boolean;
  readonly pendingOnboarding: PendingPhoneOnboarding | null;
  readonly setPendingOnboarding: Dispatch<SetStateAction<PendingPhoneOnboarding | null>>;
  enterPreview(fullName: string, phone: string): void;
  enterManagerPreview(): void;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!previewAuthEnabled);
  const [pendingOnboarding, setPendingOnboarding] = useState<PendingPhoneOnboarding | null>(null);

  useEffect(() => {
    if (previewAuthEnabled) {
      setIsLoading(false);
      return undefined;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setSession(null);
      } else {
        setSession(data.session);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession) setPendingOnboarding(null);
      setIsLoading(false);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isPreviewMode: previewAuthEnabled,
      pendingOnboarding,
      setPendingOnboarding,
      enterPreview(fullName: string, phone: string) {
        if (!previewAuthEnabled) {
          throw new Error('Preview authentication is disabled.');
        }
        setPendingOnboarding(null);
        setSession(createPreviewSession(fullName, phone));
      },
      enterManagerPreview() {
        if (!previewAuthEnabled) {
          throw new Error('Preview authentication is disabled.');
        }
        setPendingOnboarding(null);
        setSession(createPreviewSession(previewManagerPersona.fullName, previewManagerPersona.phone));
      },
      async signOut() {
        if (previewAuthEnabled) {
          setSession(null);
          setPendingOnboarding(null);
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, isLoading, pendingOnboarding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
