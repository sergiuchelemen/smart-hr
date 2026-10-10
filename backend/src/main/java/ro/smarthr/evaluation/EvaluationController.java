package ro.smarthr.evaluation;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Autorizarea fină (evaluator, vizibilitate, stare) se verifică în serviciu, din DB. */
@RestController
public class EvaluationController {

    public record CriterionInput(String key, String name, Integer weight) {
    }

    public record CycleRequest(String name, String startDate, String endDate, List<CriterionInput> criteria) {
    }

    public record ReviewRequest(Map<String, JsonNode> scores, String comment) {
    }

    public record ReassignRequest(@NotNull UUID reviewerEmployeeId) {
    }

    public record EmployeeRef(UUID id, String firstName, String lastName) {
    }

    public record CriterionView(String key, String name, int weight) {
    }

    public record CycleResponse(String id, String name, String startDate, String endDate, CycleStatus status,
                                List<CriterionView> criteria, int scaleMax, Instant openedAt, Instant closedAt) {
    }

    public record ReviewView(Map<String, Integer> scores, String comment, Instant submittedAt) {
    }

    public record EvaluationResponse(String id, CycleResponse cycle, EmployeeRef employee, EmployeeRef reviewer,
                                     EvaluationStatus status, boolean locked, ReviewView self, ReviewView manager,
                                     Double selfScore, Double finalScore, Double trend, Instant completedAt) {
    }

    public record TeamRow(String id, String cycleId, String cycleName, EmployeeRef employee, EvaluationStatus status,
                          boolean locked, boolean selfSubmitted, Double finalScore) {
    }

    public record ProgressRow(String id, EmployeeRef employee, EmployeeRef reviewer, EvaluationStatus status,
                              boolean locked, Double finalScore) {
    }

    public record Counts(long pendingSelf, long pendingManager, long completed, long locked) {
    }

    public record ProgressResponse(CycleResponse cycle, Counts counts, long excludedCount, List<EmployeeRef> excluded,
                                   List<ProgressRow> items, int page, int size, long totalElements) {
    }

    public record PageOf<T>(List<T> items, int page, int size, long totalElements) {
    }

    private final EvaluationService service;

    public EvaluationController(EvaluationService service) {
        this.service = service;
    }

    @GetMapping("/api/evaluation-cycles")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_MANAGE')")
    public PageOf<CycleResponse> cycles(@RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        return service.cycles(page, size);
    }

    @PostMapping("/api/evaluation-cycles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_EVALUATION_MANAGE')")
    public CycleResponse createCycle(@RequestBody CycleRequest request) {
        return service.createCycle(request);
    }

    @PutMapping("/api/evaluation-cycles/{id}")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_MANAGE')")
    public CycleResponse updateCycle(@PathVariable String id, @RequestBody CycleRequest request) {
        return service.updateCycle(id, request);
    }

    @PostMapping("/api/evaluation-cycles/{id}/open")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_MANAGE')")
    public CycleResponse open(@PathVariable String id) {
        return service.open(id);
    }

    @PostMapping("/api/evaluation-cycles/{id}/close")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_MANAGE')")
    public CycleResponse close(@PathVariable String id) {
        return service.close(id);
    }

    @GetMapping("/api/evaluation-cycles/{id}/progress")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_MANAGE')")
    public ProgressResponse progress(@PathVariable String id, @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return service.progress(id, page, size);
    }

    @GetMapping("/api/evaluations/me")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_SELF')")
    public List<EvaluationResponse> mine() {
        return service.mine();
    }

    @PostMapping("/api/evaluations/{id}/self-review")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_SELF')")
    public EvaluationResponse selfReview(@PathVariable String id, @Valid @RequestBody ReviewRequest request) {
        return service.selfReview(id, request);
    }

    @GetMapping("/api/evaluations/team")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_REVIEW')")
    public PageOf<TeamRow> team(@RequestParam(required = false) String cycleId,
                                @RequestParam(required = false) EvaluationStatus status,
                                @RequestParam(defaultValue = "0") int page,
                                @RequestParam(defaultValue = "20") int size) {
        return service.team(cycleId, status, page, size);
    }

    @GetMapping("/api/evaluations/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_EVALUATION_REVIEW', 'PERM_EVALUATION_MANAGE', 'PERM_EVALUATION_SELF')")
    public EvaluationResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @PostMapping("/api/evaluations/{id}/manager-review")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_REVIEW')")
    public EvaluationResponse managerReview(@PathVariable String id, @Valid @RequestBody ReviewRequest request) {
        return service.managerReview(id, request);
    }

    @PutMapping("/api/evaluations/{id}/reviewer")
    @PreAuthorize("hasAuthority('PERM_EVALUATION_MANAGE')")
    public EvaluationResponse reassign(@PathVariable String id, @Valid @RequestBody ReassignRequest request) {
        return service.reassign(id, request.reviewerEmployeeId());
    }
}
