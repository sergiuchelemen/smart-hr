package ro.smarthr.dashboard;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.dashboard.DashboardController.*;
import ro.smarthr.document.DocumentService;
import ro.smarthr.employee.Employee;
import ro.smarthr.employee.EmployeeRepository;
import ro.smarthr.evaluation.EvaluationService;
import ro.smarthr.iam.CurrentUserPrivileges;
import ro.smarthr.iam.CurrentUserPrivileges.Caller;
import ro.smarthr.leave.LeaveBalanceController;
import ro.smarthr.leave.LeaveBalanceService;
import ro.smarthr.leave.LeaveRequest;
import ro.smarthr.leave.LeaveRequestRepository;
import ro.smarthr.leave.LeaveStatus;
import ro.smarthr.leave.PublicHolidayRepository;
import ro.smarthr.org.Department;
import ro.smarthr.org.DepartmentRepository;
import ro.smarthr.platform.CompanyRepository;
import ro.smarthr.timesheet.TimesheetController.MonthResponse;
import ro.smarthr.timesheet.TimesheetService;

/**
 * Tablou de bord pe rol. Reutilizează serviciile existente; fiecare secțiune apare doar dacă privilegiile
 * (citite proaspăt din DB) ar permite apelantului același lucru prin endpoint-urile existente. Fără câmpuri sensibile.
 */
@Service
public class DashboardService {

    private static final ZoneId ZONE = ZoneId.of("Europe/Bucharest");
    private static final int MAX_ABSENCES = 50;
    private static final int TOP_DEPARTMENTS = 8;
    private static final int HOLIDAYS = 3;
    private static final int RECENT_DOCS = 3;
    private static final String OTHERS = "Altele";
    private static final String NO_DEPARTMENT = "Fără departament";

    private final CurrentUserPrivileges currentUser;
    private final EmployeeRepository employees;
    private final CompanyRepository companies;
    private final DepartmentRepository departments;
    private final LeaveRequestRepository leaves;
    private final LeaveBalanceService balances;
    private final PublicHolidayRepository holidays;
    private final TimesheetService timesheets;
    private final EvaluationService evaluations;
    private final DocumentService documents;

    public DashboardService(CurrentUserPrivileges currentUser, EmployeeRepository employees,
                            CompanyRepository companies, DepartmentRepository departments,
                            LeaveRequestRepository leaves, LeaveBalanceService balances,
                            PublicHolidayRepository holidays, TimesheetService timesheets,
                            EvaluationService evaluations, DocumentService documents) {
        this.currentUser = currentUser;
        this.employees = employees;
        this.companies = companies;
        this.departments = departments;
        this.leaves = leaves;
        this.balances = balances;
        this.holidays = holidays;
        this.timesheets = timesheets;
        this.evaluations = evaluations;
        this.documents = documents;
    }

    @Transactional(readOnly = true)
    public DashboardResponse build() {
        Caller caller = currentUser.load();
        Set<String> p = caller.permissions();
        Employee me = employees.findByUserId(caller.userId()).orElse(null);
        LocalDate today = LocalDate.now(ZONE);

        List<UUID> team = null;
        if (me != null && (p.contains("LEAVE_APPROVE") || p.contains("TIMESHEET_APPROVE"))) {
            team = employees.findIdsByManagerId(me.getId());
        }

        return new DashboardResponse(
            new Me(me == null ? null : me.getFirstName(), companyName()),
            me != null && p.contains("LEAVE_REQUEST") ? leaveSection(me, today) : null,
            me != null && p.contains("TIMESHEET_SUBMIT") ? timesheetSection(me, today) : null,
            me != null && p.contains("EVALUATION_SELF") ? evaluationSection(me) : null,
            approvals(p, me, team),
            absences(p, team, today),
            p.contains("EMPLOYEE_READ") ? headcount(today) : null,
            p.contains("LEAVE_READ_ALL") ? leaveByMonth(today.getYear()) : null,
            holidays.findFrom(today, PageRequest.of(0, HOLIDAYS)).stream()
                .map(h -> new Holiday(h.getHolidayDate(), h.getName())).toList(),
            documents.recent(RECENT_DOCS).stream()
                .map(d -> new RecentDocument(d.getId(), d.getTitle(), d.getCategory(), d.getUpdatedAt())).toList());
    }

    private String companyName() {
        return companies.findById(CurrentUserPrivileges.companyIdFromToken())
            .map(ro.smarthr.platform.Company::getName).orElse(null);
    }

    // ---------- personal ----------

    private LeaveBalanceSection leaveSection(Employee me, LocalDate today) {
        LeaveBalanceController.BalanceResponse b = balances.forEmployee(me.getId(), today.getYear());
        long pending = leaves.countByEmployeeIdAndStatus(me.getId(), LeaveStatus.PENDING);
        List<LeaveRequest> next = leaves.findNextApproved(me.getId(), today, PageRequest.of(0, 1));
        NextLeave nl = next.isEmpty() ? null
            : new NextLeave(next.get(0).getStartDate(), next.get(0).getEndDate(), next.get(0).getWorkingDays());
        return new LeaveBalanceSection(b.entitled(), b.carriedOver(), b.used(), b.pending(), b.available(), pending, nl);
    }

    private TimesheetSection timesheetSection(Employee me, LocalDate today) {
        try {
            MonthResponse m = timesheets.mine(YearMonth.from(today).toString());
            return new TimesheetSection(m.month(), m.status(), m.summary().workedMinutes(), m.summary().normMinutes());
        } catch (ApiException e) {
            // Calendarul de sărbători lipsește pentru an: secțiunea se omite, restul tabloului rămâne.
            return null;
        }
    }

