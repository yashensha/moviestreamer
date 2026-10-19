import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center font-bold transition-all duration-200 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-white hover:bg-white/90 text-black shadow-xl drop-shadow',
        secondary:
          'bg-zinc-600/60 hover:bg-zinc-600/40 text-white backdrop-blur-md border border-zinc-500/30 shadow-lg',
        brand:
          'bg-[#E50914] hover:bg-[#c90812] text-white shadow-lg shadow-rose-950/40',
        outline:
          'bg-transparent border border-zinc-700 hover:border-zinc-500 text-white hover:bg-zinc-900/50',
        ghost:
          'bg-transparent hover:bg-white/10 text-zinc-300 hover:text-white',
      },
      size: {
        sm: 'px-4 py-1.5 text-xs gap-1.5',
        md: 'px-6 py-2.5 text-sm gap-2',
        lg: 'px-7 py-3 text-sm md:text-base gap-2.5',
        icon: 'w-10 h-10 p-0',
      },
      rounded: {
        full: 'rounded-full',
        lg: 'rounded-2xl',
        md: 'rounded-xl',
        sm: 'rounded-lg',
        none: 'rounded-none',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'lg',
      rounded: 'full',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, rounded }), className)}
        {...props}
      >
        {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
