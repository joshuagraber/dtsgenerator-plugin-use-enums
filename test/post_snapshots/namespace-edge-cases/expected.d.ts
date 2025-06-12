// Test case 1: Same enum name, different values in different namespaces
declare namespace ServiceA {
    export enum Status {
        Approved = "approved",
        Pending = "pending",
        Rejected = "rejected"
    }
    export interface Request {
        status: Company.IT.Status;
    }
}
declare namespace ServiceB {
    export enum Status {
        Active = "active",
        Inactive = "inactive",
        Suspended = "suspended"
    }
    export interface User {
        status: Company.IT.Status;
    }
}
// Test case 2: Same enum name, same values in different namespaces
declare namespace ServiceC {
    export enum Priority {
        High = "high",
        Low = "low",
        Medium = "medium"
    }
    export interface TaskC {
        priority: Components.Schemas.Priority;
    }
}
declare namespace ServiceD {
    export enum Priority {
        High = "high",
        Low = "low",
        Medium = "medium"
    }
    export interface TaskD {
        priority: Components.Schemas.Priority;
    }
}
// Test case 3: Cross-namespace references should work correctly
declare namespace ServiceE {
    export enum Category {
        External = "external",
        Internal = "internal",
        Partner = "partner"
    }
    export interface Config {
        category: Category;
        // This should reference ServiceC.Priority, not create a new enum
        defaultPriority: Components.Schemas.Priority;
    }
}
// Test case 4: Nested namespaces with same enum names
declare namespace Company {
    namespace HR {
        export enum Status {
            Hired = "hired",
            Interviewing = "interviewing",
            Rejected = "rejected"
        }
        export interface Candidate {
            status: Status;
        }
    }
    namespace IT {
        export enum Status {
            Maintenance = "maintenance",
            Offline = "offline",
            Online = "online"
        }
        export interface Server {
            status: Status;
        }
    }
}
