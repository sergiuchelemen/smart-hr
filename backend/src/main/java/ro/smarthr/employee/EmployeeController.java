package ro.smarthr.employee;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
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
                                  @JsonDeserialize(using = TrimmingDeserializer.class) @Email @Size(max = 254) String workEmail,
                                  @Size(max = 150) String jobTitle,
                                  @Size(max = 150) String department,
                                  @ValidHireDate LocalDate hireDate) {
    }

    /** Elimină spațiile de la capete înainte de validarea @Email. */
    static class TrimmingDeserializer extends JsonDeserializer<String> {
        @Override
        public String deserialize(JsonParser p, DeserializationContext ctx) throws java.io.IOException {
            String v = p.getValueAsString();
            return v == null ? null : v.trim();
        }
    }

    public record EmployeeResponse(UUID id, String firstName, String lastName, String workEmail, String jobTitle,
                                   String department, LocalDate hireDate, UUID userId,
                                   UUID managerId) {
        static EmployeeResponse from(Employee e) {
            return new EmployeeResponse(e.getId(), e.getFirstName(), e.getLastName(), e.getWorkEmail(),
                e.getJobTitle(), e.getDepartment(), e.getHireDate(), e.getUserId(), e.getManagerId());
        }
    }

    public record AccountRequest(UUID userId) {
    }

    public record ManagerRequest(UUID managerId) {
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

    /** Autorizarea fină (USER_MANAGE) se verifică în serviciu, din DB. */
    @PutMapping("/{id}/account")
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    public EmployeeResponse setAccount(@PathVariable UUID id, @RequestBody AccountRequest request) {
        return service.setAccount(id, request.userId());
    }

    /** Autorizarea fină (LEAVE_APPROVE_ALL) se verifică în serviciu, din DB. */
    @PutMapping("/{id}/manager")
    @PreAuthorize("hasAuthority('PERM_EMPLOYEE_WRITE')")
    public EmployeeResponse setManager(@PathVariable UUID id, @RequestBody ManagerRequest request) {
        return service.setManager(id, request.managerId());
    }
}
