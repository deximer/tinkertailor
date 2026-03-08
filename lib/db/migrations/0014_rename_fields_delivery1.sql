-- Delivery 1: Field renames for data model consistency
-- is_first_leaf → is_anchor, stage → design_stage, component_fabric_categories → component_fabric_rules

-- 1. Rename is_first_leaf → is_anchor on component_types
ALTER TABLE component_types RENAME COLUMN is_first_leaf TO is_anchor;

-- 2. Rename stage → design_stage on component_types
ALTER TABLE component_types RENAME COLUMN stage TO design_stage;

-- 3. Rename component_fabric_categories table → component_fabric_rules
ALTER TABLE component_fabric_categories RENAME TO component_fabric_rules;

-- 4. Rename fabric_skin_category_id → fabric_category_id on component_fabric_rules
ALTER TABLE component_fabric_rules RENAME COLUMN fabric_skin_category_id TO fabric_category_id;
