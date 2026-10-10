package ro.smarthr.iam;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Emails;
import ro.smarthr.common.Messages;

@Service
public class UserService {

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;
    private final CurrentUserPrivileges currentUser;

    public UserService(UserRepository users, RoleRepository roles, PasswordEncoder encoder,
                       CurrentUserPrivileges currentUser) {
        this.users = users;
        this.roles = roles;
        this.encoder = encoder;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<UserController.UserResponse> list() {
        return users.findAll().stream().map(UserService::toResponse)
            .sorted(java.util.Comparator.comparing(UserController.UserResponse::email)).toList();
    }

    @Transactional
    public UserController.UserResponse create(String email, String password, List<UUID> roleIds) {
        String normalized = Emails.normalize(email);
        Set<UUID> ids = new HashSet<>(roleIds);
        // Filtrul de tenant face ca rolurile din alte companii să nu fie găsite.
        List<Role> found = roles.findAllById(ids);
        if (found.size() != ids.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cerere invalidă.");
        }
        // Anti-escaladare: privilegiile rolurilor atribuite trebuie incluse în privilegiile actuale ale apelantului
        // (acoperă și rolurile de sistem, ex. HR_ADMIN).
        Set<String> callerPerms = currentUser.load().permissions();
        boolean allowed = found.stream().allMatch(r -> callerPerms.containsAll(r.getPermissions()));
        if (!allowed) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        if (users.existsByEmail(normalized)) {
            throw new ApiException(HttpStatus.CONFLICT, "Există deja un utilizator cu acest email.");
        }
        AppUser saved = users.saveAndFlush(new AppUser(normalized, encoder.encode(password), new HashSet<>(found)));
        return toResponse(saved);
    }

    private static UserController.UserResponse toResponse(AppUser u) {
        return new UserController.UserResponse(u.getId(), u.getEmail(), u.isEnabled(),
            u.getRoles().stream().map(r -> new UserController.RoleRef(r.getId(), r.getName()))
                .sorted(java.util.Comparator.comparing(UserController.RoleRef::name)).toList());
    }
}
