export enum SpecialChars {
    WITH_DOLLAR = "WITH_DOLLAR",
    WITH_DASH = "WITH_DASH",
    WITH_DOT = "WITH_DOT",
    WITH_SLASH = "WITH_SLASH",
    WITH_AT = "WITH_AT"
}
declare namespace Components {
    namespace Schemas {
        export interface SpecialTest {
            special?: SpecialChars;
        }
    }
}
