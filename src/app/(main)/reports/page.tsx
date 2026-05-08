'use client';

import { useAuth } from '@/hooks/use-auth';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MarketList } from '@/lib/types';
import { getMonth, getYear, isValid, parseISO, format } from 'date-fns';
import Link from 'next/link';
import { BookOpen, ArrowLeft, Trash2, Download, Share2, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from '@/components/ui/checkbox';
import { T, N, D } from '@/lib/countries';


export default function ReportsPage() {
  const { db, undoableUpdateDb, config, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterType, setFilterType] = useState(searchParams.get('filter') || 'month');
  const [selectedMonth, setSelectedMonth] = useState<string>( (filterType === 'month' && searchParams.get('value')) || 'all');
  const [selectedYear, setSelectedYear] = useState<string>( (filterType === 'year' && searchParams.get('value')) || 'all');
  const [searchDate, setSearchDate] = useState<string>('');
  
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  
  const t = useCallback((key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options), [config?.lang]);
  const n = useCallback((num: number | string, options?: { decimals?: number }): string => N(num, config?.lang, options), [config?.lang]);
  const d = useCallback((date: Date | number, formatStr: string): string => D(new Date(date), formatStr, config?.lang, config?.country), [config?.lang, config?.country]);

  useEffect(() => {
    const filter = searchParams.get('filter');
    const value = searchParams.get('value');
    if (filter) {
      setFilterType(filter);
      if (filter === 'month' && value) {
        setSelectedMonth(value);
        setSelectedYear('all');
        setSearchDate('');
      } else if (filter === 'year' && value) {
        setSelectedYear(value);
        setSelectedMonth('all');
        setSearchDate('');
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const id = window.location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [db.length]);

  const { grandTotal, totalItemsBought: grandTotalItemsBought, totalItemsCreated: grandTotalItemsCreated, totalLists } = useMemo(() => {
    if (!db || db.length === 0) return { grandTotal: 0, totalItemsBought: 0, totalItemsCreated: 0, totalLists: 0 };
    
    const relevantLists = db.filter(list => list && list.datetime && isValid(parseISO(list.datetime)) && Array.isArray(list.items) && list.items.length > 0);

    const total = relevantLists.reduce((acc, list) => {
      const boughtItems = list.items.filter(item => item.bought).length;
      const listTotal = list.items.filter(i => i.bought).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      const totalItemsInList = list.items.length;

      return {
        totalSpent: acc.totalSpent + listTotal,
        itemsBought: acc.itemsBought + boughtItems,
        itemsCreated: acc.itemsCreated + totalItemsInList,
      };
    }, { totalSpent: 0, itemsBought: 0, itemsCreated: 0 });

    return { grandTotal: total.totalSpent, totalItemsBought: total.itemsBought, totalItemsCreated: total.itemsCreated, totalLists: relevantLists.length };
  }, [db]);


  const { groupedLists, monthOptions, yearOptions, filteredListCount, monthlySummary, sortedLists } = useMemo(() => {
    if (!db || db.length === 0) return { groupedLists: {}, monthOptions: [], yearOptions: [], filteredListCount: 0, monthlySummary: null, sortedLists: [] };
    const relevantLists = db.filter(list => list && list.datetime && isValid(parseISO(list.datetime)) && Array.isArray(list.items) && list.items.length > 0);

    let filtered = relevantLists;
    let monthlySummaryData = null;

    if (filterType === 'date' && searchDate) {
      filtered = filtered.filter(list => format(parseISO(list.datetime), 'yyyy-MM-dd') === searchDate);
    } else if (filterType === 'month' && selectedMonth !== 'all') {
      const [month, year] = selectedMonth.split('-').map(Number);
      if (!isNaN(month) && !isNaN(year)) {
        filtered = filtered.filter(list => {
          const listDate = parseISO(list.datetime);
          return getMonth(listDate) === month && getYear(listDate) === year;
        });
      }
    } else if (filterType === 'year' && selectedYear !== 'all') {
       filtered = filtered.filter(list => {
        const listDate = parseISO(list.datetime);
        return getYear(listDate) === Number(selectedYear);
      });
    }

    if( (filterType === 'month' && selectedMonth !== 'all') || (filterType === 'year' && selectedYear !== 'all') ) {
        let totalSpent = 0;
        let totalItemsCreated = 0;
        let totalItemsBought = 0;
        
        filtered.forEach(list => {
            totalItemsCreated += list.items.length;
            const boughtItems = list.items.filter(item => item.bought);
            totalItemsBought += boughtItems.length;
            totalSpent += boughtItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        });

        monthlySummaryData = {
            totalSpent,
            totalLists: filtered.length,
            totalItemsCreated,
            totalItemsBought,
        }
    }
    
    const uniqueMonths = new Set<string>();
    relevantLists.forEach(list => {
      const listDate = parseISO(list.datetime);
      if (isValid(listDate)) {
        uniqueMonths.add(`${getMonth(listDate)}-${getYear(listDate)}`);
      }
    });

    const monthOptions = Array.from(uniqueMonths).map(monthStr => {
        const [month, year] = monthStr.split('-').map(Number);
        const date = new Date(year, month);
        return {
          value: monthStr,
          label: d(date, 'MMMM yyyy'),
        }
    });

    const yearOptions = Array.from(
      new Set(relevantLists.map(list => getYear(parseISO(list.datetime)).toString()))
    ).map(yearStr => ({ value: yearStr, label: n(yearStr) }));


    const sorted = filtered.sort((a, b) => parseISO(b.datetime).getTime() - parseISO(a.datetime).getTime());

    const grouped = sorted.reduce((acc, list) => {
      const dateKey = format(parseISO(list.datetime), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = {
          lists: [],
          totalSpent: 0,
          totalItems: 0,
          totalItemsBought: 0,
        };
      }
      
      acc[dateKey].lists.push(list);
      acc[dateKey].totalSpent += list.items.filter(i => i.bought).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      acc[dateKey].totalItems += list.items.length;
      acc[dateKey].totalItemsBought += list.items.filter(i => i.bought).length;
      return acc;
    }, {} as Record<string, {lists: MarketList[], totalSpent: number, totalItems: number, totalItemsBought: number}>);


    return { groupedLists: grouped, monthOptions, yearOptions, filteredListCount: sorted.length, monthlySummary: monthlySummaryData, sortedLists: sorted };
  }, [db, selectedMonth, selectedYear, searchDate, filterType, d, n]);
  
  const handleDelete = () => {
    let idsToDelete: string[] = [];
    if (listToDelete) {
        idsToDelete = [listToDelete];
    } else if (selectedLists.length > 0) {
        idsToDelete = selectedLists;
    } else {
        return;
    }

    const deletedCount = idsToDelete.length;
    const idsToDeleteSet = new Set(idsToDelete);

    undoableUpdateDb(
        (currentDb) => currentDb.filter(list => !idsToDeleteSet.has(list.id)),
        {
            title: t('listFrom', { count: n(deletedCount) }),
            description: t('removed', { count: n(deletedCount) }),
        }
    );

    setSelectedLists([]);
    setListToDelete(null);
    setShowDeleteConfirmDialog(false);
  };
  

  const handleFilterTypeChange = (value: string) => {
    setFilterType(value);
    setSelectedMonth('all');
    setSelectedYear('all');
    setSearchDate('');
    setSelectedLists([]);
    router.replace('/reports');
  }

  const resetFilters = () => {
    setFilterType('month');
    setSelectedMonth('all');
    setSelectedYear('all');
    setSearchDate('');
    setSelectedLists([]);
    router.replace('/reports');
  }
  
  const handleListSelect = (listId: string, checked: boolean) => {
    if (checked) {
        setSelectedLists(prev => [...prev, listId]);
    } else {
        setSelectedLists(prev => prev.filter(id => id !== listId));
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedLists(sortedLists.map(list => list.id));
    } else {
        setSelectedLists([]);
    }
  };

  // Improved loading UI
  if (authLoading && db.length === 0) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">{t('loadingSuggestions')}...</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {listToDelete 
                  ? t('deleteListConfirm') 
                  : t('deleteSelectedConfirm', { count: n(selectedLists.length) })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setListToDelete(null);
              setShowDeleteConfirmDialog(false);
            }}>{t('cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('deleteBtn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/home')}>
            <ArrowLeft />
        </Button>
        <div className='flex items-center gap-2'>
            <h1 className="text-2xl font-bold">{t('reportsTitle')}</h1>
            <Badge variant="secondary" onClick={resetFilters} className="cursor-pointer hover:bg-primary/20">{n(totalLists)}</Badge>
        </div>
      </div>
       <p className="text-muted-foreground -mt-4 ml-12">{t('repMsg')}</p>

      <Card className="bg-primary/10 border-none shadow-none">
        <CardHeader className='pb-2'>
          <CardTitle className="text-xs uppercase tracking-wider text-primary/70">{t('grandTotal')}</CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-3xl font-black text-primary">{config?.currency}{n(grandTotal, {decimals: 2})}</p>
           <Separator className='my-4 bg-primary/20' />
           <div className="grid grid-cols-3 text-sm text-center gap-2">
              <div role="button" onClick={resetFilters} className='block p-2 rounded-md hover:bg-white/50 cursor-pointer transition-colors text-center'>
                  <p className='font-bold text-lg'>{n(totalLists)}</p>
                  <p className='text-[10px] uppercase text-muted-foreground'>{t('totalLists')}</p>
              </div>
              <Link href="/summary/all/all-time" className='block p-2 rounded-md hover:bg-white/50 cursor-pointer transition-colors text-center'>
                  <p className='font-bold text-lg'>{n(grandTotalItemsCreated)}</p>
                  <p className='text-[10px] uppercase text-muted-foreground'>{t('totalItems')}</p>
              </Link>
              <Link href="/summary/bought/all-time" className='block p-2 rounded-md hover:bg-white/50 cursor-pointer transition-colors text-center'>
                  <p className='font-bold text-lg'>{n(grandTotalItemsBought)}</p>
                  <p className='text-[10px] uppercase text-muted-foreground'>{t('totalBought')}</p>
              </Link>
           </div>
        </CardContent>
      </Card>

      <Card className='shadow-sm'>
        <CardHeader className="flex-row items-center justify-between pb-2">
           <CardTitle className="text-base font-bold">{t('searchByDateAndMonth')}</CardTitle>
           <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs text-muted-foreground"><RefreshCw className="mr-1 h-3 w-3"/> {t('reset')}</Button>
        </CardHeader>
        <CardContent>
          <Tabs value={filterType} onValueChange={handleFilterTypeChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="month" className='text-xs'>{t('month')}</TabsTrigger>
              <TabsTrigger value="year" className='text-xs'>{t('year')}</TabsTrigger>
              <TabsTrigger value="date" className='text-xs'>{t('date')}</TabsTrigger>
            </TabsList>
            <TabsContent value="month" className="pt-4">
              <div className="space-y-2">
                <Label htmlFor="month-filter" className='text-xs'>{t('filterByMonth')}</Label>
                <Select onValueChange={setSelectedMonth} value={selectedMonth}>
                  <SelectTrigger id="month-filter" className='h-10'>
                    <SelectValue placeholder={t('filterByMonth')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allMonths')}</SelectItem>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
             <TabsContent value="year" className="pt-4">
              <div className="space-y-2">
                <Label htmlFor="year-filter" className='text-xs'>{t('filterByYear')}</Label>
                <Select onValueChange={setSelectedYear} value={selectedYear}>
                  <SelectTrigger id="year-filter" className='h-10'>
                    <SelectValue placeholder={t('filterByYear')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allYears')}</SelectItem>
                    {yearOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="date" className="pt-4">
              <div className="space-y-2">
                <Label htmlFor="date-search" className='text-xs'>{t('searchByDate')}</Label>
                <Input 
                  type="date"
                  id="date-search"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className='h-10'
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

    {monthlySummary && (filterType === 'month' && selectedMonth !== 'all' || filterType === 'year' && selectedYear !== 'all') && (
        <Card className="bg-secondary/30 border-none shadow-none">
            <CardHeader className='pb-2'>
                <CardTitle className="text-xs uppercase tracking-wider text-secondary-foreground/70">
                    {t('summaryFor')} {filterType === 'month' ? monthOptions.find(opt => opt.value === selectedMonth)?.label : n(selectedYear)}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className='flex items-baseline gap-2'>
                    <p className="text-3xl font-black text-primary">{config?.currency}{n(monthlySummary.totalSpent, {decimals: 2})}</p>
                    <p className="text-xs text-muted-foreground font-medium uppercase">{t('totalSpent')}</p>
                </div>
                <Separator className="my-4 opacity-50" />
                <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-1">
                        <p className="font-bold text-lg">{n(monthlySummary.totalLists)}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{t('totalLists')}</p>
                    </div>

                    <Link href={`/summary/all/${filterType === 'month' ? selectedMonth : selectedYear}`} className="text-center cursor-pointer p-1 rounded-md hover:bg-white/50 transition-colors">
                        <p className="font-bold text-lg">{n(monthlySummary.totalItemsCreated)}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{t('totalItems')}</p>
                    </Link>
                    
                    <Link href={`/summary/bought/${filterType === 'month' ? selectedMonth : selectedYear}`} className="text-center cursor-pointer p-1 rounded-md hover:bg-white/50 transition-colors">
                        <p className="font-bold text-lg">{n(monthlySummary.totalItemsBought)}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{t('itemsBought')}</p>
                    </Link>
                </div>
            </CardContent>
        </Card>
    )}
    
    <div>
        {sortedLists.length > 0 && (
          <div className="mt-4 p-2 bg-muted/30 rounded-lg flex items-center justify-between border">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="select-all"
                  checked={selectedLists.length === sortedLists.length && sortedLists.length > 0}
                  onCheckedChange={handleToggleSelectAll}
                />
                <Label htmlFor="select-all" className="text-xs font-bold uppercase">{t('selectAll')}</Label>
              </div>
              <div className='flex items-center gap-2'>
                <Button variant="destructive" size="sm" className='h-8 text-xs font-bold' disabled={selectedLists.length === 0} onClick={() => { setListToDelete(null); setShowDeleteConfirmDialog(true); }}>
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t('deleteBtn')} ({n(selectedLists.length)})
                </Button>
              </div>
          </div>
        )}

        <div className="space-y-6 mt-4 pb-20">
          {Object.keys(groupedLists).length > 0 ? (
              Object.entries(groupedLists).map(([date, group]) => (
                <div key={date} className='bg-card border rounded-xl overflow-hidden shadow-sm'>
                    <Link href={`/summary/day/${date}`} passHref>
                        <div className="bg-muted/50 p-4 cursor-pointer hover:bg-muted/80 flex justify-between items-center transition-colors group">
                            <div className='space-y-1'>
                                <p className="font-black text-lg text-foreground">{d(parseISO(date), 'MMMM d, yyyy')}</p>
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex gap-4">
                                    <span>{t('totalLists')}: <span className="font-bold text-foreground">{n(group.lists.length)}</span></span>
                                    <span>{t('totalItems')}: <span className="font-bold text-foreground">{n(group.totalItems)}</span></span>
                                    <span>{t('totalBought')}: <span className="font-bold text-foreground">{n(group.totalItemsBought)}</span></span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <p className="font-black text-primary text-xl">{config?.currency}{n(group.totalSpent, {decimals: 2})}</p>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                        </div>
                    </Link>
                  <Separator />
                  <div className="p-3 space-y-2">
                      {group.lists.map((list, listIndex) => {
                        const originalListIndex = sortedLists.findIndex(sortedList => sortedList.id === list.id);
                        const listNumber = sortedLists.length - originalListIndex;
                        const listDate = parseISO(list.datetime);
                        if (!isValid(listDate)) return null;
                        const boughtItems = list.items.filter(item => item.bought).length;
                        const totalItems = list.items.length;

                        return (
                        <div key={list.id} id={list.id} className="flex items-center gap-3">
                          <Checkbox
                                id={`select-${list.id}`}
                                checked={selectedLists.includes(list.id)}
                                onCheckedChange={(checked) => handleListSelect(list.id, !!checked)}
                                className="h-5 w-5"
                            />
                          <Link href={`/market/${list.id}?from=reports`} className="flex-1 group" onClick={(e) => {
                                const currentHash = window.location.hash;
                                if(currentHash !== `#${list.id}`) {
                                    window.history.pushState(null, '', `#${list.id}`);
                                }
                            }}>
                                <Card className="border-none shadow-none bg-accent/5 group-hover:bg-accent/20 transition-all duration-200 rounded-lg">
                                  <CardContent className="p-3 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                      <span className="text-xl font-black text-primary/20 min-w-[30px] group-hover:text-primary/50 transition-colors">{n(listNumber)}</span>
                                      <div className='min-w-0'>
                                        <p className="font-bold text-sm truncate max-w-[140px] md:max-w-xs">{list.name || d(listDate, 'p')}</p>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground/70 flex items-center gap-2 mt-0.5">
                                          <span>{d(listDate, 'p')}</span>
                                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                                          <span>{t('statusTxt', { b: n(boughtItems), t: n(totalItems) })}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-2">
                                      <p className="font-black text-primary text-sm whitespace-nowrap">{config?.currency}{n(list.items.filter(item => item.bought).reduce((sum, item) => sum + (Number(item.price) || 0), 0), {decimals: 2})}</p>
                                      <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                                    </div>
                                  </CardContent>
                                </Card>
                              </Link>
                          <Button variant="ghost" size="icon" className="text-destructive/50 hover:text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0" onClick={() => { setListToDelete(list.id); setShowDeleteConfirmDialog(true); }}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )})}
                    </div>
                </div>
              ))
          ) : (
            <Card className='border-dashed'>
              <CardContent className="p-16 text-center text-muted-foreground flex flex-col items-center gap-6">
                <div className='p-4 bg-muted/30 rounded-full'>
                    <BookOpen className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <div className='space-y-1'>
                    <p className='text-lg font-bold text-foreground'>{t('noReports')}</p>
                    <p className='text-sm'>{t('noHistory')}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
    </div>
    </div>
  );
}
