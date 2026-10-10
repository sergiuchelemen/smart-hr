package ro.smarthr.dashboard;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ro.smarthr.evaluation.EvaluationStatus;
import ro.smarthr.timesheet.TimesheetStatus;

@RestController
public class DashboardController {

    public record Me(String firstName, String companyName) {
    }

    public record NextLeave(LocalDate startDate, LocalDate endDate, int workingDays) {
    }

    public record LeaveBalanceSection(int entitled, int carriedOver, int used, long pending, int available,
                                      long myPendingRequests, NextLeave nextApprovedLeave) {
    }

    public record TimesheetSection(String month, TimesheetStatus status, long workedMinutes, long normMinutes) {
    }

    public record EvaluationSection(String cycleName, EvaluationStatus status) {
    }

    public record Approvals(Long leavePending, Long timesheetSubmitted, Long evaluationsPending) {
    }

    public record Absence(String employeeName, LocalDate from, LocalDate to) {
    }

    public record Absences(List<Absence> items, long onLeaveToday) {
    }

    public record DepartmentCount(String name, long count) {
    }

    public record Headcount(long total, long hiredLast90Days, List<DepartmentCount> byDepartment) {
    }

    public record MonthDays(int month, long days) {
    }

    public record Holiday(LocalDate date, String name) {
    }

    public record RecentDocument(UUID id, String title, String category, Instant updatedAt) {
    }

    public record DashboardResponse(Me me, LeaveBalanceSection leaveBalance, TimesheetSection timesheet,
                                    EvaluationSection evaluation, Approvals approvals, Absences absences,
                                    Headcount headcount, List<MonthDays> leaveByMonth, List<Holiday> upcomingHolidays,
                                    List<RecentDocument> recentDocuments) {
    }

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    /** Doar secțiunile permise apelantului (verificate din DB în serviciu); restul sunt null. */
    @GetMapping("/api/dashboard")
    @PreAuthorize("isAuthenticated()")
    public DashboardResponse dashboard() {
        return service.build();
    }
}
