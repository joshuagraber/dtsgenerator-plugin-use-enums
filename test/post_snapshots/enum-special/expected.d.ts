export type SpecialChars = "with-dash" | "with.dot" | "with/slash" | "with@at" | "with$dollar";
declare namespace Components {
    namespace Schemas {
        export interface SpecialTest {
            special?: "with-dash" | "with.dot" | "with/slash" | "with@at" | "with$dollar";
        }
    }
}
