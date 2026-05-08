'use client';

import { useAuth } from '@/hooks/use-auth';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UserConfig } from '@/lib/types';
import { T, worldData } from '@/lib/countries';
import React, { useMemo, useCallback } from 'react';

export function AppHeader() {
  const { config, setConfig } = useAuth();

  const handleLanguageChange = useCallback((newLang: string) => {
    if (config) {
        setConfig(prevConfig => prevConfig ? {...prevConfig, lang: newLang as UserConfig['lang']} : null);
    }
  }, [config, setConfig]);
  
  const t = (key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options);


  const availableLanguages = useMemo(() => {
    return config?.country ? worldData[config.country]?.langs : { en: 'English' };
  }, [config?.country]);


  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <Link href="/home" className="flex items-center space-x-2">
          <span className="text-2xl font-black text-primary">
            My Bazar Khata
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-2">
            <Select onValueChange={handleLanguageChange} value={config?.lang || 'en'}>
                <SelectTrigger className="w-auto h-9 border-none focus:ring-0 gap-1 px-2">
                    <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                    {Object.entries(availableLanguages || {}).sort((a,b) => a[1].localeCompare(b[1])).map(([code, name]) => (
                        <SelectItem key={code} value={code}>{name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

          <Link href="/settings" passHref>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
              <span className="sr-only">{t('settings')}</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
