'use client';

import React, { memo, useCallback, useState, useEffect } from "react";
import { MarketItem, Unit, UserConfig } from "@/lib/types";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Calculator, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { T, N } from "@/lib/countries";
import { useAuth } from "@/hooks/use-auth";

interface ItemCardProps {
  item: MarketItem;
  index: number;
  onUpdate: (updatedItem: MarketItem) => void;
  onDelete: () => void;
  isViewOnly?: boolean;
  isCalculatorOpen: boolean;
  onToggleCalculator: () => void;
}

const UnitSelector: React.FC<{
  selectedUnit: Unit;
  onUnitChange: (unit: Unit) => void;
  isViewOnly: boolean;
  lang: UserConfig['lang'];
}> = ({ selectedUnit, onUnitChange, isViewOnly, lang }) => {
  const units: Unit[] = ['kg', 'gm', 'pc', 'ltr', 'quintal', 'unit'];
  const t = useCallback((key: any) => T(key, lang), [lang]);

  return (
    <div className="flex flex-wrap gap-1">
      {units.map((u) => (
        <Button
          key={u}
          type="button"
          variant={selectedUnit === u ? "default" : "outline"}
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => !isViewOnly && onUnitChange(u)}
          onMouseDown={(e) => e.preventDefault()}
          disabled={isViewOnly}
        >
          {t(u)}
        </Button>
      ))}
    </div>
  );
};


