import { describe, it, expect } from "vitest";
import type { Assignment } from "../types/assignments";
import type { Course } from "../types/courses";
import type { Role, User } from "../types/role";

describe("Type Definitions", () => {
  describe("Assignment type", () => {
    it("can create valid Assignment objects", () => {
      const assignment: Assignment = {
        id: 1,
        title: "Test Assignment",
        course_id: 100,
        description: "A test assignment",
        language: "python",
        test_file_id: "test.py",
        sub_limit: 3,
        num_attempts: 5,
        total_points: 100,
        start: "2025-01-01T00:00:00Z",
        stop: "2025-01-31T23:59:59Z",
        instructions: { type: "doc", content: [] }
      };

      // TypeScript compilation ensures the object conforms to the type
      expect(assignment.id).toBe(1);
      expect(assignment.title).toBe("Test Assignment");
      expect(assignment.course_id).toBe(100);
    });

    it("supports optional fields", () => {
      const minimalAssignment: Assignment = {
        id: 2,
        title: "Minimal Assignment",
        course_id: 200
      };

      // All optional fields can be omitted
      expect(minimalAssignment.id).toBe(2);
      expect(minimalAssignment.description).toBeUndefined();
      expect(minimalAssignment.language).toBeUndefined();
    });

    it("supports null values for nullable fields", () => {
      const assignmentWithNulls: Assignment = {
        id: 3,
        title: "Assignment with nulls",
        course_id: 300,
        description: null,
        test_file_id: null,
        sub_limit: null,
        start: null,
        stop: null,
        instructions: null
      };

      expect(assignmentWithNulls.description).toBeNull();
      expect(assignmentWithNulls.test_file_id).toBeNull();
      expect(assignmentWithNulls.sub_limit).toBeNull();
    });
  });

  describe("Course type", () => {
    it("can create valid Course objects", () => {
      const course: Course = {
        id: 1,
        course_code: "COSC-410",
        name: "Computer Science 410",
        description: "Advanced software engineering",
        enrollment_key: "ABC123XYZ789"
      };

      expect(course.id).toBe(1);
      expect(course.course_code).toBe("COSC-410");
      expect(course.name).toBe("Computer Science 410");
      expect(course.description).toBe("Advanced software engineering");
      expect(course.enrollment_key).toBe("ABC123XYZ789");
    });

    it("supports minimal Course objects", () => {
      const minimalCourse: Course = {
        id: 2,
        course_code: "MATH-101",
        name: "Mathematics 101"
      };

      expect(minimalCourse.id).toBe(2);
      expect(minimalCourse.course_code).toBe("MATH-101");
      expect(minimalCourse.name).toBe("Mathematics 101");
      expect(minimalCourse.description).toBeUndefined();
      expect(minimalCourse.enrollment_key).toBeUndefined();
    });

    it("supports null description", () => {
      const courseWithNullDesc: Course = {
        id: 3,
        course_code: "PHYS-201",
        name: "Physics 201",
        description: null
      };

      expect(courseWithNullDesc.description).toBeNull();
    });
  });

  describe("Role and User types", () => {
    it("can create valid User objects with different roles", () => {
      const student: User = {
        id: 1,
        name: "John Doe",
        role: "student"
      };

      const faculty: User = {
        id: 2,
        name: "Jane Smith",
        role: "faculty"
      };

      expect(student.id).toBe(1);
      expect(student.name).toBe("John Doe");
      expect(student.role).toBe("student");

      expect(faculty.id).toBe(2);
      expect(faculty.name).toBe("Jane Smith");
      expect(faculty.role).toBe("faculty");
    });

    it("Role type is constrained to valid values", () => {
      const studentRole: Role = "student";
      const facultyRole: Role = "faculty";

      expect(studentRole).toBe("student");
      expect(facultyRole).toBe("faculty");

      // TypeScript would prevent invalid roles like "admin" or "teacher"
      // We can't test this at runtime, but the type system enforces it
    });

    it("can create arrays of Users", () => {
      const users: User[] = [
        { id: 1, name: "Alice", role: "student" },
        { id: 2, name: "Bob", role: "faculty" },
        { id: 3, name: "Charlie", role: "student" }
      ];

      expect(users).toHaveLength(3);
      expect(users[0].role).toBe("student");
      expect(users[1].role).toBe("faculty");
      expect(users[2].role).toBe("student");
    });
  });

  describe("Type Integration", () => {
    it("Assignment references Course via course_id", () => {
      const course: Course = {
        id: 100,
        course_code: "CS-101",
        name: "Computer Science 101"
      };

      const assignment: Assignment = {
        id: 1,
        title: "Homework 1",
        course_id: course.id  // References course.id
      };

      expect(assignment.course_id).toBe(course.id);
    });

    it("can create complex objects combining all types", () => {
      const faculty: User = {
        id: 1,
        name: "Dr. Smith",
        role: "faculty"
      };

      const course: Course = {
        id: 100,
        course_code: "CS-101",
        name: "Computer Science 101",
        description: "Introduction to programming"
      };

      const assignment: Assignment = {
        id: 1,
        title: "Final Project",
        course_id: course.id,
        description: "Build a complete application",
        language: "typescript",
        total_points: 200,
        start: "2025-01-01T00:00:00Z",
        stop: "2025-12-31T23:59:59Z"
      };

      // All objects are properly typed and related
      expect(faculty.role).toBe("faculty");
      expect(course.id).toBe(assignment.course_id);
      expect(assignment.total_points).toBe(200);
    });
  });
});