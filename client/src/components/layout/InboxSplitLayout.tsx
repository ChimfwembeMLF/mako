import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type InboxSplitLayoutProps = {
  list: React.ReactNode;
  detail: React.ReactNode;
  hasSelection: boolean;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
  listMinHeight?: string;
  detailMinHeight?: string;
};

export function InboxSplitLayout({
  list,
  detail,
  hasSelection,
  onBack,
  backLabel = 'Conversations',
  className,
  // A fixed-height panel: the list and the conversation scroll inside it instead of growing the page.
  // Sized to the space below the inbox header, so the reply box stays on screen.
  listMinHeight = 'md:h-[calc(100dvh-23rem)] md:min-h-[440px]',
  detailMinHeight = 'h-[calc(100dvh-5.5rem)] min-h-[400px] md:h-auto md:min-h-0',
}: InboxSplitLayoutProps) {
  const isMobile = useIsMobile();
  const showList = !isMobile || !hasSelection;
  const showDetail = !isMobile || hasSelection;
  const detailRef = useRef<HTMLDivElement>(null);

  // On phones the inbox header fills most of the screen, so bring an opened
  // conversation (and its reply box) fully into view.
  useEffect(() => {
    if (isMobile && hasSelection) detailRef.current?.scrollIntoView({ block: 'start' });
  }, [isMobile, hasSelection]);

  return (
    <div
      className={cn(
        'grid md:grid-cols-[minmax(220px,280px)_1fr] gap-4',
        listMinHeight,
        className,
      )}
    >
      {showList && (
        <Card className="overflow-hidden min-w-0 min-h-0 flex flex-col max-md:max-h-[70dvh]">
          <CardContent className="p-0 flex flex-col flex-1 min-h-0">{list}</CardContent>
        </Card>
      )}

      {showDetail && (
        <div ref={detailRef} className={cn('min-w-0 min-h-0 flex flex-col overflow-hidden scroll-mt-20', detailMinHeight)}>
          {isMobile && hasSelection && onBack && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 h-8 w-fit shrink-0"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {backLabel}
            </Button>
          )}
          {detail}
        </div>
      )}
    </div>
  );
}
