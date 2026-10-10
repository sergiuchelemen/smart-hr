package ro.smarthr.iam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
@RequestMapping("/api/roles")
public class RoleController {

    public record CreateRoleRequest(@NotBlank @Size(max = 100) String name,
                                    @NotNull @Size(max = 50) List<@NotBlank @Size(max = 64) String> permissions) {
    }

    public record UpdatePermissionsRequest(@NotNull @Size(max = 50) List<@NotBlank @Size(max = 64) String> permissions) {
    }

    public record RenameRoleRequest(@NotBlank @Size(max = 100) String name) {
    }

    /** assignable: privilegiile rolului incluse în ale apelantului; editable: poate fi redenumit/editat/șters de apelant. */
    public record RoleResponse(UUID id, String name, boolean system, List<String> permissions,
                               long userCount, boolean assignable, boolean editable) {
    }

    private final RoleService service;

    public RoleController(RoleService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_ROLE_MANAGE','PERM_USER_READ')")
    public List<RoleResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_ROLE_MANAGE')")
    public RoleResponse create(@Valid @RequestBody CreateRoleRequest request) {
        return service.create(request.name().trim(), request.permissions());
    }

    @PutMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('PERM_ROLE_MANAGE')")
    public RoleResponse updatePermissions(@PathVariable UUID id, @Valid @RequestBody UpdatePermissionsRequest request) {
        return service.updatePermissions(id, request.permissions());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_ROLE_MANAGE')")
    public RoleResponse rename(@PathVariable UUID id, @Valid @RequestBody RenameRoleRequest request) {
        return service.rename(id, request.name().trim());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERM_ROLE_MANAGE')")
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