export const ItemCard = memo(function ItemCard({ item, index, onUpdate, onDelete, isViewOnly = false, isCalculatorOpen, onToggleCalculator }: ItemCardProps) {
  const { config } = useAuth();
  const { toast } = useToast();
  const lang = config?.lang || 'en';
  
  const t = useCallback((key: any, opts?: any) => T(key, lang, opts), [lang]);
  const n = useCallback((num: any, opts?: any) => N(num, lang, opts), [lang]);

  const [name, setName] = useState(item.name);
  const [rateStr, setRateStr] = useState(item.rate === 0 ? '' : String(item.rate));
  const [rateQtyStr, setRateQtyStr] = useState(item.rateQty === 0 ? '' : String(item.rateQty));
  const [qtyStr, setQtyStr] = useState(item.qty === 0 ? '' : String(item.qty));
  const [priceStr, setPriceStr] = useState(item.price === 0 ? '' : String(item.price));
  const [bought, setBought] = useState(item.bought);
  const [rateUnit, setRateUnit] = useState(item.rateUnit);
  const [unit, setUnit] = useState(item.unit);

  useEffect(() => {
    setName(item.name);
    setRateStr(item.rate === 0 ? '' : String(item.rate));
    setRateQtyStr(item.rateQty === 0 ? '' : String(item.rateQty));
    setQtyStr(item.qty === 0 ? '' : String(item.qty));
    setPriceStr(item.price === 0 ? '' : String(item.price));
    setBought(item.bought);
    setRateUnit(item.rateUnit);
    setUnit(item.unit);
  }, [item]);

  const handleBlur = () => {
    const finalItem: MarketItem = {
      ...item,
      name,
      rate: parseFloat(rateStr) || 0,
      rateQty: parseFloat(rateQtyStr) || 0,
      qty: parseFloat(qtyStr) || 0,
      price: parseFloat(priceStr) || 0,
      bought,
      rateUnit,
      unit,
    };
    if (JSON.stringify(item) !== JSON.stringify(finalItem)) {
      onUpdate(finalItem);
    }
  };
  
  const handleCheckboxChange = (checked: boolean) => {
    if (isViewOnly) return;
    const newBoughtState = !!checked;
    setBought(newBoughtState);
    onUpdate({ ...item, bought: newBoughtState });
  };
  
  const calculate = useCallback((calculationType: 'price' | 'qty' | 'rate') => {
    if (isViewOnly) return;

    let currentRate = parseFloat(rateStr) || 0;
    let currentRateQty = parseFloat(rateQtyStr) || 0;
    let currentQty = parseFloat(qtyStr) || 0;
    let currentPrice = parseFloat(priceStr) || 0;
    
    if ((rateUnit === 'none' || unit === 'none') && (calculationType !== 'rate')) {
        toast({ variant: 'destructive', title: t('unitSelect'), description: t('unitSelectDesc') });
        return;
    }

    const isRatePieceBased = rateUnit === 'pc' || rateUnit === 'unit';
    const isQtyPieceBased = unit === 'pc' || unit === 'unit';
    
    if ((calculationType === 'price' || calculationType === 'qty') && isRatePieceBased !== isQtyPieceBased) {
        toast({ variant: 'destructive', title: t('unitSelect'), description: 'Cannot calculate between weight-based and piece-based units.' });
        return;
    }

    const getInGrams = (q: number, u: Unit): number => {
      if (u === 'quintal') return q * 100000;
      if (u === 'kg' || u === 'ltr') return q * 1000;
      if (u === 'gm') return q;
      return 0;
    };

    let nPrice = currentPrice, nQty = currentQty, nRate = currentRate, nRateQty = currentRateQty, nUnit = unit, nRateUnit = rateUnit;

    if (calculationType === 'price') {
      if (currentQty <= 0 || currentRate <= 0 || currentRateQty <= 0) return;
      if (isRatePieceBased) nPrice = (currentRate / currentRateQty) * currentQty;
      else {
        const rateGrams = getInGrams(currentRateQty, rateUnit);
        const qtyGrams = getInGrams(currentQty, unit);
        if (rateGrams > 0) nPrice = (currentRate / rateGrams) * qtyGrams;
      }
      setPriceStr(String(nPrice));
    } else if (calculationType === 'qty') {
      if (currentPrice <= 0 || currentRate <= 0) return;
      if (isRatePieceBased) nQty = (currentPrice / currentRate) * currentRateQty;
      else {
        const rateGrams = getInGrams(currentRateQty, rateUnit);
        if (rateGrams > 0) {
            const qtyGrams = currentPrice / (currentRate / rateGrams);
            if (qtyGrams >= 1000) { nQty = qtyGrams / 1000; nUnit = 'kg'; }
            else { nQty = qtyGrams; nUnit = 'gm'; }
        }
      }
      setQtyStr(String(nQty));
      setUnit(nUnit);
    } else if (calculationType === 'rate') {
      if (currentQty <= 0 || currentPrice <= 0) return;
      if (isQtyPieceBased) { nRate = currentPrice / currentQty; nRateQty = 1; nRateUnit = unit; }
      else {
        const qtyGrams = getInGrams(currentQty, unit);
        if (qtyGrams > 0) { nRate = (currentPrice / qtyGrams) * 1000; nRateQty = 1; nRateUnit = 'kg'; }
      }
      setRateStr(String(nRate));
      setRateQtyStr(String(nRateQty));
      setRateUnit(nRateUnit);
    }
    
    onUpdate({ ...item, name, rate: nRate, rateQty: nRateQty, qty: nQty, price: nPrice, bought, rateUnit: nRateUnit, unit: nUnit });
  }, [isViewOnly, toast, t, rateStr, rateQtyStr, qtyStr, priceStr, rateUnit, unit, onUpdate, item, name, bought]);

  return (
    <Collapsible
      open={isCalculatorOpen}
      onOpenChange={onToggleCalculator}
      className={cn(
        "mb-3 transition-all duration-200 ease-in-out border rounded-lg",
        bought ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-800" : "bg-card border-border",
        isViewOnly && "cursor-pointer hover:bg-accent/50 active:scale-[.98]"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
            {!isViewOnly && (
                <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive h-8 w-8">
                    <Trash2 className="w-4 h-4" />
                </Button>
            )}
            <span className="text-base font-black text-primary/80 min-w-[20px] text-center">{n(index)}</span>
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleBlur}
                className={cn("flex-1 text-base font-bold border-0 rounded-none focus-visible:ring-0 px-1 bg-transparent", bought && "line-through text-muted-foreground")}
                readOnly={isViewOnly}
                placeholder={t('itemName')}
            />
             <Input
              type="text" inputMode="decimal" value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              onBlur={handleBlur}
              className={cn("h-9 w-24 text-right font-bold", bought && "line-through text-muted-foreground")}
              readOnly={isViewOnly}
              placeholder={t('price')}
            />
            <Checkbox checked={bought} onCheckedChange={(checked) => handleCheckboxChange(!!checked)} className="w-5 h-5" disabled={isViewOnly} />
        </div>

        {!isViewOnly && (
          <>
            <CollapsibleTrigger asChild>
                <button className="flex justify-between items-center w-full text-sm text-muted-foreground hover:text-foreground mt-2 border-t pt-2">
                    <span>{t('Calculate Item Rate')}</span>
                    <ChevronsUpDown className="h-4 w-4" />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 gap-4 pt-4">
                   <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('rate')}</Label>
                            <div className="flex items-center gap-1">
                                <Input type="text" inputMode="decimal" value={rateStr} onChange={(e) => setRateStr(e.target.value)} onBlur={handleBlur} className={cn("h-9", bought && "line-through text-muted-foreground")} />
                                <Button variant="ghost" size="icon" onClick={() => calculate('rate')}><Calculator className="w-4 h-4"/></Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('per')}</Label>
                            <Input type="text" inputMode="decimal" value={rateQtyStr} onChange={(e) => setRateQtyStr(e.target.value)} onBlur={handleBlur} className={cn("h-9 mb-1", bought && "line-through text-muted-foreground")} />
                            <UnitSelector selectedUnit={rateUnit} onUnitChange={setRateUnit} isViewOnly={isViewOnly} lang={lang} />
                        </div>
                    </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2">
                       <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('quantity')}</Label>
                          <div className="flex items-center gap-1">
                              <Input type="text" inputMode="decimal" value={qtyStr} onChange={(e) => setQtyStr(e.target.value)} onBlur={handleBlur} className={cn("h-9 mb-1", bought && "line-through text-muted-foreground")} />
                              <Button variant="ghost" size="icon" onClick={() => calculate('price')}><Calculator className="w-4 h-4"/></Button>
                          </div>
                          <UnitSelector selectedUnit={unit} onUnitChange={setUnit} isViewOnly={isViewOnly} lang={lang} />
                      </div>
                      <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('price')}</Label>
                           <div className="flex items-center gap-1">
                                <Input type="text" inputMode="decimal" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} onBlur={handleBlur} className={cn("h-9 text-right font-bold text-primary", bought && "line-through text-muted-foreground")} />
                                 <Button variant="ghost" size="icon" onClick={() => calculate('qty')}><Calculator className="w-4 h-4"/></Button>
                           </div>
                      </div>
                  </div>
              </div>
            </CollapsibleContent>
          </>
        )}
      </CardContent>
    </Collapsible>
  );
});