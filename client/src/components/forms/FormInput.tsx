import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type IconComponent = React.ComponentType<{ className?: string }>;

const fieldClass =
  'h-12 rounded-md border border-foreground bg-card px-3.5 text-sm transition-colors placeholder:text-muted-foreground focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-foreground';

interface FormInputProps extends React.ComponentProps<'input'> {
  icon?: IconComponent;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ icon: Icon, className, ...props }, ref) => (
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        ref={ref}
        className={cn(fieldClass, Icon && 'pl-10', className)}
        {...props}
      />
    </div>
  ),
);
FormInput.displayName = 'FormInput';

interface FormTextareaProps extends React.ComponentProps<'textarea'> {}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className, ...props }, ref) => (
    <Textarea
      ref={ref}
      className={cn(
        'min-h-[88px] rounded-md border border-foreground bg-card px-3.5 py-2.5 text-sm resize-none transition-colors focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-foreground',
        className,
      )}
      {...props}
    />
  ),
);
FormTextarea.displayName = 'FormTextarea';

export function formSelectTriggerClass(className?: string) {
  return cn(
    'h-12 rounded-md border border-foreground bg-card shadow-none focus:ring-2 focus:ring-foreground',
    className,
  );
}
