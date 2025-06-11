export enum EmptyOption {
     = "",
    ALSO_NOT_EMPTY = "ALSO_NOT_EMPTY",
    NOT_EMPTY = "NOT_EMPTY"
}
declare namespace Components {
    namespace Schemas {
        export interface TestResponse {
            option?: EmptyOption;
        }
    }
}
