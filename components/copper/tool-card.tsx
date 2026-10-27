"use client";

// Module 2: one tool call, drawn as a round trip: what Copper sent to the tool
// and what came back. Always open, never raw JSON.
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { formatUsd, getProducts } from "@/lib/copper/catalog";
import { TOOL_LABELS, type ToolStep } from "@/lib/copper/assistant/progress";

type Row = { label: string; value: ReactNode };

const PRODUCT_NAMES: Record<string, string> = Object.fromEntries(
  getProducts().map((product) => [product.id, product.name]),
);

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-11-14" -> "Nov 14, 2026". */
function formatDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  "copper-plus": "Copper Plus",
};

function inputRows(step: ToolStep): Row[] {
  const input = (step.input ?? {}) as Record<string, unknown>;
  if (step.name === "calculate_cost") {
    const products = Array.isArray(input.products) ? input.products : [];
    return [
      {
        label: "Products",
        value: products.length
          ? products
              .map((id) => PRODUCT_NAMES[String(id)] ?? String(id))
              .join(", ")
          : "None",
      },
      {
        label: "Plan",
        value: PLAN_NAMES[String(input.plan)] ?? String(input.plan),
      },
      { label: "Billing", value: String(input.billing) },
      { label: "Years", value: String(input.years) },
    ];
  }
  if (step.name === "check_availability") {
    return [
      {
        label: "Product",
        value: PRODUCT_NAMES[String(input.product)] ?? String(input.product),
      },
      {
        label: "Color",
        value: input.color ? String(input.color) : "All colors",
      },
    ];
  }
  return [];
}

const NO_INPUT: Record<string, string> = {
  get_prices: "Nothing, it just asked for the price list",
  get_products: "Nothing, it just asked what Copper sells",
};

const STOCK_PILLS = {
  in_stock: {
    label: "In stock",
    className: "bg-accent text-accent-foreground",
  },
  low_stock: {
    label: "Low stock",
    className: "bg-chart-4 text-primary-foreground",
  },
  backordered: {
    label: "Back-ordered",
    className: "bg-chart-3 text-primary-foreground",
  },
} as const;

function Pill({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function Result({ step }: { step: ToolStep }) {
  const output = step.output as Record<string, unknown> | string | undefined;
  if (step.state === "error" || typeof output === "string") {
    return <p className="text-sm">{String(output)}</p>;
  }
  const data = (output ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (step.name === "calculate_cost") {
    return (
      <div className="space-y-1 text-sm">
        {(data.lines ?? []).map((line: { item: string; usd: number }) => (
          <div key={line.item} className="flex justify-between gap-4">
            <span>{line.item}</span>
            <span>{formatUsd(line.usd)}</span>
          </div>
        ))}
        <div className="border-border flex items-baseline justify-between gap-4 border-t pt-1">
          <span className="font-medium">Total</span>
          <span className="text-primary text-xl font-bold">
            {formatUsd(data.totalUsd)}
          </span>
        </div>
      </div>
    );
  }

  if (step.name === "get_products") {
    return (
      <div className="space-y-2 text-sm">
        {(data.products ?? []).map(
          (p: {
            id: string;
            name: string;
            type: string;
            priceUsd: number;
            colors: string[];
          }) => (
            <div key={p.id}>
              <div className="flex justify-between gap-4 font-medium">
                <span>{p.name}</span>
                <span>{formatUsd(p.priceUsd)}</span>
              </div>
              <div className="text-muted-foreground text-xs">{p.type}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.colors.map((color) => (
                  <Pill key={color} className="bg-accent/20">
                    {color}
                  </Pill>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    );
  }

  if (step.name === "get_prices") {
    return (
      <div className="space-y-1 text-sm">
        {(data.products ?? []).map(
          (p: { id: string; name: string; priceUsd: number }) => (
            <div key={p.id} className="flex justify-between gap-4">
              <span>{p.name}</span>
              <span>{formatUsd(p.priceUsd)}</span>
            </div>
          ),
        )}
        {(data.plans ?? [])
          .filter((plan: { monthlyUsd: number }) => plan.monthlyUsd > 0)
          .map(
            (plan: {
              id: string;
              name: string;
              monthlyUsd: number;
              annualUsd: number;
            }) => (
              <div key={plan.id} className="flex justify-between gap-4">
                <span>{plan.name}</span>
                <span>
                  {formatUsd(plan.monthlyUsd)}/mo · {formatUsd(plan.annualUsd)}
                  /yr
                </span>
              </div>
            ),
          )}
      </div>
    );
  }

  if (step.name === "check_availability") {
    if (data.status === "not_a_color") {
      return (
        <p className="text-sm">
          {data.product} doesn&apos;t come in {data.color}. Its colors are{" "}
          {(data.colors ?? []).join(", ")}.
        </p>
      );
    }
    if (data.status === "unavailable")
      return <p className="text-sm">{data.message}</p>;
    return (
      <div className="space-y-1 text-sm">
        {(data.colors ?? []).map(
          (c: {
            color: string;
            stock: keyof typeof STOCK_PILLS;
            restockDate: string | null;
          }) => {
            const pill = STOCK_PILLS[c.stock];
            return (
              <div
                key={c.color}
                className="flex items-center justify-between gap-4"
              >
                <span>{c.color}</span>
                <Pill className={pill.className}>
                  {c.stock === "backordered" && c.restockDate
                    ? `Back-ordered until ${formatDate(c.restockDate)}`
                    : pill.label}
                </Pill>
              </div>
            );
          },
        )}
      </div>
    );
  }

  return <pre className="text-xs">{JSON.stringify(output, null, 2)}</pre>;
}

/** `index` counts the tool calls in this answer, starting at 1. */
export function ToolCard({ step, index }: { step: ToolStep; index: number }) {
  const rows = inputRows(step);
  const running = step.state === "calling";
  return (
    <div
      data-testid="tool-call"
      data-tool={step.name}
      className="bg-card overflow-hidden rounded-lg border text-sm"
    >
      <div className="bg-accent text-accent-foreground flex items-center gap-2 px-3 py-1.5">
        <span className="font-mono font-bold">{step.name}()</span>
        <span className="bg-card/30 rounded-full px-1.5 text-xs">
          tool {index}
        </span>
        <span className="ml-auto text-xs">{TOOL_LABELS[step.name] ?? ""}</span>
      </div>
      <div className="space-y-1 px-3 py-2">
        <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          → What Copper sent
        </div>
        {step.input === undefined ? (
          <p className="text-muted-foreground text-sm italic">
            filling in the details…
          </p>
        ) : rows.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{NO_INPUT[step.name] ?? "Nothing"}</p>
        )}
      </div>
      <div className="bg-accent/10 border-t px-3 py-2">
        <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
          ← What came back
        </div>
        {running ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm italic">
            <Loader2Icon className="size-3.5 animate-spin" />
            the app is running the code…
          </p>
        ) : (
          <Result step={step} />
        )}
      </div>
    </div>
  );
}
