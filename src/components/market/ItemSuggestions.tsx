'use client';

import { useState, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { T } from "@/lib/countries";
import { useAuth } from "@/hooks/use-auth";

// Common grocery items for suggestions
const commonItems = [
  "Apple", "Banana", "Orange", "Milk", "Bread", "Eggs", "Butter", "Cheese", "Yogurt",
  "Chicken", "Beef", "Pork", "Fish", "Rice", "Pasta", "Potato", "Onion", "Garlic", "Tomato",
  "Carrot", "Lettuce", "Spinach", "Broccoli", "Cabbage", "Cucumber", "Bell Pepper",
  "Mushroom", "Olive Oil", "Vegetable Oil", "Flour", "Sugar", "Salt", "Pepper", "Coffee",
  "Tea", "Juice", "Water", "Soap", "Shampoo", "Toothpaste", "Toilet Paper", "Detergent"
];

interface ItemSuggestionsProps {
  partialItemName: string;
  onSelect: (itemName: string) => void;
}

export function ItemSuggestions({
  partialItemName,
  onSelect,
}: ItemSuggestionsProps) {
  const { config } = useAuth();
  const t = (key: keyof (typeof import('@/lib/countries').dictionary)['en'], options?: {[key: string]: string | number}): string => T(key, config?.lang, options);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback((name: string) => {
    if (name.length < 1) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const filteredSuggestions = commonItems.filter(item => 
      item.toLowerCase().startsWith(name.toLowerCase())
    );
    setSuggestions(filteredSuggestions);
    setLoading(false);
  }, []);

  // Basic debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchSuggestions(partialItemName);
    }, 200); // 200ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [partialItemName, fetchSuggestions]);

  if (loading) {
    return (
      <Card className="absolute top-full mt-1 w-full z-10 bg-card shadow-lg border">
        <CardContent className="p-3 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span>{t('loadingSuggestions')}...</span>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0 || partialItemName.length < 1) {
    return null;
  }

  return (
    <Card className="absolute top-full mt-1 w-full z-10 bg-card shadow-lg border">
      <CardContent className="p-2 max-h-60 overflow-y-auto">
        <ul className="space-y-1">
          {suggestions.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                className="w-full text-left p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
                onClick={() => onSelect(item)}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
