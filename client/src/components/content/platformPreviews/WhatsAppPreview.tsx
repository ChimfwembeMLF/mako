import { CheckCheck } from 'lucide-react';
import { RichTextContent } from '@/components/RichTextContent';
import { htmlToPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import type { SocialPreviewProps } from './types';

export function WhatsAppPreview({
  payload,
  mode = 'draft',
  authorName = 'Your Business',
  className,
}: SocialPreviewProps) {
  const plain = htmlToPlainText(payload.content ?? '');

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden max-w-sm shadow-sm border',
        'bg-[#e5ddd5] dark:bg-[#0b141a]',
        className,
      )}
    >
      <div className="bg-[#075e54] dark:bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-semibold">
          {authorName.slice(0, 1)}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{authorName}</p>
          <p className="text-[11px] text-white/70">Business account</p>
        </div>
      </div>

      <div
        className="p-3 min-h-[120px] space-y-2"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23c8c4bc\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      >
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] dark:bg-[#005c4b] px-3 py-2 shadow-sm">
            {mode === 'published' ? (
              <p className="text-sm whitespace-pre-wrap text-[#111b21] dark:text-[#e9edef]">{plain}</p>
            ) : (
              <RichTextContent
                html={payload.content ?? ''}
                emptyPlaceholder="Broadcast message…"
                className="text-sm text-[#111b21] dark:text-[#e9edef]"
              />
            )}
            <p className="text-[10px] text-[#667781] mt-1 flex items-center justify-end gap-1">
              12:30 <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
