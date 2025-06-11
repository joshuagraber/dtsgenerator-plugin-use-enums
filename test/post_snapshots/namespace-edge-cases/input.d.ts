// Test case 1: Same enum name, different values in different namespaces
declare namespace ServiceA {
    export type Status = "pending" | "approved" | "rejected";
    
    export interface Request {
        status: Status;
    }
}

declare namespace ServiceB {
    export type Status = "active" | "inactive" | "suspended";
    
    export interface User {
        status: Status;
    }
}

// Test case 2: Same enum name, same values in different namespaces
declare namespace ServiceC {
    export type Priority = "low" | "medium" | "high";
    
    export interface TaskC {
        priority: Priority;
    }
}

declare namespace ServiceD {
    export type Priority = "low" | "medium" | "high";
    
    export interface TaskD {
        priority: Priority;
    }
}

// Test case 3: Cross-namespace references should work correctly
declare namespace ServiceE {
    export type Category = "internal" | "external" | "partner";
    
    export interface Config {
        category: Category;
        // This should reference ServiceC.Priority, not create a new enum
        defaultPriority: ServiceC.Priority;
    }
}

// Test case 4: Nested namespaces with same enum names
declare namespace Company {
    namespace HR {
        export type Status = "hired" | "interviewing" | "rejected";
        
        export interface Candidate {
            status: Status;
        }
    }
    
    namespace IT {
        export type Status = "online" | "offline" | "maintenance";
        
        export interface Server {
            status: Status;
        }
    }
}
