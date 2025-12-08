import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";

// Mock ReactDOM.createRoot to prevent actual rendering
vi.mock("react-dom/client", async () => {
  const actual = await vi.importActual("react-dom/client");
  return {
    ...actual,
    createRoot: vi.fn(() => ({
      render: vi.fn(),
    })),
  };
});

// Create mock root element and mock getElementById BEFORE importing main
const mockRoot = document.createElement("div");
mockRoot.id = "root";
document.body.appendChild(mockRoot);

const originalGetElementById = document.getElementById.bind(document);
vi.spyOn(document, "getElementById").mockImplementation((id: string) => {
  if (id === "root") {
    return mockRoot;
  }
  return originalGetElementById(id);
});

import {
  AssignmentDetailPageWrapper,
  CoursesLayoutWrapper,
  RoleRouter,
  RootRoute,
  CatchAllRoute,
  AppRouter,
} from "../main";

// Mock all the page components
vi.mock("../webpages/LoginPage", () => ({
  default: () => <div>LoginPage</div>,
}));

vi.mock("../webpages/StudentDashboard", () => ({
  default: () => <div>StudentDashboard</div>,
}));

vi.mock("../webpages/FacultyDashboard", () => ({
  default: () => <div>FacultyDashboard</div>,
}));

vi.mock("../webpages/CoursePage", () => ({
  default: () => <div>CoursePage</div>,
}));

vi.mock("../webpages/CoursesPage", () => ({
  default: () => <div>CoursesPage</div>,
}));

vi.mock("../components/layout", () => ({
  Layout: ({ children, title, actions }: any) => (
    <div data-testid="layout">
      {title && <h1>{title}</h1>}
      {actions && <div data-testid="actions">{actions}</div>}
      {children}
    </div>
  ),
}));

vi.mock("../webpages/AssignmentsPage", () => ({
  default: () => <div>AssignmentsPage</div>,
}));

vi.mock("../webpages/AssignmentDetailPage", () => ({
  default: () => <div>AssignmentDetailPage</div>,
}));

vi.mock("../webpages/GradebookPage", () => ({
  default: () => <div>GradebookPage</div>,
}));

vi.mock("../webpages/GradebookIndexPage", () => ({
  default: () => <div>GradebookIndexPage</div>,
}));

vi.mock("../webpages/StudentAttemptViewPage", () => ({
  default: () => <div>StudentAttemptViewPage</div>,
}));

vi.mock("../webpages/CreateCoursePage", () => ({
  default: () => <div>CreateCoursePage</div>,
}));

vi.mock("../webpages/CreateAssignmentPage", () => ({
  default: () => <div>CreateAssignmentPage</div>,
}));

vi.mock("../webpages/EditAssignmentPage", () => ({
  default: () => <div>EditAssignmentPage</div>,
}));

vi.mock("../webpages/JoinCoursePage", () => ({
  default: () => <div>JoinCoursePage</div>,
}));

