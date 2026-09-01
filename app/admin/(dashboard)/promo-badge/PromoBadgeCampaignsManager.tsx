"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { PromoBadgeCampaign } from "@/lib/promo-badge";
import { PromoBadgeCampaignCard, type PromoBadgeModelOption } from "./PromoBadgeCampaignCard";

type Props = {
  campaigns: PromoBadgeCampaign[];
  models: PromoBadgeModelOption[];
};

function blankCampaign(): PromoBadgeCampaign {
  return {
    id: "",
    isActive: false,
    labelAr: "",
    labelEn: "",
    backgroundColor: "#006C35",
    textColor: "#FFFFFF",
    carModelIds: [],
  };
}

export function PromoBadgeCampaignsManager({ campaigns, models }: Props) {
  const [drafts, setDrafts] = useState<PromoBadgeCampaign[]>([]);

  const rows = [...campaigns, ...drafts];

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-on-surface-variant">
        كل عرض مستقل تماماً: تقدر تشغّل أكتر من عرض بنفس الوقت على سيارات مختلفة، وكل عرض
        يُحفظ ويُحذف لوحده بدون ما يأثّر على الباقي.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest px-4 py-8 text-center text-sm text-on-surface-variant">
          لا توجد عروض بعد.
        </p>
      ) : (
        rows.map((c, i) =>
          c.id ? (
            <PromoBadgeCampaignCard key={c.id} campaign={c} models={models} onRemoveDraft={() => {}} />
          ) : (
            <PromoBadgeCampaignCard
              key={`draft-${i}`}
              campaign={c}
              models={models}
              onRemoveDraft={() => setDrafts((prev) => prev.filter((_, idx) => idx !== i - campaigns.length))}
            />
          ),
        )
      )}

      <button
        type="button"
        onClick={() => setDrafts((prev) => [...prev, blankCampaign()])}
        className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/40 px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container"
      >
        <Plus className="h-4 w-4" />
        إضافة عرض جديد
      </button>
    </div>
  );
}
