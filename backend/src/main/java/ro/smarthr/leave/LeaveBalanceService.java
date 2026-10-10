package ro.smarthr.leave;

import java.time.LocalDate;
import java.util.UUID;
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
public class LeaveBalanceService {

    private final LeaveBalanceRepository balances;
    private final LeaveRequestRepository requests;
    private final EmployeeRepository employees;
    private final CurrentUserPrivileges currentUser;

    public LeaveBalanceService(LeaveBalanceRepository balances, LeaveRequestRepository requests,
                               EmployeeRepository employees, CurrentUserPrivileges currentUser) {
        this.balances = balances;
        this.requests = requests;
        this.employees = employees;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public LeaveBalanceController.BalanceResponse mine(Integer year) {
        Caller caller = currentUser.load();
        LeaveService.requirePermission(caller, "LEAVE_REQUEST");
        Employee me = employees.findByUserId(caller.userId())
            .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN));
        int y = LeaveService.checkYear(year == null ? LocalDate.now(LeaveService.ZONE).getYear() : year);
        return response(me.getId(), y);
    }

    @Transactional(readOnly = true)
    public LeaveBalanceController.BalanceResponse get(UUID employeeId, int year) {
        Caller caller = currentUser.load();
        LeaveService.requirePermission(caller, "LEAVE_BALANCE_MANAGE");
        requireNotOwnEmployee(caller, employeeId);
        int y = LeaveService.checkYear(year);
        requireEmployee(employeeId);
        return response(employeeId, y);
    }

    @Transactional
    public LeaveBalanceController.BalanceResponse put(UUID employeeId, int year, int entitled, int carriedOver) {
        Caller caller = currentUser.load();
        LeaveService.requirePermission(caller, "LEAVE_BALANCE_MANAGE");
        requireNotOwnEmployee(caller, employeeId);
        int y = LeaveService.checkYear(year);
        requireEmployee(employeeId);
        LeaveBalance b = balances.lockByEmployeeIdAndYear(employeeId, y).orElse(null);
        if (b == null) {
            // Cursă la creare: unicitatea (employee_id, year) produce 409 prin GlobalExceptionHandler.
            balances.saveAndFlush(new LeaveBalance(employeeId, y, entitled, carriedOver));
        } else {
            if (entitled + carriedOver < b.getUsedDays()) {
                throw new ApiException(HttpStatus.CONFLICT, Messages.LEAVE_BALANCE_BELOW_USED);
            }
            b.setAllowances(entitled, carriedOver);
            balances.saveAndFlush(b);
        }
        return response(employeeId, y);
    }

    /** Separarea atribuțiilor: nimeni nu își administrează propriul sold (se vede prin GET /api/leave/balance). */
    private void requireNotOwnEmployee(Caller caller, UUID employeeId) {
        if (employees.findByUserId(caller.userId()).map(e -> e.getId().equals(employeeId)).orElse(false)) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
    }

    private void requireEmployee(UUID employeeId) {
        employees.findById(employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND));
    }

    private LeaveBalanceController.BalanceResponse response(UUID employeeId, int year) {
        long pending = requests.sumPendingRestDays(employeeId, LeaveService.yearStart(year),
            LeaveService.yearEnd(year));
        return balances.findByEmployeeIdAndYear(employeeId, year)
            .map(b -> new LeaveBalanceController.BalanceResponse(year, b.getEntitledDays(), b.getCarriedOverDays(),
                b.getUsedDays(), pending, b.available()))
            .orElse(new LeaveBalanceController.BalanceResponse(year, 0, 0, 0, pending, 0));
    }
}
