import React from "react";
import { fetchJson } from "../../api/client";
import { useNavigate } from "react-router-dom";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { FileText, Clock, Calendar as CalendarIcon } from "lucide-react";

interface Assignment {
  id: number;
  title: string;
  course_id: number;
  course_code?: string;
  start?: string;
  stop?: string;
}

interface Course {
  id: number;
  course_code: string;
  name: string;
}

interface CalendarWidgetProps {
  studentId: number;
}

export default function CalendarWidget({ studentId }: CalendarWidgetProps) {
  const navigate = useNavigate();
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [weekOffset, setWeekOffset] = React.useState<number>(0);


  // Calculate current week and next week date range
  const getCurrentWeekRange = (offset: number = 0) => {
    const now = new Date();
    // Apply week offset
    now.setDate(now.getDate() + (offset * 14));

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)

    const endOfNextWeek = new Date(startOfWeek);
    endOfNextWeek.setDate(startOfWeek.getDate() + 13); // End of next week (Saturday, 2 weeks total)

    return {
      start: startOfWeek,
      end: endOfNextWeek
    };
  };

  const weekRange = getCurrentWeekRange(weekOffset);

  // Navigation functions
  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekOffset(prev => direction === 'next' ? prev + 1 : prev - 1);
  };

  React.useEffect(() => {
    loadAssignments();
  }, [studentId]);

  async function loadAssignments() {
    if (!studentId || Number.isNaN(studentId)) return;

    try {
      setLoading(true);

      // Get student's courses first
      const courses = await fetchJson<Course[]>(`/api/v1/courses/students/${studentId}`);

      // Get assignments for each course
      const allAssignments: Assignment[] = [];
      for (const course of courses) {
        try {
          const courseAssignments = await fetchJson<Assignment[]>(`/api/v1/courses/${course.course_code}/assignments`);
          const assignmentsWithCourseCode = courseAssignments.map(assignment => ({
            ...assignment,
            course_code: course.course_code
          }));
          allAssignments.push(...assignmentsWithCourseCode);
        } catch (error) {
          console.error(`Failed to load assignments for course ${course.course_code}:`, error);
        }
      }

      setAssignments(allAssignments);
    } catch (error) {
      console.error("Failed to load assignments:", error);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }

  // Get assignments for a specific date
  const getAssignmentsForDate = (date: Date) => {
    return assignments.filter(assignment => {
      if (!assignment.stop) return false;
      const dueDate = new Date(assignment.stop);
      return (
        dueDate.getFullYear() === date.getFullYear() &&
        dueDate.getMonth() === date.getMonth() &&
        dueDate.getDate() === date.getDate()
      );
    });
  };

  // Get assignments for the selected date
  const selectedDateAssignments = getAssignmentsForDate(selectedDate);


  return (
    <Card className="p-3">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-3 h-3 text-primary" />
          <h3 className="font-semibold text-foreground text-xs">Assignments</h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Custom 2-Week Calendar */}
            <div className="calendar-widget-container">
              <div className="p-2">
                {/* Compact Header with Navigation */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => navigateWeek('prev')}
                    className="text-xs text-gray-400 hover:text-white transition-colors p-1"
                  >
                    ‹
                  </button>
                  <h3 className="text-xs font-semibold text-gray-300">
                    {weekRange.start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => navigateWeek('next')}
                    className="text-xs text-gray-400 hover:text-white transition-colors p-1"
                  >
                    ›
                  </button>
                </div>

                {/* Compact Weekday Headers */}
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {[
                    { key: 'sun', label: 'S' },
                    { key: 'mon', label: 'M' },
                    { key: 'tue', label: 'T' },
                    { key: 'wed', label: 'W' },
                    { key: 'thu', label: 'T' },
                    { key: 'fri', label: 'F' },
                    { key: 'sat', label: 'S' }
                  ].map(day => (
                    <div key={day.key} className="text-center text-xs font-bold text-gray-400 py-1">
                      {day.label}
                    </div>
                  ))}
                </div>

                {/* FINAL – Colored Dates That Actually Work (Nuclear Option) */}
                <div className="grid grid-cols-7 gap-1 place-items-center select-none">
                  {Array.from({ length: 14 }, (_, index) => {
                    const date = new Date(weekRange.start);
                    date.setDate(weekRange.start.getDate() + index);

                    const isToday = date.toDateString() === new Date().toDateString();
                    const isSelected = date.toDateString() === selectedDate.toDateString();
                    const dayAssignments = getAssignmentsForDate(date);
                    const hasAssignments = dayAssignments.length > 0;

                    // Check if any assignments are past due (due date < today)
                    const hasPastDueAssignments = dayAssignments.some(assignment => {
                      if (!assignment.stop) return false;
                      const dueDate = new Date(assignment.stop);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0); // Reset time to start of day
                      return dueDate < today;
                    });

                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedDate(date)}
                        className="relative w-8 h-8 flex items-center justify-center"
                      >
                        <span
                          className={`text-xs font-bold ${
                            isToday ? 'text-amber-400' : 'text-gray-400'
                          }`}
                        >
                          {date.getDate()}
                        </span>

                        {/* Tiny red/orange dot */}
                        {hasAssignments && (
                          <div className={`absolute -bottom-1.5 w-1.5 h-1.5 rounded-full ${
                            hasPastDueAssignments ? 'bg-red-500' : 'bg-orange-400'
                          }`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Date Assignments */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {selectedDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </h4>

              {selectedDateAssignments.length > 0 ? (
                <div className="space-y-1">
                  {selectedDateAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      onClick={() => navigate(`/assignments/${assignment.id}`)}
                      className="flex items-center gap-1 p-1 rounded bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <FileText className="w-3 h-3 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {assignment.title}
                        </p>
                        {assignment.course_code && (
                          <p className="text-xs text-muted-foreground truncate">
                            {assignment.course_code}
                          </p>
                        )}
                      </div>
                      <Badge variant="warning" className="text-xs px-1 py-0">
                        Due
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No assignments due
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
