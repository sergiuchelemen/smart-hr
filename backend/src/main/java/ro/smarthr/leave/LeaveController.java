package ro.smarthr.leave;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Autorizarea fină (inclusiv relația manager-subordonat) se verifică în serviciu, din DB. */
@RestController
public class LeaveController {

    /** Fără employeeId: cererea e mereu a angajatului legat de contul curent. */
    public record CreateRequest(@NotNull LeaveType type, @NotNull LocalDate startDate, @NotNull LocalDate endDate,
                                @Size(max = 500) String note) {
    }

    public record RejectRequest(@NotBlank @Size(max = 500) String reason) {
    }

    public record EmployeeRef(UUID id, String firstName, String lastName) {
    }

    public record DeciderRef(String name) {
    }

    public record RequestResponse(UUID id, EmployeeRef employee, LeaveType type, LocalDate startDate,
                                  LocalDate endDate, int workingDays, String note, LeaveStatus status,
                                  Instant createdAt, DeciderRef decidedBy, Instant decidedAt,
                                  String rejectionReason, Instant cancelledAt) {
    }

    public record PageResponse(List<RequestResponse> items, int page, int size, long totalElements) {
    }

    public record WorkingDaysResponse(int workingDays) {
    }

    private final LeaveService service;

    public LeaveController(LeaveService service) {
        this.service = service;
    }

    @PostMapping("/api/leave-requests")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_LEAVE_REQUEST')")
    public RequestResponse create(@Valid @RequestBody CreateRequest request) {
        return service.create(request);
    }

    @PostMapping("/api/leave-requests/{id}/cancel")
    @PreAuthorize("hasAuthority('PERM_LEAVE_REQUEST')")
    public RequestResponse cancel(@PathVariable UUID id) {
        return service.cancel(id);
    }

    @PostMapping("/api/leave-requests/{id}/approve")
    @PreAuthorize("hasAnyAuthority('PERM_LEAVE_APPROVE','PERM_LEAVE_APPROVE_ALL')")
    public RequestResponse approve(@PathVariable UUID id) {
        return service.approve(id);
    }

    @PostMapping("/api/leave-requests/{id}/reject")
    @PreAuthorize("hasAnyAuthority('PERM_LEAVE_APPROVE','PERM_LEAVE_APPROVE_ALL')")
    public RequestResponse reject(@PathVariable UUID id, @Valid @RequestBody RejectRequest request) {
        return service.reject(id, request.reason());
    }

    @GetMapping("/api/leave-requests/mine")
    @PreAuthorize("hasAuthority('PERM_LEAVE_REQUEST')")
    public PageResponse mine(@RequestParam(required = false) LeaveStatus status,
                             @RequestParam(required = false) Integer year,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size) {
        return service.mine(status, year, page, size);
    }

    @GetMapping("/api/leave-requests/team")
    @PreAuthorize("hasAuthority('PERM_LEAVE_APPROVE')")
    public PageResponse team(@RequestParam(required = false) LeaveStatus status,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size) {
        return service.team(status, page, size);
    }

    @GetMapping("/api/leave-requests")
    @PreAuthorize("hasAuthority('PERM_LEAVE_READ_ALL')")
    public PageResponse all(@RequestParam(required = false) LeaveStatus status,
                            @RequestParam(required = false) UUID employeeId,
                            @RequestParam(required = false) Integer year,
                            @RequestParam(defaultValue = "0") int page,
                            @RequestParam(defaultValue = "20") int size) {
        return service.all(status, employeeId, year, page, size);
    }

    @GetMapping("/api/leave-requests/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_LEAVE_REQUEST','PERM_LEAVE_APPROVE','PERM_LEAVE_APPROVE_ALL',"
        + "'PERM_LEAVE_READ_ALL','PERM_LEAVE_BALANCE_MANAGE')")
    public RequestResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @GetMapping("/api/leave/working-days")
    @PreAuthorize("hasAuthority('PERM_LEAVE_REQUEST')")
    public WorkingDaysResponse workingDays(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
                                           @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return service.workingDays(start, end);
    }
}
