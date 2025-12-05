import React, { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent, Node, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Label } from "./Label";
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
  Palette
} from "lucide-react";

type InstructionsManagerProps = {
  instructions: any;
  onChange: (instructions: any) => void;
  disabled?: boolean;
  readOnly?: boolean;
};

// Compact color presets - vibrant colors for text
const TEXT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

// Darker highlight colors that work well with light/white text
const HIGHLIGHT_COLORS = [
  "#7c2d12", "#713f12", "#166534", "#155e75", "#1e3a8a", "#581c87", "#831843",
];

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

function InstructionsToolbar({ editor, disabled = false }: { editor: Editor | null; disabled?: boolean }) {
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

      <div className="flex-1" />

      <span className="text-xs text-muted-foreground">
        <b>Tab</b> indent, <b>Shift+Tab</b> outdent
      </span>
    </div>
  );
}

const CustomDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'bulletList',
});

export default function InstructionsManager({
  instructions,
  onChange,
  disabled = false,
  readOnly = false,
}: InstructionsManagerProps) {
  
  const editor = useEditor({
    editable: !readOnly && !disabled,
    extensions: [
      CustomDocument,
      StarterKit.configure({
        document: false,
        bulletList: {
            HTMLAttributes: { class: readOnly ? 'list-disc pl-5 space-y-1.5 marker:text-primary' : 'list-none pl-0 m-0' },
            keepMarks: true,
            keepAttributes: true,
        },
        listItem: {
            HTMLAttributes: { class: readOnly ? 'leading-relaxed' : 'relative pl-4 mb-0.5' },
        },
        codeBlock: false,
        blockquote: false,
        heading: false,
        horizontalRule: false,
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      Subscript,
      Superscript,
    ],
    content: { type: 'doc', content: [{ type: 'bulletList', content: [] }] },
    editorProps: {
        attributes: {
            class: readOnly ? "outline-none" : "outline-none h-full prose max-w-none dark:prose-invert", 
        },
        handleKeyDown: (view, event) => {
            const { selection } = view.state;
            const { $from, $to } = selection;
            const isListItem = $from.node(-1)?.type.name === 'listItem';

            const checkForRootItems = (): boolean => {
                if ($from.pos === $to.pos) return $from.depth === 3;
                let hasRoot = false;
                if ($from.depth === 3 || $to.depth === 3) return true;
                view.state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
                    if (node.type.name === 'listItem') {
                        try {
                            const $inside = view.state.doc.resolve(pos + 1);
                            if ($inside.depth <= 3) { hasRoot = true; return false; }
                        } catch { }
                    }
                });
                return hasRoot;
            };

            if (event.key === 'Tab') {
                event.preventDefault(); 
                if (event.shiftKey) {
                    if (checkForRootItems()) return true;
                    editor?.commands.liftListItem('listItem');
                } else {
                    editor?.commands.sinkListItem('listItem');
                }
                return true;
            }

            if ((event.ctrlKey || event.metaKey) && (event.key === '[' || event.key === ']')) {
                    if (isListItem) {
                        event.preventDefault();
                        if (event.key === '[') {
                        if (checkForRootItems()) return true;
                            editor?.commands.liftListItem('listItem');
                        } else {
                            editor?.commands.sinkListItem('listItem');
                        }
                        return true;
                }
            }

            if (event.key === 'Enter') {
                if (isListItem && $from.parent.content.size === 0) return true;
            }

            if (event.key === 'Backspace') {
                const { empty } = selection;
                if (empty && $from.parent.content.size === 0 && isListItem) {
                    const grandparent = $from.node(-2);
                    const isRoot = grandparent?.type.name === 'doc';
                    const index = $from.index(-1);
                    const rootBulletList = view.state.doc.firstChild;
                    const totalRootItems = rootBulletList?.childCount || 0;
                    
                    if (!isRoot) {
                        editor?.commands.liftListItem('listItem');
                        return true; 
                    } else {
                        if (index > 0 || totalRootItems > 1) {
                            editor?.commands.deleteNode('listItem');
                            return true;
                        }
                        return true;
                    }
                }
            }
            return false;
        },
        handleClick: () => false
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    onBlur: ({ editor }) => {
        const json = editor.getJSON();
        
        const removeEmptyItems = (node: any): any => {
            if (node.type === 'bulletList' && node.content) {
                    const processedContent: any[] = [];
                    node.content.forEach((listItem: any) => {
                        if (listItem.type === 'listItem') {
                            const paragraph = listItem.content?.find((c: any) => c.type === 'paragraph');
                            const hasText = paragraph?.content?.some((c: any) => c.type === 'text' && c.text?.trim());
                            const nestedBulletList = listItem.content?.find((c: any) => c.type === 'bulletList');
                        const hasNestedChildren = nestedBulletList?.content?.length > 0;
                            
                            if (!hasText) {
                                if (hasNestedChildren) {
                                    nestedBulletList.content.forEach((nestedItem: any) => {
                                        const processed = removeEmptyItems(nestedItem);
                                    if (processed) processedContent.push(processed);
                                });
                            }
                        } else {
                            const processed = removeEmptyItems(listItem);
                            if (processed) processedContent.push(processed);
                        }
                    } else {
                        const processed = removeEmptyItems(listItem);
                        if (processed) processedContent.push(processed);
                    }
                });
                return { ...node, content: processedContent };
            } else if (node.type === 'listItem' && node.content) {
                    const processedContent: any[] = [];
                    node.content.forEach((child: any) => {
                        if (child.type === 'bulletList') {
                            const processed = removeEmptyItems(child);
                        if (processed) processedContent.push(processed);
                        } else {
                            processedContent.push(child);
                        }
                    });
                return { ...node, content: processedContent };
            } else if (node.type === 'doc' && node.content) {
                const processedContent = node.content.map((child: any) => removeEmptyItems(child)).filter(Boolean);
                return { ...node, content: processedContent };
            }
            return node;
        };
        
        const cleaned = removeEmptyItems(json);
        let isEmpty = !cleaned.content?.length || !cleaned.content[0].content?.length;
        
        if (isEmpty) {
            const placeholder = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }] };
            editor.commands.setContent(placeholder);
            onChange(placeholder);
        } else if (JSON.stringify(cleaned) !== JSON.stringify(json)) {
                editor.commands.setContent(cleaned);
                onChange(cleaned);
        }
    }
  });

  useEffect(() => {
      if (editor) {
          if (editor.isEmpty && instructions?.content) {
              try { editor.commands.setContent(instructions); }
              catch { editor.commands.setContent({ type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }] }); }
          } else if (!instructions && !editor.isFocused && editor.isEmpty) {
              editor.commands.setContent({ type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }] });
          }
      }
  }, [editor, instructions]); 

  useEffect(() => {
      const style = document.createElement('style');
      style.innerHTML = readOnly ? `
          .instructions-readonly .ProseMirror { min-height: auto; padding: 0; color: var(--foreground); }
          .instructions-readonly .ProseMirror ul { list-style-type: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
          .instructions-readonly .ProseMirror li { position: relative; margin-bottom: 0; padding-left: 1.25rem; color: var(--foreground); line-height: 1.6; }
          .instructions-readonly .ProseMirror ul ul { padding-left: 1.25rem; margin-top: 0.375rem; }
          .instructions-readonly .ProseMirror p { margin: 0; color: inherit; line-height: 1.6; }
          .instructions-readonly .ProseMirror strong { font-weight: 700; color: inherit; }
          .instructions-readonly .ProseMirror li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 6px; height: 6px; border-radius: 50%; background-color: var(--primary); }
          .instructions-readonly .ProseMirror sub { vertical-align: sub; font-size: 0.75em; }
          .instructions-readonly .ProseMirror sup { vertical-align: super; font-size: 0.75em; }
        ` : `
          .instructions-editor .ProseMirror { min-height: 100%; padding-bottom: 20px; color: var(--foreground); }
          .instructions-editor .ProseMirror ul { list-style-type: none; padding: 0; margin: 0; }
          .instructions-editor .ProseMirror li { position: relative; margin-bottom: 0.2em; padding-left: 1rem; color: var(--foreground); }
          .instructions-editor .ProseMirror ul ul { padding-left: 24px; }
          .instructions-editor .ProseMirror p { margin: 0; min-height: 1.5em; line-height: 1.5; color: inherit; }
          .instructions-editor .ProseMirror strong { font-weight: 700; color: inherit; }
          .instructions-editor .ProseMirror em { font-style: italic; color: inherit; }
          .instructions-editor .ProseMirror u { text-decoration: underline; color: inherit; }
          .instructions-editor .ProseMirror s { text-decoration: line-through; color: inherit; }
          .instructions-editor .ProseMirror sub { vertical-align: sub; font-size: 0.75em; }
          .instructions-editor .ProseMirror sup { vertical-align: super; font-size: 0.75em; }
          .instructions-editor .ProseMirror li::before { content: ''; position: absolute; left: 0px; top: 0.6em; width: 6px; height: 6px; border-radius: 50%; background-color: var(--primary); }
          .instructions-editor .ProseMirror li:has(> p:empty)::before, .instructions-editor .ProseMirror li:has(> p > br:only-child)::before { background-color: var(--primary); filter: brightness(0.7); }
        `;
      document.head.appendChild(style);
      return () => { document.head.removeChild(style); }
  }, [readOnly]);

  if (readOnly) {
    return <div className="instructions-readonly text-foreground"><EditorContent editor={editor} /></div>;
  }

  return (
    <div className="space-y-2">
        <Label>Instructions <span className="text-red-500">*</span></Label>
      <div className="instructions-editor rounded-xl border border-border bg-background shadow-sm transition-all duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/25 overflow-visible">
        <InstructionsToolbar editor={editor} disabled={disabled} />
        <div className="px-4 py-3 h-[186px] overflow-y-auto cursor-text" onClick={() => editor?.commands.focus()}>
            <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </div>
  );
}
