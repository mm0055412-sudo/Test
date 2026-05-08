'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { worldData, T, N, D } from '@/lib/countries';
import type { UserConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, User, Upload, Phone, Trash2, Loader2, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { parseISO, differenceInDays, isValid } from 'date-fns';

export default function SettingsPage() {
  const router = useRouter();
  const { config, setConfig, logout } = useAuth();
  const { toast } = useToast();
  
  const [currentCountry, setCurrentCountry] = useState(config?.country || 'US');
  const [currentLang, setCurrentLang] = useState(config?.lang || 'en');
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [userName, setUserName] = useState(config?.userName || '');
  const [photoURL, setPhotoURL] = useState(config?.photoURL || '');
  const [usageDays, setUsageDays] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const t = useCallback((key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options), [config?.lang]);
  const n = useCallback((num: number | string, options?: { decimals?: number }): string => N(num, config?.lang, options), [config?.lang]);
  const d = useCallback((date: Date | number, formatStr: string): string => D(new Date(date), formatStr, config?.lang, config?.country), [config?.lang, config?.country]);

  useEffect(() => {
    if (config) {
      setUserName(config.userName || '');
      setPhotoURL(config.photoURL || '');
      setCurrentCountry(config.country || 'US');
      setCurrentLang(config.lang || 'en');

      if (config.createdAt && isValid(parseISO(config.createdAt))) {
        setUsageDays(differenceInDays(new Date(), parseISO(config.createdAt)) + 1);
      }
    }
  }, [config]);

  useEffect(() => {
    if (currentCountry) {
      setLanguages(worldData[currentCountry]?.langs || {});
    }
  }, [currentCountry]);
  
  const handleCountryChange = (c: string) => {
    setCurrentCountry(c);
    const newLangs = worldData[c]?.langs || { en: 'English' };
    const firstLang = Object.keys(newLangs)[0] as UserConfig['lang'];
    setCurrentLang(firstLang);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoURL('');
  }

  const handleUpdate = async () => {
    if (!config) return;
    setIsUpdating(true);

    try {
        const newConfig: UserConfig = {
          ...config,
          country: currentCountry,
          lang: currentLang as UserConfig['lang'],
          currency: worldData[currentCountry].cur,
          dialCode: worldData[currentCountry].dial,
          userName: userName,
          photoURL: photoURL,
          timeFormat: worldData[currentCountry].timeFormat,
        };
        
        setConfig(newConfig);

        toast({
            title: t('settingsUpdatedTitle'),
            description: t('settingsUpdatedDesc'),
        });
        router.push('/home');
    } catch(e) {
        console.error(e);
        toast({
            variant: "destructive",
            title: t('updateFailedTitle'),
            description: t('updateFailedDesc'),
        });
    } finally {
        setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/welcome');
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
    <div className="space-y-8">
       <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
        </Button>
        <div>
            <h1 className="text-2xl font-bold">{t('settings')}</h1>
            <p className="text-muted-foreground">{t('settingsSubtitle')}</p>
        </div>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>{t('profileTitle')}</CardTitle>
          <CardDescription>{t('profileSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
             <Dialog>
              <DialogTrigger asChild>
                <div className="relative">
                  <div className="relative group cursor-pointer">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={photoURL} alt={userName} />
                      <AvatarFallback>
                        <User className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                       <Eye className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="p-0 border-0 max-w-md">
                 <DialogHeader className="sr-only">
                    <DialogTitle>{t('profileTitle')}</DialogTitle>
                    <DialogDescription>{t('profileSubtitle')}</DialogDescription>
                </DialogHeader>
                {photoURL && (
                  <img src={photoURL} alt="Profile" className="w-full h-auto rounded-lg" />
                )}
              </DialogContent>
            </Dialog>

            <div className="flex-1 space-y-1">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  {t('uploadPhoto' as any) || "Upload Photo"}
                </Button>
              {photoURL && (
                <Button variant="destructive" size="sm" className="w-full" onClick={handleRemovePhoto}>
                  <Trash2 className="mr-2 h-4 w-4"/>
                  {t('removePhoto' as any) || "Remove Photo"}
                </Button>
              )}
            </div>

          </div>
           <div className="space-y-4">
               <div>
                  <Label htmlFor="name">{t('nameLabel')}</Label>
                  <Input id="name" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder={t('namePlaceholder')} />
               </div>
               <div>
                  <Label htmlFor="phone">{t('phoneLabel')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" value={n(config?.phone || '')} readOnly className="pl-10 bg-muted cursor-not-allowed" />
                  </div>
               </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('locationTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="country">{t('selectCountry')}</Label>
            <Select value={currentCountry} onValueChange={handleCountryChange}>
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
        </CardContent>
      </Card>
      
       <Button className="w-full" onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUpdating ? t('updating') : t('update')}
       </Button>

      <Card>
        <CardHeader>
            <CardTitle>{t('accountTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            {config?.createdAt && isValid(parseISO(config.createdAt)) && (
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>{t('idCreated')}:</strong> {d(parseISO(config.createdAt), 'MMMM d, yyyy')}</p>
                <p><strong>{t('appUsage')}:</strong> {t('appUsageText', {days: n(usageDays.toString())})}</p>
              </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">{t('logout')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('areYouSure')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('logoutConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancelBtn')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>{t('logout')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
