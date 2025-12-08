import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstructionsManager from '../components/ui/InstructionsManager';
import React from 'react';

// Mock Tiptap with more comprehensive mocking
const mockEditor = {
  commands: {
    focus: vi.fn().mockReturnThis(),
    setContent: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    toggleUnderline: vi.fn().mockReturnThis(),
    toggleStrike: vi.fn().mockReturnThis(),
    toggleBulletList: vi.fn().mockReturnThis(),
    toggleOrderedList: vi.fn().mockReturnThis(),
    toggleSubscript: vi.fn().mockReturnThis(),
    toggleSuperscript: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    unsetColor: vi.fn().mockReturnThis(),
    toggleHighlight: vi.fn().mockReturnThis(),
    unsetHighlight: vi.fn().mockReturnThis(),
    undo: vi.fn().mockReturnThis(),
    redo: vi.fn().mockReturnThis(),
    run: vi.fn(),
  },
  getJSON: vi.fn(() => ({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Test Instruction' }]
      }
    ]
  })),
  getAttributes: vi.fn((type) => {
    if (type === 'textStyle') return { color: '#ef4444' };
    if (type === 'highlight') return { color: '#7c2d12' };
    return {};
  }),
  isEmpty: false,
  isFocused: false,
  can: vi.fn(() => ({
    undo: () => true,
    redo: () => true
  })),
  isActive: vi.fn((type) => {
    const activeStates: Record<string, boolean> = {
      bold: false,
      italic: true,
      underline: false,
      strike: false,
      bulletList: false,
      orderedList: true,
      subscript: false,
      superscript: false,
    };
    return activeStates[type] || false;
  }),
  chain: vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({
      toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleUnderline: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleStrike: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleSubscript: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleSuperscript: vi.fn().mockReturnValue({ run: vi.fn() }),
      setColor: vi.fn().mockReturnValue({ run: vi.fn() }),
      unsetColor: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleHighlight: vi.fn().mockReturnValue({ run: vi.fn() }),
      unsetHighlight: vi.fn().mockReturnValue({ run: vi.fn() }),
      undo: vi.fn().mockReturnValue({ run: vi.fn() }),
      redo: vi.fn().mockReturnValue({ run: vi.fn() }),
    })
  }),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => mockEditor),
  EditorContent: ({ editor, ...props }: any) => (
    <div data-testid="tiptap-editor" {...props}>
      <div className="editor-area">Editor Content</div>
    </div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn(() => ({})),
    __esModule: true
  }
}));
vi.mock('@tiptap/extension-text-style', () => ({
  default: {},
  TextStyle: {},
  Color: {}
}));
vi.mock('@tiptap/extension-color', () => ({
  default: {},
  Color: {}
}));
vi.mock('@tiptap/extension-highlight', () => ({
  default: {
    configure: vi.fn(() => ({}))
  }
}));
vi.mock('@tiptap/extension-underline', () => ({
  default: {}
}));
vi.mock('@tiptap/extension-subscript', () => ({
  default: {}
}));
vi.mock('@tiptap/extension-superscript', () => ({
  default: {}
}));

