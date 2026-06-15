import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FieldProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground/90">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function FormSection({ title, description, children, className, action }: FormSectionProps) {
  return (
    <section className={cn('rounded-xl border border-border/50 bg-card shadow-sm', className)}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-0">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

interface FormRowProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}

export function FormRow({ children, cols = 2, className }: FormRowProps) {
  const grid = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';
  return <div className={cn('grid gap-4', grid, className)}>{children}</div>;
}

interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function FormActions({ children, className }: FormActionsProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 pt-1', className)}>
      {children}
    </div>
  );
}
