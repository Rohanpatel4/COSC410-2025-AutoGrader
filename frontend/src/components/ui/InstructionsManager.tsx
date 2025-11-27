import React, { useEffect } from "react";
import { useEditor, EditorContent, Node } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Label } from "./Label";
import { cn } from "../../lib/utils";

type InstructionsManagerProps = {
  instructions: any; // Tiptap JSON content
  onChange: (instructions: any) => void;
  disabled?: boolean;
  readOnly?: boolean;
};

// Define Custom Document to enforce bullet list structure
const CustomDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'bulletList', // Restrict document to only contain a bulletList
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
        document: false, // Disable default document to use our strict one
        bulletList: {
            HTMLAttributes: {
                class: readOnly ? 'list-disc pl-5 space-y-1.5 marker:text-primary' : 'list-none pl-0 m-0', 
            },
            keepMarks: true,
            keepAttributes: true,
        },
        listItem: {
            HTMLAttributes: {
                class: readOnly ? 'text-foreground leading-relaxed' : 'relative pl-4 mb-0.5', 
            },
        }
      }),
    ],
    content: { type: 'doc', content: [{ type: 'bulletList', content: [] }] },
    editorProps: {
        attributes: {
            class: readOnly 
              ? "outline-none text-foreground" 
              : "outline-none h-full prose max-w-none dark:prose-invert", 
        },
        handleKeyDown: (view, event) => {
            const { selection } = view.state;
            const { $from, $to } = selection;
            const isListItem = $from.node(-1)?.type.name === 'listItem';

            // Helper to check if any selected listItem is at root level
            const checkForRootItems = (): boolean => {
                // For single cursor (no selection), just check $from
                if ($from.pos === $to.pos) {
                    return $from.depth === 3;
                }
                
                // For selection, check all positions
                let hasRoot = false;
                
                // Check start and end of selection
                if ($from.depth === 3 || $to.depth === 3) {
                    return true;
                }
                
                // Check all listItems in selection range
                view.state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
                    if (node.type.name === 'listItem') {
                        try {
                            const $inside = view.state.doc.resolve(pos + 1);
                            if ($inside.depth <= 3) {
                                hasRoot = true;
                                return false; // Stop iteration
                            }
                        } catch {
                            // Ignore errors
                        }
                    }
                });
                
                return hasRoot;
            };

            // Handle Tab Indentation
            if (event.key === 'Tab') {
                event.preventDefault(); 
                
                if (event.shiftKey) {
                    // OUTDENT - block if any selected item is at root
                    if (checkForRootItems()) {
                        return true; // Block - at least one item is at root
                    }
                    editor?.commands.liftListItem('listItem');
                } else {
                    // INDENT
                    editor?.commands.sinkListItem('listItem');
                }
                return true;
            }

            // Handle Ctrl+[ / ]
            if (event.ctrlKey || event.metaKey) {
                if (event.key === '[' || event.key === ']') {
                    if (isListItem) {
                        event.preventDefault();
                        if (event.key === '[') {
                            // OUTDENT - block if any selected item is at root
                            if (checkForRootItems()) {
                                return true; // Block - at least one item is at root
                            }
                            editor?.commands.liftListItem('listItem');
                        } else {
                            editor?.commands.sinkListItem('listItem');
                        }
                        return true;
                    }
                }
            }

            // Handle Enter: Prevent breaking out of list if empty
            if (event.key === 'Enter') {
                const isEmpty = $from.parent.content.size === 0;
                if (isListItem && isEmpty) {
                     return true;
                }
            }

            // Handle Backspace
            if (event.key === 'Backspace') {
                const { empty } = selection;
                const isEmptyLine = $from.parent.content.size === 0;

                if (empty && isEmptyLine && isListItem) {
                    // Check nesting level
                    const grandparent = $from.node(-2); // bulletList
                    const isRoot = grandparent?.type.name === 'doc';
                    
                    // Get the index of this listItem in its parent bulletList
                    const index = $from.index(-1);
                    
                    // Count total items in the root bulletList
                    const rootBulletList = view.state.doc.firstChild;
                    const totalRootItems = rootBulletList?.childCount || 0;
                    
                    if (!isRoot) {
                        // Nested: unindent (lift to parent level)
                        editor?.commands.liftListItem('listItem');
                        return true; 
                    } else {
                        // Root level empty item
                        if (index > 0) {
                            // Not the first item - delete this line and join with previous
                            editor?.commands.deleteNode('listItem');
                            return true;
                        } else if (totalRootItems > 1) {
                            // First item but there are more items - delete this line
                            editor?.commands.deleteNode('listItem');
                            return true;
                        } else {
                            // Only one item left - keep it (can't delete the last bullet)
                            return true;
                        }
                    }
                }
            }
            return false;
        },
        handleClick: (view, pos, event) => {
             return false;
        }
    },
    onUpdate: ({ editor }) => {
        const json = editor.getJSON();
        onChange(json);
    },
    onBlur: ({ editor }) => {
        const json = editor.getJSON();
        
        // Remove empty listItems directly from Tiptap structure
        // This preserves the valid nesting structure
        const removeEmptyItems = (node: any): any => {
            if (node.type === 'bulletList') {
                // Process listItems in this bulletList
                if (node.content && Array.isArray(node.content)) {
                    const processedContent: any[] = [];
                    
                    node.content.forEach((listItem: any) => {
                        if (listItem.type === 'listItem') {
                            // Check if this listItem is empty
                            const paragraph = listItem.content?.find((c: any) => c.type === 'paragraph');
                            const hasText = paragraph?.content?.some((c: any) => c.type === 'text' && c.text?.trim());
                            
                            // Check if this listItem has nested children
                            const nestedBulletList = listItem.content?.find((c: any) => c.type === 'bulletList');
                            const hasNestedChildren = nestedBulletList && nestedBulletList.content && nestedBulletList.content.length > 0;
                            
                            if (!hasText) {
                                // This listItem is empty
                                if (hasNestedChildren) {
                                    // Promote nested children to this level (same level as the empty item)
                                    // Process the nested children first, then add them here
                                    nestedBulletList.content.forEach((nestedItem: any) => {
                                        // Process nested item recursively
                                        const processed = removeEmptyItems(nestedItem);
                                        if (processed) {
                                            processedContent.push(processed);
                                        }
                                    });
                                    // Don't add the empty item itself
                                }
                                // If no nested children, just skip this empty item
                            } else {
                                // Not empty - process it recursively
                                const processed = removeEmptyItems(listItem);
                                if (processed) {
                                    processedContent.push(processed);
                                }
                            }
                        } else {
                            // Not a listItem - process normally
                            const processed = removeEmptyItems(listItem);
                            if (processed) {
                                processedContent.push(processed);
                            }
                        }
                    });
                    
                    return {
                        ...node,
                        content: processedContent
                    };
                }
            } else if (node.type === 'listItem') {
                // Process listItem's content (paragraphs, nested lists, etc.)
                if (node.content && Array.isArray(node.content)) {
                    const processedContent: any[] = [];
                    node.content.forEach((child: any) => {
                        if (child.type === 'bulletList') {
                            // Process nested bulletList
                            const processed = removeEmptyItems(child);
                            if (processed) {
                                processedContent.push(processed);
                            }
                        } else {
                            // Keep other content (paragraphs, etc.)
                            processedContent.push(child);
                        }
                    });
                    
                    return {
                        ...node,
                        content: processedContent
                    };
                }
            } else if (node.type === 'doc') {
                // Process root level
                if (node.content && Array.isArray(node.content)) {
                    const processedContent = node.content
                        .map((child: any) => removeEmptyItems(child))
                        .filter((child: any) => child !== null);
                    
                    return {
                        ...node,
                        content: processedContent
                    };
                }
            }
            
            return node;
        };
        
        const cleaned = removeEmptyItems(json);
        
        // Ensure at least one item exists
        let isEmpty = false;
        if (!cleaned.content || cleaned.content.length === 0) {
            isEmpty = true;
        } else if (cleaned.content[0].content && cleaned.content[0].content.length === 0) {
            isEmpty = true;
        }
        
        if (isEmpty) {
            // All items were empty - add one placeholder
            const placeholder = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }] };
            editor.commands.setContent(placeholder);
            onChange(placeholder);
        } else {
            // Items were removed - update editor
            // Only update if changed to prevent loop (JSON stringify for basic deep equality check)
            if (JSON.stringify(cleaned) !== JSON.stringify(json)) {
                editor.commands.setContent(cleaned);
                onChange(cleaned);
            }
        }
    }
  });

  // Init effect
  useEffect(() => {
      if (editor) {
          if (editor.isEmpty && instructions && Object.keys(instructions).length > 0) {
              // If editor is empty but we have instructions, load them
              // Check if instructions is a valid Tiptap doc (has content)
              if (instructions.content) {
                  try {
                      editor.commands.setContent(instructions);
                  } catch (e) {
                      console.error("Failed to load instructions:", e);
                      // Fallback to empty
                      const initial = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }] };
                      editor.commands.setContent(initial);
                  }
              }
          } else if ((!instructions || Object.keys(instructions).length === 0) && !editor.isFocused) {
              // Initialize empty state
              const initial = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }] };
              if (editor.isEmpty) {
                  editor.commands.setContent(initial);
              }
          }
      }
  }, [editor, instructions]); 

  // Add CSS for bullets
  useEffect(() => {
      const style = document.createElement('style');
      
      if (readOnly) {
        // Readonly styling - cleaner look for student view
        style.innerHTML = `
          .instructions-readonly .ProseMirror {
              min-height: auto;
              padding: 0;
              color: var(--foreground);
          }
          .instructions-readonly .ProseMirror ul {
              list-style-type: none;
              padding: 0;
              margin: 0;
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
          }
          .instructions-readonly .ProseMirror li {
              position: relative;
              margin-bottom: 0;
              padding-left: 1.25rem;
              color: var(--foreground);
              line-height: 1.6;
          }
          .instructions-readonly .ProseMirror ul ul {
              padding-left: 1.25rem;
              margin-top: 0.375rem;
          }
          .instructions-readonly .ProseMirror p {
              margin: 0;
              color: var(--foreground);
              line-height: 1.6;
          }
          /* Custom Bullet - Theme Color (Gold) */
          .instructions-readonly .ProseMirror li::before {
              content: '';
              position: absolute;
              left: 0;
              top: 0.55em;
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background-color: var(--primary);
          }
        `;
      } else {
        // Edit mode styling
        style.innerHTML = `
          .ProseMirror {
              min-height: 100%;
              padding-bottom: 20px; 
          }
          .ProseMirror ul {
              list-style-type: none;
              padding: 0;
              margin: 0;
          }
          .ProseMirror li {
              position: relative;
              margin-bottom: 0.2em;
              padding-left: 1rem; 
          }
          .ProseMirror ul ul {
              padding-left: 24px; 
          }
          .ProseMirror p {
              margin: 0;
              min-height: 1.5em;
              line-height: 1.5;
          }
          /* Custom Bullet - Theme Color (Gold) */
          .ProseMirror li::before {
              content: '';
              position: absolute;
              left: 0px; 
              top: 0.6em; 
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background-color: var(--primary);
          }
          /* Empty bullet - Darker Shade of Primary (not grey) */
          .ProseMirror li:has(> p:empty)::before,
          .ProseMirror li:has(> p > br:only-child)::before,
          .ProseMirror li:has(> p.is-empty)::before {
              background-color: var(--primary);
              filter: brightness(0.7);
          }
        `;
      }
      
      document.head.appendChild(style);
      return () => {
          document.head.removeChild(style);
      }
  }, [readOnly]);

  if (readOnly) {
    return (
      <div className="instructions-readonly text-foreground">
         <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Instructions</Label>
        <span className="text-xs text-muted-foreground">
          <b>Tab</b> indent, <b>Shift+Tab</b> outdent.
        </span>
      </div>

      <div className="rounded-xl border border-border bg-background shadow-sm transition-all duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/25">
        <div className="px-4 py-3 h-[186px] overflow-y-auto cursor-text" onClick={() => editor?.commands.focus()}>
            <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </div>
  );
}
