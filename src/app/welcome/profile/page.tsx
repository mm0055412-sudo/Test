'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { UserConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { worldData, T } from '@/lib/countries';


export default function ProfilePage() {
  const router = useRouter();
  const { config, login } = useAuth();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  
  const t = (key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options);


  useEffect(() => {
    // If config is not loaded, or country is not set, redirect to welcome.
    if (!config?.country) {
      // A small delay to allow config to load from async storage
      const timer = setTimeout(() => {
        if (!config?.country) {
            router.replace('/welcome');
        }
      }, 500);
      return () => clearTimeout(timer);
    } else if (config.dialCode && !phone.startsWith(config.dialCode)) {
      setPhone(config.dialCode + ' ');
    }
  }, [config, router, phone]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dialCode = config?.dialCode ? `${config.dialCode} ` : '';
    const inputValue = e.target.value;

    if (!inputValue.startsWith(dialCode)) {
        setPhone(dialCode);
        return;
    }

    const numberPart = inputValue.substring(dialCode.length);
    const sanitizedNumber = numberPart.replace(/[^0-9]/g, '');

    setPhone(`${dialCode}${sanitizedNumber}`);
  };


  const handleSubmit = async () => {
    if (name.trim().length < 2) {
      toast({ variant: 'destructive', title: t('invalidNameTitle'), description: t('invalidNameDesc') });
      return;
    }
    const phoneNumber = phone.trim().replace(/\s/g, '');
    if (phoneNumber.length < (config?.dialCode?.length || 0) + 7) {
      toast({ variant: 'destructive', title: t('invalidPhoneTitle'), description: t('invalidPhoneDesc') });
      return;
    }

    setLoading(true);
    try {
      const loginAttemptConfig: UserConfig = {
        // We need to construct the full config object here for the first time.
        // It's possible that the config from useAuth is still partial.
        country: config?.country || '',
        lang: config?.lang || 'en',
        currency: config?.country ? worldData[config.country].cur : 'USD',
        dialCode: config?.country ? worldData[config.country].dial : '',
        timeFormat: config?.country ? worldData[config.country].timeFormat : '12h',
        userName: name.trim(),
        phone: phoneNumber,
        isLoggedIn: true,
        createdAt: new Date().toISOString(),
      };
      
      await login(loginAttemptConfig);

      toast({ title: t('loginSuccessTitle'), description: t('loginSuccessDesc') });
      router.push('/home');

    } catch (error: any) {
      console.error('Login error:', error);
      toast({ variant: 'destructive', title: t('loginFailedTitle'), description: error.message || t('loginFailedDesc') });
       setLoading(false);
    }
  };
  
  // This handles the case where the user lands on this page directly
  // without going through welcome page. We need to ensure config is loaded.
  if (!config) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
  }


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
       <div className="w-full max-w-md absolute top-4 left-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">{t('registerAccount')}</h1>
          <p className="text-muted-foreground">{t('useMobileToSync')}</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phoneLabel')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('phonePlaceholder')}
                value={phone}
                onChange={handlePhoneChange}
                disabled={loading}
              />
            </div>
            <div className="text-xs text-destructive flex items-start gap-1 p-2 bg-destructive/10 rounded-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{t('syncMsg')}</span>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={loading || name.trim().length < 2 || phone.trim().length < (config?.dialCode?.length || 0) + 8}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('loggingIn')}...</> : t('submitBtn')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
