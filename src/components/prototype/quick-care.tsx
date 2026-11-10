import { Link } from "@tanstack/react-router";
import { HandWavingIcon } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

type QuickCareProps = {
  className?: string;
  intro?: string;
};

export function QuickCare({ className, intro }: QuickCareProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="sn-worker-assist" type="button" aria-label="Open Quick Care actions">
            <HandWavingIcon size={25} weight="fill" />
            <span>CARE</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={14}
          className="sn-quick-care"
          aria-label="Quick Care actions"
        >
          <div>
            <h2>✨ Quick Care</h2>
            <button type="button" aria-label="Close Quick Care" onClick={close}>
              ×
            </button>
          </div>
          <p>{intro ?? "A little care is just a tap away."}</p>
          <nav aria-label="Quick Care">
            <Link to="/listeners" onClick={close}>
              📞 Book a Human Listener Call
            </Link>
            <Link to="/reminders" search={{ action: "new-reminder" }} onClick={close}>
              🔔 Set a Parent or Self Reminder
            </Link>
            <Link to="/send-later" search={{ section: "studio" }} onClick={close}>
              🎙️ Record a Voice Blessing
            </Link>
            <Link to="/reminders" search={{ action: "add-medication" }} onClick={close}>
              💊 Add a Pill Strip · PhotoMed
            </Link>
          </nav>
          <section className="sn-quick-care-help" aria-label="Guides and support">
            <Link to="/docs/getting-started" onClick={close}>
              📖 See how SomeoneNear works →
            </Link>
            <Link to="/docs/faq" onClick={close}>
              ❓ FAQs &amp; help →
            </Link>
            <p>For more information or any enquiry, email us:</p>
            <a href="mailto:care@someonenear.com">care@someonenear.com</a>
          </section>
        </PopoverContent>
      </Popover>
    </div>
  );
}
