import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (!ref) return
      if (typeof ref === "function") ref(value)
      else (ref as React.MutableRefObject<T | null>).current = value
    })
  }
}

// Sliding underline measured from the real DOM (`getBoundingClientRect` on
// the active tab's `[data-tab-label]` span), not guessed from CSS padding
// tokens — a `px-4`-vs-`inset-x-4` (or any other fixed-pixel) approach only
// matches by coincidence and drifts per label/font/browser. A
// `ResizeObserver` on the list re-measures on any layout change (window
// resize, sidebar collapse, zoom), so it can't go stale the way a static
// CSS value could.
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = React.useState<{ left: number; width: number } | null>(null)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    function measure(): void {
      const activeLabel = list?.querySelector<HTMLElement>('[data-state="active"] [data-tab-label]')
      if (!list || !activeLabel) return
      const listRect = list.getBoundingClientRect()
      const labelRect = activeLabel.getBoundingClientRect()
      setIndicator({ left: labelRect.left - listRect.left, width: labelRect.width })
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(list)
    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(list, { attributes: true, attributeFilter: ["data-state"], subtree: true })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return (
    <TabsPrimitive.List
      ref={mergeRefs(ref, listRef)}
      className={cn("relative inline-flex items-center gap-1", className)}
      {...props}
    >
      {children}
      {indicator && (
        <span
          className="pointer-events-none absolute -bottom-px h-0.5 rounded-full bg-primary transition-[left,width] duration-200"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center whitespace-nowrap px-4 py-2.5 text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-semibold data-[state=active]:text-foreground",
      className
    )}
    {...props}
  >
    {/* Marks the exact box TabsList measures for the sliding underline —
        just the icon+label, not the button's own px-4 padding. */}
    <span data-tab-label className="inline-flex items-center gap-2">
      {children}
    </span>
  </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
