package ro.smarthr.iam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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

    public record RoleResponse(UUID id, String name, boolean system, List<String> permissions) {
        static RoleResponse from(Role r) {
            return new RoleResponse(r.getId(), r.getName(), r.isSystem(), r.getPermissions().stream().sorted().toList());
        }
    }

    private final RoleService service;

    public RoleController(RoleService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_ROLE_MANAGE')")
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
}
