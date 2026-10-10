package ro.smarthr.iam;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;

@Service
public class RoleService {

    private final RoleRepository roles;
    private final PermissionRepository permissions;
    private final CurrentUserPrivileges currentUser;

    public RoleService(RoleRepository roles, PermissionRepository permissions, CurrentUserPrivileges currentUser) {
        this.roles = roles;
        this.permissions = permissions;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<RoleController.RoleResponse> list() {
        return roles.findAll().stream().map(RoleController.RoleResponse::from)
            .sorted(java.util.Comparator.comparing(RoleController.RoleResponse::name)).toList();
    }

    @Transactional
    public RoleController.RoleResponse create(String name, List<String> permissionCodes) {
        Set<String> codes = validate(permissionCodes);
        requireIncluded(codes, currentUser.load().permissions());
        if (roles.existsByName(name)) {
            throw new ApiException(HttpStatus.CONFLICT, "Există deja un rol cu acest nume.");
        }
        return RoleController.RoleResponse.from(roles.saveAndFlush(new Role(name, false, codes)));
    }

    @Transactional
    public RoleController.RoleResponse updatePermissions(UUID id, List<String> permissionCodes) {
        Set<String> codes = validate(permissionCodes);
        Role role = roles.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND));
        if (role.isSystem()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Rolurile de sistem nu pot fi modificate.");
        }
        CurrentUserPrivileges.Caller caller = currentUser.load();
        // Apelantul nu își poate modifica propriile roluri și nu poate acorda ce nu deține.
        if (caller.roleIds().contains(role.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        requireIncluded(codes, caller.permissions());
        role.getPermissions().clear();
        role.getPermissions().addAll(codes);
        return RoleController.RoleResponse.from(roles.saveAndFlush(role));
    }

    private static void requireIncluded(Set<String> codes, Set<String> callerPerms) {
        if (!callerPerms.containsAll(codes)) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
    }

    private Set<String> validate(List<String> codes) {
        Set<String> set = new HashSet<>(codes);
        Set<String> known = new HashSet<>();
        permissions.findAll().forEach(p -> known.add(p.getCode()));
        if (!known.containsAll(set)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cerere invalidă.");
        }
        return set;
    }
}
