package ro.smarthr.iam;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.TenantId;

@Entity
@Table(name = "role")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "company_id", nullable = false, updatable = false)
    private UUID companyId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "is_system", nullable = false)
    private boolean system;

    @ElementCollection
    @CollectionTable(name = "role_permission", joinColumns = @JoinColumn(name = "role_id"))
    @Column(name = "permission_code", nullable = false)
    private Set<String> permissions = new HashSet<>();

    protected Role() {
    }

    public Role(String name, boolean system, Set<String> permissions) {
        this.name = name;
        this.system = system;
        this.permissions = new HashSet<>(permissions);
    }

    public UUID getId() {
        return id;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public String getName() {
        return name;
    }

    public boolean isSystem() {
        return system;
    }

    public Set<String> getPermissions() {
        return permissions;
    }
}
