import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="top-center"
      visibleToasts={1}
      duration={1500}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md group-[.toaster]:py-1 group-[.toaster]:px-2.5 group-[.toaster]:text-[11px] group-[.toaster]:w-full group-[.toaster]:mx-auto group-[.toaster]:rounded-md group-[.toaster]:gap-1 group-[.toaster]:min-h-0",
          description: "group-[.toast]:text-[9px] group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-[10px]",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-[10px]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
