use serde_json::{json, Value};

pub const BILLING_PLANS_SETTING_KEY: &str = "billing_plans";

pub fn normalize_plan_key(plan: Option<&str>) -> &'static str {
    match plan {
        Some("starter") => "starter",
        Some("pro") => "pro",
        _ => "free",
    }
}

pub fn default_plans_record() -> Value {
    json!({
        "free": {
            "key": "free",
            "label": "Free",
            "aiCallsLimit": 100,
            "dailyWorkflowEnabled": false,
            "seatLimit": 2,
            "priceZmw": 0,
            "features": ["100 AI calls/mo", "2 seats", "1 workspace"],
            "highlight": false,
            "tenantLimit": 1
        },
        "starter": {
            "key": "starter",
            "label": "Starter",
            "aiCallsLimit": 500,
            "dailyWorkflowEnabled": true,
            "seatLimit": 10,
            "priceZmw": 375,
            "features": ["500 AI calls/mo", "10 seats", "Daily workflow", "Approvals & audit"],
            "highlight": true,
            "tenantLimit": 3
        },
        "pro": {
            "key": "pro",
            "label": "Pro",
            "aiCallsLimit": null,
            "dailyWorkflowEnabled": true,
            "seatLimit": null,
            "priceZmw": 875,
            "features": ["Unlimited AI", "Unlimited seats", "Priority support"],
            "highlight": false,
            "tenantLimit": null
        }
    })
}

pub fn plans_list(record: &Value) -> Vec<Value> {
    ["free", "starter", "pro"]
        .iter()
        .filter_map(|key| record.get(key).cloned())
        .collect()
}

pub fn get_plan(record: &Value, key: &str) -> Value {
    let plan_key = normalize_plan_key(Some(key));
    record.get(plan_key).cloned().unwrap_or_else(|| {
        default_plans_record()
            .get(plan_key)
            .cloned()
            .unwrap_or(json!({}))
    })
}

pub fn get_plan_price_zmw(record: &Value, key: &str) -> i64 {
    get_plan(record, key)
        .get("priceZmw")
        .and_then(|v| v.as_i64())
        .unwrap_or(0)
}

pub fn merge_stored_plans(stored: &Value) -> Value {
    let mut out = default_plans_record();
    let Some(obj) = stored.as_object() else {
        return out;
    };
    if let Value::Object(base) = &mut out {
        for (key, patch) in obj {
            if let Some(existing) = base.get_mut(key) {
                if let (Value::Object(existing_map), Value::Object(patch_map)) = (existing, patch) {
                    for (k, v) in patch_map {
                        existing_map.insert(k.clone(), v.clone());
                    }
                    existing_map.insert("key".into(), json!(key));
                }
            }
        }
    }
    out
}
