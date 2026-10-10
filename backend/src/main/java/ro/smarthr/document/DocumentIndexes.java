package ro.smarthr.document;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;
import ro.smarthr.tenancy.mongo.TenantMongoOperations;

@Component
class DocumentIndexes {

    private static final Logger log = LoggerFactory.getLogger(DocumentIndexes.class);

    private final TenantMongoOperations mongo;

    DocumentIndexes(TenantMongoOperations mongo) {
        this.mongo = mongo;
    }

    @EventListener(ApplicationReadyEvent.class)
    void create() {
        try {
            mongo.ensureIndex(LibraryDocument.class, new Index().named("ix_company_category")
                .on("companyId", Direction.ASC).on("category", Direction.ASC));
            mongo.ensureIndex(LibraryDocument.class, new Index().named("ix_company_updated")
                .on("companyId", Direction.ASC).on("updatedAt", Direction.DESC));
        } catch (RuntimeException e) {
            log.error("Indecșii documentelor nu au putut fi creați: {}", e.getClass().getName());
            throw e;
        }
    }
}
