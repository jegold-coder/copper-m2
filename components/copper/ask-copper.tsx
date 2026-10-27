"use client";

// Module 2: the floating Ask Copper chat. It calls the askCopper server
// action, reads each update as it streams in, and draws the agent loop as
// stations on a rail: the tools on offer, Copper thinking, each tool call,
// and the reply. Tools on and tools off are two separate conversations.
import {
  ArrowUpIcon,
  BotIcon,
  BrainIcon,
  MessageCircleIcon,
  WrenchIcon,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { SetupRequired } from "@/components/setup-required";
import { ToolCard } from "@/components/copper/tool-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { readLive } from "@/lib/ai/live";
import { askCopper, type ChatMessage } from "@/lib/copper/assistant/ask";
import {
  type Progress,
  type ToolStep,
  TOOL_LABELS,
} from "@/lib/copper/assistant/progress";

const STARTERS = [
  "How much is Copper Home with Copper Plus, paid yearly, for 2 years?",
  "Is Copper Notes in Night Sky in stock?",
  "Is Copper Plus cheaper monthly or yearly?",
];

type Turn = { question: string; progress: Progress | null };
type Chats = { on: Turn[]; off: Turn[] };

/** **bold** and `code` in a thought summary, without the marks. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((piece, i) => {
    if (piece.startsWith("**"))
      return <strong key={i}>{piece.slice(2, -2)}</strong>;
    if (piece.startsWith("`"))
      return (
        <code key={i} className="font-mono">
          {piece.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{piece}</Fragment>;
  });
}

function Station({
  icon,
  label,
  nodeClass,
  children,
}: {
  icon: ReactNode;
  label?: string;
  nodeClass: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative pb-4 pl-9">
      <span
        className={`ring-secondary absolute top-0 left-0 flex size-6 items-center justify-center rounded-full text-white ring-4 ${nodeClass}`}
      >
        {icon}
      </span>
      {label && (
        <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function Answer({ turn, useTools }: { turn: Turn; useTools: boolean }) {
  const progress = turn.progress;
  const working = !progress || progress.status === "working";
  const tools =
    progress?.steps.filter((s): s is ToolStep => s.type === "tool") ?? [];
  const used = new Set(tools.map((t) => t.name));
  const nodeClass = useTools ? "bg-primary" : "bg-chart-3";
  let toolCount = 0;

  const nowText = !progress
    ? "Reading your question…"
    : progress.reply
      ? "Writing the answer…"
      : !useTools
        ? "Answering from memory…"
        : progress.steps.length
          ? "Deciding what to do next…"
          : "Reading your question…";

  return (
    <div className="relative">
      <div
        className={`absolute top-0 bottom-0 left-3 w-0.5 bg-linear-to-b ${
          useTools
            ? "from-primary via-accent to-accent"
            : "from-chart-3 to-chart-3"
        }`}
      />
      <Station
        icon={<WrenchIcon className="size-3" />}
        nodeClass={useTools ? "bg-accent" : "bg-chart-3"}
        label={
          useTools ? "Tools Copper can use" : "Tools given to Copper: none"
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(TOOL_LABELS).map((name) => (
            <span
              key={name}
              className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                !useTools
                  ? "bg-muted text-muted-foreground line-through"
                  : used.has(name)
                    ? "bg-accent text-accent-foreground font-bold"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {name}
            </span>
          ))}
        </div>
        {!useTools && (
          <p className="text-muted-foreground mt-1 text-xs">
            Copper has to answer from memory alone.
          </p>
        )}
      </Station>

      {progress?.steps.map((step, i) =>
        step.type === "thinking" ? (
          <Station
            key={i}
            icon={<BrainIcon className="size-3" />}
            nodeClass={nodeClass}
            label="Copper is thinking"
          >
            <div
              data-testid="thinking"
              className="text-muted-foreground border-l-2 pl-3 text-sm italic"
            >
              {step.text.split(/\n\n+/).map((paragraph, j) => (
                <p key={j}>{inline(paragraph)}</p>
              ))}
            </div>
          </Station>
        ) : (
          <Station
            key={step.id}
            icon={<WrenchIcon className="size-3" />}
            nodeClass="bg-accent"
            label={
              step.state === "calling"
                ? "Copper is calling a tool"
                : "Copper called a tool"
            }
          >
            <ToolCard step={step} index={++toolCount} />
          </Station>
        ),
      )}

      {working && (
        <Station
          icon={
            <span className="flex gap-px">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1 animate-bounce rounded-full bg-white"
                  style={{ animationDelay: `${dot * 120}ms` }}
                />
              ))}
            </span>
          }
          nodeClass={`animate-pulse ${nodeClass}`}
        >
          <p className="text-muted-foreground text-sm">{nowText}</p>
        </Station>
      )}

      {progress?.reply && (
        <div className="bg-card ml-9 rounded-2xl rounded-tl-sm border px-3 py-2 text-sm">
          <div className="text-primary mb-1 text-xs font-semibold">Copper</div>
          {!useTools && (
            <div className="border-chart-3 bg-chart-3/10 mb-2 rounded-md border p-2 text-xs">
              <p className="font-bold">
                ⚠ Answered without tools: may be made up
              </p>
              <p>
                With tools off, Copper can&apos;t see today&apos;s prices or
                stock. The AI only has what it learned in training, so it fills
                the gaps with guesses that sound right. That&apos;s a
                hallucination.
              </p>
            </div>
          )}
          <p className="whitespace-pre-wrap">
            {progress.reply}
            {working && <span className="animate-pulse">▍</span>}
          </p>
        </div>
      )}
    </div>
  );
}

export function AskCopper({ aiConfigured }: { aiConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [useTools, setUseTools] = useState(true);
  const [chats, setChats] = useState<Chats>({ on: [], off: [] });
  const [busy, setBusy] = useState({ on: false, off: false });
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const mode = useTools ? "on" : "off";
  const turns = chats[mode];

  // Open from /#ask, and again whenever the header link is clicked: once the
  // address already ends in #ask, a second click fires no hashchange.
  useEffect(() => {
    const openIfAsk = () => {
      if (window.location.hash === "#ask") setOpen(true);
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(
        'a[href$="#ask"]',
      );
      if (link) setOpen(true);
    };
    openIfAsk();
    window.addEventListener("hashchange", openIfAsk);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", openIfAsk);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [turns, open, mode]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy[mode]) return;
    const key = mode;
    const history: ChatMessage[] = chats[key].flatMap((turn) =>
      turn.progress?.reply
        ? [
            { role: "user" as const, content: turn.question },
            { role: "assistant" as const, content: turn.progress.reply },
          ]
        : [],
    );
    const index = chats[key].length;
    const setTurn = (progress: Progress | null) =>
      setChats((current) => {
        const list = [...current[key]];
        list[index] = { question: text, progress };
        return { ...current, [key]: list };
      });

    setDraft("");
    setBusy((current) => ({ ...current, [key]: true }));
    setTurn(null);
    try {
      const { progress } = await askCopper({
        messages: [...history, { role: "user", content: text }],
        useTools: key === "on",
      });
      for await (const update of readLive(progress)) setTurn(update);
    } catch {
      setTurn({
        steps: [],
        reply: "Sorry, I couldn't answer that. Please try again.",
        status: "error",
      });
    } finally {
      setBusy((current) => ({ ...current, [key]: false }));
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="ask-copper-launcher"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg"
      >
        <MessageCircleIcon className="size-4" />
        Ask Copper
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          data-testid="ask-copper"
          showCloseButton
          className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <div className="bg-chart-5 text-card">
            <div className="flex items-center gap-3 p-4 pr-12">
              <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full">
                <BotIcon className="size-5" />
              </span>
              <div>
                <SheetTitle className="text-card">Ask Copper</SheetTitle>
                <SheetDescription className="text-card/70">
                  Prices, totals and stock, checked with tools.
                </SheetDescription>
              </div>
            </div>
            <div className="bg-card/10 flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium">Use tools</span>
                <span className="text-card/70 ml-2 text-xs">
                  {useTools ? "Checks every answer" : "Model guesses alone"}
                </span>
              </div>
              <Switch
                aria-label="Use tools"
                checked={useTools}
                onCheckedChange={setUseTools}
              />
            </div>
          </div>

          {aiConfigured ? (
            <>
              <div className="bg-secondary flex-1 space-y-4 overflow-y-auto p-4">
                {turns.map((turn, i) => (
                  <div key={i} className="space-y-3">
                    <div className="bg-primary text-primary-foreground ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm">
                      {turn.question}
                    </div>
                    <Answer turn={turn} useTools={useTools} />
                  </div>
                ))}
                {!busy[mode] && (
                  <div className="flex flex-col items-start gap-2">
                    {STARTERS.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => send(starter)}
                        className="bg-card hover:bg-card/80 rounded-full border px-3 py-1.5 text-left text-sm"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={bottom} />
              </div>
              <form
                className="bg-card flex items-center gap-2 border-t p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(draft);
                }}
              >
                <input
                  aria-label="Your question"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about prices or stock"
                  className="bg-background flex-1 rounded-full border px-4 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={busy[mode] || !draft.trim()}
                  className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full disabled:opacity-50"
                >
                  <ArrowUpIcon className="size-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="bg-secondary flex-1 overflow-y-auto p-4">
              <SetupRequired service="ai" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
