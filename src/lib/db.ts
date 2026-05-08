
import { ref, onValue, set, get, off, Database, getDatabase } from "firebase/database";
import { openDB, type DBSchema, type IDBPDatabase, deleteDB } from 'idb';
import type { MarketList, UserConfig } from '@/lib/types';
import { getFirebaseApp } from '@/lib/firebase';
import { migrateDb } from "./utils";


const DB_NAME = 'GlobalBazarDB';
const DB_VERSION = 3;
const MARKET_LIST_STORE = 'market-lists';
const CONFIG_STORE = 'user-config';


interface MyDB extends DBSchema {
  [MARKET_LIST_STORE]: {
    key: string;
    value: MarketList;
  };
  [CONFIG_STORE]: {
    key: 'config';
    value: UserConfig;
  };
}

let dbPromise: Promise<IDBPDatabase<MyDB>> | null = null;

const getDb = () => {
    if (typeof window === 'undefined') return null;
    
    if (!dbPromise) {
      dbPromise = openDB<MyDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            if (!db.objectStoreNames.contains(MARKET_LIST_STORE)) {
                db.createObjectStore(MARKET_LIST_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(CONFIG_STORE)) {
                db.createObjectStore(CONFIG_STORE);
            }
        },
      });
    }
    return dbPromise;
};

const getLazyDatabase = (): Database | null => {
    if (typeof window === 'undefined') return null;
    try {
        return getDatabase(getFirebaseApp());
    } catch (e) {
        console.error("Failed to get database instance", e);
        return null;
    }
};

const recoverFromError = async (e: any, retryFunction: () => any) => {
    if (e instanceof Error && (e.name === 'NotFoundError' || e.message.includes("does not exist"))) {
        if (typeof window !== 'undefined') {
            const db = await dbPromise;
            db?.close();
            dbPromise = null;
            await deleteDB(DB_NAME);
            return await retryFunction();
        }
    }
    return null;
}

export const getCachedLists = async (): Promise<MarketList[]> => {
    const idb = getDb();
    if (!idb) return [];
    try {
        const db = await idb;
        const lists = await db.getAll(MARKET_LIST_STORE);
        return migrateDb(lists);
    } catch (e) {
        const result = await recoverFromError(e, getCachedLists);
        return result || [];
    }
};

export const getCachedConfig = async (): Promise<UserConfig | null> => {
    const idb = getDb();
    if (!idb) return null;
     try {
        const db = await idb;
        return (await db.get(CONFIG_STORE, 'config')) || null;
    } catch (e) {
        const result = await recoverFromError(e, getCachedConfig);
        return result;
    }
}

export const setCachedConfig = async (config: UserConfig | null) => {
    const idb = getDb();
    if (!idb) return;
     try {
        const db = await idb;
        if(config) {
            await db.put(CONFIG_STORE, config, 'config');
        } else {
            await db.delete(CONFIG_STORE, 'config');
        }
    } catch (e) {
        console.error("Failed to set cached config", e);
    }
}

export const syncFirebaseToCache = async (data: MarketList[]) => {
    const idb = getDb();
    if (!idb) return;
    try {
        const db = await idb;
        const tx = db.transaction(MARKET_LIST_STORE, 'readwrite');
        await tx.store.clear();
        for (const list of data) {
            await tx.store.put(list);
        }
        await tx.done;
    } catch (e) {
        console.error("Failed to sync firebase to cache", e);
    }
};

export const syncCacheToFirebase = (phone: string, data: MarketList[]) => {
     const database = getLazyDatabase();
     if (!database || !phone) return Promise.resolve();
     // Update local cache first
     syncFirebaseToCache(data);
     // Non-blocking Firebase set
     set(ref(database, `users/${phone}/data`), data);
     return Promise.resolve();
}

export const listenToFirebase = (
    phone: string,
    onDataChange: (data: MarketList[]) => void,
    onConfigChange: (config: UserConfig) => void,
    onError?: (error: Error) => void
) => {
    const database = getLazyDatabase();
    if (!database) return;

    const userRef = ref(database, `users/${phone}`);

    // Initial fetch
    get(userRef).then((snapshot) => {
        if (snapshot.exists()) {
            const remoteUserData = snapshot.val();
            const remoteDb = migrateDb(Array.isArray(remoteUserData.data) ? remoteUserData.data : []);
            onDataChange(remoteDb);
            syncFirebaseToCache(remoteDb);
            if (remoteUserData.config) onConfigChange(remoteUserData.config);
        }
    }).catch(e => console.warn("Initial fetch skipped", e));

    const unsubscribe = onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
            const remoteUserData = snapshot.val();
            const remoteDb = migrateDb(Array.isArray(remoteUserData.data) ? remoteUserData.data : []);
            onDataChange(remoteDb);
            syncFirebaseToCache(remoteDb);
            if (remoteUserData.config) onConfigChange(remoteUserData.config);
        }
    }, (error) => {
        if (onError) onError(error);
    });

    return () => off(userRef, 'value', unsubscribe);
};

export const writeInitialData = async (phone: string, config: UserConfig) => {
    const database = getLazyDatabase();
    if (!database) return;
    const userRef = ref(database, `users/${phone}`);
    try {
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
            await set(userRef, {
                config: config,
                data: [],
            });
        }
    } catch (e) {
        console.error("Failed to write initial data:", e);
    }
};

export const clearCache = async () => {
    const idb = getDb();
    if (!idb) return;
    try {
        const db = await idb;
        db.close();
        dbPromise = null;
        await deleteDB(DB_NAME);
    } catch (e) {
        console.error("Failed to clear cache", e);
    }
}
