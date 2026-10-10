package ro.smarthr.tenancy.mongo;

import java.util.UUID;

/** Document Mongo care aparține unei companii; orice document stocat trebuie să implementeze interfața. */
public interface TenantScoped {

    UUID getCompanyId();

    void setCompanyId(UUID companyId);
}
