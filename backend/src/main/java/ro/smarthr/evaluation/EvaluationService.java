package ro.smarthr.evaluation;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;
import ro.smarthr.employee.Employee;
import ro.smarthr.employee.EmployeeRepository;
import ro.smarthr.evaluation.EvaluationController.Counts;
import ro.smarthr.evaluation.EvaluationController.CriterionInput;
import ro.smarthr.evaluation.EvaluationController.CriterionView;
import ro.smarthr.evaluation.EvaluationController.CycleRequest;
import ro.smarthr.evaluation.EvaluationController.CycleResponse;
import ro.smarthr.evaluation.EvaluationController.EmployeeRef;
import ro.smarthr.evaluation.EvaluationController.EvaluationResponse;
import ro.smarthr.evaluation.EvaluationController.PageOf;
import ro.smarthr.evaluation.EvaluationController.ProgressResponse;
import ro.smarthr.evaluation.EvaluationController.ProgressRow;
import ro.smarthr.evaluation.EvaluationController.ReviewRequest;
import ro.smarthr.evaluation.EvaluationController.ReviewView;
import ro.smarthr.evaluation.EvaluationController.TeamRow;
import ro.smarthr.iam.CurrentUserPrivileges;
import ro.smarthr.iam.CurrentUserPrivileges.Caller;
import ro.smarthr.tenancy.mongo.TenantMongoOperations;

/**
 * Evaluarea performanței (MongoDB, prin wrapperul de tenant) cu angajații din Postgres.
 * Fiecare metodă începe cu privilegiile proaspete din DB; toate tranzițiile sunt findAndModify condiționat pe stare.
 */
@Service
public class EvaluationService {

