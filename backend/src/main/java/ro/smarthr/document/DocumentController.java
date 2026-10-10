package ro.smarthr.document;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Citirea: orice utilizator de companie (tip tenant verificat în serviciu), cu vizibilitate; scrierea: DOCUMENT_MANAGE. */
@RestController
public class DocumentController {

    public record MetaRequest(@NotBlank @Size(max = 150) String title, @Size(max = 500) String description,
                              @NotBlank @Size(max = 50) String category, @NotNull DocumentVisibility visibility) {
    }

    public record DocumentResponse(String id, String title, String description, String category,
                                   DocumentVisibility visibility, String fileName, String contentType,
                                   long sizeBytes, int version, Instant createdAt, Instant updatedAt) {
        static DocumentResponse of(LibraryDocument d) {
            return new DocumentResponse(d.getId().toString(), d.getTitle(), d.getDescription(), d.getCategory(),
                d.getVisibility(), d.getFileName(), d.getContentType(), d.getSizeBytes(), d.getVersion(),
                d.getCreatedAt(), d.getUpdatedAt());
        }
    }

    public record PageResponse(List<DocumentResponse> items, int page, int size, long totalElements) {
    }

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @GetMapping("/api/documents")
    @PreAuthorize("isAuthenticated()")
    public PageResponse list(@RequestParam(required = false) String q, @RequestParam(required = false) String category,
                             @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        DocumentService.Page p = service.list(q, category, page, size);
        return new PageResponse(p.items().stream().map(DocumentResponse::of).toList(), p.page(), p.size(),
            p.totalElements());
    }

    @GetMapping("/api/documents/categories")
    @PreAuthorize("isAuthenticated()")
    public List<DocumentService.CategoryCount> categories() {
        return service.categories();
    }

    @GetMapping("/api/documents/{id}")
    @PreAuthorize("isAuthenticated()")
    public DocumentResponse get(@PathVariable String id) {
        return DocumentResponse.of(service.get(id));
    }

    @GetMapping("/api/documents/{id}/content")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> content(@PathVariable String id) {
        return file(service.content(id), false);
    }

    @GetMapping("/api/documents/{id}/download")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> download(@PathVariable String id) {
        return file(service.content(id), true);
    }

    private static ResponseEntity<byte[]> file(DocumentService.Content c, boolean attachment) {
        String encoded = URLEncoder.encode(c.fileName(), StandardCharsets.UTF_8).replace("+", "%20")
            .replace("*", "%2A").replace("'", "%27").replace("(", "%28").replace(")", "%29");
        String disposition = (attachment ? "attachment" : "inline") + "; filename*=UTF-8''" + encoded;
        return ResponseEntity.ok()
            .contentType("text/plain".equals(c.contentType()) ? MediaType.parseMediaType("text/plain;charset=UTF-8")
                : MediaType.parseMediaType(c.contentType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "sandbox; default-src 'none'")
            .cacheControl(CacheControl.noStore().cachePrivate())
            .contentLength(c.bytes().length)
            .body(c.bytes());
    }

    @PostMapping(value = "/api/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_MANAGE')")
    public DocumentResponse create(@RequestPart("file") MultipartFile file, @Valid @RequestPart("meta") MetaRequest meta) {
        return DocumentResponse.of(service.create(file, meta.title(), meta.description(), meta.category(),
            meta.visibility()));
    }

    @PutMapping("/api/documents/{id}")
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_MANAGE')")
    public DocumentResponse update(@PathVariable String id, @Valid @RequestBody MetaRequest meta) {
        return DocumentResponse.of(service.updateMeta(id, meta.title(), meta.description(), meta.category(),
            meta.visibility()));
    }

    @PutMapping(value = "/api/documents/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_MANAGE')")
    public DocumentResponse replace(@PathVariable String id, @RequestPart("file") MultipartFile file) {
        return DocumentResponse.of(service.replaceFile(id, file));
    }

    @DeleteMapping("/api/documents/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_MANAGE')")
    public void delete(@PathVariable String id) {
        service.delete(id);
    }
}
