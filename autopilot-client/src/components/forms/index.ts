import { Field, FormSection, FormRow, FormActions } from '@/components/forms/Field';
import { FormInput } from '@/components/forms/FormInput';
import { cn } from '@/lib/utils';

export { Field, FormSection, FormRow, FormActions, FormInput };
export { formSelectTriggerClass, FormTextarea } from '@/components/forms/FormInput';

/** Wrapper for SelectTrigger with consistent form styling */
export function formSelectProps(className?: string) {
  return { className: cn('h-11 rounded-lg border-border/60 bg-muted/30 shadow-sm focus:ring-2 focus:ring-primary/15', className) };
}
