package ro.smarthr.iam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Global, nu e tenant-scoped. */
@Entity
@Table(name = "permission")
public class Permission {

    @Id
    @Column(name = "code", length = 64)
    private String code;

    @Column(name = "description", nullable = false)
    private String description;

    protected Permission() {
    }

    public String getCode() {
        return code;
    }

    public String getDescription() {
        return description;
    }
}
