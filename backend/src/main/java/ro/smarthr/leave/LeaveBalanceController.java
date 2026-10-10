package ro.smarthr.leave;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LeaveBalanceController {

    public record BalanceResponse(int year, int entitled, int carriedOver, int used, long pending, int available) {
    }

    public record BalanceRequest(@Min(0) @Max(100) int entitledDays, @Min(0) @Max(100) int carriedOverDays) {
    }

    private final LeaveBalanceService service;

    public LeaveBalanceController(LeaveBalanceService service) {
        this.service = service;
    }

    @GetMapping("/api/leave/balance")
    @PreAuthorize("hasAuthority('PERM_LEAVE_REQUEST')")
    public BalanceResponse mine(@RequestParam(required = false) Integer year) {
        return service.mine(year);
    }

    @GetMapping("/api/employees/{id}/leave-balances/{year}")
    @PreAuthorize("hasAuthority('PERM_LEAVE_BALANCE_MANAGE')")
    public BalanceResponse get(@PathVariable UUID id, @PathVariable int year) {
        return service.get(id, year);
    }

    @PutMapping("/api/employees/{id}/leave-balances/{year}")
    @PreAuthorize("hasAuthority('PERM_LEAVE_BALANCE_MANAGE')")
    public BalanceResponse put(@PathVariable UUID id, @PathVariable int year,
                               @Valid @RequestBody BalanceRequest request) {
        return service.put(id, year, request.entitledDays(), request.carriedOverDays());
    }
}
