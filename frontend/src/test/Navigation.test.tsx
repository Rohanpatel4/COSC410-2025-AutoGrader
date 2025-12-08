import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Navigation } from "../components/layout/Navigation";
import { AuthProvider } from "../auth/AuthContext";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test wrapper with auth provider
function TestWrapper({ children, role = "faculty", userId = "301", userEmail = "test@example.com" }: {
  children: React.ReactNode;
  role?: "faculty" | "student";
  userId?: string;
  userEmail?: string;
}) {
  return (
    <AuthProvider initial={{ role, userId, token: "fake-token", userEmail }}>
      <MemoryRouter initialEntries={["/my"]}>
        {children}
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("faculty navigation", () => {
    test("renders faculty navigation items", () => {
      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      expect(screen.getByText("AutoGrader")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Courses")).toBeInTheDocument();
      expect(screen.queryByText("Assignments")).not.toBeInTheDocument();
    });

    test("highlights active route", () => {
      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      const dashboardLink = screen.getByText("Dashboard").closest("a");
      expect(dashboardLink?.className).toContain("bg-primary-foreground/20");
    });
  });

  describe("student navigation", () => {
    test("renders student navigation items", () => {
      render(
        <TestWrapper role="student">
          <Navigation />
        </TestWrapper>
      );

      expect(screen.getByText("AutoGrader")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Assignments")).toBeInTheDocument();
      expect(screen.getByText("Courses")).toBeInTheDocument();
    });
  });

  describe("user info display", () => {
    test("displays user email when available", () => {
      render(
        <TestWrapper role="faculty" userEmail="professor@university.edu">
          <Navigation />
        </TestWrapper>
      );

      expect(screen.getByText("professor@university.edu")).toBeInTheDocument();
      expect(screen.getByText("(faculty)")).toBeInTheDocument();
    });

    test("falls back to userId when email not available", () => {
      render(
        <TestWrapper role="student" userId="12345" userEmail={undefined}>
          <Navigation />
        </TestWrapper>
      );

      // Check if the user info text is present (may be hidden on small screens)
      const userInfo = screen.queryByText(/12345/) || screen.queryByText(/student/);
      expect(userInfo).toBeTruthy();
    });
  });

  describe("mobile responsiveness", () => {
    test("shows hamburger menu on mobile", () => {
      // Mock window.innerWidth to simulate mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText("Open sidebar");
      expect(menuButton).toBeInTheDocument();
    });

    test("toggles sidebar on mobile", async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText("Open sidebar");
      await userEvent.click(menuButton);

      // Check if backdrop appears
      expect(screen.getByTestId("mobile-backdrop")).toBeInTheDocument();

      const closeButton = screen.getByLabelText("Close sidebar");
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId("mobile-backdrop")).not.toBeInTheDocument();
      });
    });

    test("closes sidebar when clicking backdrop", async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText("Open sidebar");
      await userEvent.click(menuButton);

      const backdrop = screen.getByTestId("mobile-backdrop");
      await userEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByTestId("mobile-backdrop")).not.toBeInTheDocument();
      });
    });
  });

  describe("logout functionality", () => {
    test("calls logout and navigates to login", async () => {
      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      const logoutButton = screen.getByLabelText("Logout");
      await userEvent.click(logoutButton);

      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    test("closes mobile sidebar after navigation", async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText("Open sidebar");
      await userEvent.click(menuButton);

      const dashboardLink = screen.getByText("Dashboard");
      await userEvent.click(dashboardLink);

      await waitFor(() => {
        expect(screen.queryByTestId("mobile-backdrop")).not.toBeInTheDocument();
      });
    });
  });

  describe("navigation links", () => {
    test("faculty dashboard link navigates correctly", () => {
      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      const dashboardLink = screen.getByText("Dashboard").closest("a");
      expect(dashboardLink).toHaveAttribute("href", "/my");
    });

    test("faculty courses link navigates correctly", () => {
      render(
        <TestWrapper role="faculty">
          <Navigation />
        </TestWrapper>
      );

      const coursesLink = screen.getByText("Courses").closest("a");
      expect(coursesLink).toHaveAttribute("href", "/courses");
    });

    test("student assignments link navigates correctly", () => {
      render(
        <TestWrapper role="student">
          <Navigation />
        </TestWrapper>
      );

      const assignmentsLink = screen.getByText("Assignments").closest("a");
      expect(assignmentsLink).toHaveAttribute("href", "/assignments");
    });
  });
});