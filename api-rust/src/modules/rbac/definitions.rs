//! RBAC permission and system role definitions — mirrors `api/src/modules/auth/rbac/rbac.constants.ts`.

pub struct PermissionDef {
    pub key: &'static str,
    pub label: &'static str,
    pub module: &'static str,
}

pub const PERMISSION_DEFINITIONS: &[PermissionDef] = &[
    PermissionDef {
        key: "content.view",
        label: "View content",
        module: "content",
    },
    PermissionDef {
        key: "content.create",
        label: "Create content",
        module: "content",
    },
    PermissionDef {
        key: "content.edit",
        label: "Edit content",
        module: "content",
    },
    PermissionDef {
        key: "content.delete",
        label: "Delete content",
        module: "content",
    },
    PermissionDef {
        key: "content.approve",
        label: "Approve content",
        module: "content",
    },
    PermissionDef {
        key: "content.publish",
        label: "Publish content",
        module: "content",
    },
    PermissionDef {
        key: "leads.view",
        label: "View leads",
        module: "leads",
    },
    PermissionDef {
        key: "leads.email",
        label: "Email leads",
        module: "leads",
    },
    PermissionDef {
        key: "leads.email_bulk",
        label: "Bulk email leads",
        module: "leads",
    },
    PermissionDef {
        key: "leads.classify",
        label: "Classify leads",
        module: "leads",
    },
    PermissionDef {
        key: "leads.delete",
        label: "Delete leads",
        module: "leads",
    },
    PermissionDef {
        key: "leads.export",
        label: "Export leads",
        module: "leads",
    },
    PermissionDef {
        key: "media.view",
        label: "View media",
        module: "media",
    },
    PermissionDef {
        key: "media.upload",
        label: "Upload media",
        module: "media",
    },
    PermissionDef {
        key: "media.delete",
        label: "Delete media",
        module: "media",
    },
    PermissionDef {
        key: "templates.view",
        label: "View templates",
        module: "templates",
    },
    PermissionDef {
        key: "templates.create",
        label: "Create templates",
        module: "templates",
    },
    PermissionDef {
        key: "templates.edit",
        label: "Edit templates",
        module: "templates",
    },
    PermissionDef {
        key: "templates.delete",
        label: "Delete templates",
        module: "templates",
    },
    PermissionDef {
        key: "templates.activate",
        label: "Activate templates",
        module: "templates",
    },
    PermissionDef {
        key: "replies.view",
        label: "View replies",
        module: "replies",
    },
    PermissionDef {
        key: "replies.create",
        label: "Create replies",
        module: "replies",
    },
    PermissionDef {
        key: "replies.manage_rules",
        label: "Manage reply rules",
        module: "replies",
    },
    PermissionDef {
        key: "analytics.view",
        label: "View analytics",
        module: "analytics",
    },
    PermissionDef {
        key: "team.view",
        label: "View team",
        module: "team",
    },
    PermissionDef {
        key: "team.invite",
        label: "Invite team members",
        module: "team",
    },
    PermissionDef {
        key: "team.remove",
        label: "Remove team members",
        module: "team",
    },
    PermissionDef {
        key: "team.assign_roles",
        label: "Assign roles",
        module: "team",
    },
    PermissionDef {
        key: "team.assign_permissions",
        label: "Assign permissions",
        module: "team",
    },
    PermissionDef {
        key: "settings.view",
        label: "View settings",
        module: "settings",
    },
    PermissionDef {
        key: "settings.billing",
        label: "Manage billing",
        module: "settings",
    },
    PermissionDef {
        key: "settings.brand_brain",
        label: "Manage brand brain",
        module: "settings",
    },
    PermissionDef {
        key: "chatbot.view",
        label: "View chatbot",
        module: "chatbot",
    },
    PermissionDef {
        key: "chatbot.use",
        label: "Use chatbot playground",
        module: "chatbot",
    },
    PermissionDef {
        key: "chatbot.manage",
        label: "Manage chatbot & knowledge",
        module: "chatbot",
    },
    PermissionDef {
        key: "approvals.view",
        label: "View approvals",
        module: "approvals",
    },
    PermissionDef {
        key: "approvals.review",
        label: "Review approvals",
        module: "approvals",
    },
    PermissionDef {
        key: "audit.view",
        label: "View audit logs",
        module: "audit",
    },
    PermissionDef {
        key: "admin.roles",
        label: "Manage roles",
        module: "admin",
    },
    PermissionDef {
        key: "admin.maker_checker",
        label: "Manage maker-checker",
        module: "admin",
    },
    PermissionDef {
        key: "admin.system",
        label: "System settings & theme",
        module: "admin",
    },
    PermissionDef {
        key: "admin.super",
        label: "Platform super admin (backoffice)",
        module: "admin",
    },
];

pub const BACKOFFICE_ONLY_PERMISSIONS: &[&str] = &["admin.system", "admin.super"];

pub fn tenant_scoped_permissions() -> Vec<&'static str> {
    PERMISSION_DEFINITIONS
        .iter()
        .map(|p| p.key)
        .filter(|k| !BACKOFFICE_ONLY_PERMISSIONS.contains(k))
        .collect()
}

pub struct SystemRoleDef {
    pub name: &'static str,
    pub description: &'static str,
    pub permissions: RolePermissionSet,
}

pub enum RolePermissionSet {
    All,
    WithoutMakerChecker,
    List(&'static [&'static str]),
}

pub fn system_role_definitions() -> &'static [SystemRoleDef] {
    &[
        SystemRoleDef {
            name: "Owner",
            description: "Full access within the workspace (tenant-scoped)",
            permissions: RolePermissionSet::All,
        },
        SystemRoleDef {
            name: "Admin",
            description: "Manage team, settings, and all content",
            permissions: RolePermissionSet::WithoutMakerChecker,
        },
        SystemRoleDef {
            name: "Publisher",
            description: "Publish and approve content, manage social",
            permissions: RolePermissionSet::List(&[
                "content.view",
                "content.create",
                "content.edit",
                "content.approve",
                "content.publish",
                "leads.view",
                "leads.email",
                "leads.classify",
                "media.view",
                "media.upload",
                "templates.view",
                "templates.create",
                "templates.edit",
                "templates.activate",
                "replies.view",
                "replies.create",
                "analytics.view",
                "team.view",
                "settings.view",
                "settings.brand_brain",
                "chatbot.view",
                "chatbot.use",
                "approvals.view",
                "approvals.review",
            ]),
        },
        SystemRoleDef {
            name: "Creator",
            description: "Create and edit content drafts",
            permissions: RolePermissionSet::List(&[
                "content.view",
                "content.create",
                "content.edit",
                "leads.view",
                "media.view",
                "media.upload",
                "templates.view",
                "replies.view",
                "analytics.view",
                "team.view",
                "settings.view",
            ]),
        },
        SystemRoleDef {
            name: "Viewer",
            description: "Read-only access",
            permissions: RolePermissionSet::List(&[
                "content.view",
                "leads.view",
                "media.view",
                "templates.view",
                "replies.view",
                "analytics.view",
                "team.view",
                "settings.view",
            ]),
        },
    ]
}

pub fn permissions_for_role(role: &SystemRoleDef) -> Vec<&'static str> {
    match &role.permissions {
        RolePermissionSet::All => tenant_scoped_permissions(),
        RolePermissionSet::WithoutMakerChecker => tenant_scoped_permissions()
            .into_iter()
            .filter(|k| *k != "admin.maker_checker")
            .collect(),
        RolePermissionSet::List(keys) => keys.to_vec(),
    }
}
