import { Toaster as Sonner, type ToasterProps } from "sonner"

// The app has no light/dark toggle (index.html is hard-locked to `dark`),
// so this skips next-themes entirely and just always renders the dark toast theme.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
