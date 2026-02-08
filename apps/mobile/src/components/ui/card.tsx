import * as React from 'react';
import { View, type ViewProps, Text, type TextProps } from 'react-native';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      'rounded-lg border border-gray-800 bg-gray-900',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  React.ElementRef<typeof Text>,
  TextProps
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight text-gray-50',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  React.ElementRef<typeof Text>,
  TextProps
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    className={cn('text-sm text-gray-400', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps
>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('flex flex-row items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
