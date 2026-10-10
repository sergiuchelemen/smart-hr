package ro.smarthr.timesheet;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Autorizarea fină (echipa directă, auto-aprobare) se verifică în serviciu, din DB. */
@RestController
public class TimesheetController {

    public record EntryInput(@NotNull LocalDate date, @NotNull @Min(0) @Max(960) Integer minutes,
                             @NotNull TimesheetEntryType type, @Size(max = 200) String note) {
    }

    public record SaveRequest(@NotNull @Size(min = 1, max = 7) List<@Valid @NotNull EntryInput> entries) {
    }

    public record RejectRequest(@NotBlank @Size(max = 500) String reason) {
    }

    public record EmployeeRef(UUID id, String firstName, String lastName) {
    }

    /** minutes/type/note null pe zilele doar blocate; blocked null pe zilele pontabile. */
    public record DayResponse(String date, Integer minutes, TimesheetEntryType type, String note, String blocked) {
    }

    public record Summary(long workedMinutes, long normMinutes, int leaveDays, int holidayDays, int absentDays) {
    }

    public record MonthResponse(String month, EmployeeRef employee, TimesheetStatus status, Instant submittedAt,
                                Instant decidedAt, String rejectionReason, Integer approvedMinutes,
                                List<DayResponse> days, Summary summary) {
    }

    public record EntriesResponse(List<DayResponse> entries) {
    }

    public record TeamRow(EmployeeRef employee, TimesheetStatus status, Summary summary) {
    }

    public record PageResponse(List<TeamRow> items, int page, int size, long totalElements) {
    }

    private final TimesheetService service;

    public TimesheetController(TimesheetService service) {
        this.service = service;
    }

    @PutMapping("/api/timesheet/me/entries")
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_SUBMIT')")
    public EntriesResponse save(@Valid @RequestBody SaveRequest request) {
        return service.save(request.entries());
    }

    @DeleteMapping("/api/timesheet/me/entries/{date}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_SUBMIT')")
    public void delete(@PathVariable LocalDate date) {
        service.delete(date);
    }

    @GetMapping("/api/timesheet/me")
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_SUBMIT')")
    public MonthResponse mine(@RequestParam String month) {
        return service.mine(month);
    }

    @PostMapping("/api/timesheet/me/{month}/submit")
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_SUBMIT')")
    public MonthResponse submit(@PathVariable String month) {
        return service.submit(month);
    }

    @GetMapping("/api/timesheet/team")
    @PreAuthorize("hasAuthority('PERM_TIMESHEET_APPROVE')")
    public PageResponse team(@RequestParam String month, @RequestParam(required = false) TimesheetStatus status,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size) {
        return service.team(month, status, page, size);
    }

    @GetMapping("/api/timesheet/all")
    @PreAuthorize("hasAnyAuthority('PERM_TIMESHEET_READ_ALL','PERM_TIMESHEET_APPROVE_ALL')")
    public PageResponse all(@RequestParam String month, @RequestParam(required = false) TimesheetStatus status,
                            @RequestParam(defaultValue = "0") int page,
                            @RequestParam(defaultValue = "20") int size) {
        return service.all(month, status, page, size);
    }

    @GetMapping("/api/timesheet/employees/{employeeId}")
    @PreAuthorize("hasAnyAuthority('PERM_TIMESHEET_APPROVE','PERM_TIMESHEET_APPROVE_ALL','PERM_TIMESHEET_READ_ALL')")
    public MonthResponse employee(@PathVariable UUID employeeId, @RequestParam String month) {
        return service.employee(employeeId, month);
    }

    @PostMapping("/api/timesheet/employees/{employeeId}/{month}/approve")
    @PreAuthorize("hasAnyAuthority('PERM_TIMESHEET_APPROVE','PERM_TIMESHEET_APPROVE_ALL')")
    public MonthResponse approve(@PathVariable UUID employeeId, @PathVariable String month) {
        return service.approve(employeeId, month);
    }

    @PostMapping("/api/timesheet/employees/{employeeId}/{month}/reject")
    @PreAuthorize("hasAnyAuthority('PERM_TIMESHEET_APPROVE','PERM_TIMESHEET_APPROVE_ALL')")
    public MonthResponse reject(@PathVariable UUID employeeId, @PathVariable String month,
                                @Valid @RequestBody RejectRequest request) {
        return service.reject(employeeId, month, request.reason());
    }
}
