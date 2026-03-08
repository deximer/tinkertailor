-- Delivery 3: Rename fabric tables and columns for consistency
-- fabric_skin_categories → fabric_categories
-- fabric_skins → fabrics
-- product_components.fabric_skin_id → fabric_id
-- silhouette_components.default_fabric_skin_id → default_fabric_id
-- component_meshes.variant → fabric_weight

ALTER TABLE fabric_skin_categories RENAME TO fabric_categories;
ALTER TABLE fabric_skins RENAME TO fabrics;

ALTER TABLE product_components RENAME COLUMN fabric_skin_id TO fabric_id;
ALTER TABLE silhouette_components RENAME COLUMN default_fabric_skin_id TO default_fabric_id;

ALTER TABLE component_meshes RENAME COLUMN variant TO fabric_weight;
