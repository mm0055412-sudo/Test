
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useParams, useRouter } from 'next/navigation';
import { format, parse, isValid, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ItemCard } from '@/components/market/ItemCard';
import { ItemSuggestions } from '@/components/market/ItemSuggestions';
import { MarketList, MarketItem } from '@/lib/types';
import { Plus, ArrowLeft, Receipt, Loader2, Save, AlertTriangle, ClipboardPaste, Copy, X, Trash2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { T, N, D } from '@/lib/countries';


const DRAFT_STORAGE_KEY = 'newMarketListDraft';
const COPIED_ITEMS_KEY = 'copiedMarketItems';


export default function MarketPage() {
  const { id: listIdParam } = useParams();
  const router = useRouter();
  const { db, updateDb, undoableUpdateDb, config, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const listId = Array.isArray(listIdParam) ? listIdParam[0] : listIdParam;
  const isNew = listId === 'new';
  
  const t = useCallback((key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options), [config?.lang]);
  const n = useCallback((num: number | string, options?: { decimals?: number }): string => N(num, config?.lang, options), [config?.lang]);
  const d = useCallback((date: Date | number, formatStr: string): string => D(new Date(date), formatStr, config?.lang, config?.country), [config?.lang, config?.country]);

  const [currentList, setCurrentList] = useState<MarketList | null>(null);
  const [listName, setListName] = useState<string>('');
  const [marketDate, setMarketDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [items, setItems] = useState<MarketItem[]>([]);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [hasCopiedItems, setHasCopiedItems] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [openCalculatorId, setOpenCalculatorId] = useState<string | null>(null);
  
  const initializedId = useRef<string | null>(null);

  const checkCopiedItems = useCallback(() => {
    const copied = localStorage.getItem(COPIED_ITEMS_KEY);
    setHasCopiedItems(!!copied);
  }, []);

  useEffect(() => {
    checkCopiedItems();
    window.addEventListener('storage', checkCopiedItems);
    return () => window.removeEventListener('storage', checkCopiedItems);
  }, [checkCopiedItems]);

  // Optimized load effect to prevent loops and ensure fast initialization
  useEffect(() => {
    if (authLoading || initializedId.current === listId) return;

    if (isNew) {
      const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draftJson) {
        try {
          const draftList: Partial<MarketList> = JSON.parse(draftJson);
          setListName(draftList.name || '');
          setItems(draftList.items || []);
        } catch (e) { console.error("Draft parse error", e); }
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const dateParam = urlParams.get('date');
      if (dateParam && isValid(parseISO(dateParam))) {
        setMarketDate(format(parseISO(dateParam), 'yyyy-MM-dd'));
      }
      setIsReady(true);
      initializedId.current = listId;
    } else {
      const listFromDb = db.find(l => l.id === listId);
      if (listFromDb) {
        setCurrentList(listFromDb);
        setListName(listFromDb.name || '');
        const listDate = parseISO(listFromDb.datetime);
        setMarketDate(format(isValid(listDate) ? listDate : new Date(), 'yyyy-MM-dd'));
        setItems(listFromDb.items || []);
        setIsReady(true);
        initializedId.current = listId;
      } else if (db.length > 0) {
        toast({ variant: 'destructive', title: t('listNotFoundTitle'), description: t('listNotFoundDesc') });
        router.replace('/home');
      }
    }
  }, [listId, isNew, authLoading, db, t, router, toast]);

  // Fast sync draft to storage without blocking UI
  useEffect(() => {
    if (isReady && isNew) {
      const timer = setTimeout(() => {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ name: listName, items }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [items, listName, isNew, isReady]);

  const handleBackNavigation = useCallback(() => {
    if (isNew && items.length > 0) {
      setShowConfirmDialog(true);
    } else {
      router.back();
    }
  }, [isNew, items.length, router]);

  const handleViewBill = useCallback(() => {
    const listForBill: MarketList = {
      id: currentList?.id || 'new-bill',
      name: listName,
      date: marketDate,
      datetime: currentList?.datetime || new Date().toISOString(),
      items: items,
      status: currentList?.status || 'draft',
    };

    const url = `/bill/${listForBill.id}`;
    window.history.pushState({ list: listForBill }, '', url);
    router.push(url);
  }, [currentList, listName, marketDate, items, router]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (newDate && isValid(parse(newDate, 'yyyy-MM-dd', new Date()))) {
      setMarketDate(newDate);
    }
  };

  const addItem = useCallback((name: string) => {
    if (name.trim() === '' || isAdding) return;

    setIsAdding(true);
    const newItem: MarketItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      rate: 0,
      rateQty: 0,
      rateUnit: 'none',
      qty: 0,
      unit: 'none',
      price: 0,
      bought: false,
    };
    
    setItems(prev => [...prev, newItem]);
    setNewItemName('');
    setIsAdding(false);
  }, [isAdding]);

  const handleAddItem = () => addItem(newItemName);

  const handleFinalizeList = useCallback(() => {
    if (items.length === 0) {
      toast({ variant: "destructive", title: t('emptyListTitle'), description: t('emptyListDesc') });
      return;
    }
    setIsSaving(true);
    
    const datePart = parse(marketDate, 'yyyy-MM-dd', new Date());
    const now = new Date();
    datePart.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    const isoDateTime = isNew ? datePart.toISOString() : (currentList?.datetime || datePart.toISOString());

    const listData: MarketList = {
      id: isNew ? `list-${datePart.getTime()}` : listId,
      name: listName || `${t('marketList')} - ${d(datePart, 'yyyy-MM-dd')}`,
      date: marketDate,
      datetime: isoDateTime,
      items: items,
      status: 'active'
    };

    updateDb(currentDb => {
        if (isNew) {
            return [listData, ...currentDb];
        }
        return currentDb.map(list => list.id === listId ? listData : list);
    });

    if (isNew) localStorage.removeItem(DRAFT_STORAGE_KEY);
    
    toast({ title: t('listFinalizedTitle'), description: t('listFinalizedDesc') });
    router.push('/home');
    setIsSaving(false);
  }, [items, marketDate, isNew, listId, listName, t, d, updateDb, router, currentList?.datetime, toast]);
  
  const handleUpdateItem = useCallback((updatedItem: MarketItem) => {
    setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedItems.length === 0) return;
    const deletedCount = selectedItems.length;
    const idsToDeleteSet = new Set(selectedItems);

    const originalItems = [...items];
    setItems(prev => prev.filter(item => !idsToDeleteSet.has(item.id)));
    
    toast({
        title: t('itemsDeletedTitle', { count: n(deletedCount) }),
        description: t('itemsDeletedDesc', { count: n(deletedCount) }),
        action: <Button variant="secondary" size="sm" onClick={() => setItems(originalItems) }>{t('undoBtn')}</Button>,
        duration: 4000,
    });
    
    setSelectedItems([]);
    setShowDeleteConfirmDialog(false);
  }, [selectedItems, items, t, n, toast]);

  const handlePasteItems = useCallback(() => {
    const copiedJson = localStorage.getItem(COPIED_ITEMS_KEY);
    if (!copiedJson) return;
    try {
        const copiedItems: MarketItem[] = JSON.parse(copiedJson);
        const newItems = copiedItems.map(item => ({
            ...item,
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        }));
        setItems(prev => [...prev, ...newItems]);
        localStorage.removeItem(COPIED_ITEMS_KEY);
        checkCopiedItems();
        toast({ title: t('itemsPastedTitle'), description: t('itemsPastedDesc', { count: n(newItems.length) }) });
    } catch (e) { toast({ variant: 'destructive', title: t('pasteFailedTitle'), description: t('pasteFailedDesc') }); }
  }, [t, n, checkCopiedItems, toast]);

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedItems(checked ? items.map(item => item.id) : []);
  };

  const handleItemSelect = useCallback((itemId: string, checked: boolean) => {
    setSelectedItems(prev => checked ? [...prev, itemId] : prev.filter(id => id !== itemId));
  }, []);
  
  const handleToggleCalculator = useCallback((itemId: string) => {
    setOpenCalculatorId(prevId => (prevId === itemId ? null : itemId));
  }, []);

  const stats = useMemo(() => {
    const boughtItemsList = items.filter(item => item.bought);
    return {
      totalItems: items.length,
      boughtItems: boughtItemsList.length,
      totalSpent: boughtItemsList.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
      grandTotal: items.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    };
  }, [items]);

  const reversedItems = useMemo(() => [...items].reverse(), [items]);

  if (authLoading || !isReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-24">
       <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive" /> {t('areYouSure')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('unsavedChangesMsg')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => router.back()}>{t('leavePageBtn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{t('areYouSure')}</AlertDialogTitle>
                <AlertDialogDescription>{t('deleteSelectedConfirm', { count: n(selectedItems.length) })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{t('cancelBtn')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSelected}>{t('deleteBtn')}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>

      <header className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm pt-4 pb-2">
        <div className="flex items-center justify-between mb-2 gap-2">
          <Button variant="ghost" size="icon" onClick={handleBackNavigation}><ArrowLeft /></Button>
          <Input type="date" value={marketDate} onChange={handleDateChange} readOnly={!isNew} className="w-auto font-bold text-center border-none text-lg focus-visible:ring-1" />
          <Button onClick={handleFinalizeList} disabled={isSaving || items.length === 0}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            <span>{isNew ? t('save') : t('update')}</span>
          </Button>
        </div>
        
        <div className="mb-4">
          <Label htmlFor="list-name" className="text-xs text-muted-foreground">{t('listName')}</Label>
          <Input id="list-name" value={listName} onChange={(e) => setListName(e.target.value)} placeholder={t('listNamePlaceholder')} className="font-bold text-lg" />
        </div>

        <Card className="shadow-md">
          <CardContent className="p-3">
            <div className="flex gap-2 relative">
              <Input placeholder={t('itemName')} value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddItem()} className="font-semibold" disabled={isAdding} />
              <Button onClick={handleAddItem} disabled={isAdding || newItemName.trim() === ''}>
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
              {newItemName.length > 1 && <ItemSuggestions partialItemName={newItemName} onSelect={(name) => { setNewItemName(name); addItem(name); }} />}
            </div>
             {hasCopiedItems && (
                <div className="flex gap-2 w-full mt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={handlePasteItems}><ClipboardPaste className="mr-2 h-4 w-4" />{t('pasteItems')}</Button>
                  <Button variant="destructive" size="icon" onClick={() => { localStorage.removeItem(COPIED_ITEMS_KEY); checkCopiedItems(); }}><X className="h-4 w-4" /></Button>
                </div>
            )}
          </CardContent>
        </Card>

        {items.length > 0 && (
          <div className="mt-4 p-2 bg-muted/50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="select-all" checked={selectedItems.length === items.length} onCheckedChange={handleToggleSelectAll} />
                <Label htmlFor="select-all" className="text-sm font-medium">{t('selectAll')}</Label>
              </div>
              <div className='flex items-center gap-2'>
                <Button size="sm" onClick={() => {
                  const toStore = items.filter(i => selectedItems.includes(i.id)).map(i => ({...i, bought: false, price: 0}));
                  localStorage.setItem(COPIED_ITEMS_KEY, JSON.stringify(toStore));
                  checkCopiedItems();
                  toast({ title: t('itemsCopiedTitle'), description: t('itemsCopiedDesc', { count: n(toStore.length) }) });
                  setSelectedItems([]);
                }} disabled={selectedItems.length === 0}><Copy className="mr-2 h-4 w-4" />{t('copySelected')} ({n(selectedItems.length)})</Button>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirmDialog(true)} disabled={selectedItems.length === 0}><Trash2 className="mr-2 h-4 w-4" />{t('deleteBtn')} ({n(selectedItems.length)})</Button>
              </div>
          </div>
        )}
      </header>

      <main className="pt-2">
        {reversedItems.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
            <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={(checked) => handleItemSelect(item.id, !!checked)} className="my-auto" />
            <div className="flex-1">
              <ItemCard 
                item={item} 
                index={items.length - index} 
                onUpdate={handleUpdateItem} 
                onDelete={() => { setSelectedItems([item.id]); setShowDeleteConfirmDialog(true); }} 
                isCalculatorOpen={openCalculatorId === item.id}
                onToggleCalculator={() => handleToggleCalculator(item.id)}
              />
            </div>
          </div>
        ))}
      </main>
      
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-sm z-30">
        <div className="container mx-auto max-w-2xl p-3 flex items-center justify-between">
          <Button variant="outline" onClick={handleViewBill}><Receipt className="mr-2 h-4 w-4" />{t('viewBill')}</Button>
          <div className="text-right">
            <div className="grid grid-cols-2 gap-x-4 text-sm">
                <span className="text-muted-foreground">{t('itemsCreated')}: <span className="font-bold text-foreground">{n(stats.totalItems)}</span></span>
                <span className="text-muted-foreground">{t('itemsBought')}: <span className="font-bold text-foreground">{n(stats.boughtItems)}</span></span>
            </div>
            <div className="text-sm font-semibold mt-1">{t('footSpent')}: {config?.currency}{n(stats.totalSpent, {decimals: 2})}</div>
            <div className="text-lg font-bold text-primary">{t('total')}: {config?.currency}{n(stats.grandTotal, {decimals: 2})}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
