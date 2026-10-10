package ro.smarthr.leave;

import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;
import ro.smarthr.employee.Employee;
import ro.smarthr.employee.EmployeeRepository;
import ro.smarthr.iam.CurrentUserPrivileges;
import ro.smarthr.iam.CurrentUserPrivileges.Caller;

@Service
public class LeaveService {

    static final int MAX_PAGE_SIZE = 100;

    static final ZoneId ZONE = ZoneId.of("Europe/Bucharest");

    private static final String UNKNOWN_DECIDER = "Utilizator";

    private final LeaveRequestRepository requests;
    private final LeaveBalanceRepository balances;
    private final EmployeeRepository employees;
    private final CurrentUserPrivileges currentUser;
    private final WorkingDaysCalculator calculator;

    public LeaveService(LeaveRequestRepository requests, LeaveBalanceRepository balances,
                        EmployeeRepository employees, CurrentUserPrivileges currentUser,
                        WorkingDaysCalculator calculator) {
        this.requests = requests;
        this.balances = balances;
        this.employees = employees;
        this.currentUser = currentUser;
        this.calculator = calculator;
    }

    // ---------- creare / anulare ----------

    @Transactional
    public LeaveController.RequestResponse create(LeaveController.CreateRequest r) {
        Caller caller = currentUser.load();
        requirePermission(caller, "LEAVE_REQUEST");
        Employee me = ownEmployee(caller);
        LocalDate start = r.startDate();
        LocalDate end = r.endDate();
        if (start.isBefore(LocalDate.now(ZONE))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.LEAVE_START_IN_PAST);
        }
        int days = calculator.calculate(start, end);
        if (days <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.LEAVE_NO_WORKING_DAYS);
        }
        if (requests.existsActiveOverlap(me.getId(), start, end)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.LEAVE_OVERLAP);
        }
        if (r.type() == LeaveType.ODIHNA) {
            int year = start.getYear();
            int available = balances.findByEmployeeIdAndYear(me.getId(), year).map(LeaveBalance::available).orElse(0);
            long pending = requests.sumPendingRestDays(me.getId(), yearStart(year), yearEnd(year));
            if (available - pending < days) {
                throw new ApiException(HttpStatus.CONFLICT, Messages.LEAVE_INSUFFICIENT_BALANCE);
            }
        }
        String note = r.note() == null || r.note().isBlank() ? null : r.note().trim();
        // Suprapunerea concurentă e prinsă de constrângerea de excludere (23P01 => 409 în GlobalExceptionHandler).
        LeaveRequest saved = requests.saveAndFlush(new LeaveRequest(me.getId(), r.type(), start, end, days, note,
            caller.userId()));
        return toResponses(List.of(saved)).get(0);
    }

    @Transactional
    public LeaveController.RequestResponse cancel(UUID id) {
        Caller caller = currentUser.load();
        requirePermission(caller, "LEAVE_REQUEST");
        Employee me = ownEmployee(caller);
        LeaveRequest req = requests.lockById(id)
            .filter(x -> x.getEmployeeId().equals(me.getId()))
            .orElseThrow(LeaveService::notFound);
        boolean cancellable = req.getStatus() == LeaveStatus.PENDING
            || (req.getStatus() == LeaveStatus.APPROVED && LocalDate.now(ZONE).isBefore(req.getStartDate()));
        if (!cancellable) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.LEAVE_CANNOT_CANCEL);
        }
        if (req.getStatus() == LeaveStatus.APPROVED && req.getType() == LeaveType.ODIHNA) {
            balances.lockByEmployeeIdAndYear(req.getEmployeeId(), req.getStartDate().getYear())
                .ifPresent(b -> b.releaseUsed(req.getWorkingDays()));
        }
        req.cancel();
        requests.saveAndFlush(req);
        return toResponses(List.of(req)).get(0);
    }

    // ---------- aprobare / respingere ----------

    @Transactional
    public LeaveController.RequestResponse approve(UUID id) {
        return decide(id, null);
    }

    @Transactional
    public LeaveController.RequestResponse reject(UUID id, String reason) {
        return decide(id, reason.trim());
    }

    /** reason == null => aprobare. Ordinea lock-urilor: cererea, apoi soldul. */
    private LeaveController.RequestResponse decide(UUID id, String reason) {
        Caller caller = currentUser.load();
        if (!caller.permissions().contains("LEAVE_APPROVE") && !caller.permissions().contains("LEAVE_APPROVE_ALL")) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        Optional<Employee> me = employees.findByUserId(caller.userId());
        LeaveRequest req = requests.lockById(id).orElseThrow(LeaveService::notFound);
        Employee owner = employees.findById(req.getEmployeeId()).orElseThrow(LeaveService::notFound);
        if (!isVisible(caller, me, req, owner)) {
            throw notFound();
        }
        if (me.isPresent() && me.get().getId().equals(owner.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        if (caller.userId().equals(req.getRequestedByUserId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        boolean allowed = caller.permissions().contains("LEAVE_APPROVE_ALL")
            || (caller.permissions().contains("LEAVE_APPROVE") && isDirectManager(me, owner));
        if (!allowed) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        if (req.getStatus() != LeaveStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.LEAVE_NOT_PENDING);
        }
        if (reason != null) {
            req.reject(caller.userId(), reason);
        } else {
            if (req.getType() == LeaveType.ODIHNA) {
                LeaveBalance b = balances.lockByEmployeeIdAndYear(req.getEmployeeId(), req.getStartDate().getYear())
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, Messages.LEAVE_INSUFFICIENT_BALANCE));
                if (b.available() < req.getWorkingDays()) {
                    throw new ApiException(HttpStatus.CONFLICT, Messages.LEAVE_INSUFFICIENT_BALANCE);
                }
                b.addUsed(req.getWorkingDays());
            }
            req.approve(caller.userId());
        }
        requests.saveAndFlush(req);
        return toResponses(List.of(req)).get(0);
    }

    // ---------- vizibilitate ----------

    @Transactional(readOnly = true)
    public LeaveController.PageResponse mine(LeaveStatus status, Integer year, int page, int size) {
        Caller caller = currentUser.load();
        requirePermission(caller, "LEAVE_REQUEST");
        Employee me = ownEmployee(caller);
        return list(spec(List.of(me.getId()), status, year), page, size);
    }

    @Transactional(readOnly = true)
    public LeaveController.PageResponse team(LeaveStatus status, int page, int size) {
        Caller caller = currentUser.load();
        requirePermission(caller, "LEAVE_APPROVE");
        List<UUID> ids = employees.findByUserId(caller.userId())
            .map(e -> employees.findIdsByManagerId(e.getId())).orElse(List.of());
        if (ids.isEmpty()) {
            return emptyPage(page, size);
        }
        return list(spec(ids, status, null), page, size);
    }

    @Transactional(readOnly = true)
    public LeaveController.PageResponse all(LeaveStatus status, UUID employeeId, Integer year, int page, int size) {
        Caller caller = currentUser.load();
        requirePermission(caller, "LEAVE_READ_ALL");
        return list(spec(employeeId == null ? null : List.of(employeeId), status, year), page, size);
    }

    @Transactional(readOnly = true)
    public LeaveController.RequestResponse get(UUID id) {
        Caller caller = currentUser.load();
        if (caller.permissions().stream().noneMatch(p -> p.startsWith("LEAVE_"))) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        Optional<Employee> me = employees.findByUserId(caller.userId());
        LeaveRequest req = requests.findById(id).orElseThrow(LeaveService::notFound);
        Employee owner = employees.findById(req.getEmployeeId()).orElseThrow(LeaveService::notFound);
        if (!isVisible(caller, me, req, owner)) {
            throw notFound();
        }
        return toResponses(List.of(req)).get(0);
    }

    // ---------- zile lucrătoare ----------

    @Transactional(readOnly = true)
    public LeaveController.WorkingDaysResponse workingDays(LocalDate start, LocalDate end) {
        Caller caller = currentUser.load();
        requirePermission(caller, "LEAVE_REQUEST");
        return new LeaveController.WorkingDaysResponse(calculator.calculate(start, end));
    }

    // ---------- helpere ----------

    private boolean isVisible(Caller caller, Optional<Employee> me, LeaveRequest req, Employee owner) {
        Set<String> p = caller.permissions();
        if (p.contains("LEAVE_READ_ALL") || p.contains("LEAVE_APPROVE_ALL")) {
            return true;
        }
        if (me.isPresent() && me.get().getId().equals(req.getEmployeeId())) {
            return true;
        }
        return p.contains("LEAVE_APPROVE") && isDirectManager(me, owner);
    }

    private static boolean isDirectManager(Optional<Employee> me, Employee owner) {
        return me.isPresent() && owner.getManagerId() != null && owner.getManagerId().equals(me.get().getId());
    }

    private Specification<LeaveRequest> spec(Collection<UUID> employeeIds, LeaveStatus status, Integer year) {
        LocalDate from = year == null ? null : yearStart(checkYear(year));
        LocalDate to = year == null ? null : yearEnd(year);
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (employeeIds != null) {
                ps.add(root.get("employeeId").in(employeeIds));
            }
            if (status != null) {
                ps.add(cb.equal(root.get("status"), status));
            }
            if (from != null) {
                ps.add(cb.between(root.<LocalDate>get("startDate"), from, to));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
    }

    private LeaveController.PageResponse list(Specification<LeaveRequest> spec, int page, int size) {
        int safeSize = safeSize(size);
        int safePage = safePage(page, safeSize);
        var result = requests.findAll(spec,
            PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.desc("startDate"), Sort.Order.asc("id"))));
        return new LeaveController.PageResponse(toResponses(result.getContent()), safePage, safeSize,
            result.getTotalElements());
    }

    private LeaveController.PageResponse emptyPage(int page, int size) {
        int safeSize = safeSize(size);
        return new LeaveController.PageResponse(List.of(), safePage(page, safeSize), safeSize, 0);
    }

    private static int safeSize(int size) {
        return Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
    }

    private static int safePage(int page, int safeSize) {
        int maxPage = (int) ((Integer.MAX_VALUE / (long) safeSize) - 1);
        return Math.min(Math.max(page, 0), maxPage);
    }

    private List<LeaveController.RequestResponse> toResponses(List<LeaveRequest> items) {
        Set<UUID> employeeIds = items.stream().map(LeaveRequest::getEmployeeId).collect(Collectors.toSet());
        Map<UUID, Employee> byId = new HashMap<>();
        employees.findAllById(employeeIds).forEach(e -> byId.put(e.getId(), e));
        Set<UUID> deciderIds = items.stream().map(LeaveRequest::getDecidedByUserId)
            .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, String> deciderNames = new HashMap<>();
        if (!deciderIds.isEmpty()) {
            employees.findAllByUserIdIn(deciderIds)
                .forEach(e -> deciderNames.put(e.getUserId(), e.getFirstName() + " " + e.getLastName()));
        }
        return items.stream().map(r -> {
            Employee e = byId.get(r.getEmployeeId());
            LeaveController.DeciderRef decider = r.getDecidedByUserId() == null ? null
                : new LeaveController.DeciderRef(deciderNames.getOrDefault(r.getDecidedByUserId(), UNKNOWN_DECIDER));
            return new LeaveController.RequestResponse(r.getId(),
                new LeaveController.EmployeeRef(e.getId(), e.getFirstName(), e.getLastName()), r.getType(),
                r.getStartDate(), r.getEndDate(), r.getWorkingDays(), r.getNote(), r.getStatus(), r.getCreatedAt(),
                decider, r.getDecidedAt(), r.getRejectionReason(), r.getCancelledAt());
        }).toList();
    }

    private Employee ownEmployee(Caller caller) {
        return employees.findByUserId(caller.userId())
            .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN));
    }

    static void requirePermission(Caller caller, String code) {
        if (!caller.permissions().contains(code)) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
    }

    static int checkYear(int year) {
        if (year < WorkingDaysCalculator.MIN_YEAR || year > WorkingDaysCalculator.MAX_YEAR) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        return year;
    }

    static LocalDate yearStart(int year) {
        return LocalDate.of(year, 1, 1);
    }

    static LocalDate yearEnd(int year) {
        return LocalDate.of(year, 12, 31);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND);
    }
}
