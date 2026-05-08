
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO, isValid, format } from 'date-fns';
import type { MarketList } from "./types";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * High-performance database migration and validation.
 * Resiliently handles legacy formats and ensures instant availability.
 */
export const migrateDb = (db: any[]): MarketList[] => {
    if (!db || !Array.isArray(db)) return [];
    
    const migrated: MarketList[] = [];
    const now = new Date().toISOString();

    for (const list of db) {
        if (!list || !list.id) continue;

        // Ensure items array exists
        const items = Array.isArray(list.items) ? list.items : [];

        // Fix missing or invalid datetime
        let datetime = list.datetime;
        
        if (!datetime || typeof datetime !== 'string' || !isValid(parseISO(datetime))) {
            // Attempt to recover from 'date' field
            if (list.date && typeof list.date === 'string' && isValid(parseISO(list.date))) {
                datetime = new Date(list.date).toISOString();
            } 
            // Attempt to extract from ID (format: list-timestamp)
            else if (typeof list.id === 'string' && list.id.startsWith('list-')) {
                const tsString = list.id.split('-')[1];
                const ts = parseInt(tsString);
                if (!isNaN(ts) && ts > 946684800000) {
                    datetime = new Date(ts).toISOString();
                } else {
                    datetime = now;
                }
            } else {
                datetime = now;
            }
        }

        migrated.push({
            ...list,
            id: String(list.id),
            datetime,
            items,
            name: list.name || `Market List ${format(parseISO(datetime), 'P')}`,
            date: list.date || datetime.split('T')[0]
        } as MarketList);
    }

    // Sort by most recent first
    return migrated.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
};
