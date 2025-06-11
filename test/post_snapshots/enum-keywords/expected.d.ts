export enum Keywords {
    class = "class",
    enum = "enum",
    function = "function",
    interface = "interface",
    return = "return"
}
declare namespace Components {
    namespace Schemas {
        export interface KeywordTest {
            keyword?: Keywords;
        }
    }
}
