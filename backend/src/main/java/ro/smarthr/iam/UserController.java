package ro.smarthr.iam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
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
import ro.smarthr.common.MaxUtf8Bytes;

@RestController
@RequestMapping("/api/users")
public class UserController {

    public record CreateUserRequest(@NotBlank @Email @Size(max = 254) String email,
                                    @NotBlank @Size(min = 12) @MaxUtf8Bytes(72) String password,
                                    @NotNull @Size(max = 50) List<@NotNull UUID> roleIds) {
    }

    public record RoleRef(UUID id, String name) {
    }

    public record UpdateRolesRequest(@NotNull @Size(max = 50) List<@NotNull UUID> roleIds) {
    }

    public record UpdateEnabledRequest(@NotNull Boolean enabled) {
    }

    public record UpdatePasswordRequest(@NotBlank @Size(min = 12) @MaxUtf8Bytes(72) String password) {
    }

    /** self: e apelantul; manageable: apelantul poate modifica ținta (nu e el însuși, privilegiile ținte incluse în ale lui). */
    public record UserResponse(UUID id, String email, boolean enabled, List<RoleRef> roles,
                               boolean self, boolean manageable) {
    }

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_USER_READ')")
    public List<UserResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_USER_MANAGE')")
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        return service.create(request.email(), request.password(), request.roleIds());
    }

    @PutMapping("/{id}/roles")
    @PreAuthorize("hasAuthority('PERM_USER_MANAGE')")
    public UserResponse updateRoles(@PathVariable UUID id, @Valid @RequestBody UpdateRolesRequest request) {
        return service.updateRoles(id, request.roleIds());
    }

    @PutMapping("/{id}/enabled")
    @PreAuthorize("hasAuthority('PERM_USER_MANAGE')")
    public UserResponse updateEnabled(@PathVariable UUID id, @Valid @RequestBody UpdateEnabledRequest request) {
        return service.updateEnabled(id, request.enabled());
    }

    @PutMapping("/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERM_USER_MANAGE')")
    public void updatePassword(@PathVariable UUID id, @Valid @RequestBody UpdatePasswordRequest request) {
        service.updatePassword(id, request.password());
    }
}
