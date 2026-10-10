package ro.smarthr.employee;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    /** Fără companyId: compania vine exclusiv din token. Câmpurile necunoscute sunt ignorate. */
    public record EmployeeRequest(@NotBlank @Size(max = 100) String firstName,
                                  @NotBlank @Size(max = 100) String lastName,
                                  @Email @Size(max = 254) String workEmail,
                                  @Size(max = 150) String jobTitle,
                                  @Size(max = 150) String department,
                                  @ValidHireDate LocalDate hireDate) {
    }

    public record EmployeeResponse(UUID id, String firstName, String lastName, String workEmail, String jobTitle,
                                   String department, LocalDate hireDate) {
        static EmployeeResponse from(Employee e) {
            return new EmployeeResponse(e.getId(), e.getFirstName(), e.getLastName(), e.getWorkEmail(),
                e.getJobTitle(), e.getDepartment(), e.getHireDate());
        }
    }

    public record PageResponse(List<EmployeeResponse> items, int page, int size, long totalElements) {
    }

    private final EmployeeService service;

    public EmployeeController(EmployeeService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_READ')")
    public PageResponse list(@RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_READ')")
    public EmployeeResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    public EmployeeResponse create(@Valid @RequestBody EmployeeRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    public EmployeeResponse update(@PathVariable UUID id, @Valid @RequestBody EmployeeRequest request) {
        return service.update(id, request);
    }
}
