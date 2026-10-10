package ro.smarthr.org;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    public record DepartmentRequest(@NotBlank @Size(max = 100) String name, UUID parentId) {
    }

    public record DepartmentResponse(UUID id, String name, UUID parentId, long employeeCount, long childCount) {
    }

    private final OrgService service;

    public DepartmentController(OrgService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_EMPLOYEE_READ', 'PERM_ORG_MANAGE')")
    public List<DepartmentResponse> list() {
        return service.listDepartments();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_ORG_MANAGE')")
    public DepartmentResponse create(@Valid @RequestBody DepartmentRequest request) {
        return service.createDepartment(request.name(), request.parentId());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_ORG_MANAGE')")
    public DepartmentResponse update(@PathVariable UUID id, @Valid @RequestBody DepartmentRequest request) {
        return service.updateDepartment(id, request.name(), request.parentId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERM_ORG_MANAGE')")
    public void delete(@PathVariable UUID id) {
        service.deleteDepartment(id);
    }
}
