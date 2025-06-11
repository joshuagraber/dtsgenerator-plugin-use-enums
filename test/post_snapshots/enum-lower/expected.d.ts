export enum Direction {
    down = "down",
    left = "left",
    right = "right",
    up = "up"
}
declare namespace Components {
    namespace Schemas {
        export interface NavigationRequest {
            direction?: Direction;
            distance?: number;
        }
    }
}
