import { useEffect, useState } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { cn } from '@/lib/utils';
import { Eye, Pencil } from 'lucide-react';

export interface BrandMarkdownFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  hint?: string;
}

function useIsDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false,
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return dark;
}

/**
 * GitHub-style markdown field for Brand Brain — Write / Preview tabs, markdown stored as plain text.
 */
export function BrandMarkdownField({
  id,
  value,
  onChange,
  placeholder,
  minHeight = 200,
  className,
  hint,
}: BrandMarkdownFieldProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const isDark = useIsDarkMode();

  return (
    <div
      id={id}
      data-color-mode={isDark ? 'dark' : 'light'}
      className={cn(
        'rounded-lg border border-input bg-background overflow-hidden shadow-sm',
        'focus-within:ring-2 focus-within:ring-ring/40 focus-within:border-primary/40',
        className,
      )}
    >
      {/* GitHub-style tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-1">
        <div className="flex">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              mode === 'write'
                ? 'border-primary text-foreground bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Pencil className="h-3 w-3" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              mode === 'preview'
                ? 'border-primary text-foreground bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
        </div>
        <span className="hidden sm:inline text-[10px] text-muted-foreground px-3">
          Markdown supported
        </span>
      </div>

      {hint && (
        <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border/60 bg-muted/20">
          {hint}
        </p>
      )}

      <div className="brand-markdown-editor">
        {mode === 'write' ? (
          <MDEditor
            value={value}
            onChange={(v) => onChange(v ?? '')}
            preview="edit"
            visibleDragbar={false}
            height={minHeight}
            textareaProps={{
              placeholder: placeholder ?? 'Write with Markdown…',
              spellCheck: true,
            }}
            extraCommands={[
              commands.group(
                [
                  commands.title1,
                  commands.title2,
                  commands.title3,
                  commands.divider,
                  commands.bold,
                  commands.italic,
                  commands.strikethrough,
                  commands.divider,
                  commands.unorderedListCommand,
                  commands.orderedListCommand,
                  commands.checkedListCommand,
                  commands.divider,
                  commands.quote,
                  commands.code,
                  commands.codeBlock,
                  commands.divider,
                  commands.link,
                  commands.hr,
                ],
                {
                  name: 'brand-brain-formatting',
                  groupName: 'brand-brain-formatting',
                  buttonProps: { 'aria-label': 'Formatting' },
                },
              ),
            ]}
          />
        ) : (
          <div
            className="overflow-y-auto px-4 py-3 prose prose-sm dark:prose-invert max-w-none min-h-[120px]"
            style={{ minHeight }}
          >
            {value.trim() ? (
              <MDEditor.Markdown source={value} />
            ) : (
              <p className="text-sm text-muted-foreground italic not-prose">
                Nothing to preview yet. Switch to Write and add content using Markdown.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
