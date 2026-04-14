import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = ({ children, value, onValueChange, className }: any) => {
  return (
    <div className={cn("inline-flex flex-col", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { value, onValueChange });
        }
        return child;
      })}
    </div>
  );
};

const TabsList = ({ children, className, value, onValueChange }: any) => {
  return (
    <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          const c = child as React.ReactElement<any>;
          return React.cloneElement(c, { 
            active: c.props.value === value,
            onClick: () => onValueChange(c.props.value)
          });
        }
        return child;
      })}
    </div>
  )
}

const TabsTrigger = ({ children, className, active, onClick }: any) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        active 
          ? "bg-white text-slate-900 shadow-sm" 
          : "text-slate-500 hover:text-slate-700",
        className
      )}
    >
      {children}
    </button>
  )
}

const TabsContent = ({ children, className, value, activeValue }: any) => {
  if (value !== activeValue) return null;
  return (
    <div className={cn("mt-2 outline-none", className)}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
