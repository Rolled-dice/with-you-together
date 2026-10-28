import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarHeartIcon,
  ChatCircleIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  PillIcon,
  PlusIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ACTIONS = [
  { to: "/family", label: "Family reminders and updates", icon: UsersIcon },
  { to: "/reminders", label: "Plan a personal reminder", icon: CalendarHeartIcon },
  { to: "/send-later", label: "Send a message later", icon: ChatCircleIcon },
  { to: "/reminders", label: "Add or review a prescription", icon: PillIcon },
  { to: "/listeners", label: "Book a listener call", icon: HeadphonesIcon },
  { to: "/companion", label: "Talk or type to Companion", icon: MicrophoneIcon },
] as const;

export function QuickCareActions({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigating = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Chat owns the bottom corner and microphone while a conversation is open.
  if (pathname.startsWith("/companion")) return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={
          inline
            ? "flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
            : "care-quick-trigger"
        }
        aria-label="Open care actions"
        disabled={!ready}
        title="Care actions"
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={25} weight="bold" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className="overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!navigating.current) trigger.current?.focus();
            navigating.current = false;
          }}
        >
          <SheetHeader>
            <SheetTitle>A little help, close by</SheetTitle>
            <SheetDescription>What would you like to do?</SheetDescription>
          </SheetHeader>
          <nav aria-label="Care actions" className="care-quick-links mt-6">
            {ACTIONS.map(({ to, label, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                search={
                  to === "/reminders"
                    ? { view: label.startsWith("Plan") ? "everyday" : "medication" }
                    : undefined
                }
                onClick={() => {
                  navigating.current = true;
                  setOpen(false);
                }}
              >
                <Icon aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
