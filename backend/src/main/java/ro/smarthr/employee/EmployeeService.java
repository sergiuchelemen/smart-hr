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

@Service
public class EmployeeService {

    static final int MAX_PAGE_SIZE = 100;

    private final EmployeeRepository employees;

    public EmployeeService(EmployeeRepository employees) {
        this.employees = employees;
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
