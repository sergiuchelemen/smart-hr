package ro.smarthr.tenancy.mongo;

import org.bson.Document;
import org.springframework.data.mongodb.core.mapping.event.BeforeSaveCallback;
import org.springframework.stereotype.Component;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;
import org.springframework.http.HttpStatus;

/** Respinge orice document TenantScoped cu companyId lipsă sau diferit de tenantul curent. */
@Component
class TenantScopedSaveGuard implements BeforeSaveCallback<TenantScoped> {

    @Override
    public TenantScoped onBeforeSave(TenantScoped entity, Document document, String collection) {
        if (entity.getCompanyId() == null || !entity.getCompanyId().equals(TenantMongoOperations.currentCompanyId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        return entity;
    }
}
