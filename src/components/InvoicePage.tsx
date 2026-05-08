'use client';
import React from 'react';
import type { MarketItem, UserConfig } from '@/lib/types';
import { T, N, D } from '@/lib/countries';

interface InvoicePageProps {
  title: string;
  date: string;
  config: UserConfig | null;
  items: MarketItem[];
  total: number;
  boughtTotal?: number;
  pageNumber: number;
  totalPages: number;
  t: (key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}) => string;
  n: (num: number | string, options?: { decimals?: number }) => string;
  d: (date: Date | number, formatStr: string) => string;
  isAllItemsView?: boolean;
  itemOffset?: number;
  isLastPage: boolean;
}

export const InvoicePage: React.FC<InvoicePageProps> = ({
  title,
  date,
  config,
  items,
  total,
  boughtTotal = 0,
  pageNumber,
  totalPages,
  t,
  n,
  d,
  isAllItemsView = false,
  itemOffset = 0,
  isLastPage,
}) => {

  return (
    <div style={{ width: '210mm', height: '297mm', fontFamily: 'Inter, sans-serif', color: 'black', background: 'white', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
            .invoice-table { border-collapse: collapse; width: 100%; font-size: 10pt; }
            .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 6px; text-align: right; }
            .invoice-table th { background-color: #f2f2f2; font-weight: bold; }
            .invoice-table td:nth-child(2) { text-align: left; }
            .invoice-table th:nth-child(1), .invoice-table th:nth-child(2) { text-align: left; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid #eee; }
            .header div { text-align: right; }
            .header div:first-child { text-align: left; }
            h2 { font-size: 1.5rem; font-weight: bold; color: #1a1a1a; margin-bottom: 0.2rem; }
            h3 { font-size: 1rem; font-weight: bold; }
            p { font-size: 0.8rem; color: #666; margin: 0; }
            .total-row td { border: none; font-weight: bold; font-size: 1.1rem; }
            .text-green { color: green; font-weight: bold; font-family: sans-serif; }
            .text-red { color: red; font-weight: bold; font-family: sans-serif; }
            .footer { margin-top: auto; text-align: center; font-size: 0.75rem; color: #888; border-top: 1px solid #eee; padding-top: 5px;}
        `}</style>
        <div className="header">
            <div>
                <h2>INVOICE</h2>
                <p>{title}</p>
            </div>
            <div className="text-right">
                <h3>{config?.userName}</h3>
                <p>{n(config?.phone || '')}</p>
                <p>{date}</p>
            </div>
        </div>

        <table className="invoice-table">
            <thead>
            <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: isAllItemsView ? '35%' : '45%' }}>{t('itemName')}</th>
                <th style={{ width: '15%' }}>{t('qty')}</th>
                <th style={{ width: '15%' }}>{t('rate')}</th>
                <th style={{ width: '15%' }}>{t('price')}</th>
                {isAllItemsView && <th style={{ width: '15%', textAlign: 'center' }}>{t('bought')}</th>}
            </tr>
            </thead>
            <tbody>
            {items.map((item, index) => (
                <tr key={`${item.id}-${index}-pdf`}>
                    <td style={{textAlign: 'left'}}>{n(itemOffset + index + 1)}</td>
                    <td style={{textAlign: 'left', wordBreak: 'break-word'}}>{item.name}</td>
                    <td>{n(item.qty)} {t(item.unit as any)}</td>
                    <td>{config?.currency}{n((Number(item.rate) || 0), {decimals: 2})}</td>
                    <td>{config?.currency}{n((Number(item.price) || 0), {decimals: 2})}</td>
                    {isAllItemsView && <td style={{textAlign: 'center'}}>{item.bought ? <span className="text-green">✓</span> : <span className="text-red">✗</span>}</td>}
                </tr>
            ))}
            </tbody>
            {isLastPage && (
                 <tfoot>
                    {isAllItemsView && (
                        <tr className="total-row">
                            <td colSpan={isAllItemsView ? 3 : 2}></td>
                            <td style={{textAlign: 'right'}}>{t('total')}:</td>
                            <td style={{textAlign: 'right'}}>{config?.currency}{n(total, {decimals: 2})}</td>
                            <td></td>
                        </tr>
                    )}
                    <tr className="total-row">
                        <td colSpan={isAllItemsView ? 3 : 2}></td>
                        <td style={{textAlign: 'right'}}>{t('total')} ({t('bought')}):</td>
                        <td style={{textAlign: 'right'}}>{config?.currency}{n((boughtTotal || 0), {decimals: 2})}</td>
                        {isAllItemsView && <td></td>}
                    </tr>
                </tfoot>
            )}
        </table>
         <div className="footer">
            {t('page')} {n(pageNumber)} {t('of')} {n(totalPages)}
        </div>
    </div>
  );
};
