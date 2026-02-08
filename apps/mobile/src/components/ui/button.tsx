import * as React from 'react';
import {
  TouchableOpacity,
  type TouchableOpacityProps,
  ActivityIndicator,
  Text,
  View,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-lg',
  {
    variants: {
      variant: {
        default: 'bg-violet-600 active:bg-violet-700',
        destructive: 'bg-red-600 active:bg-red-700',
        outline: 'border border-gray-700 bg-transparent active:bg-gray-800',
        secondary: 'bg-gray-800 active:bg-gray-700 border border-gray-700',
        ghost: 'bg-transparent active:bg-gray-800',
        link: 'bg-transparent underline-offset-4',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-12 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('font-medium', {
  variants: {
    variant: {
      default: 'text-white',
      destructive: 'text-white',
      outline: 'text-gray-50',
      secondary: 'text-gray-50',
      ghost: 'text-gray-50',
      link: 'text-violet-400 underline',
    },
    size: {
      default: 'text-base',
      sm: 'text-sm',
      lg: 'text-lg',
      icon: 'text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

interface ButtonProps
  extends TouchableOpacityProps,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<
  React.ElementRef<typeof TouchableOpacity>,
  ButtonProps
>(
  (
    { className, variant, size, isLoading = false, disabled, children, ...props },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <TouchableOpacity
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }), isDisabled && 'opacity-50')}
        disabled={isDisabled}
        activeOpacity={0.8}
        {...props}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : typeof children === 'string' ? (
          <Text className={buttonTextVariants({ variant, size })}>{children}</Text>
        ) : (
          children
        )}
      </TouchableOpacity>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants, buttonTextVariants };
