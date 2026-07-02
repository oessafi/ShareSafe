"use client";

import type { DetectionItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DetectedItemsTableProps {
  items: DetectionItem[];
  selectedIds: string[];
  onToggle: (itemId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function DetectedItemsTable({
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearSelection,
}: DetectedItemsTableProps) {
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Detected values</Badge>
          <Badge variant="secondary">{selectedIds.length} selected</Badge>
        </div>
        <div>
          <CardTitle>Choose PDF values to redact</CardTitle>
          <CardDescription>
            Selected values are sent to the PyMuPDF backend for real PDF redaction.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button disabled={items.length === 0 || allSelected} onClick={onSelectAll} size="sm">
            Select all
          </Button>
          <Button
            disabled={selectedIds.length === 0}
            onClick={onClearSelection}
            size="sm"
            variant="outline"
          >
            Clear selection
          </Button>
        </div>

        <div className="overflow-hidden rounded-[1.4rem] border border-border">
          <div className="grid grid-cols-[0.55fr_1.05fr_2fr_0.5fr] gap-3 bg-muted/45 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span>Select</span>
            <span>Type</span>
            <span>Value</span>
            <span className="text-right">Count</span>
          </div>
          <div className="divide-y divide-border/80">
            {items.map((item) => {
              const checked = selectedIds.includes(item.id);

              return (
                <label
                  className="grid cursor-pointer grid-cols-[0.55fr_1.05fr_2fr_0.5fr] gap-3 px-4 py-3 text-sm"
                  key={item.id}
                >
                  <span className="flex items-center">
                    <input
                      checked={checked}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      onChange={() => onToggle(item.id)}
                      type="checkbox"
                    />
                  </span>
                  <span className="font-semibold text-foreground">{item.type}</span>
                  <span className="break-words text-muted-foreground">{item.value}</span>
                  <span className="text-right font-semibold text-foreground">{item.count}</span>
                </label>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
