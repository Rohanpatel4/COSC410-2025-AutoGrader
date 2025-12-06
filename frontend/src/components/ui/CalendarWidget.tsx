import React from "react";
import { fetchJson } from "../../api/client";
import { useNavigate } from "react-router-dom";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { 
  FileText, 
  Clock, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Timer,
  History,
  AlertCircle,
  ListChecks
} from "lucide-react";

interface Assignment {
  id: number;
  title: string;
  course_id: number;
  course_code?: string;
  course_name?: string;
  start?: string;
  stop?: string;
  best_score?: number;
  max_score?: number;
  attempts_used?: number;
  max_attempts?: number;
}

interface Course {
  id: number;
  course_code: string;
  name: string;
}

interface CalendarWidgetProps {
  studentId: number;
}

function getCourseColor(code: string): { bg: string; text: string; border: string } {
  const colors = [
    { bg: "bg-rose-500/20", text: "text-rose-400", border: "border-rose-500/30" },
    { bg: "bg-violet-500/20", text: "text-violet-400", border: "border-violet-500/30" },
    { bg: "bg-sky-500/20", text: "text-sky-400", border: "border-sky-500/30" },
    { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
    { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
    { bg: "bg-indigo-500/20", text: "text-indigo-400", border: "border-indigo-500/30" },
    { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
    { bg: "bg-fuchsia-500/20", text: "text-fuchsia-400", border: "border-fuchsia-500/30" },
  ];
  
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function CalendarWidget({ studentId }: CalendarWidgetProps) {
  const navigate = useNavigate();
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [weekOffset, setWeekOffset] = React.useState<number>(0);

  React.useEffect(() => {
    loadAssignments();
  }, [studentId]);

  async function loadAssignments() {
    if (!studentId || Number.isNaN(studentId)) return;

    try {
      setLoading(true);
      const courses = await fetchJson<Course[]>(`/api/v1/courses/students/${studentId}`);

      const allAssignments: Assignment[] = [];
      for (const course of courses) {
        try {
          const courseAssignments = await fetchJson<Assignment[]>(`/api/v1/courses/${course.course_code}/assignments`);
          const assignmentsWithCourseInfo = courseAssignments.map(assignment => ({
            ...assignment,
            course_code: course.course_code,
            course_name: course.name
          }));
          allAssignments.push(...assignmentsWithCourseInfo);
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

  const needsAttention = (assignment: Assignment) => {
    if (assignment.best_score === undefined || assignment.max_score === undefined) {
      return true;
    }
    const isComplete = assignment.best_score >= assignment.max_score;
    const hasAttemptsLeft = assignment.max_attempts === undefined || 
      assignment.max_attempts === null || 
      (assignment.attempts_used ?? 0) < assignment.max_attempts;
    
    return !isComplete && hasAttemptsLeft;
  };

  const getAllAssignmentsForDate = (date: Date) => {
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

  const getFutureAssignmentsForDate = (date: Date) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    return assignments.filter(assignment => {
      if (!assignment.stop) return false;
      const dueDate = new Date(assignment.stop);
      if (dueDate < now) return false;
      
      return (
        dueDate.getFullYear() === date.getFullYear() &&
        dueDate.getMonth() === date.getMonth() &&
        dueDate.getDate() === date.getDate()
      );
    });
  };

  const isDatePast = (date: Date) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < now;
  };

  const getAssignmentStatus = (assignment: Assignment) => {
    if (!assignment.stop) return 'no-due-date';
    const now = new Date();
    const dueDate = new Date(assignment.stop);
    const timeDiff = dueDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    if (timeDiff < 0) return 'past';
    if (daysDiff <= 1) return 'due-soon';
    if (daysDiff <= 3) return 'upcoming';
    return 'future';
  };

  const getDueSoonAssignments = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    return assignments.filter(a => {
      if (!a.stop) return false;
      const dueDate = new Date(a.stop);
      return dueDate >= now && dueDate <= threeDaysFromNow && needsAttention(a);
    });
  };

  const getIncompleteAssignments = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return assignments.filter(a => {
      if (a.stop) {
        const dueDate = new Date(a.stop);
        if (dueDate < now) return false;
      }
      return needsAttention(a);
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekOffset(prev => prev + (direction === 'next' ? 1 : -1));
  };

  const goToToday = () => {
    setWeekOffset(0);
    setSelectedDate(new Date());
  };

  const getTwoWeeksDays = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const days: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  const getDateRangeLabel = () => {
    const days = getTwoWeeksDays();
    const start = days[0];
    const end = days[13];
    
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}-${end.getDate()}`;
    } else {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  };

  const selectedDateAssignments = getAllAssignmentsForDate(selectedDate);
  const dueSoonAssignments = getDueSoonAssignments();
  const incompleteAssignments = getIncompleteAssignments();
  const isSelectedDatePast = isDatePast(selectedDate);

  // Navigate to assignments with filter
  const handleDueSoonClick = () => {
    navigate("/assignments?filter=due-soon");
  };

  const handleToCompleteClick = () => {
    navigate("/assignments?filter=active");
  };

  if (loading) {
    return (
      <Card className="p-3 h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      {/* Calendar Header */}
      <div className="px-3 py-2 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Calendar</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={goToToday}
              className="px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {getDateRangeLabel()}
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-2">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-[9px] font-medium text-muted-foreground py-0.5">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days - Fixed height grid */}
        <div className="grid grid-cols-7 gap-1">
          {getTwoWeeksDays().map((date) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isPast = isDatePast(date);
            
            const futureAssignments = getFutureAssignmentsForDate(date);
            const hasFutureAssignments = futureAssignments.length > 0;
            const hasIncomplete = futureAssignments.some(a => needsAttention(a));
            
            const allAssignments = getAllAssignmentsForDate(date);
            const hadPastAssignments = isPast && allAssignments.length > 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`
                  w-full h-8 flex items-center justify-center rounded text-[11px] font-medium transition-colors relative
                  ${isSelected 
                    ? 'bg-primary text-primary-foreground' 
                    : isToday 
                      ? 'bg-accent/30 text-accent font-bold' 
                      : hasFutureAssignments
                        ? hasIncomplete
                          ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                          : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : hadPastAssignments
                          ? 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          : isPast
                            ? 'text-muted-foreground/50 hover:bg-muted/50'
                            : 'hover:bg-muted text-foreground'
                  }
                `}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-2 pb-2">
        <div className="flex gap-2">
          <button
            onClick={handleDueSoonClick}
            className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg py-1.5 px-2 transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">{dueSoonAssignments.length}</span>
            <span className="text-[10px] text-amber-400/80">Due Soon</span>
          </button>
          <button
            onClick={handleToCompleteClick}
            className="flex-1 flex items-center justify-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-lg py-1.5 px-2 transition-colors"
          >
            <ListChecks className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-sm font-bold text-sky-400">{incompleteAssignments.length}</span>
            <span className="text-[10px] text-sky-400/80">To Do</span>
          </button>
        </div>
      </div>

      {/* Selected Date Details - Fixed height container */}
      <div className="border-t border-border px-2 py-2 bg-muted/20 min-h-[72px]">
        {selectedDateAssignments.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                {isSelectedDatePast ? (
                  <History className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <Clock className="w-3 h-3 text-primary" />
                )}
                {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <Badge 
                variant={isSelectedDatePast ? "default" : "warning"} 
                className="text-[9px] px-1.5 py-0"
              >
                {selectedDateAssignments.length}
              </Badge>
            </div>

            <div className="space-y-1">
              {selectedDateAssignments.slice(0, 2).map((assignment) => {
                const colors = getCourseColor(assignment.course_code || '');
                const status = getAssignmentStatus(assignment);
                const isPast = status === 'past';
                
                return (
                  <div
                    key={assignment.id}
                    onClick={() => navigate(`/assignments/${assignment.id}`)}
                    className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] ${
                      isPast ? 'bg-muted/30 border-border' : `${colors.bg} ${colors.border}`
                    }`}
                  >
                    <FileText className={`w-3 h-3 ${isPast ? 'text-muted-foreground' : colors.text} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-medium truncate ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {assignment.title}
                      </p>
                    </div>
                    {status === 'due-soon' && (
                      <Timer className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </div>
                );
              })}
              {selectedDateAssignments.length > 2 && (
                <p className="text-[9px] text-muted-foreground text-center py-0.5">
                  +{selectedDateAssignments.length - 2} more
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
            <span>No assignments on {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
