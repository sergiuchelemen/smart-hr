package ro.smarthr.iam;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Emails;
import ro.smarthr.common.Messages;
import ro.smarthr.platform.CompanyRepository;

/**
 * Ordinea verificărilor la modificări: 403 de privilegiu/auto-modificare (fără citirea țintei), lock pe rândul
 * companiei, țintă (404), id-uri din body (400), dominanță/anti-escaladare (403), invarianți (409), scriere.
 */
@Service
public class UserService {

    private final UserRepository users;
    private final RoleRepository roles;
    private final CompanyRepository companies;
    private final PasswordEncoder encoder;
    private final CurrentUserPrivileges currentUser;

    public UserService(UserRepository users, RoleRepository roles, CompanyRepository companies,
                       PasswordEncoder encoder, CurrentUserPrivileges currentUser) {
        this.users = users;
        this.roles = roles;
        this.companies = companies;
        this.encoder = encoder;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<UserController.UserResponse> list() {
        CurrentUserPrivileges.Caller caller = currentUser.load();
        return users.findAllWithRoles().stream().map(u -> toResponse(u, caller))
            .sorted(Comparator.comparing(UserController.UserResponse::email)).toList();
    }

    @Transactional
    public UserController.UserResponse create(String email, String password, List<UUID> roleIds) {
        currentUser.load();
        String hash = encoder.encode(password);
        CurrentUserPrivileges.Caller caller = lockAndReload();
        String normalized = Emails.normalize(email);
        Set<Role> found = resolveRoles(roleIds);
        // Anti-escaladare: privilegiile rolurilor atribuite trebuie incluse în privilegiile actuale ale apelantului
        // (acoperă și rolurile de sistem, ex. HR_ADMIN).
        found.forEach(r -> requireDominates(caller, r.getPermissions()));
        if (users.existsByEmail(normalized)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.USER_EMAIL_TAKEN);
        }
        return toResponse(users.saveAndFlush(new AppUser(normalized, hash, found)), caller);
    }

    @Transactional
    public UserController.UserResponse updateRoles(UUID id, List<UUID> roleIds) {
        precheck(id);
        CurrentUserPrivileges.Caller caller = lockAndReload();
        AppUser target = findTarget(id);
        Set<Role> newRoles = resolveRoles(roleIds);
        requireDominates(caller, privileges(target));
        newRoles.forEach(r -> requireDominates(caller, r.getPermissions()));
        guardLastAdmin(target, target.isEnabled(), newRoles.stream().anyMatch(Role::isHrAdmin));
        target.replaceRoles(newRoles);
        return toResponse(users.saveAndFlush(target), caller);
    }

    @Transactional
    public UserController.UserResponse updateEnabled(UUID id, boolean enabled) {
        precheck(id);
        CurrentUserPrivileges.Caller caller = lockAndReload();
        AppUser target = findTarget(id);
        requireDominates(caller, privileges(target));
        guardLastAdmin(target, enabled, target.getRoles().stream().anyMatch(Role::isHrAdmin));
        target.setEnabled(enabled);
        return toResponse(users.saveAndFlush(target), caller);
    }

    @Transactional
    public void updatePassword(UUID id, String password) {
        precheck(id);
        String hash = encoder.encode(password); // înainte de lock: BCrypt e scump
        CurrentUserPrivileges.Caller caller = lockAndReload();
        AppUser target = findTarget(id);
        requireDominates(caller, privileges(target));
        target.changePassword(hash);
        users.saveAndFlush(target);
    }

    /** Apelant valid (403) și nu e ținta (403), fără a citi ținta. */
    private void precheck(UUID targetId) {
        CurrentUserPrivileges.Caller caller = currentUser.load();
        if (caller.userId().equals(targetId)) {
            throw forbidden();
        }
    }

    /** Lock pe rândul companiei, apoi reîncărcarea apelantului (privilegiile pot fi schimbat cât s-a așteptat lock-ul). */
    private CurrentUserPrivileges.Caller lockAndReload() {
        companies.findByIdForUpdate(CurrentUserPrivileges.companyIdFromToken()).orElseThrow(UserService::forbidden);
        CurrentUserPrivileges.Caller caller = currentUser.load();
        // Privilegiul endpoint-ului se reverifică din valorile proaspete (poate fi retras cât s-a așteptat lock-ul).
        if (!caller.permissions().contains("USER_MANAGE")) {
            throw forbidden();
        }
        return caller;
    }

    private AppUser findTarget(UUID id) {
        // Filtrul de tenant face ca userii altor companii să nu fie găsiți.
        return users.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND));
    }

    private Set<Role> resolveRoles(List<UUID> roleIds) {
        Set<UUID> ids = new HashSet<>(roleIds);
        // Filtrul de tenant face ca rolurile din alte companii să nu fie găsite.
        List<Role> found = roles.findAllById(ids);
        if (found.size() != ids.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        return new HashSet<>(found);
    }

    /** Invariant: după modificare rămâne cel puțin un HR_ADMIN de sistem activ. */
    private void guardLastAdmin(AppUser target, boolean enabledAfter, boolean adminAfter) {
        boolean activeAdminNow = target.isEnabled() && target.getRoles().stream().anyMatch(Role::isHrAdmin);
        if (activeAdminNow && !(enabledAfter && adminAfter) && users.countActiveAdmins() <= 1) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.LAST_ADMIN);
        }
    }

    private static Set<String> privileges(AppUser u) {
        return u.getRoles().stream().flatMap(r -> r.getPermissions().stream()).collect(Collectors.toSet());
    }

    private static void requireDominates(CurrentUserPrivileges.Caller caller, Set<String> required) {
        if (!caller.permissions().containsAll(required)) {
            throw forbidden();
        }
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
    }

    private static UserController.UserResponse toResponse(AppUser u, CurrentUserPrivileges.Caller caller) {
        boolean self = u.getId().equals(caller.userId());
        boolean manageable = !self && caller.permissions().containsAll(privileges(u));
        return new UserController.UserResponse(u.getId(), u.getEmail(), u.isEnabled(),
            u.getRoles().stream().map(r -> new UserController.RoleRef(r.getId(), r.getName()))
                .sorted(Comparator.comparing(UserController.RoleRef::name)).toList(),
            self, manageable);
    }
}