    private EvaluationSection evaluationSection(Employee me) {
        EvaluationService.OpenEvaluationInfo info = evaluations.ownOpen(me.getId());
        return info == null ? null : new EvaluationSection(info.cycleName(), info.status());
    }

    // ---------- aprobări ----------

    private Approvals approvals(Set<String> p, Employee me, List<UUID> team) {
        UUID self = me == null ? new UUID(0, 0) : me.getId();
        Long leave = null;
        if (p.contains("LEAVE_READ_ALL") || p.contains("LEAVE_APPROVE_ALL")) {
            leave = leaves.countPendingExcluding(self);
        } else if (p.contains("LEAVE_APPROVE")) {
            leave = team == null || team.isEmpty() ? 0L : leaves.countPendingIn(team, self);
        }
        Long ts = null;
        if (p.contains("TIMESHEET_READ_ALL") || p.contains("TIMESHEET_APPROVE_ALL")) {
            ts = timesheets.submittedCount(null, me == null ? null : me.getId());
        } else if (p.contains("TIMESHEET_APPROVE")) {
            ts = team == null ? 0L : timesheets.submittedCount(team, self);
        }
        Long ev = p.contains("EVALUATION_REVIEW") && me != null ? evaluations.pendingReviews(me.getId()) : null;
        return leave == null && ts == null && ev == null ? null : new Approvals(leave, ts, ev);
    }

    // ---------- absențe ----------

    private Absences absences(Set<String> p, List<UUID> team, LocalDate today) {
        boolean all = p.contains("LEAVE_READ_ALL");
        if (!all && !(p.contains("LEAVE_APPROVE") && team != null)) {
            return null;
        }
        if (!all && team.isEmpty()) {
            return new Absences(List.of(), 0);
        }
        LocalDate from = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate to = from.plusDays(6);
        PageRequest limit = PageRequest.of(0, MAX_ABSENCES);
        List<Object[]> rows = all ? leaves.findApprovedSpans(from, to, limit)
            : leaves.findApprovedSpansIn(team, from, to, limit);
        long onLeave = all ? leaves.countOnLeave(today) : leaves.countOnLeaveIn(team, today);
        Set<UUID> ids = rows.stream().map(r -> (UUID) r[0]).collect(Collectors.toSet());
        Map<UUID, String> names = new HashMap<>();
        employees.findAllById(ids).forEach(e -> names.put(e.getId(), e.getFirstName() + " " + e.getLastName()));
        List<Absence> items = rows.stream()
            .map(r -> new Absence(names.getOrDefault((UUID) r[0], ""), (LocalDate) r[1], (LocalDate) r[2]))
            .sorted(Comparator.comparing(Absence::from).thenComparing(Absence::employeeName,
                String.CASE_INSENSITIVE_ORDER)).toList();
        return new Absences(items, onLeave);
    }

    // ---------- efective ----------

    private Headcount headcount(LocalDate today) {
        long total = employees.count();
        long recent = employees.countByHireDateGreaterThanEqual(today.minusDays(90));
        List<Object[]> rows = employees.countPerDepartment();
        Map<UUID, String> names = new HashMap<>();
        if (!rows.isEmpty()) {
            departments.findAllByIdIn(rows.stream().map(r -> (UUID) r[0]).collect(Collectors.toSet()))
                .forEach((Department d) -> names.put(d.getId(), d.getName()));
        }
        List<DepartmentCount> all = new ArrayList<>();
        long assigned = 0;
        for (Object[] r : rows) {
            long c = ((Number) r[1]).longValue();
            assigned += c;
            all.add(new DepartmentCount(names.getOrDefault((UUID) r[0], NO_DEPARTMENT), c));
        }
        if (total - assigned > 0) {
            all.add(new DepartmentCount(NO_DEPARTMENT, total - assigned));
        }
        all.sort(Comparator.comparingLong(DepartmentCount::count).reversed()
            .thenComparing(DepartmentCount::name, String.CASE_INSENSITIVE_ORDER));
        List<DepartmentCount> out = new ArrayList<>(all.subList(0, Math.min(TOP_DEPARTMENTS, all.size())));
        if (all.size() > TOP_DEPARTMENTS) {
            out.add(new DepartmentCount(OTHERS,
                all.subList(TOP_DEPARTMENTS, all.size()).stream().mapToLong(DepartmentCount::count).sum()));
        }
        return new Headcount(total, recent, out);
    }

    // ---------- concedii pe lună ----------

    private List<MonthDays> leaveByMonth(int year) {
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to = LocalDate.of(year, 12, 31);
        long[] days = new long[13];
        for (Object[] r : leaves.sumApprovedDaysByMonth(from, to)) {
            days[((Number) r[0]).intValue()] += ((Number) r[1]).longValue();
        }
        List<Object[]> spans = leaves.findApprovedMultiMonth(from, to);
        if (!spans.isEmpty()) {
            Set<LocalDate> off = new HashSet<>(holidays.findDatesBetween(from, to));
            for (Object[] r : spans) {
                LocalDate end = (LocalDate) r[1];
                for (LocalDate d = (LocalDate) r[0]; !d.isAfter(end); d = d.plusDays(1)) {
                    if (d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY
                        && !off.contains(d)) {
                        days[d.getMonthValue()]++;
                    }
                }
            }
        }
        List<MonthDays> out = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            out.add(new MonthDays(m, days[m]));
        }
        return out;
    }
}
