import { cn } from '@/lib/utils';

const WIDTH = {
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  lg: 'max-w-lg',
  full: 'max-w-full',
} as const;

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
  size?: keyof typeof WIDTH;
};

export function PageContainer({ children, className, size = '5xl' }: PageContainerProps) {
  return (
    <div
      className={cn(
        WIDTH[size],
        'mx-auto min-w-0 space-y-5 sm:space-y-6 pb-8 sm:pb-10',
        className,
      )}
    >
      {children}
    </div>
  );
}
