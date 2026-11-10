import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl",
          title: "text-foreground font-medium text-sm",
          description: "text-muted-foreground text-xs",
          error:
            "!bg-rose-50 !text-rose-950 !border-rose-200 dark:!bg-rose-950 dark:!text-rose-100 dark:!border-rose-800",
          success:
            "!bg-emerald-50 !text-emerald-950 !border-emerald-200 dark:!bg-emerald-950 dark:!text-emerald-100 dark:!border-emerald-800",
          info:
            "!bg-sky-50 !text-sky-950 !border-sky-200 dark:!bg-sky-950 dark:!text-sky-100 dark:!border-sky-800",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
