// src/integrations/supabase/client.ts
import {
    tenantsApi,
    brandProfilesApi,
    contentItemsApi,
    leadsApi,
    approvalRequestsApi,
    auditLogsApi,
    usersApi,
    socialAccountsApi,
    authApi,
    setAuthToken,
    getAuthToken,
} from "@/lib/api";

// ----------------------------------------------------------------------
// Auth compatibility
// ----------------------------------------------------------------------
type AuthChangeCallback = (event: string, session: any) => void;
const authListeners: AuthChangeCallback[] = [];

// Notify all listeners about auth change
const notifyAuthListeners = (event: string, session: any) => {
    authListeners.forEach((cb) => cb(event, session));
};

// Helper to build session object from token and user
const buildSession = async () => {
    const token = getAuthToken();
    if (!token) return null;
    try {
        const user = await authApi.getMe();
        return {
            access_token: token,
            user: { id: user.id, email: user.email, ...user },
        };
    } catch {
        return null;
    }
};

const supabaseAuth = {
    getSession: async () => {
        const session = await buildSession();
        return { data: { session }, error: null };
    },
    getUser: async () => {
        const token = getAuthToken();
        if (!token) return { data: { user: null }, error: null };
        try {
            const user = await authApi.getMe();
            return { data: { user }, error: null };
        } catch (err: any) {
            return { data: { user: null }, error: err };
        }
    },
    signOut: async () => {
        try {
            await authApi.logout();
        } catch { }
        setAuthToken(null);
        notifyAuthListeners("SIGNED_OUT", null);
        return { error: null };
    },
    onAuthStateChange: (callback: AuthChangeCallback) => {
        // Call immediately with current session
        buildSession().then((session) => {
            callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
        });
        authListeners.push(callback);
        // Listen to localStorage changes (token changes)
        const handler = () => {
            buildSession().then((session) => {
                callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
            });
        };
        window.addEventListener("storage", handler);
        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        const idx = authListeners.indexOf(callback);
                        if (idx !== -1) authListeners.splice(idx, 1);
                        window.removeEventListener("storage", handler);
                    },
                },
            },
        };
    },
};

// ----------------------------------------------------------------------
// Query builder that mimics Supabase's fluent interface
// ----------------------------------------------------------------------
type Filter = { column: string; operator: "eq" | "in"; value: any };

function camelCase(snake: string): string {
    return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

class SupabaseQueryBuilder {
    private table: string;
    private filters: Filter[] = [];
    private selectColumns: string = "*";
    private orderBy: { column: string; ascending: boolean } | null = null;

    constructor(table: string) {
        this.table = table;
    }

    select(columns: string = "*") {
        this.selectColumns = columns;
        return this;
    }

    eq(column: string, value: any) {
        this.filters.push({ column, operator: "eq", value });
        return this;
    }

    in(column: string, values: any[]) {
        this.filters.push({ column, operator: "in", value: values });
        return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
        this.orderBy = { column, ascending: options?.ascending ?? true };
        return this;
    }

    // Execute the query – returns a Promise that resolves to { data, error }
    then<T = any>(onFulfilled?: (value: { data: T; error: null }) => void, onRejected?: (reason: any) => void) {
        return this.execute().then(onFulfilled, onRejected);
    }

    private async execute() {
        try {
            let rawData: any[] = [];
            // Map table name to the corresponding API call
            switch (this.table) {
                case "tenants":
                    rawData = await this.fetchAll(tenantsApi.findAll);
                    break;
                case "brand_profiles":
                    rawData = await this.fetchAll(brandProfilesApi.findAll);
                    break;
                case "content_items":
                    rawData = await this.fetchAll(contentItemsApi.findAll);
                    break;
                case "leads":
                    rawData = await this.fetchAll(leadsApi.findAll);
                    break;
                case "approval_requests":
                    rawData = await this.fetchAll(approvalRequestsApi.findAll);
                    break;
                case "audit_logs":
                    rawData = await this.fetchAll(auditLogsApi.findAll);
                    break;
                case "users":
                    const usersRes = await usersApi.getUsers();
                    rawData = usersRes.data || usersRes;
                    break;
                case "social_accounts":
                    rawData = await this.fetchAll(socialAccountsApi.getMyAccounts);
                    break;
                // Add other tables as needed – you can extend this list
                default:
                    console.warn(`Supabase compatibility: table "${this.table}" not mapped yet. Returning empty array.`);
                    rawData = [];
            }

            // Apply filters (client-side for simplicity)
            let filtered = rawData;
            for (const filter of this.filters) {
                if (filter.operator === "eq") {
                    filtered = filtered.filter((item) => {
                        const val = item[filter.column] ?? item[camelCase(filter.column)];
                        return val === filter.value;
                    });
                } else if (filter.operator === "in") {
                    filtered = filtered.filter((item) => {
                        const val = item[filter.column] ?? item[camelCase(filter.column)];
                        return filter.value.includes(val);
                    });
                }
            }

            // Apply ordering
            if (this.orderBy) {
                filtered.sort((a, b) => {
                    const aVal = a[this.orderBy!.column];
                    const bVal = b[this.orderBy!.column];
                    if (aVal < bVal) return this.orderBy!.ascending ? -1 : 1;
                    if (aVal > bVal) return this.orderBy!.ascending ? 1 : -1;
                    return 0;
                });
            }

            // If selectColumns is not "*", we could project, but ignore for now
            return { data: filtered, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    }

    // Helper to fetch all records, handling possible pagination or nested responses
    private async fetchAll(apiCall: () => Promise<any>) {
        const result = await apiCall();
        // If the API returns an object with a "data" field, extract it
        if (result && typeof result === "object" && "data" in result) {
            return result.data;
        }
        // If it's an array, return as-is
        if (Array.isArray(result)) {
            return result;
        }
        // Otherwise wrap in array
        return [result];
    }

    // Insert, update, delete stubs – implement as needed
    insert(data: any) {
        // You can implement this by calling the corresponding create API
        console.warn("supabase.from(...).insert() not implemented yet");
        return Promise.resolve({ data: null, error: null });
    }
    update(data: any) {
        console.warn("supabase.from(...).update() not implemented yet");
        return Promise.resolve({ data: null, error: null });
    }
    delete() {
        console.warn("supabase.from(...).delete() not implemented yet");
        return Promise.resolve({ data: null, error: null });
    }
}

// ----------------------------------------------------------------------
// Main supabase client
// ----------------------------------------------------------------------
export const supabase = {
    auth: supabaseAuth,
    from: (table: string) => new SupabaseQueryBuilder(table),
};