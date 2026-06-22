-- ============================================================
-- Migration 053 — Role permission matrix (Admin Panel → Permissions)
-- ============================================================
-- A role × action → scope matrix that powers the RBAC matrix UI. This is the
-- configurable/declared access model; the existing per-user `permission_rules`
-- table is a separate resource-level ACL. Scope vocabulary: none | own | vessel |
-- org | full. (Not yet enforced at the data layer — descriptive + editable.)

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text NOT NULL,
  action     text NOT NULL,
  scope      text NOT NULL DEFAULT 'none',
  resource   text NOT NULL DEFAULT 'platform',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, action)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_role_permissions ON public.role_permissions;
CREATE POLICY read_role_permissions ON public.role_permissions FOR SELECT
  USING ((select auth.role()) = 'authenticated');

-- Seed the default matrix (idempotent).
INSERT INTO public.role_permissions (role, action, scope)
SELECT r.role, a.action,
  CASE
    WHEN r.role = 'global_admin' THEN 'full'
    WHEN r.role = 'org_admin' THEN CASE a.action WHEN 'leo_briefings' THEN 'full' ELSE 'org' END
    WHEN r.role = 'jls_staff' THEN CASE a.action
      WHEN 'view' THEN 'full' WHEN 'create' THEN 'full' WHEN 'edit' THEN 'full'
      WHEN 'leo_briefings' THEN 'full' ELSE 'none' END
    WHEN r.role = 'captain' THEN CASE a.action
      WHEN 'view' THEN 'vessel' WHEN 'create' THEN 'vessel' WHEN 'edit' THEN 'vessel'
      WHEN 'approve' THEN 'vessel' WHEN 'leo_briefings' THEN 'vessel' ELSE 'none' END
    WHEN r.role = 'crew_member' THEN CASE a.action
      WHEN 'view' THEN 'own' WHEN 'leo_briefings' THEN 'own' ELSE 'none' END
    WHEN r.role = 'supplier' THEN CASE a.action
      WHEN 'view' THEN 'own' WHEN 'create' THEN 'own' WHEN 'edit' THEN 'own' ELSE 'none' END
    WHEN r.role = 'owner' THEN CASE a.action
      WHEN 'view' THEN 'vessel' WHEN 'finance' THEN 'vessel' WHEN 'leo_briefings' THEN 'vessel' ELSE 'none' END
    ELSE 'none'
  END
FROM (VALUES ('global_admin'),('org_admin'),('jls_staff'),('captain'),('crew_member'),('supplier'),('owner')) AS r(role)
CROSS JOIN (VALUES ('view'),('create'),('edit'),('approve'),('finance'),('manage_users'),('admin_panel'),('audit_log'),('leo_briefings')) AS a(action)
ON CONFLICT (role, action) DO NOTHING;
