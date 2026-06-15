import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Heading2, Quote, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { isHtmlContent, normalizeRichContent } from "@/lib/rich-text";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

const ToolbarButton = ({
  onClick,
  isActive,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={onClick}
    title={title}
    className={cn(
      "h-7 w-7 p-0",
      isActive && "bg-primary/10 text-primary"
    )}
  >
    {children}
  </Button>
);

const RichTextEditor = ({ value, onChange, placeholder = "Start typing...", minHeight = "120px", className }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none text-foreground",
          "prose-headings:font-display prose-headings:text-foreground",
          "prose-p:text-foreground prose-p:my-1",
          "prose-ul:text-foreground prose-ol:text-foreground",
          "prose-blockquote:border-primary/30 prose-blockquote:text-muted-foreground",
          "prose-strong:text-foreground prose-em:text-foreground prose-u:underline",
          "prose-a:text-primary prose-a:underline",
        ),
        style: `min-height: ${minHeight}; padding: 0.75rem;`,
      },
    },
  });

  // Sync external value changes (e.g. on load)
  useEffect(() => {
    if (!editor) return;

    const current = editor.getHTML();
    const next = normalizeRichContent(value || '');

    if (value !== current && next !== current) {
      editor.commands.setContent(next || '<p></p>', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border border-input bg-background overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1 bg-muted/30 flex-wrap">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const prev = editor.getAttributes('link').href as string | undefined;
            const url = window.prompt('Link URL', prev ?? 'https://');
            if (url === null) return;
            if (!url.trim()) {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
          }}
          isActive={editor.isActive('link')}
          title="Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered List">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Quote">
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} isActive={editor.isActive({ textAlign: "left" })} title="Align Left">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} isActive={editor.isActive({ textAlign: "center" })} title="Align Center">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} isActive={editor.isActive({ textAlign: "right" })} title="Align Right">
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
