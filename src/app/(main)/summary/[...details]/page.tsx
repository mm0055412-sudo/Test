'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { MarketItem, MarketList } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Share2, Download, Eye, Plus, Copy, ClipboardPaste, X, Trash2 } from 'lucide-react';
import { format, getMonth, getYear, isValid, isSameYear, parse, parseISO, isToday, startOfDay, isSameDay } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { createRoot } from 'react-dom/client';
import { InvoicePage } from '@/components/InvoicePage';
import { ItemCard } from '@/components/market/ItemCard';
import { ItemSuggestions } from '@/components/market/ItemSuggestions';
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
import { T, N, D } from '@/lib/countries';

const COPIED_ITEMS_KEY = 'copiedMarketItems';

type ItemWithListId = MarketItem & { __listId: string };


export default function MonthlySummaryPage() {
  const router = useRouter();
  const params = useParams();
  const { db, updateDb, undoableUpdateDb, config, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isEditable, setIsEditable] = useState(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newListName, setNewListName] = useState<string>('');
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [hasCopiedItems, setHasCopiedItems] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [openCalculatorId, setOpenCalculatorId] = useState<string | null>(null);
  
  const newItemInputRef = useRef<HTMLInputElement>(null);

  const { details } = params;
  const summaryType = Array.isArray(details) ? details[0] : 'all';
  const dateStr = Array.isArray(details) ? details.slice(1).join('/') : '';
  
  const t = useCallback((key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options), [config?.lang]);
  const n = useCallback((num: number | string, options?: { decimals?: number }): string => N(num, config?.lang, options), [config?.lang]);
  const d = useCallback((date: Date | number, formatStr: string): string => D(new Date(date), formatStr, config?.lang, config?.country), [config?.lang, config?.country]);

  const checkCopiedItems = useCallback(() => {
    const copied = localStorage.getItem(COPIED_ITEMS_KEY);
    setHasCopiedItems(!!copied);
  }, []);

  useEffect(() => {
    checkCopiedItems();
    window.addEventListener('storage', checkCopiedItems);
    return () => window.removeEventListener('storage', checkCopiedItems);
  }, [checkCopiedItems]);

  const processedData = useMemo(() => {
    if (authLoading || !db) {
      return { displayedItems: [], title: '', isEditable: false, shouldShowNewListUI: false, loading: true, error: null };
    }
  
    const pageIsEditable = summaryType !== 'bought' && dateStr !== 'all-time';
    let newItems: ItemWithListId[] = [];
    let newTitle = '';
    
    const allLists = [...db];
    
    if (summaryType === 'all' && dateStr === 'all-time') {
        newItems = allLists.flatMap(list => list.items ? list.items.map(i => ({...i, __listId: list.id})) : []);
        newTitle = `${t('allItems')} (${t('allTime')})`;
    } else if (summaryType === 'bought' && dateStr === 'all-time') {
        newItems = allLists.flatMap(list => list.items ? list.items.map(i => ({...i, __listId: list.id})) : []).filter(item => item.bought);
        newTitle = `${t('allBoughtItems')} (${t('allTime')})`;
    } else if (summaryType === 'day') {
        if (!dateStr || !isValid(parse(dateStr, 'yyyy-MM-dd', new Date()))) {
            return { displayedItems: [], title: '', isEditable: false, shouldShowNewListUI: false, loading: false, error: 'invalidDay' };
        }
        const dayDate = parse(dateStr, 'yyyy-MM-dd', new Date());
        const dayLabel = d(dayDate, 'MMMM d, yyyy');

        const filteredLists = allLists.filter(list => list && list.datetime && format(parseISO(list.datetime), 'yyyy-MM-dd') === dateStr);
        newItems = filteredLists.flatMap(list => list.items ? list.items.map(i => ({...i, __listId: list.id})) : []);
        newTitle = `${t('summaryFor')} ${dayLabel}`;
        
    } else if (dateStr === 'today') {
        const todaysLists = allLists.filter(l => l && l.datetime && isToday(parseISO(l.datetime)));
        const todaysItems = todaysLists.flatMap(l => l.items ? l.items.map(i => ({...i, __listId: l.id})) : []);
        
        if (summaryType === 'bought') {
            newItems = todaysItems.filter(item => item.bought);
            newTitle = `${t('billForToday')}`;
        } else { // summaryType === 'all'
            newItems = todaysItems;
            newTitle = `${t('allItemsForToday')}`;
        }
    } else if (dateStr.includes('-')) { // Month-Year
        const [month, year] = dateStr.split('-').map(Number);
        if (isNaN(month) || isNaN(year)) {
             return { displayedItems: [], title: '', isEditable: false, shouldShowNewListUI: false, loading: false, error: 'invalidMonthYear' };
        }
        
        const monthDate = new Date(year, month, 1);
        const monthLabel = isValid(monthDate) ? d(monthDate, 'MMMM yyyy') : t('invalidMonth');
        
        const filteredLists = allLists.filter(list => {
            const listDate = list && list.datetime ? parseISO(list.datetime) : null;
            return listDate && isValid(listDate) && getMonth(listDate) === month && getYear(listDate) === year;
        });

        const filteredItems = filteredLists.flatMap(l => l.items ? l.items.map(i => ({...i, __listId: l.id})) : []);
        
        if (summaryType === 'bought') {
            newItems = filteredItems.filter(item => item.bought);
            newTitle = `${t('bill')} for ${monthLabel}`;
        } else { // summaryType === 'all'
            newItems = filteredItems;
            newTitle = `${t('allItems')} for ${monthLabel}`;
        }
    } else if (!isNaN(Number(dateStr))) { // Year
         const year = Number(dateStr);
         const yearLabel = n(year);
         
         const filteredLists = allLists.filter(list => {
            const listDate = list && list.datetime ? parseISO(list.datetime) : null;
            return listDate && isValid(listDate) && isSameYear(listDate, new Date(year, 0, 1));
         });

         const filteredItems = filteredLists.flatMap(l => l.items ? l.items.map(i => ({...i, __listId: l.id})) : []);

        if (summaryType === 'bought') {
            newItems = filteredItems.filter(item => item.bought);
            newTitle = `${t('bill')} for ${yearLabel}`;
        } else { // summaryType === 'all'
            newItems = filteredItems;
            newTitle = `${t('allItems')} for ${yearLabel}`;
        }
    }
    
    let shouldShowNewListUI = false;
    if (pageIsEditable) {
        const todayString = format(new Date(), 'yyyy-MM-dd');
        const hasListForToday = allLists.some(list => list.datetime && format(parseISO(list.datetime), 'yyyy-MM-dd') === todayString);
        shouldShowNewListUI = !hasListForToday;
    }

    return { displayedItems: newItems, title: newTitle, isEditable: pageIsEditable, shouldShowNewListUI, loading: false, error: null };
  }, [db, authLoading, dateStr, summaryType, t, n, d]);

  useEffect(() => {
    if (processedData.error) {
        let errorDesc = '';
        if (processedData.error === 'invalidDay') errorDesc = t('invalidDay');
        if (processedData.error === 'invalidMonthYear') errorDesc = t('invalidMonthYear');
        toast({ variant: "destructive", title: t('invalidDate'), description: errorDesc });
        router.replace('/reports');
    } else {
        setTitle(processedData.title);
        setIsEditable(processedData.isEditable);
        setShowNewListInput(processedData.shouldShowNewListUI);
        setLoading(processedData.loading);
    }
  }, [processedData, router, t, toast]);
  

  const { displayedItems } = processedData;

  const { totalSpent, totalItems, boughtItems, grandTotal } = useMemo(() => {
    const boughtItemsList = displayedItems.filter(item => item.bought);
    return { 
      totalItems: displayedItems.length,
      boughtItems: boughtItemsList.length,
      totalSpent: boughtItemsList.reduce((acc, item) => acc + (Number(item.price) || 0), 0),
      grandTotal: displayedItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    };
  }, [displayedItems]);
  
  
  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return;
    
    const deletedCount = selectedItems.length;
    const idsToDeleteSet = new Set(selectedItems);

    undoableUpdateDb(
        (currentDb) =>
            currentDb.map(list => ({
                ...list,
                items: list.items ? list.items.filter(item => !idsToDeleteSet.has(item.id)) : [],
            })),
        {
            title: t('itemsDeletedTitle', { count: n(deletedCount) }),
            description: t('itemsDeletedDesc', { count: n(deletedCount) }),
        }
    );
    
    setSelectedItems([]);
    setShowDeleteConfirmDialog(false);
  };
    
  
    const handleUpdateItem = useCallback((updatedItem: ItemWithListId) => {
      const { __listId, ...itemData } = updatedItem;
      if (!__listId) return;
      
      updateDb(currentDb => {
        return currentDb.map(list => {
          if (list.id === __listId) {
            const newItems = (list.items || []).map(item => item.id === itemData.id ? itemData : item);
            return { ...list, items: newItems };
          }
          return list;
        });
      });
    }, [updateDb]);
  
    const getTargetDateForNewList = useCallback(() => {
        // When adding from a summary page, new items should always go to a list for *today*.
        // If on a specific day's summary that is today, it uses today. Otherwise, it defaults to today.
        if (summaryType === 'day' && dateStr === format(new Date(), 'yyyy-MM-dd')) {
            return parse(dateStr, 'yyyy-MM-dd', new Date());
        }
        return new Date();
    }, [summaryType, dateStr]);

  const addItem = useCallback((name: string) => {
    if (name.trim() === '' || !isEditable || isAdding || summaryType === 'bought') return;
    
    let listWasCreated = false;
    
    const newItem: MarketItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      rate: 0,
      rateQty: 0,
      rateUnit: 'kg',
      qty: 0,
      unit: 'kg',
      price: 0,
      bought: false,
    };
    
    updateDb(currentDb => {
        const newDb = [...currentDb];
        const targetDate = getTargetDateForNewList();
        const targetDateString = format(targetDate, 'yyyy-MM-dd');
        
        let targetList: MarketList | undefined = newDb
            .filter(l => l && l.datetime && format(parseISO(l.datetime), 'yyyy-MM-dd') === targetDateString)
            .sort((a,b) => parseISO(b.datetime).getTime() - parseISO(a.datetime).getTime())[0];
        
        if (!targetList) {
            const listName = newListName.trim() || `${t('marketList')} - ${d(targetDate, 'yyyy-MM-dd')}`;
            const newList: MarketList = {
                id: `list-${targetDate.getTime()}`,
                name: listName,
                date: format(targetDate, 'yyyy-MM-dd'),
                datetime: targetDate.toISOString(),
                items: [],
                status: 'active'
            };
            newDb.unshift(newList);
            targetList = newList;
            listWasCreated = true;
        }

        return newDb.map(list => {
            if (list.id === targetList?.id) {
                const updatedItems = [...(list.items || []), newItem];
                return { ...list, items: updatedItems };
            }
            return list;
        });
    });

    if (listWasCreated) {
        setNewListName('');
        setShowNewListInput(false);
    }
    setNewItemName('');
    newItemInputRef.current?.focus();
    
  }, [updateDb, isAdding, isEditable, newListName, getTargetDateForNewList, t, d, summaryType]);
  
  const handleAddItem = () => {
    setIsAdding(true);
    addItem(newItemName);
    setIsAdding(false);
  };

  const handlePasteItems = useCallback(() => {
    const copiedJson = localStorage.getItem(COPIED_ITEMS_KEY);
    if (copiedJson) {
        try {
            const copiedItems: MarketItem[] = JSON.parse(copiedJson);
            const newItems = copiedItems.map(item => ({
                ...item,
                id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            }));
            
            let listWasCreated = false;

            updateDb(currentDb => {
                const newDb = [...currentDb];
                const targetDate = getTargetDateForNewList();
                const targetDateString = format(targetDate, 'yyyy-MM-dd');
                
                let targetList: MarketList | undefined = newDb
                    .filter(l => l && l.datetime && format(parseISO(l.datetime), 'yyyy-MM-dd') === targetDateString)
                    .sort((a,b) => parseISO(b.datetime).getTime() - parseISO(a.datetime).getTime())[0];

                if (!targetList) {
                    const listName = newListName.trim() || `${t('marketList')} - ${d(targetDate, 'yyyy-MM-dd')}`;
                    const newList: MarketList = { id: `list-${targetDate.getTime()}`, name: listName, date: format(targetDate, 'yyyy-MM-dd'), datetime: targetDate.toISOString(), items: [], status: 'active' };
                    newDb.unshift(newList);
                    targetList = newList;
                    listWasCreated = true;
                }

                const finalDb = newDb.map(list => {
                    if (list.id === targetList?.id) {
                         const updatedItems = [...(list.items || []), ...newItems];
                         return { ...list, items: updatedItems };
                    }
                    return list;
                });
                return finalDb;
            });

            if (listWasCreated) {
                setNewListName('');
                setShowNewListInput(false);
            }
              
            localStorage.removeItem(COPIED_ITEMS_KEY);
            checkCopiedItems();
            toast({ title: t('itemsPastedTitle'), description: t('itemsPastedDesc', { count: n(newItems.length) }) });

        } catch (error) {
            console.error("Failed to parse or paste items from localStorage", error);
            toast({ variant: 'destructive', title: t('pasteFailedTitle'), description: t('pasteFailedDesc') });
        }
    }
}, [updateDb, newListName, getTargetDateForNewList, checkCopiedItems, toast, t, n, d]);
  
  const handleUnCopy = () => {
    localStorage.removeItem(COPIED_ITEMS_KEY);
    checkCopiedItems();
  };


  const generateAndDownloadPdf = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    const root = createRoot(tempContainer);
    
    const itemsToPrint = displayedItems;

    const ITEMS_PER_PAGE = 25;
    const totalPages = Math.ceil(itemsToPrint.length / ITEMS_PER_PAGE);

    for (let i = 0; i < totalPages; i++) {
        const chunk = itemsToPrint.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);
        const isLastPage = i === totalPages - 1;

        await new Promise<void>(resolve => {
            const invoiceElement = (
                <InvoicePage
                    title={title}
                    date={d(new Date(), 'yyyy-MM-dd')}
                    config={config}
                    items={chunk}
                    total={grandTotal}
                    boughtTotal={totalSpent}
                    pageNumber={i + 1}
                    totalPages={totalPages}
                    isLastPage={isLastPage}
                    t={t}
                    n={n}
                    d={d}
                    itemOffset={i * ITEMS_PER_PAGE}
                    isAllItemsView={true}
                />
            );

            root.render(invoiceElement);

            setTimeout(async () => {
                const canvas = await html2canvas(tempContainer.firstElementChild as HTMLElement, {
                    scale: 2,
                    backgroundColor: '#ffffff'
                });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = imgWidth / pdfWidth;
                const canvasImgHeight = imgHeight / ratio;

                if (i > 0) {
                    pdf.addPage();
                }
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, canvasImgHeight);
                resolve();
            }, 100);
        });
    }

    root.unmount();
    document.body.removeChild(tempContainer);
    pdf.save(`${title.replace(/ /g, '_')}.pdf`);
  };

  const handleShareBill = async () => {
    if (navigator.share) {
      let billText = `*${title}*\n\n`;
      billText += `*${t('items')}*\n`;
      const itemsToShare = displayedItems;
          
      itemsToShare.forEach(item => {
        const status = item.bought ? '✓' : '✗';
        billText += `- ${item.name}: ${config?.currency}${n((Number(item.price) || 0), {decimals: 2})} [${status}]\n`;
      });

      billText += `\n*${t('total')} (${t('itemsBought')}): ${config?.currency}${n(totalSpent, {decimals: 2})}*`;
      billText += `\n*${t('total')}: ${config?.currency}${n(grandTotal, {decimals: 2})}*`;

      try {
        await navigator.share({
          title: title,
          text: billText,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
          console.error('Error sharing', error);
          toast({
            variant: "destructive",
            title: t('shareFailedTitle'),
            description: t('shareFailedDesc'),
          });
        }
      }
    } else {
      toast({
        variant: "destructive",
        title: t('notSupportedTitle'),
        description: t('notSupportedDesc'),
      });
    }
  };

  const handleCopySelected = () => {
    if (selectedItems.length === 0) {
        toast({ variant: 'destructive', title: t('noItemsSelectedTitle'), description: t('noItemsSelectedDesc') });
        return;
    }
    const itemsToCopy = displayedItems.filter(item => selectedItems.includes(item.id));
    const itemsToStore = itemsToCopy.map(({ __listId, ...rest }) => ({...rest, bought: false, price: 0}));

    // For in-app paste
    localStorage.setItem(COPIED_ITEMS_KEY, JSON.stringify(itemsToStore));

    // For pasting into other apps
    const textToCopy = itemsToCopy.map(item => item.name).join(', ');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          checkCopiedItems();
          toast({ title: t('itemsCopiedTitle'), description: t('itemsCopiedDesc', { count: n(itemsToCopy.length) }) });
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          checkCopiedItems(); // Still check for internal copy
          toast({ title: t('itemsCopiedTitle'), description: t('itemsCopiedDesc', { count: n(itemsToCopy.length) }) });
        });
    } else {
        // Fallback for older browsers
        checkCopiedItems();
        toast({ title: t('itemsCopiedTitle'), description: t('itemsCopiedDesc', { count: n(itemsToCopy.length) }) });
    }
    
    setSelectedItems([]);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedItems(displayedItems.map(item => item.id));
    } else {
        setSelectedItems([]);
    }
  };

  const handleItemSelect = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => 
      checked ? [...prev, itemId] : prev.filter(id => id !== itemId)
    );
  };

  const handleToggleCalculator = (itemId: string) => {
    setOpenCalculatorId(prevId => (prevId === itemId ? null : itemId));
  };

  
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sortedItems = [...displayedItems].sort((a, b) => {
    const listA = db.find(l => l.id === a.__listId);
    const listB = db.find(l => l.id === b.__listId);
    if (!listA || !listB) return 0;
    
    const timeA = parseISO(listA.datetime).getTime();
    const timeB = parseISO(listB.datetime).getTime();
    if (timeA !== timeB) return timeB - timeA;
    
    if (!listA.items || !listB.items) return 0;
    const indexA = listA.items.findIndex(i => i.id === a.id);
    const indexB = listB.items.findIndex(i => i.id === b.id);

    return indexB - indexA;
  });

  return (
    <div className="pb-24">
       <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{t('areYouSure')}</AlertDialogTitle>
                <AlertDialogDescription>
                    {t('deleteSelectedConfirm', { count: n(selectedItems.length) })}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{t('cancelBtn')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSelected}>
                    {t('deleteBtn')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>

      <header className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm pt-4 pb-2">
        <div className='flex items-center justify-between gap-2 mb-4'>
            <div className='flex items-center gap-2'>
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft />
              </Button>
              <h1 className='text-lg font-semibold truncate'>{title}</h1>
            </div>
            {!isEditable && (
                <div className="bg-muted text-muted-foreground px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4" /> {t('viewOnly')}
                </div>
            )}
        </div>
        
        {isEditable && (
           <div className="sticky top-0 z-10 bg-background/95 pt-2 backdrop-blur-sm">
            {showNewListInput && (
              <Card className="mb-4">
                <CardHeader className='p-3'>
                  <CardTitle className="text-sm font-medium">{t('listName')}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <Input
                      placeholder={t('listNamePlaceholder')}
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      className="font-semibold"
                  />
                </CardContent>
              </Card>
            )}
            <Card className="shadow-md">
              <CardContent className="p-3">
                <div className="flex gap-2 relative">
                  <Input
                    ref={newItemInputRef}
                    placeholder={t('itemName')}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    className="font-semibold"
                    disabled={isAdding}
                  />
                  <Button onClick={handleAddItem} disabled={isAdding || newItemName.trim() === ''}>
                     {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span className="sr-only">{t('add')}</span>
                  </Button>
                  {newItemName.length > 1 && (
                    <ItemSuggestions 
                      partialItemName={newItemName} 
                      onSelect={(name) => {
                        setNewItemName(name);
                        addItem(name);
                      }} 
                    />
                  )}
                </div>
                {hasCopiedItems && (
                    <div className="flex gap-2 w-full mt-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={handlePasteItems}>
                            <ClipboardPaste className="mr-2 h-4 w-4" />
                            {t('pasteItems')}
                        </Button>
                        <Button variant="destructive" size="icon" onClick={handleUnCopy} aria-label={t('unCopy' as any)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {displayedItems.length > 0 && isEditable && (
          <div className="mt-4 p-2 bg-muted/50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="select-all"
                  checked={selectedItems.length === displayedItems.length && displayedItems.length > 0}
                  onCheckedChange={handleToggleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm font-medium">{t('selectAll')}</Label>
              </div>
              <div className='flex items-center gap-2'>
                <Button size="sm" onClick={handleCopySelected} disabled={selectedItems.length === 0}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('copySelected')} ({n(selectedItems.length)})
                </Button>
                 <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirmDialog(true)} disabled={selectedItems.length === 0}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('deleteBtn')} ({n(selectedItems.length)})
                </Button>
              </div>
          </div>
        )}
      </header>
      
      <main className="pt-2">
          {sortedItems.length > 0 ? (
            sortedItems.map((item, index) => {
                const itemWithListId = item;
                if (!itemWithListId.__listId) return null;
                
                const itemCard = (
                  <ItemCard 
                      key={`${item.id}-${index}-card`}
                      item={item as MarketItem} 
                      index={sortedItems.length - index}
                      onUpdate={(updatedItem) => handleUpdateItem({...updatedItem, __listId: itemWithListId.__listId})} 
                      onDelete={() => {
                        setSelectedItems([item.id]);
                        setShowDeleteConfirmDialog(true);
                      }}
                      isViewOnly={!isEditable}
                      isCalculatorOpen={openCalculatorId === item.id}
                      onToggleCalculator={() => handleToggleCalculator(item.id)} 
                  />
                );

                if (isEditable) {
                   return (
                     <div key={`${item.id}-${index}`} className="flex items-center gap-2">
                        <Checkbox
                            id={`select-${item.id}`}
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={(checked) => handleItemSelect(item.id, !!checked)}
                            className="my-auto"
                        />
                        <div className='flex-1'>
                          {itemCard}
                        </div>
                     </div>
                   );
                }

                return (
                  <div key={`${item.id}-${index}-link`} className="block" onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('button, input, [role="checkbox"], a, [role="option"]')) {
                        return;
                    }
                    router.push(`/market/${itemWithListId.__listId}?from=reports`);
                  }}>
                     {itemCard}
                  </div>
                )
            })
          ) : (
              <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                      {isEditable ? t('noItemsToDisplay') : t('noItemsInList')}
                  </CardContent>
              </Card>
          )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-sm z-30">
        <div className="container mx-auto max-w-2xl p-3 flex items-center justify-between">
          <div className='flex items-center gap-2'>
              <Button variant="outline" onClick={handleShareBill}><Share2 className="mr-2 h-4 w-4" />{t('shareBill')}</Button>
              <Button onClick={generateAndDownloadPdf}><Download className="mr-2 h-4 w-4" />{t('downloadBill')}</Button>
          </div>
          <div className="text-right">
            <div className="grid grid-cols-2 gap-x-4 text-sm">
                <span className="text-muted-foreground">{t('totalItemsCreated')}: <span className="font-bold text-foreground">{n(totalItems)}</span></span>
                <span className="text-muted-foreground">{t('totalItemsBought')}: <span className="font-bold text-foreground">{n(boughtItems)}</span></span>
            </div>
            <div className="text-sm font-semibold mt-1">{t('totalSpent')}: {config?.currency}{n(totalSpent, {decimals: 2})}</div>
            <div className="text-lg font-bold text-primary">{t('total')}: {config?.currency}{n(grandTotal, {decimals: 2})}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
