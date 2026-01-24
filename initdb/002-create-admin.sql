-- Create default admin user (guacadmin / guacadmin)
-- Password hash is SHA-256 of 'guacadmin' with salt

INSERT INTO guacamole_entity (name, type) VALUES ('guacadmin', 'USER')
ON CONFLICT DO NOTHING;

INSERT INTO guacamole_user (entity_id, password_hash, password_salt, password_date)
SELECT
    entity_id,
    decode('CA458A7D494E3BE824F5E1E175A1556C0F8EEF2C2D7DF3633BEC4A29C4411960', 'hex'),
    decode('FE24ADC5E11E2B25288D1704ABE67A79E342ECC26064CE69C5B3177795A82264', 'hex'),
    CURRENT_TIMESTAMP
FROM guacamole_entity WHERE name = 'guacadmin' AND type = 'USER'
ON CONFLICT DO NOTHING;

-- Grant all system permissions to admin
INSERT INTO guacamole_system_permission (entity_id, permission)
SELECT entity_id, permission::guacamole_system_permission_type
FROM (
    SELECT entity_id, unnest(ARRAY['CREATE_CONNECTION', 'CREATE_CONNECTION_GROUP', 'CREATE_SHARING_PROFILE', 'CREATE_USER', 'CREATE_USER_GROUP', 'ADMINISTER']) AS permission
    FROM guacamole_entity WHERE name = 'guacadmin' AND type = 'USER'
) AS permissions
ON CONFLICT DO NOTHING;

-- Grant admin permission to read/update/administer own user
INSERT INTO guacamole_user_permission (entity_id, affected_user_id, permission)
SELECT e.entity_id, u.user_id, permission::guacamole_object_permission_type
FROM (
    SELECT unnest(ARRAY['READ', 'UPDATE', 'ADMINISTER']) AS permission
) AS perms
CROSS JOIN guacamole_entity e
CROSS JOIN guacamole_user u
WHERE e.name = 'guacadmin' AND e.type = 'USER'
  AND u.entity_id = e.entity_id
ON CONFLICT DO NOTHING;
