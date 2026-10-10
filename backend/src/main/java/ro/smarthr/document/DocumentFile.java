package ro.smarthr.document;

import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import ro.smarthr.tenancy.mongo.TenantScoped;

/** Octeții fișierului; _id = id-ul documentului. Separat de metadate ca listarea să nu încarce conținutul. */
@Document("document_files")
public class DocumentFile implements TenantScoped {

    @Id
    private UUID id;
    private UUID companyId;
    private byte[] content;

    public DocumentFile() {
    }

    public DocumentFile(UUID id, byte[] content) {
        this.id = id;
        this.content = content;
    }

    @Override
    public UUID getCompanyId() {
        return companyId;
    }

    @Override
    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public UUID getId() {
        return id;
    }

    public byte[] getContent() {
        return content;
    }
}
