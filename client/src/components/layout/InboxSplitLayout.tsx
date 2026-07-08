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
  listMinHeight = 'min-h-[280px] md:min-h-[520px]',
  detailMinHeight = 'min-h-[360px] md:min-h-[520px]',
}: InboxSplitLayoutProps) {
  const isMobile = useIsMobile();
  const showList = !isMobile || !hasSelection;
  const showDetail = !isMobile || hasSelection;

  return (
    <div
      className={cn(
        'grid md:grid-cols-[minmax(220px,280px)_1fr] gap-4',
        listMinHeight,
        className,
      )}
    >
      {showList && (
        <Card className="overflow-hidden min-w-0 flex flex-col">
          <CardContent className="p-0 flex flex-col flex-1 min-h-0">{list}</CardContent>
        </Card>
      )}

      {showDetail && (
        <div className={cn('min-w-0 flex flex-col', detailMinHeight)}>
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
