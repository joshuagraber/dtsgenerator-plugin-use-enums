export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
declare namespace Components {
    namespace Schemas {
        export interface NavigationRequest {
            direction?: "UP" | "DOWN" | "LEFT" | "RIGHT";
            distance?: number;
        }
    }
}
