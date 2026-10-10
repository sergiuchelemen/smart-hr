package ro.smarthr.employee;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Emails;
import ro.smarthr.common.Messages;
import ro.smarthr.iam.CurrentUserPrivileges;
import ro.smarthr.iam.UserRepository;
import ro.smarthr.platform.CompanyRepository;

@Service
public class EmployeeService {

    static final int MAX_PAGE_SIZE = 100;

    static final int MAX_CHAIN_DEPTH = 1000;

    private final EmployeeRepository employees;
    private final UserRepository users;
    private final CompanyRepository companies;
    private final CurrentUserPrivileges currentUser;

    public EmployeeService(EmployeeRepository employees, UserRepository users, CompanyRepository companies,
                           CurrentUserPrivileges currentUser) {
        this.employees = employees;
        this.users = users;
        this.companies = companies;
        this.currentUser = currentUser;
    }

    @Transactional
    public EmployeeController.EmployeeResponse setAccount(UUID id, UUID userId) {
        CurrentUserPrivileges.Caller caller = currentUser.load();
        requirePermission(caller, "USER_MANAGE");
        Employee e = find(id);
        requireNotOwnEmployee(caller, id);
        if (userId != null) {
            users.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND));
            if (employees.findByUserId(userId).filter(o -> !o.getId().equals(id)).isPresent()) {
                throw new ApiException(HttpStatus.CONFLICT, Messages.USER_ALREADY_LINKED);
            }
        }
        e.setUserId(userId);
        return EmployeeController.EmployeeResponse.from(employees.saveAndFlush(e));
    }

    @Transactional
    public EmployeeController.EmployeeResponse setManager(UUID id, UUID managerId) {
        // Lock pe rândul companiei ÎNAINTE de orice citire de angajați: serializează modificările de ierarhie.
        companies.findByIdForUpdate(CurrentUserPrivileges.companyIdFromToken())
            .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN));
        CurrentUserPrivileges.Caller caller = currentUser.load();
        requirePermission(caller, "LEAVE_APPROVE_ALL");
        Employee e = find(id);
        requireNotOwnEmployee(caller, id);
        if (managerId != null) {
            if (managerId.equals(id)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
            }
            find(managerId);
            UUID current = managerId;
            for (int depth = 0; current != null; depth++) {
                if (current.equals(id) || depth >= MAX_CHAIN_DEPTH) {
                    throw new ApiException(HttpStatus.CONFLICT, Messages.MANAGER_CYCLE);
                }
                current = find(current).getManagerId();
            }
        }
        e.setManagerId(managerId);
        return EmployeeController.EmployeeResponse.from(employees.saveAndFlush(e));
    }

    private static void requirePermission(CurrentUserPrivileges.Caller caller, String code) {
        if (!caller.permissions().contains(code)) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
    }

    /** Apelantul nu își poate modifica propriul angajat (cel legat de contul lui). */
    private void requireNotOwnEmployee(CurrentUserPrivileges.Caller caller, UUID employeeId) {
        if (employees.findByUserId(caller.userId()).filter(o -> o.getId().equals(employeeId)).isPresent()) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
    }

    @Transactional(readOnly = true)
    public EmployeeController.PageResponse list(int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        // offset-ul (page * size) trebuie să încapă în int; peste ultima pagină reală rezultă lista goală
        int maxPage = (int) ((Integer.MAX_VALUE / (long) safeSize) - 1);
        int safePage = Math.min(Math.max(page, 0), maxPage);
        var result = employees.findAll(
            PageRequest.of(safePage, safeSize, Sort.by("lastName", "firstName", "id")));
        List<EmployeeController.EmployeeResponse> items =
            result.getContent().stream().map(EmployeeController.EmployeeResponse::from).toList();
        return new EmployeeController.PageResponse(items, safePage, safeSize, result.getTotalElements());
    }

    @Transactional(readOnly = true)
    public EmployeeController.EmployeeResponse get(UUID id) {
        return EmployeeController.EmployeeResponse.from(find(id));
    }

    @Transactional
    public EmployeeController.EmployeeResponse create(EmployeeController.EmployeeRequest r) {
        String email = normalizeEmail(r.workEmail());
        if (email != null && employees.existsByWorkEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.EMPLOYEE_EMAIL_TAKEN);
        }
        Employee saved = employees.saveAndFlush(new Employee(r.firstName().trim(), r.lastName().trim(), email,
            blankToNull(r.jobTitle()), blankToNull(r.department()), r.hireDate()));
        return EmployeeController.EmployeeResponse.from(saved);
    }

    @Transactional
    public EmployeeController.EmployeeResponse update(UUID id, EmployeeController.EmployeeRequest r) {
        Employee e = find(id);
        String email = normalizeEmail(r.workEmail());
        if (email != null && employees.existsByWorkEmailAndIdNot(email, id)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.EMPLOYEE_EMAIL_TAKEN);
        }
        e.update(r.firstName().trim(), r.lastName().trim(), email, blankToNull(r.jobTitle()),
            blankToNull(r.department()), r.hireDate());
        return EmployeeController.EmployeeResponse.from(employees.saveAndFlush(e));
    }

    /** Filtrul de tenant face ca id-urile din alte companii să nu fie găsite (404, nu 403). */
    private Employee find(UUID id) {
        return employees.findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND));
    }

    private static String normalizeEmail(String email) {
        String n = Emails.normalize(email);
        return n == null || n.isEmpty() ? null : n;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
