import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      richColors
      position="bottom-center"
      toastOptions={{
        style: {
          borderRadius: "0.875rem",
          fontFamily: "Inter, system-ui, sans-serif",
        },
      }}
      {...props}
    />
  );
}
