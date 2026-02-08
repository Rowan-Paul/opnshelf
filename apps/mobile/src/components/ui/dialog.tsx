import * as React from 'react';
import {
  Modal,
  View,
  type ViewProps,
  Text,
  type TextProps,
  TouchableOpacity,
  type ModalProps,
  ScrollView,
  Pressable,
} from 'react-native';
import { cn } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';

interface DialogProps extends Omit<ModalProps, 'visible'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Dialog = React.forwardRef<
  React.ElementRef<typeof Modal>,
  DialogProps
>(({ open, onOpenChange, children, ...props }, ref) => {
  return (
    <Modal
      ref={ref}
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
      {...props}
    >
      <Pressable
        className="flex-1 bg-black/70 justify-center items-center p-4"
        onPress={() => onOpenChange(false)}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
});
Dialog.displayName = 'Dialog';

const DialogContent = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      'w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-6',
      className
    )}
    {...props}
  />
));
DialogContent.displayName = 'DialogContent';

const DialogHeader = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('flex flex-col space-y-1.5 mb-4', className)}
    {...props}
  />
));
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof Text>,
  TextProps
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    className={cn(
      'text-xl font-semibold text-white',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof Text>,
  TextProps
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    className={cn('text-sm text-gray-400', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

const DialogFooter = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('flex flex-row justify-end mt-6 gap-3', className)}
    {...props}
  />
));
DialogFooter.displayName = 'DialogFooter';

const DialogClose = React.forwardRef<
  React.ElementRef<typeof TouchableOpacity>,
  React.ComponentProps<typeof TouchableOpacity>
>(({ className, onPress, ...props }, ref) => {
  return (
    <TouchableOpacity
      ref={ref}
      className={cn('absolute top-4 right-4 p-2 rounded-full', className)}
      onPress={onPress}
      activeOpacity={0.7}
      {...props}
    >
      <Ionicons name="close" size={24} color="#9ca3af" />
    </TouchableOpacity>
  );
});
DialogClose.displayName = 'DialogClose';

const DialogScrollContent = React.forwardRef<
  React.ElementRef<typeof ScrollView>,
  React.ComponentProps<typeof ScrollView>
>(({ className, ...props }, ref) => (
  <ScrollView
    ref={ref}
    className={cn('max-h-[50vh]', className)}
    showsVerticalScrollIndicator={true}
    {...props}
  />
));
DialogScrollContent.displayName = 'DialogScrollContent';

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogScrollContent,
};
