package ro.smarthr.timesheet;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;
import ro.smarthr.employee.Employee;
import ro.smarthr.employee.EmployeeRepository;
import ro.smarthr.iam.CurrentUserPrivileges;
import ro.smarthr.iam.CurrentUserPrivileges.Caller;
import ro.smarthr.leave.LeaveRequest;
import ro.smarthr.leave.LeaveRequestRepository;
import ro.smarthr.leave.PublicHolidayRepository;
import ro.smarthr.leave.WorkingDaysCalculator;
import ro.smarthr.tenancy.mongo.TenantMongoOperations;
import ro.smarthr.timesheet.TimesheetController.DayResponse;
import ro.smarthr.timesheet.TimesheetController.EmployeeRef;
import ro.smarthr.timesheet.TimesheetController.EntriesResponse;
import ro.smarthr.timesheet.TimesheetController.EntryInput;
import ro.smarthr.timesheet.TimesheetController.MonthResponse;
import ro.smarthr.timesheet.TimesheetController.PageResponse;
import ro.smarthr.timesheet.TimesheetController.Summary;
import ro.smarthr.timesheet.TimesheetController.TeamRow;

/**
 * Pontajul zilnic (MongoDB, prin wrapperul de tenant) combinat cu concediile și sărbătorile (Postgres).
 * Fiecare metodă începe cu privilegiile proaspete din DB; relația manager-subordonat se verifică tot din DB.
 */
@Service
public class TimesheetService {

    static final int MAX_PAGE_SIZE = 100;
    static final int DAY_MINUTES = 480;
    static final int WINDOW_DAYS = 35;
    static final int MIN_YEAR = 2000;
    static final int MAX_YEAR = 2100;
    static final ZoneId ZONE = ZoneId.of("Europe/Bucharest");

    private static final String LEAVE = "CONCEDIU";
    private static final String HOLIDAY = "SARBATOARE";
    private static final Pattern MONTH = Pattern.compile("\\d{4}-\\d{2}");
    private static final Set<TimesheetStatus> EDITABLE = Set.of(TimesheetStatus.DRAFT, TimesheetStatus.REJECTED);

    private final TenantMongoOperations mongo;
    private final EmployeeRepository employees;
    private final CurrentUserPrivileges currentUser;
    private final LeaveRequestRepository leaves;
    private final PublicHolidayRepository holidays;
    private final WorkingDaysCalculator calculator;

    public TimesheetService(TenantMongoOperations mongo, EmployeeRepository employees,
                            CurrentUserPrivileges currentUser, LeaveRequestRepository leaves,
                            PublicHolidayRepository holidays, WorkingDaysCalculator calculator) {
        this.mongo = mongo;
        this.employees = employees;
        this.currentUser = currentUser;
        this.leaves = leaves;
        this.holidays = holidays;
        this.calculator = calculator;
    }

    // ---------- pontajul propriu ----------

