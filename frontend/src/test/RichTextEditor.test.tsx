import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RichTextEditor } from "../components/ui/RichTextEditor";

// Create a more complete mock editor
const mockEditor = {
  chain: () => ({
    focus: () => ({
      toggleBold: () => ({ run: vi.fn() }),
      toggleItalic: () => ({ run: vi.fn() }),
      toggleUnderline: () => ({ run: vi.fn() }),
      toggleStrike: () => ({ run: vi.fn() }),
      toggleBulletList: () => ({ run: vi.fn() }),
      toggleOrderedList: () => ({ run: vi.fn() }),
      toggleSubscript: () => ({ run: vi.fn() }),
      toggleSuperscript: () => ({ run: vi.fn() }),
      setParagraph: () => ({ run: vi.fn() }),
      toggleHeading: () => ({ run: vi.fn() }),
      undo: () => ({ run: vi.fn() }),
      redo: () => ({ run: vi.fn() }),
      setColor: () => ({ run: vi.fn() }),
      unsetColor: () => ({ run: vi.fn() }),
      toggleHighlight: () => ({ run: vi.fn() }),
      unsetHighlight: () => ({ run: vi.fn() }),
    }),
  }),
  isActive: vi.fn(() => false),
  can: vi.fn(() => ({ undo: () => true, redo: () => true })),
  getAttributes: vi.fn(() => ({})),
  commands: {
    focus: vi.fn(),
    setContent: vi.fn(),
  },
  setEditable: vi.fn(),
  getJSON: vi.fn(() => ({})),
  isFocused: false,
  on: vi.fn(),
  off: vi.fn(),
};

// Mock TipTap
vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => ({
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleUnderline: () => ({ run: vi.fn() }),
        toggleStrike: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
        toggleSubscript: () => ({ run: vi.fn() }),
        toggleSuperscript: () => ({ run: vi.fn() }),
        undo: () => ({ run: vi.fn() }),
        redo: () => ({ run: vi.fn() }),
        setColor: () => ({ run: vi.fn() }),
        unsetColor: () => ({ run: vi.fn() }),
        toggleHighlight: () => ({ run: vi.fn() }),
        unsetHighlight: () => ({ run: vi.fn() }),
      }),
    }),
    isActive: vi.fn(() => false),
    can: vi.fn(() => ({ undo: () => true, redo: () => true })),
    getAttributes: vi.fn(() => ({})),
    commands: {
      focus: vi.fn(),
      setContent: vi.fn(),
    },
    setEditable: vi.fn(),
    getJSON: vi.fn(() => ({})),
    isFocused: false,
    on: vi.fn(),
    off: vi.fn(),
  })),
  EditorContent: ({ editor, ...props }: any) => (
    <div {...props} data-testid="editor-content" onClick={() => editor?.commands.focus()}>
      <div className="editor-area">Editor Content</div>
    </div>
  ),
}));

// Mock all TipTap extensions with proper configure methods
vi.mock("@tiptap/starter-kit", () => ({
  default: {
    configure: vi.fn(() => ({})),
    __esModule: true
  }
}));
vi.mock("@tiptap/extension-text-style", () => ({
  default: {},
  TextStyle: {},
  Color: {}
}));
vi.mock("@tiptap/extension-color", () => ({
  default: {},
  Color: {}
}));
vi.mock("@tiptap/extension-highlight", () => ({
  default: {
    configure: vi.fn(() => ({}))
  }
}));
vi.mock("@tiptap/extension-underline", () => ({
  default: {}
}));
vi.mock("@tiptap/extension-subscript", () => ({
  default: {}
}));
vi.mock("@tiptap/extension-superscript", () => ({
  default: {}
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Bold: () => <span title="Bold">B</span>,
  Italic: () => <span title="Italic">I</span>,
  Underline: () => <span title="Underline">U</span>,
  Strikethrough: () => <span title="Strike">S</span>,
  Highlighter: () => <span title="Highlight">H</span>,
  Undo2: () => <span title="Undo">↶</span>,
  Redo2: () => <span title="Redo">↷</span>,
  Subscript: () => <span title="Subscript">Sub</span>,
  Superscript: () => <span title="Superscript">Sup</span>,
  Heading1: () => <span title="H1">H1</span>,
  Heading2: () => <span title="H2">H2</span>,
  Heading3: () => <span title="H3">H3</span>,
  Type: () => <span title="Paragraph">P</span>,
  Palette: () => <span title="Text Color">🎨</span>,
  List: () => <span title="Bullet List">•</span>,
  ListOrdered: () => <span title="Numbered List">1.</span>,
}));

describe("RichTextEditor", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  test("renders with default props", () => {
    render(<RichTextEditor content="" onChange={mockOnChange} />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  test("renders with readOnly mode", () => {
    render(<RichTextEditor content="" onChange={mockOnChange} readOnly />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  test("renders with disabled state", () => {
    render(<RichTextEditor content="" onChange={mockOnChange} disabled />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  test("renders with string content", () => {
    render(<RichTextEditor content="<p>Test content</p>" onChange={mockOnChange} />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  test("renders with object content", () => {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test" }] }] };
    render(<RichTextEditor content={content} onChange={mockOnChange} />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  test("includes toolbar buttons", () => {
    render(<RichTextEditor content="" onChange={mockOnChange} />);
    const toolbar = document.querySelector(".flex.items-center");
    expect(toolbar).toBeInTheDocument();
  });

  test("renders with custom placeholder", () => {
    render(<RichTextEditor content="" onChange={mockOnChange} placeholder="Custom placeholder" />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  test("renders with custom minHeight", () => {
    render(<RichTextEditor content="" onChange={mockOnChange} minHeight="200px" />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });
});