    static final int MAX_PAGE_SIZE = 100;
    static final int MAX_PAGE = 100_000;
    static final int MAX_EXCLUDED_LISTED = 100;
    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9_-]{0,39}");
    private static final Set<EvaluationStatus> OPEN_STATES =
        Set.of(EvaluationStatus.PENDING_SELF, EvaluationStatus.PENDING_MANAGER);

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(EvaluationService.class);

    private enum Mode { SUBJECT, REVIEWER, HR }

    private final TenantMongoOperations mongo;
    private final EmployeeRepository employees;
    private final CurrentUserPrivileges currentUser;

    public EvaluationService(TenantMongoOperations mongo, EmployeeRepository employees,
                             CurrentUserPrivileges currentUser) {
        this.mongo = mongo;
        this.employees = employees;
        this.currentUser = currentUser;
    }

    // ---------- cicluri (HR) ----------

    public PageOf<CycleResponse> cycles(int page, int size) {
        require(currentUser.load(), "EVALUATION_MANAGE");
        int p = clampPage(page);
        int s = clampSize(size);
        List<CycleResponse> items = mongo.find(EvaluationCycle.class, null,
            Sort.by(Sort.Order.desc("startDate"), Sort.Order.desc("id")), p * s, s).stream()
            .map(EvaluationService::cycleView).toList();
        return new PageOf<>(items, p, s, mongo.count(EvaluationCycle.class, null));
    }

    public CycleResponse createCycle(CycleRequest request) {
        require(currentUser.load(), "EVALUATION_MANAGE");
        EvaluationCycle cycle = buildCycle(request);
        return cycleView(mongo.insert(cycle));
    }

    public CycleResponse updateCycle(String id, CycleRequest request) {
        require(currentUser.load(), "EVALUATION_MANAGE");
        EvaluationCycle existing = findCycle(id);
        if (existing == null) {
            throw notFound();
        }
        if (existing.getStatus() != CycleStatus.DRAFT) {
            throw stateConflict();
        }
        EvaluationCycle in = buildCycle(request);
        Update update = new Update().set("name", in.getName()).set("startDate", in.getStartDate())
            .set("endDate", in.getEndDate()).set("criteria", in.getCriteria());
        EvaluationCycle updated = mongo.findAndModify(EvaluationCycle.class,
            Criteria.where("id").is(id).and("status").is(CycleStatus.DRAFT), update, true, false);
        if (updated == null) {
            throw stateConflict();
        }
        return cycleView(updated);
    }

    public CycleResponse open(String id) {
        require(currentUser.load(), "EVALUATION_MANAGE");
        EvaluationCycle existing = findCycle(id);
        if (existing == null) {
            throw notFound();
        }
        if (existing.getStatus() != CycleStatus.DRAFT) {
            throw stateConflict();
        }
        EvaluationCycle opened;
        try {
            opened = mongo.findAndModify(EvaluationCycle.class,
                Criteria.where("id").is(id).and("status").is(CycleStatus.DRAFT),
                new Update().set("status", CycleStatus.OPEN).set("openedAt", Instant.now()), true, false);
        } catch (DuplicateKeyException e) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.EVALUATION_CYCLE_OPEN_EXISTS);
        }
        if (opened == null) {
            throw stateConflict();
        }
        try {
            List<Employee> all = employees.findAll();
            Map<UUID, Employee> byId = new HashMap<>();
            all.forEach(x -> byId.put(x.getId(), x));
            for (Employee e : all) {
                if (e.getUserId() == null || e.getManagerId() == null || e.getManagerId().equals(e.getId())) {
                    continue;
                }
                // Managerul trebuie să aibă cont, altfel evaluatorul nu s-ar putea autentifica.
                Employee mgr = byId.get(e.getManagerId());
                if (mgr == null || mgr.getUserId() == null) {
                    continue;
                }
                try {
                    mongo.insert(new Evaluation(id, e.getId(), e.getManagerId()));
                } catch (DuplicateKeyException ignored) {
                    // evaluare deja creată pentru angajat în acest ciclu
                }
            }
        } catch (RuntimeException e) {
            // Ciclul nu rămâne deschis cu evaluări incomplete, chiar dacă ștergerea eșuează.
            try {
                mongo.delete(Evaluation.class, Criteria.where("cycleId").is(id));
            } catch (RuntimeException deleteFailure) {
                log.error("Rollback open: stergerea evaluarilor a esuat ({})", deleteFailure.getClass().getSimpleName());
            } finally {
                mongo.findAndModify(EvaluationCycle.class,
                    Criteria.where("id").is(id).and("status").is(CycleStatus.OPEN),
                    new Update().set("status", CycleStatus.DRAFT).unset("openedAt"), false, false);
            }
            throw e;
        }
        return cycleView(opened);
    }

    public CycleResponse close(String id) {
        require(currentUser.load(), "EVALUATION_MANAGE");
        EvaluationCycle existing = findCycle(id);
        if (existing == null) {
            throw notFound();
        }
        EvaluationCycle closed = mongo.findAndModify(EvaluationCycle.class,
            Criteria.where("id").is(id).and("status").is(CycleStatus.OPEN),
            new Update().set("status", CycleStatus.CLOSED).set("closedAt", Instant.now()), true, false);
        if (closed == null) {
            throw stateConflict();
        }
        // Limitare cunoscută: o trimitere concurentă între tranziția ciclului și blocare poate finaliza o evaluare
        // chiar la închidere; rezultatul rămâne consistent (evaluarea apare COMPLETED).
        mongo.updateMulti(Evaluation.class,
            Criteria.where("cycleId").is(id).and("status").ne(EvaluationStatus.COMPLETED),
            new Update().set("locked", true));
        return cycleView(closed);
    }

    public ProgressResponse progress(String id, int page, int size) {
        Caller caller = currentUser.load();
        require(caller, "EVALUATION_MANAGE");
        UUID myId = employees.findByUserId(caller.userId()).map(Employee::getId).orElse(null);
        EvaluationCycle cycle = findCycle(id);
        if (cycle == null) {
            throw notFound();
        }
        int p = clampPage(page);
        int s = clampSize(size);
        Criteria base = Criteria.where("cycleId").is(id);
        Counts counts = new Counts(
            mongo.count(Evaluation.class, Criteria.where("cycleId").is(id).and("status").is(EvaluationStatus.PENDING_SELF)),
            mongo.count(Evaluation.class, Criteria.where("cycleId").is(id).and("status").is(EvaluationStatus.PENDING_MANAGER)),
            mongo.count(Evaluation.class, Criteria.where("cycleId").is(id).and("status").is(EvaluationStatus.COMPLETED)),
            mongo.count(Evaluation.class, Criteria.where("cycleId").is(id).and("locked").is(true)));
        long total = counts.pendingSelf() + counts.pendingManager() + counts.completed();
        List<Evaluation> page1 = mongo.find(Evaluation.class, base, Sort.by(Sort.Order.asc("id")), p * s, s);

        List<Employee> excluded = List.of();
        if (cycle.getStatus() != CycleStatus.DRAFT) {
            Set<UUID> included = mongo.find(Evaluation.class, base).stream().map(Evaluation::getEmployeeId)
                .collect(Collectors.toSet());
            excluded = employees.findAll().stream().filter(e -> !included.contains(e.getId())).toList();
        }
        Set<UUID> ids = new HashSet<>();
        page1.forEach(e -> {
            ids.add(e.getEmployeeId());
            ids.add(e.getReviewerEmployeeId());
        });
        Map<UUID, EmployeeRef> names = refs(ids);
        boolean closed = cycle.getStatus() == CycleStatus.CLOSED;
        List<ProgressRow> items = page1.stream().map(e -> {
            boolean own = !closed && e.getEmployeeId().equals(myId);
            return new ProgressRow(e.getId(), ref(names, e.getEmployeeId()), ref(names, e.getReviewerEmployeeId()),
                own ? subjectStatus(e) : e.getStatus(), e.isLocked(), own ? null : e.getFinalScore());
        }).toList();
        List<EmployeeRef> excludedRefs = excluded.stream().limit(MAX_EXCLUDED_LISTED)
            .map(e -> new EmployeeRef(e.getId(), e.getFirstName(), e.getLastName())).toList();
        return new ProgressResponse(cycleView(cycle), counts, excluded.size(), excludedRefs, items, p, s, total);
    }

    // ---------- angajat ----------

    public List<EvaluationResponse> mine() {
        Caller caller = currentUser.load();
        require(caller, "EVALUATION_SELF");
        Employee me = ownEmployee(caller);
        List<Evaluation> evals = mongo.find(Evaluation.class, Criteria.where("employeeId").is(me.getId()),
            Sort.by(Sort.Order.desc("id")), 0, MAX_PAGE_SIZE);
        Map<String, EvaluationCycle> cycles = cyclesOf(evals);
        TrendData trendData = trendData(me.getId());
        Set<UUID> ids = new HashSet<>();
        evals.forEach(e -> {
            ids.add(e.getEmployeeId());
            ids.add(e.getReviewerEmployeeId());
        });
        Map<UUID, EmployeeRef> names = refs(ids);
        List<EvaluationResponse> out = new ArrayList<>();
        for (Evaluation e : evals) {
            EvaluationCycle c = cycles.get(e.getCycleId());
            if (c != null) {
                out.add(view(e, c, Mode.SUBJECT, names, trendData));
            }
        }
        return out;
    }

    public EvaluationResponse selfReview(String id, ReviewRequest request) {
        Caller caller = currentUser.load();
        require(caller, "EVALUATION_SELF");
        Employee me = ownEmployee(caller);
        Evaluation ev = findEvaluation(id);
        if (ev == null || !visible(ev, me, caller)) {
            throw notFound();
        }
        if (!ev.getEmployeeId().equals(me.getId())) {
            throw forbidden();
        }
        EvaluationCycle cycle = cycleOf(ev);
        if (ev.getStatus() != EvaluationStatus.PENDING_SELF || ev.isLocked() || cycle.getStatus() != CycleStatus.OPEN) {
            throw stateConflict();
        }
        Map<String, Integer> scores = parseScores(request.scores(), cycle);
        String comment = parseComment(request.comment());
        Update update = new Update().set("self", new ReviewEntry(scores, comment, Instant.now()))
            .set("selfScore", weighted(scores, cycle)).set("status", EvaluationStatus.PENDING_MANAGER);
        Evaluation updated = mongo.findAndModify(Evaluation.class,
            Criteria.where("id").is(id).and("status").is(EvaluationStatus.PENDING_SELF).and("locked").ne(true),
            update, true, false);
        if (updated == null) {
            throw stateConflict();
        }
        return single(updated, cycle, Mode.SUBJECT);
    }

    // ---------- manager ----------

    public PageOf<TeamRow> team(String cycleId, EvaluationStatus status, int page, int size) {
        Caller caller = currentUser.load();
        require(caller, "EVALUATION_REVIEW");
        Employee me = ownEmployee(caller);
        int p = clampPage(page);
        int s = clampSize(size);
        Criteria criteria = Criteria.where("reviewerEmployeeId").is(me.getId());
        if (cycleId != null && !cycleId.isBlank()) {
            criteria = criteria.and("cycleId").is(cycleId);
        }
        if (status != null) {
            criteria = criteria.and("status").is(status);
        }
        List<Evaluation> evals = mongo.find(Evaluation.class, criteria, Sort.by(Sort.Order.asc("id")), p * s, s);
        long total = mongo.count(Evaluation.class, criteria);
        Map<String, EvaluationCycle> cycles = cyclesOf(evals);
        Map<UUID, EmployeeRef> names = refs(evals.stream().map(Evaluation::getEmployeeId).collect(Collectors.toSet()));
        List<TeamRow> items = evals.stream().map(e -> {
            EvaluationCycle c = cycles.get(e.getCycleId());
            return new TeamRow(e.getId(), e.getCycleId(), c == null ? null : c.getName(),
                ref(names, e.getEmployeeId()), e.getStatus(), e.isLocked(), e.getSelf() != null, e.getFinalScore());
        }).toList();
        return new PageOf<>(items, p, s, total);
    }

    public EvaluationResponse get(String id) {
        Caller caller = currentUser.load();
        boolean hr = has(caller, "EVALUATION_MANAGE");
        if (!hr && !has(caller, "EVALUATION_SELF") && !has(caller, "EVALUATION_REVIEW")) {
            throw forbidden();
        }
        Optional<Employee> me = employees.findByUserId(caller.userId());
        if (me.isEmpty() && !hr) {
            throw forbidden();
        }
        Evaluation ev = findEvaluation(id);
        if (ev == null) {
            throw notFound();
        }
        Mode mode;
        if (me.isPresent() && ev.getEmployeeId().equals(me.get().getId())) {
            // Propria evaluare: mereu vedere de subiect, indiferent de privilegii.
            mode = Mode.SUBJECT;
        } else if (hr) {
            mode = Mode.HR;
        } else if (me.isPresent() && has(caller, "EVALUATION_REVIEW")
            && ev.getReviewerEmployeeId().equals(me.get().getId())) {
            mode = Mode.REVIEWER;
        } else {
            throw notFound();
        }
        return single(ev, cycleOf(ev), mode);
    }

    public EvaluationResponse managerReview(String id, ReviewRequest request) {
        Caller caller = currentUser.load();
        require(caller, "EVALUATION_REVIEW");
        Employee me = ownEmployee(caller);
        Evaluation ev = findEvaluation(id);
        if (ev == null || !visible(ev, me, caller)) {
            throw notFound();
        }
        // Vizibilă, dar acțiune nepermisă: propria evaluare sau evaluator diferit (inclusiv HR).
        if (ev.getEmployeeId().equals(me.getId()) || !ev.getReviewerEmployeeId().equals(me.getId())) {
            throw forbidden();
        }
        EvaluationCycle cycle = cycleOf(ev);
        if (!OPEN_STATES.contains(ev.getStatus()) || ev.isLocked() || cycle.getStatus() != CycleStatus.OPEN) {
            throw stateConflict();
        }
        Map<String, Integer> scores = parseScores(request.scores(), cycle);
        String comment = parseComment(request.comment());
        Instant now = Instant.now();
        Update update = new Update().set("manager", new ReviewEntry(scores, comment, now))
            .set("finalScore", weighted(scores, cycle)).set("status", EvaluationStatus.COMPLETED)
            .set("completedAt", now);
        Evaluation updated = mongo.findAndModify(Evaluation.class,
            Criteria.where("id").is(id).and("status").in(OPEN_STATES).and("locked").ne(true)
                .and("reviewerEmployeeId").is(me.getId()), update, true, false);
        if (updated == null) {
            throw stateConflict();
        }
        return single(updated, cycle, Mode.REVIEWER);
    }

    // ---------- reasignare (HR) ----------

    public EvaluationResponse reassign(String id, UUID reviewerEmployeeId) {
        Caller caller = currentUser.load();
        require(caller, "EVALUATION_MANAGE");
        Evaluation ev = findEvaluation(id);
        if (ev == null) {
            throw notFound();
        }
        if (employees.findByUserId(caller.userId()).map(x -> x.getId().equals(ev.getEmployeeId())).orElse(false)) {
            throw forbidden();
        }
        EvaluationCycle cycle = cycleOf(ev);
        if (ev.getStatus() == EvaluationStatus.COMPLETED || ev.isLocked() || cycle.getStatus() != CycleStatus.OPEN) {
            throw stateConflict();
        }
        Employee reviewer = employees.findById(reviewerEmployeeId).orElse(null);
        if (reviewer == null || reviewer.getUserId() == null || reviewer.getId().equals(ev.getEmployeeId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.EVALUATION_INVALID_REVIEWER);
        }
        Evaluation updated = mongo.findAndModify(Evaluation.class,
            Criteria.where("id").is(id).and("status").in(OPEN_STATES).and("locked").ne(true),
            new Update().set("reviewerEmployeeId", reviewerEmployeeId), true, false);
        if (updated == null) {
            throw stateConflict();
        }
        return single(updated, cycle, Mode.HR);
    }

    // ---------- răspunsuri ----------

    private record TrendData(List<Evaluation> completed, Map<String, EvaluationCycle> closedCycles) {
    }

    private TrendData trendData(UUID employeeId) {
        List<Evaluation> completed = mongo.find(Evaluation.class,
            Criteria.where("employeeId").is(employeeId).and("completedAt").ne(null));
        Map<String, EvaluationCycle> closed = mongo.find(EvaluationCycle.class,
            Criteria.where("status").is(CycleStatus.CLOSED)).stream()
            .collect(Collectors.toMap(EvaluationCycle::getId, c -> c));
        return new TrendData(completed, closed);
    }

    /** Diferența față de cel mai recent ciclu închis anterior cu evaluare finalizată; null dacă nu există. */
    private static Double trend(Evaluation ev, EvaluationCycle cycle, TrendData data) {
        if (ev.getFinalScore() == null) {
            return null;
        }
        Evaluation prev = null;
        Instant prevClosed = null;
        for (Evaluation e : data.completed()) {
            EvaluationCycle c = data.closedCycles().get(e.getCycleId());
            if (c == null || e.getId().equals(ev.getId()) || e.getFinalScore() == null || c.getClosedAt() == null) {
                continue;
            }
            if (cycle.getClosedAt() != null && !c.getClosedAt().isBefore(cycle.getClosedAt())) {
                continue;
            }
            if (prevClosed == null || c.getClosedAt().isAfter(prevClosed)) {
                prev = e;
                prevClosed = c.getClosedAt();
            }
        }
        if (prev == null) {
            return null;
        }
        return BigDecimal.valueOf(ev.getFinalScore()).subtract(BigDecimal.valueOf(prev.getFinalScore()))
            .setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private EvaluationResponse single(Evaluation ev, EvaluationCycle cycle, Mode mode) {
        Map<UUID, EmployeeRef> names = refs(Set.of(ev.getEmployeeId(), ev.getReviewerEmployeeId()));
        TrendData data = ev.getFinalScore() == null ? new TrendData(List.of(), Map.of()) : trendData(ev.getEmployeeId());
        return view(ev, cycle, mode, names, data);
    }

    private static EvaluationResponse view(Evaluation ev, EvaluationCycle cycle, Mode mode, Map<UUID, EmployeeRef> names,
                                           TrendData data) {
        EvaluationStatus status = ev.getStatus();
        ReviewView self = reviewView(ev.getSelf());
        ReviewView manager = reviewView(ev.getManager());
        Double finalScore = ev.getFinalScore();
        Instant completedAt = ev.getCompletedAt();
        if (mode == Mode.SUBJECT && cycle.getStatus() != CycleStatus.CLOSED) {
            // Partea managerului și scorul final devin vizibile angajatului doar după închiderea ciclului.
            manager = null;
            finalScore = null;
            completedAt = null;
            status = subjectStatus(ev);
        }
        Double trend = finalScore == null || mode == Mode.REVIEWER ? null : trend(ev, cycle, data);
        return new EvaluationResponse(ev.getId(), cycleView(cycle), ref(names, ev.getEmployeeId()),
            ref(names, ev.getReviewerEmployeeId()), status, ev.isLocked(), self, manager, ev.getSelfScore(),
            finalScore, trend, completedAt);
    }

    /** Starea văzută de angajat cât ciclul e deschis: COMPLETED se ascunde în starea de dinainte. */
    private static EvaluationStatus subjectStatus(Evaluation ev) {
        if (ev.getStatus() == EvaluationStatus.COMPLETED) {
            return ev.getSelf() == null ? EvaluationStatus.PENDING_SELF : EvaluationStatus.PENDING_MANAGER;
        }
        return ev.getStatus();
    }

    private static ReviewView reviewView(ReviewEntry r) {
        return r == null ? null : new ReviewView(r.getScores(), r.getComment(), r.getSubmittedAt());
    }

    private static CycleResponse cycleView(EvaluationCycle c) {
        List<CriterionView> criteria = c.getCriteria().stream()
            .map(k -> new CriterionView(k.getKey(), k.getName(), k.getWeight())).toList();
        return new CycleResponse(c.getId(), c.getName(), c.getStartDate(), c.getEndDate(), c.getStatus(), criteria,
            c.getScaleMax(), c.getOpenedAt(), c.getClosedAt());
    }

    private Map<UUID, EmployeeRef> refs(Set<UUID> ids) {
        Map<UUID, EmployeeRef> out = new HashMap<>();
        for (Employee e : employees.findAllById(ids)) {
            out.put(e.getId(), new EmployeeRef(e.getId(), e.getFirstName(), e.getLastName()));
        }
        return out;
    }

    private static EmployeeRef ref(Map<UUID, EmployeeRef> names, UUID id) {
        return names.getOrDefault(id, new EmployeeRef(id, null, null));
    }

    // ---------- validări ----------

    private static EvaluationCycle buildCycle(CycleRequest r) {
        if (r == null || r.name() == null || r.criteria() == null) {
            throw invalidCycle();
        }
        String name = r.name().trim();
        if (name.isEmpty() || name.length() > 120) {
            throw invalidCycle();
        }
        LocalDate start = parseDate(r.startDate());
        LocalDate end = parseDate(r.endDate());
        if (start.isAfter(end)) {
            throw invalidCycle();
        }
        if (r.criteria().isEmpty() || r.criteria().size() > 10) {
            throw invalidCycle();
        }
        Set<String> keys = new HashSet<>();
        List<CycleCriterion> criteria = new ArrayList<>();
        int sum = 0;
        for (CriterionInput in : r.criteria()) {
            if (in == null || in.key() == null || in.name() == null || in.weight() == null
                || !KEY.matcher(in.key()).matches() || !keys.add(in.key())) {
                throw invalidCycle();
            }
            String cname = in.name().trim();
            if (cname.isEmpty() || cname.length() > 100 || in.weight() < 1 || in.weight() > 100) {
                throw invalidCycle();
            }
            sum += in.weight();
            criteria.add(new CycleCriterion(in.key(), cname, in.weight()));
        }
        if (sum != 100) {
            throw invalidCycle();
        }
        return new EvaluationCycle(name, start.toString(), end.toString(), criteria);
    }

    private static LocalDate parseDate(String s) {
        if (s == null) {
            throw invalidCycle();
        }
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            throw invalidCycle();
        }
    }

    /** Scoruri întregi 1..5 pentru exact toate cheile ciclului. */
    private static Map<String, Integer> parseScores(Map<String, JsonNode> raw, EvaluationCycle cycle) {
        if (raw == null || raw.size() != cycle.getCriteria().size()) {
            throw invalidScores();
        }
        Map<String, Integer> out = new LinkedHashMap<>();
        for (CycleCriterion c : cycle.getCriteria()) {
            JsonNode n = raw.get(c.getKey());
            if (n == null || !n.isIntegralNumber() || !n.canConvertToInt()
                || n.intValue() < 1 || n.intValue() > cycle.getScaleMax()) {
                throw invalidScores();
            }
            out.put(c.getKey(), n.intValue());
        }
        return out;
    }

    private static String parseComment(String comment) {
        if (comment == null) {
            return null;
        }
        String c = comment.trim();
        if (c.length() > 1000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.EVALUATION_INVALID_COMMENT);
        }
        return c.isEmpty() ? null : c;
    }

    private static double weighted(Map<String, Integer> scores, EvaluationCycle cycle) {
        long sum = 0;
        for (CycleCriterion c : cycle.getCriteria()) {
            sum += (long) scores.get(c.getKey()) * c.getWeight();
        }
        return BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP).doubleValue();
    }

    // ---------- acces la date și vizibilitate ----------

    private EvaluationCycle findCycle(String id) {
        return mongo.findOne(EvaluationCycle.class, Criteria.where("id").is(id));
    }

    private Evaluation findEvaluation(String id) {
        return mongo.findOne(Evaluation.class, Criteria.where("id").is(id));
    }

    private EvaluationCycle cycleOf(Evaluation ev) {
        EvaluationCycle c = findCycle(ev.getCycleId());
        if (c == null) {
            throw notFound();
        }
        return c;
    }

    private Map<String, EvaluationCycle> cyclesOf(List<Evaluation> evals) {
        Set<String> ids = evals.stream().map(Evaluation::getCycleId).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return mongo.find(EvaluationCycle.class, Criteria.where("id").in(ids)).stream()
            .collect(Collectors.toMap(EvaluationCycle::getId, c -> c));
    }

    /** Evaluarea e vizibilă apelantului: angajatul evaluat, evaluatorul sau HR (EVALUATION_MANAGE). */
    private static boolean visible(Evaluation ev, Employee me, Caller caller) {
        return ev.getEmployeeId().equals(me.getId()) || ev.getReviewerEmployeeId().equals(me.getId())
            || has(caller, "EVALUATION_MANAGE");
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
        return employees.findByUserId(caller.userId()).orElseThrow(EvaluationService::forbidden);
    }

    private static int clampPage(int page) {
        return Math.max(0, Math.min(page, MAX_PAGE));
    }

    private static int clampSize(int size) {
        return Math.max(1, Math.min(size, MAX_PAGE_SIZE));
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND);
    }

    private static ApiException stateConflict() {
        return new ApiException(HttpStatus.CONFLICT, Messages.EVALUATION_STATE_CONFLICT);
    }

    private static ApiException invalidCycle() {
        return new ApiException(HttpStatus.BAD_REQUEST, Messages.EVALUATION_INVALID_CYCLE);
    }

    private static ApiException invalidScores() {
        return new ApiException(HttpStatus.BAD_REQUEST, Messages.EVALUATION_INVALID_SCORES);
    }
}
