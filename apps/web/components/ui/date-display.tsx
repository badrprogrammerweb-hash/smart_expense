import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { formatDisplayDate, type DisplayDateValue } from "@/lib/format/date";
import { cn } from "@/lib/utils";

type LtrProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className" | "dir">;

/** Isolates technical and Latin content from surrounding bidirectional text. */
export function Ltr<T extends ElementType = "span">({
  as,
  children,
  className,
  ...props
}: LtrProps<T>) {
  const Component = as ?? "span";

  return (
    <Component
      {...props}
      dir="ltr"
      className={cn("inline-block tabular-nums", className)}
    >
      {children}
    </Component>
  );
}

type DateDisplayProps = Omit<ComponentPropsWithoutRef<"span">, "children" | "dir"> & {
  date: DisplayDateValue;
};

export function DateDisplay({ date, className, ...props }: DateDisplayProps) {
  return (
    <Ltr {...props} className={cn("font-[family-name:var(--font-arabic)]", className)}>
      {formatDisplayDate(date)}
    </Ltr>
  );
}
