export type ContentType = "application/json" | "text/plain" | "application/xml";
declare namespace Components {
    namespace Schemas {
        export interface ApiRequest {
            contentType?: "application/json" | "text/plain" | "application/xml";
            body?: string;
        }
    }
}
