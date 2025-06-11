declare namespace Components {
    namespace Schemas {
        export const enum Status {
            Active = "Active",
            Inactive = "Inactive",
            Pending = "Pending"
        }
        export const enum Priority {
            High = "High",
            Low = "Low",
            Medium = "Medium"
        }
        export const enum Category {
            Type one = "Type one",
            Type three = "Type three",
            Type two = "Type two"
        }
        export interface StatusResponse {
            status?: Status;
            priority?: Priority;
            category?: Category;
        }
    }
}
export const enum Status {
    Active = "Active",
    Inactive = "Inactive",
    Pending = "Pending"
}
export const enum Priority {
    High = "High",
    Low = "Low",
    Medium = "Medium"
}
export const enum Category {
    Type one = "Type one",
    Type three = "Type three",
    Type two = "Type two"
}