    public EntriesResponse save(List<EntryInput> inputs) {
        Caller caller = currentUser.load();
        require(caller, "TIMESHEET_SUBMIT");
        Employee me = ownEmployee(caller);
        LocalDate today = LocalDate.now(ZONE);
        Set<LocalDate> seen = new HashSet<>();
        for (EntryInput in : inputs) {
            checkWindow(in.date(), today);
            if (!seen.add(in.date())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, Messages.TIMESHEET_DUPLICATE_DATE);
            }
        }
        Set<YearMonth> months = inputs.stream().map(i -> YearMonth.from(i.date())).collect(Collectors.toSet());
        for (YearMonth m : months) {
            requireEditable(me.getId(), m);
            Map<LocalDate, String> blocked = blockedDays(m, holidaysIn(m), leavesOf(me.getId(), m));
            for (EntryInput in : inputs) {
                if (YearMonth.from(in.date()).equals(m) && blocked.containsKey(in.date())) {
                    throw new ApiException(HttpStatus.CONFLICT, Messages.TIMESHEET_DAY_BLOCKED);
                }
            }
        }
        List<String> dates = inputs.stream().map(i -> i.date().toString()).toList();
        Map<String, TimesheetEntry> previous = mongo.find(TimesheetEntry.class,
                Criteria.where("employeeId").is(me.getId()).and("date").in(dates)).stream()
            .collect(Collectors.toMap(TimesheetEntry::getDate, e -> e));
        for (EntryInput in : inputs) {
            writeEntry(me.getId(), in.date().toString(), in.minutes(), in.type(), in.note(), caller.userId());
        }
        // Luna poate fi trimisă concurent între verificare și scriere: recitește și anulează scrierea dacă s-a blocat.
        boolean locked = months.stream().anyMatch(m -> !EDITABLE.contains(statusOf(me.getId(), m)));
        if (locked) {
            for (String d : dates) {
                TimesheetEntry old = previous.get(d);
                if (old == null) {
                    mongo.delete(TimesheetEntry.class, Criteria.where("employeeId").is(me.getId()).and("date").is(d));
                } else {
                    writeEntry(me.getId(), d, old.getMinutes(), old.getType(), old.getNote(), caller.userId());
                }
            }
            throw new ApiException(HttpStatus.CONFLICT, Messages.TIMESHEET_MONTH_LOCKED);
        }
        List<DayResponse> out = inputs.stream()
            .map(i -> new DayResponse(i.date().toString(), i.minutes(), i.type(), clean(i.note()), null)).toList();
        return new EntriesResponse(out);
    }

    public void delete(LocalDate date) {
        Caller caller = currentUser.load();
        require(caller, "TIMESHEET_SUBMIT");
        Employee me = ownEmployee(caller);
        checkWindow(date, LocalDate.now(ZONE));
        requireEditable(me.getId(), YearMonth.from(date));
        mongo.delete(TimesheetEntry.class,
            Criteria.where("employeeId").is(me.getId()).and("date").is(date.toString()));
        if (!EDITABLE.contains(statusOf(me.getId(), YearMonth.from(date)))) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.TIMESHEET_MONTH_LOCKED);
        }
    }

    public MonthResponse mine(String month) {
        Caller caller = currentUser.load();
        require(caller, "TIMESHEET_SUBMIT");
        Employee me = ownEmployee(caller);
        return view(me, parseMonth(month), false);
    }

    public MonthResponse submit(String month) {
        Caller caller = currentUser.load();
        require(caller, "TIMESHEET_SUBMIT");
        Employee me = ownEmployee(caller);
        YearMonth m = parseMonth(month);
        if (m.isAfter(YearMonth.now(ZONE))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.TIMESHEET_FUTURE_MONTH);
        }
        Update update = new Update().set("status", TimesheetStatus.SUBMITTED).set("submittedAt", Instant.now())
            .unset("decidedByUserId").unset("decidedAt").unset("rejectionReason").unset("approvedMinutes");
        // Upsert pe cheia unică: dacă luna există în altă stare, inserarea eșuează cu cheie duplicat => 409.
        transition(me.getId(), m, Criteria.where("status").in(EDITABLE), update, true);
        return view(me, m, false);
    }

    // ---------- vizibilitate ----------

    public PageResponse team(String month, TimesheetStatus status, int page, int size) {
        Caller caller = currentUser.load();
        require(caller, "TIMESHEET_APPROVE");
        YearMonth m = parseMonth(month);
        List<Employee> scope = employees.findByUserId(caller.userId())
            .map(e -> employees.findAllById(employees.findIdsByManagerId(e.getId()))).orElse(List.of());
        return list(m, status, scope, page, size);
    }

    public PageResponse all(String month, TimesheetStatus status, int page, int size) {
        Caller caller = currentUser.load();
        if (!has(caller, "TIMESHEET_READ_ALL") && !has(caller, "TIMESHEET_APPROVE_ALL")) {
            throw forbidden();
        }
        YearMonth m = parseMonth(month);
        return list(m, status, employees.findAll(), page, size);
    }

    public MonthResponse employee(UUID employeeId, String month) {
        Caller caller = currentUser.load();
        if (!has(caller, "TIMESHEET_APPROVE") && !has(caller, "TIMESHEET_APPROVE_ALL")
            && !has(caller, "TIMESHEET_READ_ALL")) {
            throw forbidden();
        }
        YearMonth m = parseMonth(month);
        Optional<Employee> me = employees.findByUserId(caller.userId());
        Employee target = employees.findById(employeeId).orElseThrow(TimesheetService::notFound);
        if (!visible(caller, me, target)) {
            throw notFound();
        }
        return view(target, m, true);
    }

    // ---------- decizie ----------

    public MonthResponse approve(UUID employeeId, String month) {
        return decide(employeeId, month, null);
    }

    public MonthResponse reject(UUID employeeId, String month, String reason) {
        return decide(employeeId, month, reason.trim());
    }

    /** reason == null => aprobare. Ordinea: 403 (privilegiu), 404 (invizibil), 403 (propriu / nu poate decide), 409. */
    private MonthResponse decide(UUID employeeId, String month, String reason) {
        Caller caller = currentUser.load();
        if (!has(caller, "TIMESHEET_APPROVE") && !has(caller, "TIMESHEET_APPROVE_ALL")) {
            throw forbidden();
        }
        YearMonth m = parseMonth(month);
        Optional<Employee> me = employees.findByUserId(caller.userId());
        Employee target = employees.findById(employeeId).orElseThrow(TimesheetService::notFound);
        if (!visible(caller, me, target)) {
            throw notFound();
        }
        if (me.isPresent() && me.get().getId().equals(target.getId())) {
            throw forbidden();
        }
        if (!has(caller, "TIMESHEET_APPROVE_ALL") && !(has(caller, "TIMESHEET_APPROVE") && isDirectManager(me, target))) {
            throw forbidden();
        }
        Update update = new Update().set("decidedByUserId", caller.userId()).set("decidedAt", Instant.now());
        if (reason != null) {
            update.set("status", TimesheetStatus.REJECTED).set("rejectionReason", reason).unset("approvedMinutes");
        } else {
            MonthData data = load(target.getId(), m);
            long worked = worked(data.entries, data.blocked);
            update.set("status", TimesheetStatus.APPROVED).set("approvedMinutes", (int) worked)
                .unset("rejectionReason");
        }
        transition(target.getId(), m, Criteria.where("status").is(TimesheetStatus.SUBMITTED), update, false);
        return view(target, m, true);
    }

    // ---------- helpere Mongo ----------

    private void writeEntry(UUID employeeId, String date, int minutes, TimesheetEntryType type, String note,
                            UUID userId) {
        Update update = new Update().set("minutes", minutes).set("type", type).set("updatedAt", Instant.now())
            .set("updatedByUserId", userId);
        if (clean(note) == null) {
            update.unset("note");
        } else {
            update.set("note", clean(note));
        }
        Criteria key = Criteria.where("employeeId").is(employeeId).and("date").is(date);
        try {
            mongo.upsert(TimesheetEntry.class, key, update);
        } catch (DuplicateKeyException first) {
            // Două upsert-uri simultane pe aceeași cheie: al doilea reîncearcă (acum documentul există).
            try {
                mongo.upsert(TimesheetEntry.class, key, update);
            } catch (DuplicateKeyException second) {
                throw new ApiException(HttpStatus.CONFLICT, Messages.CONCURRENT_UPDATE);
            }
        }
    }

    /** Tranziție atomică condiționată de statusul așteptat; fără potrivire => 409. */
    private void transition(UUID employeeId, YearMonth m, Criteria expectedStatus, Update update, boolean upsert) {
        Criteria key = Criteria.where("employeeId").is(employeeId).and("month").is(m.toString());
        Criteria criteria = new Criteria().andOperator(key, expectedStatus);
        TimesheetPeriod result;
        try {
            result = mongo.findAndModify(TimesheetPeriod.class, criteria, update, true, upsert);
        } catch (DuplicateKeyException e) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.TIMESHEET_STATE_CONFLICT);
        }
        if (result == null) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.TIMESHEET_STATE_CONFLICT);
        }
    }

    private TimesheetPeriod periodOf(UUID employeeId, YearMonth m) {
        return mongo.findOne(TimesheetPeriod.class,
            Criteria.where("employeeId").is(employeeId).and("month").is(m.toString()));
    }

    private TimesheetStatus statusOf(UUID employeeId, YearMonth m) {
        TimesheetPeriod p = periodOf(employeeId, m);
        return p == null || p.getStatus() == null ? TimesheetStatus.DRAFT : p.getStatus();
    }

    private void requireEditable(UUID employeeId, YearMonth m) {
        if (!EDITABLE.contains(statusOf(employeeId, m))) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.TIMESHEET_MONTH_LOCKED);
        }
    }

    // ---------- construirea răspunsurilor ----------

    private record MonthData(List<TimesheetEntry> entries, Map<LocalDate, String> blocked, TimesheetPeriod period) {
    }

    private MonthData load(UUID employeeId, YearMonth m) {
        List<TimesheetEntry> entries = entriesOf(List.of(employeeId), m).getOrDefault(employeeId, List.of());
        Map<LocalDate, String> blocked = blockedDays(m, holidaysIn(m), leavesOf(employeeId, m));
        return new MonthData(entries, blocked, periodOf(employeeId, m));
    }

    private MonthResponse view(Employee employee, YearMonth m, boolean withEmployee) {
        MonthData data = load(employee.getId(), m);
        int baseDays = calculator.calculate(m.atDay(1), m.atEndOfMonth());
        TimesheetPeriod p = data.period;
        TimesheetStatus status = p == null || p.getStatus() == null ? TimesheetStatus.DRAFT : p.getStatus();
        TreeMap<String, DayResponse> days = new TreeMap<>();
        data.blocked.forEach((d, why) -> days.put(d.toString(), new DayResponse(d.toString(), null, null, null, why)));
        for (TimesheetEntry e : data.entries) {
            String why = data.blocked.get(LocalDate.parse(e.getDate()));
            days.put(e.getDate(), new DayResponse(e.getDate(), e.getMinutes(), e.getType(), e.getNote(), why));
        }
        return new MonthResponse(m.toString(), withEmployee ? ref(employee) : null, status,
            p == null ? null : p.getSubmittedAt(), p == null ? null : p.getDecidedAt(),
            p == null ? null : p.getRejectionReason(), p == null ? null : p.getApprovedMinutes(),
            new ArrayList<>(days.values()), summary(data.entries, data.blocked, baseDays));
    }

    private PageResponse list(YearMonth m, TimesheetStatus status, List<Employee> scope, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int maxPage = (int) ((Integer.MAX_VALUE / (long) safeSize) - 1);
        int safePage = Math.min(Math.max(page, 0), maxPage);
        List<UUID> scopeIds = scope.stream().map(Employee::getId).toList();
        Map<UUID, TimesheetPeriod> periods = scopeIds.isEmpty() ? Map.of()
            : mongo.find(TimesheetPeriod.class,
                    Criteria.where("employeeId").in(scopeIds).and("month").is(m.toString())).stream()
                .collect(Collectors.toMap(TimesheetPeriod::getEmployeeId, p -> p, (a, b) -> a));
        List<Employee> filtered = scope.stream()
            .filter(e -> status == null || statusFrom(periods.get(e.getId())) == status)
            .sorted(Comparator.comparing(Employee::getLastName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(Employee::getFirstName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(Employee::getId))
            .toList();
        long from = (long) safePage * safeSize;
        List<Employee> slice = from >= filtered.size() ? List.of()
            : filtered.subList((int) from, (int) Math.min(filtered.size(), from + safeSize));
        List<TeamRow> rows = new ArrayList<>();
        if (!slice.isEmpty()) {
            List<UUID> ids = slice.stream().map(Employee::getId).toList();
            int baseDays = calculator.calculate(m.atDay(1), m.atEndOfMonth());
            Set<LocalDate> hol = holidaysIn(m);
            Map<UUID, List<TimesheetEntry>> entries = entriesOf(ids, m);
            Map<UUID, List<LeaveRequest>> leavesBy = leaves
                .findApprovedOverlapping(ids, m.atDay(1), m.atEndOfMonth()).stream()
                .collect(Collectors.groupingBy(LeaveRequest::getEmployeeId));
            for (Employee e : slice) {
                Map<LocalDate, String> blocked = blockedDays(m, hol, leavesBy.getOrDefault(e.getId(), List.of()));
                rows.add(new TeamRow(ref(e), statusFrom(periods.get(e.getId())),
                    summary(entries.getOrDefault(e.getId(), List.of()), blocked, baseDays)));
            }
        }
        return new PageResponse(rows, safePage, safeSize, filtered.size());
    }

    private Map<UUID, List<TimesheetEntry>> entriesOf(Collection<UUID> ids, YearMonth m) {
        return mongo.find(TimesheetEntry.class, Criteria.where("employeeId").in(ids)
                .and("date").gte(m.atDay(1).toString()).lte(m.atEndOfMonth().toString())).stream()
            .collect(Collectors.groupingBy(TimesheetEntry::getEmployeeId));
    }

    private static TimesheetStatus statusFrom(TimesheetPeriod p) {
        return p == null || p.getStatus() == null ? TimesheetStatus.DRAFT : p.getStatus();
    }

    // ---------- calcule ----------

    /** Sărbătorile legale căzute în zile lucrătoare (luni-vineri). */
    private Set<LocalDate> holidaysIn(YearMonth m) {
        return holidays.findDatesBetween(m.atDay(1), m.atEndOfMonth()).stream()
            .filter(d -> d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY)
            .collect(Collectors.toSet());
    }

    private List<LeaveRequest> leavesOf(UUID employeeId, YearMonth m) {
        return leaves.findApprovedOverlapping(List.of(employeeId), m.atDay(1), m.atEndOfMonth());
    }

    private static Map<LocalDate, String> blockedDays(YearMonth m, Set<LocalDate> holidaySet,
                                                      List<LeaveRequest> approvedLeaves) {
        Map<LocalDate, String> out = new HashMap<>();
        holidaySet.forEach(d -> out.put(d, HOLIDAY));
        for (LeaveRequest l : approvedLeaves) {
            LocalDate from = l.getStartDate().isBefore(m.atDay(1)) ? m.atDay(1) : l.getStartDate();
            LocalDate to = l.getEndDate().isAfter(m.atEndOfMonth()) ? m.atEndOfMonth() : l.getEndDate();
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                if (d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY) {
                    out.putIfAbsent(d, LEAVE);
                }
            }
        }
        return out;
    }

    private static long worked(List<TimesheetEntry> entries, Map<LocalDate, String> blocked) {
        return entries.stream()
            .filter(e -> e.getType() != TimesheetEntryType.ABSENT && !blocked.containsKey(LocalDate.parse(e.getDate())))
            .mapToLong(TimesheetEntry::getMinutes).sum();
    }

    private static Summary summary(List<TimesheetEntry> entries, Map<LocalDate, String> blocked, int baseDays) {
        int leaveDays = (int) blocked.values().stream().filter(LEAVE::equals).count();
        int holidayDays = (int) blocked.values().stream().filter(HOLIDAY::equals).count();
        int absent = (int) entries.stream().filter(e -> e.getType() == TimesheetEntryType.ABSENT
            && !blocked.containsKey(LocalDate.parse(e.getDate()))).count();
        long norm = (long) Math.max(baseDays - leaveDays, 0) * DAY_MINUTES;
        return new Summary(worked(entries, blocked), norm, leaveDays, holidayDays, absent);
    }

    // ---------- autorizare / validare ----------

    private boolean visible(Caller caller, Optional<Employee> me, Employee target) {
        if (has(caller, "TIMESHEET_READ_ALL") || has(caller, "TIMESHEET_APPROVE_ALL")) {
            return true;
        }
        if (me.isPresent() && me.get().getId().equals(target.getId())) {
            return true;
        }
        return has(caller, "TIMESHEET_APPROVE") && isDirectManager(me, target);
    }

    private static boolean isDirectManager(Optional<Employee> me, Employee target) {
        return me.isPresent() && target.getManagerId() != null && target.getManagerId().equals(me.get().getId());
    }

    private static boolean has(Caller caller, String code) {
        return caller.permissions().contains(code);
    }

    private static void require(Caller caller, String code) {
        if (!has(caller, code)) {
            throw forbidden();
        }
    }

    private Employee ownEmployee(Caller caller) {
        return employees.findByUserId(caller.userId()).orElseThrow(TimesheetService::forbidden);
    }

    private static YearMonth parseMonth(String month) {
        if (month == null || !MONTH.matcher(month).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        try {
            YearMonth m = YearMonth.parse(month);
            if (m.getYear() < MIN_YEAR || m.getYear() > MAX_YEAR) {
                throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
            }
            return m;
        } catch (java.time.DateTimeException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
    }

    private static void checkWindow(LocalDate date, LocalDate today) {
        if (date.isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.TIMESHEET_FUTURE_DATE);
        }
        if (date.isBefore(today.minusDays(WINDOW_DAYS))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.TIMESHEET_DATE_TOO_OLD);
        }
    }

    private static String clean(String note) {
        return note == null || note.isBlank() ? null : note.trim();
    }

    private static EmployeeRef ref(Employee e) {
        return new EmployeeRef(e.getId(), e.getFirstName(), e.getLastName());
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND);
    }
}
