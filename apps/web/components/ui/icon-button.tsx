import type { ButtonHTMLAttributes } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

export type IconButtonProps = Omit<ButtonProps, "size" | "children"> &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    children: React.ReactNode;
  };

export function IconButton({ label, children, ...props }: IconButtonProps) {
  return (
    <Button {...props} size="icon" aria-label={label} title={label}>
      {children}
    </Button>
  );
}
