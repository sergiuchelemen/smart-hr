package ro.smarthr.document;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;

/** Tipul se stabilește din conținut (nu din extensie sau Content-Type trimis de client). */
final class DocumentContentValidator {

    static final String PDF = "application/pdf";
    static final String TXT = "text/plain";
    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    private DocumentContentValidator() {
    }

    static String detect(byte[] b) {
        if (b == null || b.length == 0) {
            throw invalid();
        }
        if (startsWithPdf(b)) {
            return PDF;
        }
        for (byte x : b) {
            if (x == 0) {
                throw invalid();
            }
        }
        try {
            StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b));
        } catch (CharacterCodingException e) {
            throw invalid();
        }
        return TXT;
    }

    private static boolean startsWithPdf(byte[] b) {
        if (b.length < PDF_MAGIC.length) {
            return false;
        }
        for (int i = 0; i < PDF_MAGIC.length; i++) {
            if (b[i] != PDF_MAGIC[i]) {
                return false;
            }
        }
        return true;
    }

    /** Extensia (.pdf / .txt) trebuie să corespundă tipului detectat din conținut. */
    static void checkExtension(String sanitizedName, String detectedType) {
        String lower = sanitizedName.toLowerCase(java.util.Locale.ROOT);
        boolean ok = (lower.endsWith(".pdf") && PDF.equals(detectedType))
            || (lower.endsWith(".txt") && TXT.equals(detectedType));
        if (!ok) {
            throw invalid();
        }
    }

    static String sanitizeName(String original) {
        String n = original == null ? "" : original;
        int cut = Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\'));
        n = n.substring(cut + 1);
        StringBuilder sb = new StringBuilder();
        n.codePoints().filter(cp -> !Character.isISOControl(cp) && cp != '"' && cp != 0x2028 && cp != 0x2029
            && Character.isDefined(cp)).forEach(sb::appendCodePoint);
        n = sb.toString().trim();
        if (n.codePointCount(0, n.length()) > 150) {
            int dot = n.lastIndexOf('.');
            String ext = dot >= 0 && n.length() - dot <= 5 ? n.substring(dot) : "";
            String base = n.substring(0, dot >= 0 && !ext.isEmpty() ? dot : n.length());
            n = base.substring(0, base.offsetByCodePoints(0, 150 - ext.length())).trim() + ext;
        }
        return n.isEmpty() || n.equals(".") || n.equals("..") ? "document" : n;
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, Messages.DOCUMENT_INVALID_FILE);
    }
}
