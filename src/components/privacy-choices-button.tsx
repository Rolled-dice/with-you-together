import { Button, type ButtonProps } from "@/components/ui/button";

declare global {
  interface Window {
    Cookiebot?: {
      renew: () => void;
    };
  }
}

export function PrivacyChoicesButton(props: ButtonProps) {
  return (
    <Button
      type="button"
      variant="link"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) window.Cookiebot?.renew();
      }}
    >
      Manage Privacy Choices
    </Button>
  );
}