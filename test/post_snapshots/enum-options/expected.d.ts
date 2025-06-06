declare namespace Components {
    namespace Schemas {
        export interface StatusResponse {
            status?: "active" | "inactive" | "pending";
            priority?: "low" | "medium" | "high";
            category?: "type one" | "type two" | "type three";
        }
    }
}
export type Status = "active" | "inactive" | "pending";
export type Priority = "low" | "medium" | "high";
export type Category = "type one" | "type two" | "type three";
