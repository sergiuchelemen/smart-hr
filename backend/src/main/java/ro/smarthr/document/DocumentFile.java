package ro.smarthr.document;

import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import ro.smarthr.tenancy.mongo.TenantScoped;

/** Octeții fișierului împreună cu contentType/fileName/version (servite din aceeași înregistrare); _id = id-ul documentului. Separat de metadate ca listarea să nu încarce conținutul. */
@Document("document_files")
public class DocumentFile implements TenantScoped {

    @Id
    private UUID id;
    private UUID companyId;
    private byte[] content;
    private String contentType;
    private String fileName;
    private int version;

    public DocumentFile() {
    }

    public DocumentFile(UUID id, byte[] content, String contentType, String fileName, int version) {
        this.id = id;
        this.content = content;
        this.contentType = contentType;
        this.fileName = fileName;
        this.version = version;
    }

    public String getContentType() {
        return contentType;
    }

    public String getFileName() {
        return fileName;
    }

    public int getVersion() {
        return version;
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
