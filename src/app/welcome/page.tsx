'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { worldData, T } from '@/lib/countries';
import type { UserConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const { config, setConfig } = useAuth();
  
  const [currentCountry, setCurrentCountry] = useState(config?.country || 'US');
  const [currentLang, setCurrentLang] = useState(config?.lang || 'en');
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const t = (key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, currentLang, options);

  useEffect(() => {
    const countryData = worldData[currentCountry];
    if (countryData) {
      setLanguages(countryData.langs || {});
      const langKeys = Object.keys(countryData.langs || { en: 'English' });
      if (!langKeys.includes(currentLang)) {
        setCurrentLang(langKeys[0]);
      }
    } else {
      setLanguages({});
    }
  }, [currentCountry, currentLang]);


  const handleContinue = () => {
    if (!currentCountry || !currentLang) {
      alert('Please select your country and language.');
      return;
    }
    setIsLoading(true);

    const countryData = worldData[currentCountry];
    
    setConfig(currentConfig => ({
        ...(currentConfig || {
            userName: '',
            phone: '',
            isLoggedIn: false,
            createdAt: ''
        }), 
        country: currentCountry,
        lang: currentLang as UserConfig['lang'],
        currency: countryData.cur,
        dialCode: countryData.dial,
        timeFormat: countryData.timeFormat,
    } as UserConfig));
    router.push('/welcome/profile');
  };
  
  const sortedCountries = Object.entries(worldData).sort((a, b) => {
    const specialOrder = { "IN": 1, "RU": 2, "US": 3, "CN": 4 };
    const aOrder = specialOrder[a[0] as keyof typeof specialOrder];
    const bOrder = specialOrder[b[0] as keyof typeof specialOrder];

    if (aOrder && bOrder) {
      return aOrder - bOrder;
    }
    if (aOrder) {
      return -1;
    }
    if (bOrder) {
      return 1;
    }
    return a[1].n.localeCompare(b[1].n);
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary">My Bazar Khata</h1>
          <p className="text-muted-foreground">{t('onSub')}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('logTitle')}</CardTitle>
            <CardDescription>{t('logSub')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="country">{t('selectCountry')}</Label>
              <Select value={currentCountry} onValueChange={setCurrentCountry}>
                <SelectTrigger id="country">
                  <SelectValue placeholder={t('selectCountry')} />
                </SelectTrigger>
                <SelectContent>
                  {sortedCountries.map(([code, obj]) => (
                      <SelectItem key={code} value={code}>
                        {obj.n}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">{t('selectLanguage')}</Label>
              <Select value={currentLang} onValueChange={(l) => setCurrentLang(l as UserConfig['lang'])} disabled={!currentCountry}>
                <SelectTrigger id="language">
                  <SelectValue placeholder={t('selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(languages)
                    .sort((a,b) => a[1].localeCompare(b[1]))
                    .map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleContinue} disabled={!currentCountry || !currentLang || isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                t('continueBtn')
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