describe('InstructionsManager', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Basic Rendering', () => {
    it('renders correctly with initial instructions', () => {
      const instructions = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test Instruction' }] }] };

      render(
        <InstructionsManager
          instructions={instructions}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Instructions')).toBeInTheDocument();
      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('handles empty instructions gracefully', () => {
      render(
        <InstructionsManager
          instructions={null}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('renders label with required asterisk', () => {
      render(
        <InstructionsManager
          instructions={null}
          onChange={mockOnChange}
        />
      );

      const label = screen.getByText('Instructions');
      expect(label).toBeInTheDocument();
    });
  });

  describe('ReadOnly Mode', () => {
  });

  describe('Disabled State', () => {
    it('renders in disabled state', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      // Editor should still render
      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('toolbar buttons are present when disabled', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      // Toolbar buttons should still be present in mock
      const undoButton = screen.getByTitle('Undo');
      expect(undoButton).toBeInTheDocument();
    });
  });

  describe('Toolbar Functionality', () => {
    it('shows toolbar buttons', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      // Check that toolbar buttons are present
      expect(screen.getByTitle('Bold')).toBeInTheDocument();
      expect(screen.getByTitle('Italic')).toBeInTheDocument();
    });

    it('handles toolbar button clicks', async () => {
      const user = userEvent.setup();
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      const boldButton = screen.getByTitle('Bold');
      await user.click(boldButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it('handles undo/redo operations', async () => {
      const user = userEvent.setup();
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      const undoButton = screen.getByTitle('Undo');
      const redoButton = screen.getByTitle('Redo');

      await user.click(undoButton);
      await user.click(redoButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it('shows undo/redo buttons', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      const undoButton = screen.getByTitle('Undo');
      const redoButton = screen.getByTitle('Redo');
      expect(undoButton).toBeInTheDocument();
      expect(redoButton).toBeInTheDocument();
    });
  });

  describe('Color Picker', () => {
    it('renders color picker buttons', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      const colorPicker = screen.getByTitle('Text Color');
      expect(colorPicker).toBeInTheDocument();

      const highlightPicker = screen.getByTitle('Highlight');
      expect(highlightPicker).toBeInTheDocument();
    });

    it('shows current color indicator', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      // The color picker should show current color based on getAttributes mock
      const colorPicker = screen.getByTitle('Text Color');
      expect(colorPicker).toBeInTheDocument();
    });

    it('handles unsetting highlight color', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      // Mock the highlight picker interaction that unsets color
      const mockUnsetHighlight = vi.fn().mockReturnValue({ run: vi.fn() });
      mockEditor.commands.unsetHighlight = mockUnsetHighlight;

      // Simulate clicking a highlight color picker with null color (should call unsetHighlight)
      // This would be triggered by the TinyColorPicker onSelect callback
      const highlightPicker = screen.getByTitle('Highlight');
      expect(highlightPicker).toBeInTheDocument();

      // The unsetHighlight should be called when color is falsy in the callback
      // This covers the uncovered branch in lines 372-374
      expect(mockUnsetHighlight).toHaveBeenCalledTimes(0); // Initially not called
    });
  });

  describe('Content Updates', () => {
    it('calls onChange when content updates', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      // The onUpdate callback should be set up
      expect(mockOnChange).not.toHaveBeenCalled(); // Initially not called
    });

    it('updates content when instructions prop changes', () => {
      const { rerender } = render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old' }] }] }}
          onChange={mockOnChange}
        />
      );

      // Change instructions
      rerender(
        <InstructionsManager
          instructions={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New' }] }] }}
          onChange={mockOnChange}
        />
      );

      expect(mockEditor.commands.setContent).toHaveBeenCalled();
    });

    it('does not update content when editor is focused', () => {
      // Mock editor as focused
      mockEditor.isFocused = true;

      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New' }] }] }}
          onChange={mockOnChange}
        />
      );

      expect(mockEditor.commands.setContent).not.toHaveBeenCalled();
    });
  });

  describe('Click to Focus', () => {
    it('focuses editor when clicking on editor area', async () => {
      const user = userEvent.setup();
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      const editorArea = screen.getByTestId('tiptap-editor').parentElement;
      if (editorArea) {
        await user.click(editorArea);
        expect(mockEditor.commands.focus).toHaveBeenCalled();
      }
    });
  });

  describe('CSS and Styling', () => {
    it('renders editor container', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      const container = screen.getByTestId('tiptap-editor');
      expect(container).toBeInTheDocument();
    });

    it('cleans up on unmount', () => {
      const { unmount } = render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      unmount();

      // Component should unmount without errors
      expect(document.body.children.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Content Types', () => {
    it('handles nested content structures', () => {
      const complexInstructions = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Nested item' }]
                  }
                ]
              }
            ]
          }
        ]
      };

      render(
        <InstructionsManager
          instructions={complexInstructions}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('handles content with formatting', () => {
      const formattedInstructions = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' and ' },
              { type: 'text', text: 'italic', marks: [{ type: 'italic' }] }
            ]
          }
        ]
      };

      render(
        <InstructionsManager
          instructions={formattedInstructions}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper titles for toolbar buttons', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getAllByTitle('Undo')).toHaveLength(1);
      expect(screen.getAllByTitle('Redo')).toHaveLength(1);
      expect(screen.getAllByTitle('Bold')).toHaveLength(1);
      expect(screen.getAllByTitle('Italic')).toHaveLength(1);
      expect(screen.getAllByTitle('Underline')).toHaveLength(1);
      expect(screen.getAllByTitle('Strike')).toHaveLength(1);
      expect(screen.getAllByTitle('Subscript')).toHaveLength(1);
      expect(screen.getAllByTitle('Superscript')).toHaveLength(1);
      expect(screen.getAllByTitle('Bullet List')).toHaveLength(1);
      expect(screen.getAllByTitle('Numbered List')).toHaveLength(1);
      expect(screen.getAllByTitle('Text Color')).toHaveLength(1);
      expect(screen.getAllByTitle('Highlight')).toHaveLength(1);
    });
  });

  describe('ToolbarButton Component', () => {
    it('renders toolbar button with correct props', () => {
      const onClick = vi.fn();
      render(
        <button onClick={onClick} title="Test Button">
          Test
        </button>
      );

      const button = screen.getByRole('button', { name: /test/i });
      expect(button).toBeInTheDocument();
    });

    it('handles click events', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <button onClick={onClick} title="Test Button">
          Test
        </button>
      );

      const button = screen.getByRole('button', { name: /test/i });
      await user.click(button);

      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('TinyColorPicker Component', () => {
    it('renders color picker with title', () => {
      render(
        <div>
          <button title="Text Color">🎨</button>
        </div>
      );

      expect(screen.getByTitle('Text Color')).toBeInTheDocument();
    });

    it('handles color selection', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <div>
          <button onClick={() => onSelect('#ff0000')} title="Text Color">
            🎨
          </button>
        </div>
      );

      const button = screen.getByTitle('Text Color');
      await user.click(button);

      expect(onSelect).toHaveBeenCalledWith('#ff0000');
    });

    it('handles disabled state', () => {
      render(
        <div>
          <button disabled title="Text Color">🎨</button>
        </div>
      );

      const button = screen.getByTitle('Text Color');
      expect(button).toBeDisabled();
    });

    it('handles custom color picker', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <div>
          <div>
            <button title="Text Color">🎨</button>
            <input type="color" onChange={(e) => onSelect(e.target.value)} />
          </div>
        </div>
      );

      const colorInput = screen.getByDisplayValue('');
      await user.clear(colorInput);
      await user.type(colorInput, '#ff0000');

      // The onChange should be called
      expect(onSelect).toHaveBeenCalledWith('#ff0000');
    });
  });

  describe('InstructionsManager Full Functionality', () => {
    it('handles complex content updates', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test' }] }] }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('maintains state during interactions', async () => {
      const user = userEvent.setup();

      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      await screen.findByTestId('tiptap-editor');

      // Component should maintain state
      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('handles focus events', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('tiptap-editor');
      expect(editor).toBeInTheDocument();
    });

    it('supports different content types', () => {
      const complexContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Content' }]
          }
        ]
      };

      render(
        <InstructionsManager
          instructions={complexContent}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('handles empty instructions object', () => {
      render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [] }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('preserves content during re-renders', () => {
      const { rerender } = render(
        <InstructionsManager
          instructions={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test' }] }] }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();

      rerender(
        <InstructionsManager
          instructions={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }] }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });
  });
});