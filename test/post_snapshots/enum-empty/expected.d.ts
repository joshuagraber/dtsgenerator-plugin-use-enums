export type EmptyOption = "" | "not-empty" | "also-not-empty";
declare namespace Components {
    namespace Schemas {
        export interface TestResponse {
            option?: "" | "not-empty" | "also-not-empty";
        }
    }
}
