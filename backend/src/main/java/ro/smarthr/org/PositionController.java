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
@RequestMapping("/api/positions")
public class PositionController {

    public record PositionRequest(@NotBlank @Size(max = 100) String name) {
    }

    public record PositionResponse(UUID id, String name, long employeeCount) {
    }

    private final OrgService service;

    public PositionController(OrgService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_EMPLOYEE_READ', 'PERM_ORG_MANAGE')")
    public List<PositionResponse> list() {
        return service.listPositions();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_ORG_MANAGE')")
    public PositionResponse create(@Valid @RequestBody PositionRequest request) {
        return service.createPosition(request.name());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_ORG_MANAGE')")
    public PositionResponse update(@PathVariable UUID id, @Valid @RequestBody PositionRequest request) {
        return service.updatePosition(id, request.name());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERM_ORG_MANAGE')")
    public void delete(@PathVariable UUID id) {
        service.deletePosition(id);
    }
}
