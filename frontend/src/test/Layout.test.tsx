import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "../components/layout/layout";
import { AuthProvider } from "../auth/AuthContext";

// Test wrapper with auth provider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider initial={{ role: "faculty", userId: "301", token: "fake-token" }}>
      <MemoryRouter initialEntries={["/test"]}>
        {children}
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("Layout", () => {
  test("renders children correctly", () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("includes Navigation component", () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    // Check for AutoGrader logo which is in Navigation
    expect(screen.getByText("AutoGrader")).toBeInTheDocument();
  });

  test("applies correct main layout classes", () => {
    const { container } = render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    const main = container.querySelector("main");
    expect(main?.className).toContain("lg:pl-64");
    expect(main?.className).toContain("pt-24");
  });

  test("renders in normal mode by default", () => {
    const { container } = render(
      <TestWrapper>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </TestWrapper>
    );

    const main = container.querySelector("main");
    const contentWrapper = main?.querySelector("div");
    expect(contentWrapper?.className).toContain("py-6");
  });

  test("renders in fullscreen mode when specified", () => {
    const { container } = render(
      <TestWrapper>
        <Layout fullScreen>
          <div>Test Content</div>
        </Layout>
      </TestWrapper>
    );

    const main = container.querySelector("main");
    // In fullscreen mode, content should be direct child of main without wrapper
    expect(main?.firstChild).toHaveTextContent("Test Content");
    expect(main?.querySelector("div.py-6")).not.toBeInTheDocument();
  });

  test("applies background class to root", () => {
    const { container } = render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
    expect(root.className).toContain("bg-background");
  });

  test("accepts optional title prop (currently not used in render)", () => {
    render(
      <TestWrapper>
        <Layout title="Test Title">
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    // Title is currently not rendered according to the comment in the component
    expect(screen.queryByText("Test Title")).not.toBeInTheDocument();
  });

  test("accepts optional actions prop (currently not used in render)", () => {
    render(
      <TestWrapper>
        <Layout actions={<button>Action</button>}>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    // Actions are currently not rendered according to the comment in the component
    expect(screen.queryByText("Action")).not.toBeInTheDocument();
  });
});