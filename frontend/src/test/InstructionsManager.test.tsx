import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-ignore
import { render, screen, cleanup } from '@testing-library/react';
import InstructionsManager from '../components/ui/InstructionsManager';
import React from 'react';

// Mock Tiptap
vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    commands: {
      focus: vi.fn(),
      setContent: vi.fn(),
    },
    getJSON: () => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Test Instruction' }]
        }
      ]
    }),
    isEmpty: false,
    isFocused: false,
    can: () => ({
        undo: () => true,
        redo: () => true
    }),
    isActive: () => false,
    getAttributes: () => ({}),
    chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
    on: vi.fn(),
    off: vi.fn(),
  }),
  EditorContent: () => <div data-testid="tiptap-editor" contentEditable />,
}));

describe('InstructionsManager', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly with initial instructions', () => {
    const instructions = [{ id: '1', text: 'Test Instruction', level: 0 }];
    const onChange = vi.fn();
    
    render(
      <InstructionsManager 
        instructions={instructions} 
        onChange={onChange} 
      />
    );
    
    expect(screen.getByText('Instructions')).toBeTruthy();
    expect(screen.getByTestId('tiptap-editor')).toBeTruthy();
  });

  it('handles empty instructions gracefully', () => {
    const onChange = vi.fn();
    render(
      <InstructionsManager 
        instructions={[]} 
        onChange={onChange} 
      />
    );
    
    expect(screen.getByTestId('tiptap-editor')).toBeTruthy();
  });
});
