export enum ContentType {
    "application/json" = "application/json",
    "application/xml" = "application/xml",
    "text/plain" = "text/plain"
}
declare namespace Components {
    namespace Schemas {
        export interface ApiRequest {
            contentType?: ContentType;
            body?: string;
        }
    }
}
