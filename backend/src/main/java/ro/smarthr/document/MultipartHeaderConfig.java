package ro.smarthr.document;

import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Tomcat limitează antetele unei părți multipart la 512 de octeți, deci un nume de fișier Unicode lung
 * ar da 413 înainte să ajungă la sanitizare. Limita se ridică la 4 KB; numele se taie apoi la 150 de caractere.
 */
@Configuration
class MultipartHeaderConfig {

    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> multipartHeaderSize() {
        return factory -> factory.addConnectorCustomizers(connector -> connector.setMaxPartHeaderSize(4096));
    }
}
