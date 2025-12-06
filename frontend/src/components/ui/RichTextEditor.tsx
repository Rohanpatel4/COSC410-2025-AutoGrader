import React, { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  Highlighter,
  Undo2,
  Redo2,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Palette,
  List,
  ListOrdered
} from "lucide-react";

type RichTextEditorProps = {
  content: string | object | null;
  onChange: (content: object) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: string;
};

// Compact color presets - vibrant colors for text
const TEXT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

// Darker highlight colors that work well with light/white text
const HIGHLIGHT_COLORS = [
  "#7c2d12", "#713f12", "#166534", "#155e75", "#1e3a8a", "#581c87", "#831843",
];

// Toolbar Button
function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-1.5 rounded-md transition-all duration-150
        ${isActive 
          ? "bg-primary text-primary-foreground" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {children}
    </button>
  );
}

// Compact Color Picker with circles matching icon size
function TinyColorPicker({
  colors,
  currentColor,
  onSelect,
  icon,
  title,
  disabled = false,
  allowCustom = false,
}: {
  colors: string[];
  currentColor: string;
  onSelect: (color: string) => void;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  allowCustom?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#886e4c");
  const containerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as HTMLElement)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onSelect(newColor);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        title={title}
        className={`
          p-1.5 rounded-md transition-all duration-150
          text-muted-foreground hover:bg-muted hover:text-foreground
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span className="relative block">
          {icon}
          {currentColor && (
            <span 
              className="absolute -bottom-0.5 left-0.5 right-0.5 h-0.5 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 z-50">
          <div className="bg-popover border border-border rounded-md p-1.5 shadow-lg">
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {/* Color circles - fixed 14px size */}
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { onSelect(color); setIsOpen(false); }}
                  style={{ 
                    width: '14px', 
                    height: '14px', 
                    minWidth: '14px',
                    maxWidth: '14px',
                    minHeight: '14px',
                    maxHeight: '14px',
                    padding: 0,
                    margin: 0,
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: currentColor === color ? '2px solid var(--primary)' : 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title={color}
                />
              ))}

              {/* Custom color with native color picker */}
              {allowCustom && (
                <div style={{ position: 'relative', display: 'flex' }}>
                  <button
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    style={{ 
                      width: '14px', 
                      height: '14px', 
                      minWidth: '14px',
                      maxWidth: '14px',
                      minHeight: '14px',
                      maxHeight: '14px',
                      padding: 0,
                      margin: 0,
                      borderRadius: '50%',
                      backgroundColor: customColor,
                      border: (currentColor === customColor && !colors.includes(currentColor)) ? '2px solid var(--primary)' : '1.5px dashed rgba(156, 163, 175, 0.6)',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title={`Custom: ${customColor}`}
                  />
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={customColor}
                    onChange={handleCustomColorChange}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                </div>
              )}

              {/* Clear/No color button */}
              <button
                type="button"
                onClick={() => { onSelect(""); setIsOpen(false); }}
                style={{ 
                  width: '14px', 
                  height: '14px', 
                  minWidth: '14px',
                  maxWidth: '14px',
                  minHeight: '14px',
                  maxHeight: '14px',
                  padding: 0,
                  margin: 0,
                  borderRadius: '50%',
                  backgroundColor: 'transparent',
                  border: !currentColor ? '2px solid var(--primary)' : '1.5px solid rgba(156, 163, 175, 0.5)',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  flexShrink: 0,
                }}
                title="Clear"
              >
                <span style={{ 
                  width: '8px', 
                  height: '1.5px', 
                  backgroundColor: 'rgba(156,163,175,0.8)', 
                  transform: 'rotate(45deg)', 
                  position: 'absolute',
                  borderRadius: '1px',
                }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Heading Buttons
function HeadingButtons({ editor, disabled = false }: { editor: Editor | null; disabled?: boolean }) {
  if (!editor) return null;

  const headings = [
    { level: 0, icon: Type, title: "Normal" },
    { level: 1, icon: Heading1, title: "H1" },
    { level: 2, icon: Heading2, title: "H2" },
    { level: 3, icon: Heading3, title: "H3" },
  ];

  return (
    <>
      {headings.map((h) => {
        const isActive = h.level === 0 
          ? editor.isActive('paragraph') 
          : editor.isActive('heading', { level: h.level });
        
        return (
          <ToolbarButton
            key={h.level}
            onClick={() => {
              if (h.level === 0) {
                editor.chain().focus().setParagraph().run();
              } else {
                editor.chain().focus().toggleHeading({ level: h.level as 1 | 2 | 3 }).run();
              }
            }}
            isActive={isActive}
            disabled={disabled}
            title={h.title}
          >
            <h.icon className="w-4 h-4" />
          </ToolbarButton>
        );
      })}
    </>
  );
}

// Toolbar
function EditorToolbar({ editor, disabled = false }: { editor: Editor | null; disabled?: boolean }) {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    if (!editor) return;
    const updateHandler = () => forceUpdate({});
    editor.on('selectionUpdate', updateHandler);
    editor.on('transaction', updateHandler);
    return () => {
      editor.off('selectionUpdate', updateHandler);
      editor.off('transaction', updateHandler);
    };
  }, [editor]);

  if (!editor) return null;

  const currentTextColor = editor.getAttributes("textStyle").color || "";
  const currentHighlight = editor.getAttributes("highlight").color || "";

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 rounded-t-xl flex-wrap">
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={disabled || !editor.can().undo()}
        title="Undo"
      >
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={disabled || !editor.can().redo()}
        title="Redo"
      >
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <HeadingButtons editor={editor} disabled={disabled} />

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        disabled={disabled}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        disabled={disabled}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        disabled={disabled}
        title="Underline"
      >
        <UnderlineIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        disabled={disabled}
        title="Strike"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        disabled={disabled}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        disabled={disabled}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive("subscript")}
        disabled={disabled}
        title="Subscript"
      >
        <SubscriptIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive("superscript")}
        disabled={disabled}
        title="Superscript"
      >
        <SuperscriptIcon className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <TinyColorPicker
        colors={TEXT_COLORS}
        currentColor={currentTextColor}
        onSelect={(color) => {
          if (!color) editor.chain().focus().unsetColor().run();
          else editor.chain().focus().setColor(color).run();
        }}
        icon={<Palette className="w-4 h-4" />}
        title="Text Color"
        disabled={disabled}
        allowCustom={true}
      />
      <TinyColorPicker
        colors={HIGHLIGHT_COLORS}
        currentColor={currentHighlight}
        onSelect={(color) => {
          if (!color) editor.chain().focus().unsetHighlight().run();
          else editor.chain().focus().toggleHighlight({ color }).run();
        }}
        icon={<Highlighter className="w-4 h-4" />}
        title="Highlight"
        disabled={disabled}
        allowCustom={false}
      />
    </div>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "Enter text...",
  minHeight = "120px",
}: RichTextEditorProps) {
  const editor = useEditor({
    editable: !readOnly && !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: {
          HTMLAttributes: { class: 'list-disc pl-5 space-y-1' },
          keepMarks: true,
          keepAttributes: true,
        },
        orderedList: {
          HTMLAttributes: { class: 'list-decimal pl-5 space-y-1' },
          keepMarks: true,
          keepAttributes: true,
        },
        listItem: {
          HTMLAttributes: { class: '' },
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      Subscript,
      Superscript,
    ],
    content: typeof content === "string" ? content : content && Object.keys(content).length > 0 ? content : "",
    editorProps: {
      attributes: {
        class: `outline-none prose prose-sm max-w-none dark:prose-invert focus:outline-none`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  useEffect(() => {
    if (editor && content) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = typeof content === "string" ? content : JSON.stringify(content);
      if (currentContent !== newContent && !editor.isFocused) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  useEffect(() => {
    if (editor) editor.setEditable(!readOnly && !disabled);
  }, [editor, readOnly, disabled]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .rich-text-editor .ProseMirror { padding: 0.75rem 1rem; color: var(--foreground); line-height: 1.6; }
      .rich-text-editor .ProseMirror p { margin: 0 0 0.5em 0; color: inherit; }
      .rich-text-editor .ProseMirror p:last-child { margin-bottom: 0; }
      .rich-text-editor .ProseMirror strong { font-weight: 700; color: inherit; }
      .rich-text-editor .ProseMirror em { font-style: italic; color: inherit; }
      .rich-text-editor .ProseMirror u { text-decoration: underline; color: inherit; }
      .rich-text-editor .ProseMirror s { text-decoration: line-through; color: inherit; }
      .rich-text-editor .ProseMirror sub { vertical-align: sub; font-size: 0.75em; }
      .rich-text-editor .ProseMirror sup { vertical-align: super; font-size: 0.75em; }
      .rich-text-editor .ProseMirror h1 { font-size: 1.75em; font-weight: 700; margin: 0.5em 0 0.25em 0; color: var(--foreground); }
      .rich-text-editor .ProseMirror h2 { font-size: 1.5em; font-weight: 600; margin: 0.5em 0 0.25em 0; color: var(--foreground); }
      .rich-text-editor .ProseMirror h3 { font-size: 1.25em; font-weight: 600; margin: 0.5em 0 0.25em 0; color: var(--foreground); }
      .rich-text-editor .ProseMirror h1:first-child, .rich-text-editor .ProseMirror h2:first-child, .rich-text-editor .ProseMirror h3:first-child { margin-top: 0; }
      .rich-text-editor .ProseMirror ul { list-style-type: disc; padding-left: 1.25rem; margin: 0.5em 0; }
      .rich-text-editor .ProseMirror ol { list-style-type: decimal; padding-left: 1.25rem; margin: 0.5em 0; }
      .rich-text-editor .ProseMirror li { margin-bottom: 0.25em; color: var(--foreground); }
      .rich-text-editor .ProseMirror ul ul, .rich-text-editor .ProseMirror ol ol, .rich-text-editor .ProseMirror ul ol, .rich-text-editor .ProseMirror ol ul { padding-left: 1.25rem; margin-top: 0.25em; }
      .rich-text-editor-readonly .ProseMirror { padding: 0; color: var(--foreground); line-height: 1.6; }
      .rich-text-editor-readonly .ProseMirror p { margin: 0 0 0.5em 0; color: inherit; }
      .rich-text-editor-readonly .ProseMirror p:last-child { margin-bottom: 0; }
      .rich-text-editor-readonly .ProseMirror strong { font-weight: 700; color: inherit; }
      .rich-text-editor-readonly .ProseMirror h1 { font-size: 1.75em; font-weight: 700; margin: 0.5em 0 0.25em 0; color: var(--foreground); }
      .rich-text-editor-readonly .ProseMirror h2 { font-size: 1.5em; font-weight: 600; margin: 0.5em 0 0.25em 0; color: var(--foreground); }
      .rich-text-editor-readonly .ProseMirror h3 { font-size: 1.25em; font-weight: 600; margin: 0.5em 0 0.25em 0; color: var(--foreground); }
      .rich-text-editor-readonly .ProseMirror ul { list-style-type: disc; padding-left: 1.25rem; margin: 0.5em 0; }
      .rich-text-editor-readonly .ProseMirror ol { list-style-type: decimal; padding-left: 1.25rem; margin: 0.5em 0; }
      .rich-text-editor-readonly .ProseMirror li { margin-bottom: 0.25em; color: var(--foreground); }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (readOnly) {
    return (
      <div className="rich-text-editor-readonly text-foreground">
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="rich-text-editor rounded-xl border border-border bg-background shadow-sm transition-all duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/25 overflow-visible">
      <EditorToolbar editor={editor} disabled={disabled} />
      <div className="cursor-text overflow-y-auto" style={{ maxHeight: "300px" }} onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} data-placeholder={placeholder} />
      </div>
    </div>
  );
}

export { RichTextEditor };
