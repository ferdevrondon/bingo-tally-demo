"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const NUMBERS = Array.from({ length: 15 }, (_, i) => i + 1);

 function NumberSelectorCard({ title = "Cartón #001", onChange }) {
  const [selected, setSelected] = useState(new Set());

  function toggleNumber(n) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      onChange?.(Array.from(next));
      return next;
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="font-semibold">{title}</CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {NUMBERS.map((n) => {
            const isSelected = selected.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleNumber(n)}
                aria-pressed={isSelected}
                className={cn(
                  "aspect-square rounded-lg border text-sm font-medium transition-colors",
                  "flex items-center justify-center",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-foreground border-border hover:bg-muted"
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export {
  NumberSelectorCard
}