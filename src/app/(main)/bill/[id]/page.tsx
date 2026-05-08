'use client';

import { useEffect, useState, useMemo, useRef, useCallback }from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { MarketList, MarketItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Share2, Download, Trash2, Copy, X } from 'lucide-react';
import { parseISO, isValid } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { createRoot } from 'react-dom/client';
import { InvoicePage } from '@/components/InvoicePage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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

export default function BillPage() {
  const router = useRouter();
  const params = useParams();
  const { undoableUpdateDb, config, loading: authLoading, getBill } = useAuth();
  const { toast } = useToast();
  
  const [list, setList] = useState<MarketList | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [hasCopiedItems, setHasCopiedItems] = useState(false);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
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

  useEffect(() => {
    if (authLoading) return;
    
    const state = window.history.state;
    if (state && state.list) {
        setList(state.list);
        setLoading(false);
        return;
    }

    if (id) {
      const listFromDb = getBill(id);
      if (listFromDb) {
        setList(listFromDb);
      } else {
         toast({
            variant: "destructive",
            title: t('billNotFoundTitle'),
            description: t('billNotFoundDesc'),
        });
        router.replace('/home');
      }
    } else {
        router.replace('/home');
    }
    
    setLoading(false);
    
  }, [id, authLoading, getBill, router, toast, t]);

  useEffect(() => {
    if(!loading && id) {
       const listFromDb = getBill(id);
        if (listFromDb) {
          setList(listFromDb);
        }
    }
  }, [getBill, id, loading]);

  const { totalSpent, allItems, boughtItems, grandTotal } = useMemo(() => {
    if (!list) {
      return { totalSpent: 0, allItems: [], boughtItems: [], grandTotal: 0 };
    }
    const boughtItemsList = list.items.filter(item => item.bought);
    const total = boughtItemsList.reduce((acc, item) => acc + (Number(item.price) || 0), 0);
    const allItemsTotal = list.items.reduce((acc, item) => acc + (Number(item.price) || 0), 0);
    return { totalSpent: total, allItems: list.items, boughtItems: boughtItemsList, grandTotal: allItemsTotal };
  }, [list]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(allItems.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleItemSelect = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => 
      checked ? [...prev, itemId] : prev.filter(id => id !== itemId)
    );
  };

  const handleCopySelected = () => {
    if (selectedItems.length === 0) {
      toast({ variant: 'destructive', title: t('noItemsSelectedTitle'), description: t('noItemsSelectedDesc') });
      return;
    }
    const itemsToCopy = allItems.filter(item => selectedItems.includes(item.id));
    const itemsToStore = itemsToCopy.map(({ ...rest }) => ({...rest, bought: false, price: 0}));

    localStorage.setItem(COPIED_ITEMS_KEY, JSON.stringify(itemsToStore));
    
    const textToCopy = itemsToCopy.map(item => item.name).join(', ');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          checkCopiedItems();
          toast({ title: t('itemsCopiedTitle'), description: t('itemsCopiedDesc', { count: n(itemsToCopy.length) }) });
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          checkCopiedItems();
          toast({ title: t('itemsCopiedTitle'), description: t('itemsCopiedDesc', { count: n(itemsToCopy.length) }) });
        });
    } else {
      checkCopiedItems();
      toast({ title: t('itemsCopiedTitle'), description: t('itemsCopiedDesc', { count: n(itemsToCopy.length) }) });
    }
    
    setSelectedItems([]);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0 || !list) return;
  
    const listId = list.id;
    const deletedCount = selectedItems.length;
    const itemsToDeleteSet = new Set(selectedItems);

    undoableUpdateDb(
        (currentDb) =>
            currentDb.map(l => {
                if (l.id === listId) {
                    return { ...l, items: l.items.filter(item => !itemsToDeleteSet.has(item.id)) };
                }
                return l;
            }),
        {
            title: t('itemsDeletedTitle', { count: n(deletedCount) }),
            description: t('itemsDeletedDesc', { count: n(deletedCount) }),
        }
    );
  
    setSelectedItems([]);
    setShowDeleteConfirmDialog(false);
  };


  if (loading || authLoading || !list) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const listDate = parseISO(list.datetime);

  const generateAndDownloadPdf = async (downloadType: 'all' | 'bought') => {
    const itemsToDownload = downloadType === 'bought' ? boughtItems : allItems;
    const totalToDisplay = downloadType === 'all' ? grandTotal : totalSpent;
    const boughtTotal = totalSpent;
    const isStatusVisible = true;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    const root = createRoot(tempContainer);
  
    const ITEMS_PER_PAGE = 25; 
    const totalPages = Math.ceil(itemsToDownload.length / ITEMS_PER_PAGE);
  
    for (let i = 0; i < totalPages; i++) {
      const chunk = itemsToDownload.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);
      const isLastPage = i === totalPages - 1;
  
      await new Promise<void>(resolve => {
        const invoiceElement = (
            <InvoicePage
              title={'INVOICE'}
              date={isValid(listDate) ? d(listDate, 'yyyy-MM-dd') : list.date}
              config={config}
              items={chunk}
              total={totalToDisplay}
              boughtTotal={boughtTotal}
              pageNumber={i + 1}
              totalPages={totalPages}
              isLastPage={isLastPage}
              t={t}
              n={n}
              d={d}
              itemOffset={i * ITEMS_PER_PAGE}
              isAllItemsView={isStatusVisible}
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
    const dateStr = isValid(listDate) ? d(listDate, 'yyyy-MM-dd') : list.date;
    pdf.save(`Invoice-${downloadType}-${dateStr}.pdf`);
  };
  

  const handleShareBill = async () => {
    if (navigator.share) {
      let billText = `*${t('bill')} - ${isValid(listDate) ? d(listDate, 'MMMM d, yyyy') : list.date}*\n\n`;
      billText += `*${t('items')}*\n`;
      allItems.forEach(item => {
        const status = item.bought ? '✓' : '✗';
        billText += `- ${item.name}: ${config?.currency}${n((Number(item.price) || 0), {decimals: 2})} [${status}]\n`;
      });
      billText += `\n*${t('total')} (${t('bought')}): ${config?.currency}${n(totalSpent, {decimals: 2})}*`;

      try {
        await navigator.share({
          title: t('bill'),
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

  return (
    <div>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b p-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleShareBill}><Share2 className="mr-2 h-4 w-4" />{t('shareBill')}</Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button><Download className="mr-2 h-4 w-4" />{t('downloadBill')}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => generateAndDownloadPdf('all')}>
                        {t('downloadAllItems')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => generateAndDownloadPdf('bought')}>
                        {t('downloadBoughtItems')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>
      
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <div className="p-6 bg-background text-foreground rounded-lg shadow-lg">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-primary mb-1">INVOICE</h2>
                    <p className="text-sm text-muted-foreground">{t('bill')} - {isValid(listDate) ? d(listDate, 'MMMM d, yyyy') : t('invalidDate')}</p>
                </div>
                <div className="text-right">
                    <h3 className="text-lg font-bold">{config?.userName}</h3>
                    <p className="text-sm text-muted-foreground">{n(config?.phone || '')}</p>
                </div>
            </div>

            {allItems.length > 0 && (
                <div className="mb-4 p-2 bg-muted/50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="select-all"
                            checked={selectedItems.length === allItems.length && allItems.length > 0}
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

            <table className="w-full text-sm table-auto">
                <thead className="bg-primary/10">
                  <tr className="border-b">
                    <th className="p-2 text-left font-semibold w-[5%]"></th>
                    <th className="p-2 text-left font-semibold w-[5%]">#</th>
                    <th className="p-2 text-left font-semibold w-[35%]">{t('itemName')}</th>
                    <th className="p-2 text-right font-semibold w-[15%]">{t('qty')}</th>
                    <th className="p-2 text-right font-semibold w-[15%]">{t('rate')}</th>
                    <th className="p-2 text-right font-semibold w-[15%]">{t('price')}</th>
                    <th className="p-2 text-center font-semibold w-[15%]">{t('bought')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.length > 0 ? (
                    allItems.map((item, index) => (
                      <tr key={item.id} className="border-b">
                        <td className="p-2">
                           <Checkbox
                                id={`select-${item.id}`}
                                checked={selectedItems.includes(item.id)}
                                onCheckedChange={(checked) => handleItemSelect(item.id, !!checked)}
                                className="my-auto"
                           />
                        </td>
                        <td className="p-2">{n(index + 1)}</td>
                        <td className="p-2 break-words">{item.name}</td>
                        <td className="p-2 text-right">{n(item.qty)} {t(item.unit as any)}</td>
                        <td className="p-2 text-right">{config?.currency}{n((Number(item.rate) || 0), {decimals: 2})}</td>
                        <td className="p-2 text-right">{config?.currency}{n((Number(item.price) || 0), {decimals: 2})}</td>
                        <td className={`p-2 text-center font-bold ${item.bought ? 'text-green-600' : 'text-red-500'}`}>{item.bought ? '✓' : '✗'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-muted-foreground">{t('noItemsInList')}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-primary/20">
                        <td colSpan={6} className="p-2 text-right font-bold text-lg">{t('total')} ({t('bought')}):</td>
                        <td className="p-2 text-right font-bold text-lg">{config?.currency}{n(totalSpent, {decimals: 2})}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
      </main>

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
    </div>
  );
}
