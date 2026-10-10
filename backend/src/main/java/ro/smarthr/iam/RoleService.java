package ro.smarthr.iam;

import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;
import ro.smarthr.platform.CompanyRepository;

/**
 * Ordinea verificărilor: 403 de privilegiu/rol propriu (fără citirea țintei), lock pe rândul companiei,
 * țintă (404), validarea body (400), dominanță (403), invarianți (409), scriere.
 */
@Service
public class RoleService {

    private final RoleRepository roles;
    private final PermissionRepository permissions;
    private final CompanyRepository companies;
    private final CurrentUserPrivileges currentUser;

    public RoleService(RoleRepository roles, PermissionRepository permissions, CompanyRepository companies,
                       CurrentUserPrivileges currentUser) {
        this.roles = roles;
        this.permissions = permissions;
        this.companies = companies;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<RoleController.RoleResponse> list() {
        CurrentUserPrivileges.Caller caller = currentUser.load();
        Map<UUID, Long> counts = new HashMap<>();
        roles.countUsersPerRole().forEach(row -> counts.put((UUID) row[0], (Long) row[1]));
        return roles.findAll().stream().map(r -> toResponse(r, counts.getOrDefault(r.getId(), 0L), caller))
            .sorted(Comparator.comparing(RoleController.RoleResponse::name)).toList();
    }

    @Transactional
    public RoleController.RoleResponse create(String name, List<String> permissionCodes) {
        currentUser.load();
        Set<String> codes = validate(permissionCodes);
        CurrentUserPrivileges.Caller caller = lockAndReload();
        requireIncluded(codes, caller.permissions());
        if (roles.existsByName(name)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.ROLE_NAME_TAKEN);
        }
        return toResponse(roles.saveAndFlush(new Role(name, false, codes)), 0L, caller);
    }

    @Transactional
    public RoleController.RoleResponse rename(UUID id, String name) {
        precheck(id);
        CurrentUserPrivileges.Caller caller = lockAndReload();
        Role role = findEditable(id, caller);
        if (roles.existsByNameAndIdNot(name, id)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.ROLE_NAME_TAKEN);
        }
        role.rename(name);
        return toResponse(roles.saveAndFlush(role), roles.countUsersWithRole(id), caller);
    }

    @Transactional
    public RoleController.RoleResponse updatePermissions(UUID id, List<String> permissionCodes) {
        precheck(id);
        CurrentUserPrivileges.Caller caller = lockAndReload();
        Role role = find(id);
        Set<String> codes = validate(permissionCodes);
        requireEditable(role, caller); // setul VECHI trebuie dominat de apelant
        requireIncluded(codes, caller.permissions()); // și cel NOU
        role.getPermissions().clear();
        role.getPermissions().addAll(codes);
        return toResponse(roles.saveAndFlush(role), roles.countUsersWithRole(id), caller);
    }

    @Transactional
    public void delete(UUID id) {
        precheck(id);
        CurrentUserPrivileges.Caller caller = lockAndReload();
        Role role = findEditable(id, caller);
        if (roles.existsUserWithRole(id)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.ROLE_IN_USE);
        }
        roles.delete(role);
        roles.flush();
    }

    /** Apelant valid (403) și ținta nu e rolul propriu (403), fără a citi ținta. */
    private void precheck(UUID roleId) {
        if (currentUser.load().roleIds().contains(roleId)) {
            throw forbidden();
        }
    }

    /** Lock pe rândul companiei, apoi reîncărcarea apelantului (privilegiile pot fi schimbat cât s-a așteptat lock-ul). */
    private CurrentUserPrivileges.Caller lockAndReload() {
        companies.findByIdForUpdate(CurrentUserPrivileges.companyIdFromToken()).orElseThrow(RoleService::forbidden);
        CurrentUserPrivileges.Caller caller = currentUser.load();
        // Privilegiul endpoint-ului se reverifică din valorile proaspete (poate fi retras cât s-a așteptat lock-ul).
        if (!caller.permissions().contains("ROLE_MANAGE")) {
            throw forbidden();
        }
        return caller;
    }

    private Role find(UUID id) {
        return roles.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND));
    }

    private Role findEditable(UUID id, CurrentUserPrivileges.Caller caller) {
        Role role = find(id);
        requireEditable(role, caller);
        return role;
    }

    private static void requireEditable(Role role, CurrentUserPrivileges.Caller caller) {
        if (!isEditable(role, caller)) {
            throw forbidden();
        }
    }

    private static boolean isEditable(Role role, CurrentUserPrivileges.Caller caller) {
        return !role.isSystem() && !caller.roleIds().contains(role.getId())
            && caller.permissions().containsAll(role.getPermissions());
    }

    private static RoleController.RoleResponse toResponse(Role r, long userCount, CurrentUserPrivileges.Caller caller) {
        return new RoleController.RoleResponse(r.getId(), r.getName(), r.isSystem(),
            r.getPermissions().stream().sorted().toList(), userCount,
            caller.permissions().containsAll(r.getPermissions()), isEditable(r, caller));
    }

    private static void requireIncluded(Set<String> codes, Set<String> callerPerms) {
        if (!callerPerms.containsAll(codes)) {
            throw forbidden();
        }
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
    }

    private Set<String> validate(List<String> codes) {
        Set<String> set = new HashSet<>(codes);
        Set<String> known = new HashSet<>();
        permissions.findAll().forEach(p -> known.add(p.getCode()));
        if (!known.containsAll(set)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        return set;
    }
}
