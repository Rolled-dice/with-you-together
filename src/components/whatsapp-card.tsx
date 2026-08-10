import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Copy, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getMyWhatsappLink,
  requestWhatsappCode,
  unlinkWhatsapp,
} from "@/lib/whatsapp.functions";

export function WhatsappCard() {
  const qc = useQueryClient();
  const load = useServerFn(getMyWhatsappLink);
  const getCode = useServerFn(requestWhatsappCode);
  const unlink = useServerFn(unlinkWhatsapp);
  const [code, setCode] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["whatsapp", "link"], queryFn: () => load({}) });

  const codeMutation = useMutation({
    mutationFn: () => getCode({ data: {} } as never),
    onSuccess: (res: { code: string }) => {
      setCode(res.code);
      qc.invalidateQueries({ queryKey: ["whatsapp", "link"] });
    },
    onError: () => toast.error("Couldn't create a code. Please try again."),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => unlink({ data: {} } as never),
    onSuccess: () => {
      setCode(null);
      toast.success("WhatsApp disconnected");
      qc.invalidateQueries({ queryKey: ["whatsapp", "link"] });
    },
  });

  const activeCode = code ?? q.data?.code ?? null;

  return (
    <Card className="rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <MessageCircle className="h-4 w-4 text-brand-accent" />
          WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Connect WhatsApp to book listener calls, get medicine reminders you can answer with a
          single word, and add medicines by sending a photo of a prescription.
        </p>

        {q.data?.linked ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-brand border border-border bg-surface px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Connected</p>
              <p className="text-xs text-muted-foreground">{q.data.phone}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
            >
              <Unlink className="mr-1.5 h-3.5 w-3.5" /> Disconnect
            </Button>
          </div>
        ) : activeCode ? (
          <div className="rounded-brand border border-border bg-surface p-4">
            <p className="text-sm">Send this code to the BesideU WhatsApp number:</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-2xl font-semibold tracking-[0.3em]">{activeCode}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(activeCode);
                  toast.success("Code copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The code expires in 30 minutes. Once the bot replies, this number is linked to your
              account.
            </p>
          </div>
        ) : (
          <Button
            className="w-fit"
            onClick={() => codeMutation.mutate()}
            disabled={codeMutation.isPending}
          >
            {codeMutation.isPending ? "Creating code…" : "Get a connect code"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
