
'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
  useMemo
} from 'react';
import type { UserConfig, MarketList } from '@/lib/types';
import { useToast } from './use-toast';
import { Button } from '@/components/ui/button';
import { 
    getCachedLists, 
    getCachedConfig, 
    setCachedConfig, 
    listenToFirebase,
    writeInitialData,
    syncCacheToFirebase,
    clearCache,
    syncFirebaseToCache
} from '@/lib/db';
import { T } from '@/lib/countries';
import { getFirebaseAuth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

const LOCAL_SETTINGS_KEY = 'globalBazar_LocalSettings';

interface AuthContextType {
  config: UserConfig | null;
  db: MarketList[];
  loading: boolean;
  isSyncing: boolean;
  isAuthenticated: boolean;
  user: { phone: string } | null;
  setConfig: (newConfigOrUpdater: React.SetStateAction<UserConfig | null>) => void;
  login: (loginConfig: UserConfig) => Promise<void>;
  logout: () => void;
  updateDb: (
    updater: (prevDb: MarketList[]) => MarketList[],
  ) => void;
  undoableUpdateDb: (
    updater: (prevDb: MarketList[]) => MarketList[],
    toastMessages: { title: string; description: string }
  ) => void;
  getBill: (id: string) => MarketList | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialLocalSettings = (): { lang: UserConfig['lang']; country: string } => {
    if (typeof window === 'undefined') {
      return { lang: 'en', country: 'US' };
    }
    try {
      const localSettingsStr = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (localSettingsStr) {
        const localSettings = JSON.parse(localSettingsStr);
        if (localSettings.lang && localSettings.country) {
          return localSettings;
        }
      }
    } catch (e) {
      console.warn("Could not parse local settings", e);
    }
    return { lang: 'en', country: 'US' };
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfigState] = useState<UserConfig | null>(() => {
    const initialSettings = getInitialLocalSettings();
    return {
        country: initialSettings.country,
        lang: initialSettings.lang,
        userName: '',
        phone: '',
        isLoggedIn: false,
        currency: 'USD',
        dialCode: '+1',
        timeFormat: '12h'
    }
  });

  const [db, setDb] = useState<MarketList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast, dismiss } = useToast();

  const undoStackRef = useRef<MarketList[][]>([]);
  const dbRef = useRef(db);
  const activeListenerPhoneRef = useRef<string | null>(null);
  
  useEffect(() => {
    dbRef.current = db;
  }, [db]);
  
  const user = useMemo(() => config?.isLoggedIn ? { phone: config.phone } : null, [config?.isLoggedIn, config?.phone]);
  
  const t = useCallback((key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options), [config?.lang]);

  const ensureFirebaseSession = useCallback(async () => {
    try {
        const auth = getFirebaseAuth();
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
        setIsAuthenticated(true);
        return true;
    } catch (error: any) {
        console.warn("Cloud sync restricted", error.message);
        setIsAuthenticated(true); // Allow local usage even if auth fails
        return false;
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [cachedConfig, cachedLists] = await Promise.all([
            getCachedConfig(),
            getCachedLists()
        ]);

        if (cachedConfig) setConfigState(cachedConfig);
        if (cachedLists && cachedLists.length > 0) setDb(cachedLists);
      } catch (e) {
        console.error("Cache load error:", e);
      } finally {
        setLoading(false);
      }
      
      ensureFirebaseSession();
    };

    loadInitialData();
  }, [ensureFirebaseSession]);

  const setConfig = useCallback((newConfigOrUpdater: React.SetStateAction<UserConfig | null>) => {
    setConfigState(currentConfig => {
        const newConfig = typeof newConfigOrUpdater === 'function' ? newConfigOrUpdater(currentConfig) : newConfigOrUpdater;
        setCachedConfig(newConfig);
         if (newConfig?.lang && newConfig?.country) {
            try {
                const localSettings = { lang: newConfig.lang, country: newConfig.country };
                localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(localSettings));
            } catch (e) {
                console.error("Failed to update local storage", e);
            }
        }
        return newConfig;
    });
  }, []);

  useEffect(() => {
    if (loading || !config?.isLoggedIn || !config.phone) {
      activeListenerPhoneRef.current = null;
      return;
    }

    if (activeListenerPhoneRef.current === config.phone) {
      return;
    }

    activeListenerPhoneRef.current = config.phone;
    setIsSyncing(true);

    const handleRemoteDataChange = (data: MarketList[]) => {
        setDb(data);
        setIsSyncing(false);
    };
    
    const handleRemoteConfigChange = (newConfig: UserConfig) => {
        setConfigState(currentConfig => {
             const {lang, country, ...restOfConfig} = newConfig; 
             const updated = { ...(currentConfig || {lang: 'en', country: 'US'}), ...restOfConfig } as UserConfig;
             return updated;
        });
    };

    const unsubscribe = listenToFirebase(
        config.phone, 
        handleRemoteDataChange, 
        handleRemoteConfigChange,
        (err) => {
          console.warn("Sync warning:", err.message);
          setIsSyncing(false);
        }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loading, config?.isLoggedIn, config?.phone]);


  const login = useCallback(async (loginConfig: UserConfig): Promise<void> => {
    setLoading(true);
    await clearCache();
    setDb([]);
    setConfig(loginConfig);
    
    const success = await ensureFirebaseSession();
    if (success) {
        try {
            await writeInitialData(loginConfig.phone, loginConfig);
        } catch (error: any) {
            console.warn("Cloud write failed", error.message);
        }
    }
    setLoading(false);
  }, [setConfig, ensureFirebaseSession]);


  const updateDb = useCallback(
    (updater: (prevDb: MarketList[]) => MarketList[]) => {
      const currentDb = dbRef.current;
      const newDb = updater(currentDb);
      
      // Update memory
      setDb(newDb);
      
      // Update local cache immediately
      syncFirebaseToCache(newDb);

      // Update cloud if logged in
      if (config?.isLoggedIn && config.phone) {
          syncCacheToFirebase(config.phone, newDb).catch((e) => {
             console.warn("Cloud sync deferred", e.message);
          });
      }
    },
    [config?.isLoggedIn, config?.phone]
  );
  

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length > 0) {
      const lastDbState = undoStackRef.current.pop();
      if (lastDbState) {
        updateDb(() => lastDbState);
      }
    }
  }, [updateDb]);

  const undoableUpdateDb = useCallback(
    (
      updater: (prevDb: MarketList[]) => MarketList[],
      toastMessages: { title: string; description: string }
    ) => {
      const currentDb = dbRef.current;
      undoStackRef.current.push([...currentDb]);
      if (undoStackRef.current.length > 10) undoStackRef.current.shift();
      
      updateDb(updater);

      const { id } = toast({
        title: toastMessages.title,
        description: toastMessages.description,
        action: (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              handleUndo();
              dismiss(id);
            }}
          >
            {t('undoBtn')}
          </Button>
        ),
        duration: 4000,
      });
    },
    [updateDb, toast, dismiss, t, handleUndo]
  );
  
  const logout = useCallback(async () => {
    await clearCache();
    setConfig(prev => prev ? {...prev, isLoggedIn: false, phone: '', userName: '', photoURL: ''} : null);
    setDb([]);
    setIsAuthenticated(false);
  }, [setConfig]);
  
  const getBill = useCallback((id: string) => {
    return dbRef.current.find(list => String(list.id) === String(id));
  }, []);
  
  const contextValue = useMemo(() => ({
    config,
    user,
    db,
    loading,
    isSyncing,
    isAuthenticated,
    setConfig,
    login,
    logout,
    updateDb,
    undoableUpdateDb,
    getBill
  }), [config, user, db, loading, isSyncing, isAuthenticated, setConfig, login, logout, updateDb, undoableUpdateDb, getBill]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