vi.mock("../components/ui/Button", () => ({
  Button: ({ children, onClick, variant, className }: any) => (
    <button onClick={onClick} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span>PlusIcon</span>,
  BookOpen: () => <span>BookOpenIcon</span>,
}));

describe("main.tsx", () => {
  const renderWithAuth = (ui: React.ReactElement, role: "faculty" | "student" | null = null) => {
    return render(
      <AuthProvider initial={{ role, userId: role === "faculty" ? "301" : "201" }}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    );
  };

  describe("RootRoute", () => {
    it("redirects to /login when not authenticated and on root path", async () => {
      renderWithAuth(<RootRoute />, null);

      await waitFor(() => {
        expect(window.location.pathname).toBe("/login");
      });
    });

    it("redirects to /my when authenticated and on root path", async () => {
      renderWithAuth(<RootRoute />, "faculty");

      await waitFor(() => {
        expect(window.location.pathname).toBe("/my");
      });
    });

    it("does not redirect when not on root path", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/some-other-path"]}>
            <RootRoute />
          </MemoryRouter>
        </AuthProvider>
      );

      // Should not redirect, component should return null
      expect(screen.queryByText("LoginPage")).not.toBeInTheDocument();
      expect(screen.queryByText("StudentDashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("FacultyDashboard")).not.toBeInTheDocument();
    });
  });

  describe("RoleRouter", () => {
    it("renders FacultyDashboard for faculty role", () => {
      renderWithAuth(<RoleRouter />, "faculty");

      expect(screen.getByText("FacultyDashboard")).toBeInTheDocument();
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByText("Faculty Dashboard")).toBeInTheDocument();
    });

    it("renders StudentDashboard for student role", () => {
      renderWithAuth(<RoleRouter />, "student");

      expect(screen.getByText("StudentDashboard")).toBeInTheDocument();
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    });

    it("redirects to login when no role", () => {
      renderWithAuth(<RoleRouter />, null);

      expect(screen.queryByText("StudentDashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("FacultyDashboard")).not.toBeInTheDocument();
    });

    it("uses role from location state when no auth role", () => {
      render(
        <AuthProvider initial={{ role: null, userId: null }}>
          <MemoryRouter initialEntries={[{ pathname: "/", state: { role: "student" } }]}>
            <RoleRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("StudentDashboard")).toBeInTheDocument();
    });
  });

  describe("AssignmentDetailPageWrapper", () => {
    it("renders full screen layout for students", () => {
      renderWithAuth(<AssignmentDetailPageWrapper />, "student");

      expect(screen.getByText("AssignmentDetailPage")).toBeInTheDocument();
      expect(screen.getByTestId("layout")).toHaveAttribute("data-fullscreen", "true");
      expect(screen.queryByText("Assignment Details")).not.toBeInTheDocument();
    });

    it("renders standard layout with title for faculty", () => {
      renderWithAuth(<AssignmentDetailPageWrapper />, "faculty");

      expect(screen.getByText("AssignmentDetailPage")).toBeInTheDocument();
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByText("Assignment Details")).toBeInTheDocument();
    });
  });

  describe("CoursesLayoutWrapper", () => {
    it("shows create course button for faculty", () => {
      renderWithAuth(<CoursesLayoutWrapper />, "faculty");

      expect(screen.getByText("CoursesPage")).toBeInTheDocument();
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByText("Courses")).toBeInTheDocument();
      expect(screen.getByTestId("actions")).toBeInTheDocument();
      expect(screen.getByText("Create Course")).toBeInTheDocument();
      expect(screen.getByText("PlusIcon")).toBeInTheDocument();
    });

    it("shows join course button for students", () => {
      renderWithAuth(<CoursesLayoutWrapper />, "student");

      expect(screen.getByText("CoursesPage")).toBeInTheDocument();
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByText("Courses")).toBeInTheDocument();
      expect(screen.getByTestId("actions")).toBeInTheDocument();
      expect(screen.getByText("Join Course")).toBeInTheDocument();
      expect(screen.getByText("BookOpenIcon")).toBeInTheDocument();
    });

    it("navigates to create course page when create button clicked", async () => {
      renderWithAuth(<CoursesLayoutWrapper />, "faculty");

      const createButton = screen.getByText("Create Course");
      createButton.click();

      await waitFor(() => {
        expect(window.location.pathname).toBe("/courses/new");
      });
    });

    it("navigates to join course page when join button clicked", async () => {
      renderWithAuth(<CoursesLayoutWrapper />, "student");

      const joinButton = screen.getByText("Join Course");
      joinButton.click();

      await waitFor(() => {
        expect(window.location.pathname).toBe("/courses/join");
      });
    });
  });

  describe("CatchAllRoute", () => {
    it("redirects to /my when authenticated", () => {
      renderWithAuth(<CatchAllRoute />, "faculty");

      expect(screen.queryByText("LoginPage")).not.toBeInTheDocument();
    });

    it("redirects to /login when not authenticated", () => {
      renderWithAuth(<CatchAllRoute />, null);

      expect(screen.queryByText("StudentDashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("FacultyDashboard")).not.toBeInTheDocument();
    });
  });

  describe("AppRouter", () => {
    it("renders login page on /login route", () => {
      render(
        <AuthProvider initial={{ role: null, userId: null }}>
          <MemoryRouter initialEntries={["/login"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("LoginPage")).toBeInTheDocument();
    });

    it("renders faculty dashboard on /my route for faculty", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/my"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("FacultyDashboard")).toBeInTheDocument();
    });

    it("renders student dashboard on /my route for student", () => {
      render(
        <AuthProvider initial={{ role: "student", userId: "201" }}>
          <MemoryRouter initialEntries={["/my"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("StudentDashboard")).toBeInTheDocument();
    });

    it("renders create course page", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/courses/new"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("CreateCoursePage")).toBeInTheDocument();
      expect(screen.getByText("Create Course")).toBeInTheDocument();
    });

    it("renders join course page", () => {
      render(
        <AuthProvider initial={{ role: "student", userId: "201" }}>
          <MemoryRouter initialEntries={["/courses/join"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("JoinCoursePage")).toBeInTheDocument();
      expect(screen.getByText("Join Course")).toBeInTheDocument();
    });

    it("renders courses page", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/courses"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("CoursesPage")).toBeInTheDocument();
      expect(screen.getByText("Courses")).toBeInTheDocument();
    });

    it("renders course page", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/courses/500"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("CoursePage")).toBeInTheDocument();
      expect(screen.getByText("Course Details")).toBeInTheDocument();
    });

    it("renders create assignment page", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/courses/500/assignments/new"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("CreateAssignmentPage")).toBeInTheDocument();
      expect(screen.getByText("Create Assignment")).toBeInTheDocument();
    });

    it("renders assignments page", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/assignments"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("AssignmentsPage")).toBeInTheDocument();
      expect(screen.getByText("Assignments")).toBeInTheDocument();
    });

    it("renders assignment detail page for student (full screen)", () => {
      render(
        <AuthProvider initial={{ role: "student", userId: "201" }}>
          <MemoryRouter initialEntries={["/assignments/9001"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("AssignmentDetailPage")).toBeInTheDocument();
    });

    it("renders assignment detail page for faculty (with title)", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/assignments/9001"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("AssignmentDetailPage")).toBeInTheDocument();
      expect(screen.getByText("Assignment Details")).toBeInTheDocument();
    });

    it("renders edit assignment page", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/assignments/9001/edit"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("EditAssignmentPage")).toBeInTheDocument();
      expect(screen.getByText("Edit Assignment")).toBeInTheDocument();
    });

    it("renders gradebook page", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/gradebook"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("GradebookIndexPage")).toBeInTheDocument();
      expect(screen.getByText("Gradebook")).toBeInTheDocument();
    });

    it("redirects unknown routes to appropriate dashboard", () => {
      render(
        <AuthProvider initial={{ role: "faculty", userId: "301" }}>
          <MemoryRouter initialEntries={["/unknown-route"]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("FacultyDashboard")).toBeInTheDocument();
    });
  });
});
