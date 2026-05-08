'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, BarChart2, BookOpen, Trash2, User, Loader2, ChevronRight, Eye, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { isSameMonth, isSameYear, isToday, isValid, getMonth, getYear, differenceInDays, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { T, N, D } from '@/lib/countries';


export default function HomePage() {
  const { config, db, undoableUpdateDb, isSyncing } = useAuth();
  const router = useRouter();

  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);

  const t = useCallback((key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options), [config?.lang]);
  const n = useCallback((num: number | string, options?: { decimals?: number }): string => N(num, config?.lang, options), [config?.lang]);
  const d = useCallback((date: Date | number, formatStr: string): string => D(new Date(date), formatStr, config?.lang, config?.country), [config?.lang, config?.country]);


  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const id = window.location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [db.length]);

  const handleNewList = useCallback(() => {
    setIsCreatingList(true);
    router.push('/market/new');
  }, [router]);

  const stats = useMemo(() => {
    const now = new Date();
    let todaySpend = 0, monthSpend = 0, yearSpend = 0;
    let tCreated = 0, tBought = 0, mCreated = 0, mBought = 0, yCreated = 0, yBought = 0;
    let mCount = 0, yCount = 0;

    const todaysLists = db
      .filter(l => {
          if (!l?.datetime || !isValid(parseISO(l.datetime))) return false;
          const lDate = parseISO(l.datetime);
          return isToday(lDate) && l.items.length > 0;
      })
      .sort((a, b) => parseISO(b.datetime).getTime() - parseISO(a.datetime).getTime());

    db.forEach(l => {
      if (!l?.datetime || !Array.isArray(l.items)) return;
      const lDate = parseISO(l.datetime);
      if (!isValid(lDate)) return;
      
      const bItems = l.items.filter(i => i.bought);
      const total = bItems.reduce((s, i) => s + (i.price || 0), 0);
      
      if (isToday(lDate)) {
        todaySpend += total;
        tCreated += l.items.length;
        tBought += bItems.length;
      }
      if (isSameMonth(lDate, now)) {
        monthSpend += total;
        if (l.items.length > 0) { mCreated += l.items.length; mBought += bItems.length; mCount++; }
      }
      if (isSameYear(lDate, now)) {
        yearSpend += total;
        if (l.items.length > 0) { yCreated += l.items.length; yBought += bItems.length; yCount++; }
      }
    });

    let usageDays = config?.createdAt ? differenceInDays(now, parseISO(config.createdAt)) + 1 : 0;

    return { todaySpend, monthSpend, yearSpend, todaysLists, tCreated, tBought, mCreated, mBought, yCreated, yBought, mCount, yCount, usageDays };
  }, [db, config?.createdAt]);

  const handleDelete = useCallback(() => {
    const ids = listToDelete ? [listToDelete] : selectedLists;
    if (ids.length === 0) return;
    const set = new Set(ids);
    undoableUpdateDb(current => current.filter(l => !set.has(l.id)), {
      title: t('listFrom', { count: n(ids.length) }),
      description: t('removed', { count: n(ids.length) }),
    });
    setSelectedLists([]);
    setListToDelete(null);
    setShowDeleteConfirmDialog(false);
  }, [listToDelete, selectedLists, undoableUpdateDb, t, n]);

  const handleListSelect = useCallback((id: string, checked: boolean) => {
    setSelectedLists(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  }, []);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-4 bg-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <div className="relative group cursor-pointer">
                  <Avatar className="h-12 w-12 border-2 border-primary-foreground">
                    <AvatarImage src={config?.photoURL} alt={config?.userName} />
                    <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    <Eye className="h-6 w-6 text-white" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="p-0 border-0 max-w-md">
                   <DialogHeader className="sr-only">
                      <DialogTitle>{t('profileTitle')}</DialogTitle>
                      <DialogDescription>{t('profileSubtitle')}</DialogDescription>
                  </DialogHeader>
                  {config?.photoURL && (
                    <img src={config.photoURL} alt="Profile" className="w-full h-auto rounded-lg" />
                  )}
              </DialogContent>
            </Dialog>
             <div>
               <CardTitle className="text-lg font-bold text-primary">{config?.userName}</CardTitle>
               <CardDescription className="font-mono text-sm">{n(config?.phone || '')}</CardDescription>
             </div>
          </div>
          {isSyncing && (
            <div className="flex items-center gap-1 text-xs text-primary animate-pulse font-medium">
              <RefreshCcw className="h-3 w-3 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{t('today')}</CardTitle>
               <a href="#history-section" className="cursor-pointer">
                <Badge variant="secondary">{n(stats.todaysLists.length)} {t('lists')}</Badge>
              </a>
          </CardHeader>
          <CardContent>
              <p className="text-2xl font-bold">{config?.currency}{n(stats.todaySpend, {decimals: 2})}</p>
          </CardContent>
          <div className="grid grid-cols-2 text-sm font-medium border-t">
              <Link href="/summary/all/today" className="text-center p-3 hover:bg-accent/50 transition-colors">
                  <p className="text-muted-foreground">{t('totalItemsCreated')}</p>
                  <p className="font-bold text-lg">{n(stats.tCreated)}</p>
              </Link>
              <Link href="/summary/bought/today" className="text-center p-3 hover:bg-accent/50 transition-colors border-l">
                  <p className="text-muted-foreground">{t('totalItemsBought')}</p>
                  <p className="font-bold text-lg text-primary">{n(stats.tBought)}</p>
              </Link>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">{t('month')}</CardTitle>
                    <Link href={`/reports?filter=month&value=${getMonth(new Date())}-${getYear(new Date())}`}>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20">{n(stats.mCount)} {t('lists')}</Badge>
                    </Link>
                </CardHeader>
                <CardContent>
                    <p className="text-xl font-bold">{config?.currency}{n(stats.monthSpend, {decimals: 2})}</p>
                </CardContent>
                <div className="grid grid-cols-2 text-xs font-medium border-t">
                    <Link href={`/summary/all/${getMonth(new Date())}-${getYear(new Date())}`} className="text-center p-2 hover:bg-accent/50 transition-colors">
                        <p className="text-muted-foreground">{t('totalItemsCreated')}</p>
                        <p className="font-bold text-base">{n(stats.mCreated)}</p>
                    </Link>
                    <Link href={`/summary/bought/${getMonth(new Date())}-${getYear(new Date())}`} className="text-center p-2 hover:bg-accent/50 transition-colors border-l">
                        <p className="text-muted-foreground">{t('totalItemsBought')}</p>
                        <p className="font-bold text-base text-primary">{n(stats.mBought)}</p>
                    </Link>
                </div>
            </Card>
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">{t('year')}</CardTitle>
                     <Link href={`/reports?filter=year&value=${getYear(new Date())}`}>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20">{n(stats.yCount)} {t('lists')}</Badge>
                     </Link>
                </CardHeader>
                <CardContent>
                    <p className="text-xl font-bold">{config?.currency}{n(stats.yearSpend, {decimals: 2})}</p>
                </CardContent>
                <div className="grid grid-cols-2 text-xs font-medium border-t">
                     <Link href={`/summary/all/${getYear(new Date())}`} className="text-center p-2 hover:bg-accent/50 transition-colors">
                        <p className="text-muted-foreground">{t('totalItemsCreated')}</p>
                        <p className="font-bold text-base">{n(stats.yCreated)}</p>
                    </Link>
                    <Link href={`/summary/bought/${getYear(new Date())}`} className="text-center p-2 hover:bg-accent/50 transition-colors border-l">
                        <p className="text-muted-foreground">{t('totalItemsBought')}</p>
                        <p className="font-bold text-base text-primary">{n(stats.yBought)}</p>
                    </Link>
                </div>
            </Card>
        </div>
      </div>

      <div className="space-y-4">
        <Button size="lg" className="w-full h-14 text-lg shadow-md hover:shadow-lg transition-shadow" onClick={handleNewList} disabled={isCreatingList}>
          {isCreatingList ? <><Loader2 className="mr-2 h-6 w-6 animate-spin" />{t('creatingList')}...</> : <><Plus className="mr-2 h-6 w-6" /> {t('newMarketList')}</>}
        </Button>
        <Link href="/reports" passHref>
          <Button size="lg" variant="outline" className="w-full h-14 text-lg"><BarChart2 className="mr-2 h-6 w-6" /> {t('reportsTitle')}</Button>
        </Link>
      </div>
      
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>{listToDelete ? t('deleteListConfirm') : t('deleteSelectedConfirm', { count: n(selectedLists.length) })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setListToDelete(null); setShowDeleteConfirmDialog(false); }}>{t('cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('deleteBtn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div id="history-section">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{t('history')}</h3>
              <Badge variant="secondary">{n(stats.todaysLists.length)}</Badge>
            </div>
            {stats.todaysLists.length > 0 && (
                <div className="flex items-center gap-2">
                    <Checkbox id="sel-all-l" checked={selectedLists.length === stats.todaysLists.length} onCheckedChange={(c) => setSelectedLists(c ? stats.todaysLists.map(l => l.id) : [])} />
                    <Label htmlFor="sel-all-l" className="text-sm font-medium">{t('selectAll')}</Label>
                    <Button variant="destructive" size="sm" disabled={selectedLists.length === 0} onClick={() => setShowDeleteConfirmDialog(true)}><Trash2 className="mr-2 h-4 w-4" />{t('deleteBtn')} ({n(selectedLists.length)})</Button>
                </div>
            )}
        </div>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {stats.todaysLists.length > 0 ? (
              stats.todaysLists.map((list, idx) => {
                const lDate = parseISO(list.datetime);
                return (
                  <div key={list.id} className="flex items-center gap-2">
                      <Checkbox checked={selectedLists.includes(list.id)} onCheckedChange={(c) => handleListSelect(list.id, !!c)} className="my-auto" />
                      <Link href={`/market/${list.id}`} className="flex-1" onClick={() => window.history.pushState(null, '', '#history-section')}>
                        <Card className="hover:bg-accent/50 transition-colors active:scale-[.98]">
                          <CardContent className="p-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-black text-primary/80 min-w-[20px] text-center">{n(stats.todaysLists.length - idx)}</span>
                              <div>
                                <p className="font-semibold truncate max-w-[150px]">{list.name || d(lDate, 'p')}</p>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                  <span>{d(lDate, 'MMMM d, p')}</span>
                                  <span>·</span>
                                  <span>{t('statusTxt', { b: n(list.items.filter(i => i.bought).length), t: n(list.items.length) })}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-primary">{config?.currency}{n(list.items.filter(i => i.bought).reduce((s, i) => s + (i.price || 0), 0), {decimals: 2})}</p>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                       <Button variant="ghost" size="icon" className="text-destructive h-9 w-9" onClick={() => { setListToDelete(list.id); setShowDeleteConfirmDialog(true); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )
              })
            ) : (
              <Card><CardContent className="p-6 text-center text-muted-foreground flex flex-col items-center gap-4"><BookOpen className="w-12 h-12 text-gray-300" /><p>{t('noHistory')}</p></CardContent></Card>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
