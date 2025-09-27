/**
 * Tests for Layout component
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../Layout';

describe('Layout', () => {
  it('renders navigation and children', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByText('Auto-Grader')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('highlights current page in navigation', () => {
    render(
      <MemoryRouter initialEntries={['/files']}>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MemoryRouter>
    );

    const filesLink = screen.getByText('Files');
    expect(filesLink).toHaveClass('border-indigo-500');
  });
});
