import { Button, type ButtonProps } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function PrivacyChoicesButton(props: ButtonProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <Button
      type="button"
      variant="link"
      {...props}
      disabled={!ready || props.disabled}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) window.dispatchEvent(new Event("sn:open-privacy"));
      }}
    >
      Manage Privacy Choices
    </Button>
  );
}
