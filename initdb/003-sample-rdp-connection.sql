-- =====================================================
-- Sample RDP Connection with Drive Redirection + Print
-- MODIFY the hostname/port/credentials for your RDP server
-- =====================================================

-- Create the connection
INSERT INTO guacamole_connection (connection_name, protocol, max_connections, max_connections_per_user)
VALUES ('My RDP Server', 'rdp', 5, 2);

-- Get the connection ID
DO $$
DECLARE
    conn_id integer;
    admin_entity_id integer;
BEGIN
    SELECT connection_id INTO conn_id FROM guacamole_connection WHERE connection_name = 'My RDP Server';
    SELECT entity_id INTO admin_entity_id FROM guacamole_entity WHERE name = 'guacadmin' AND type = 'USER';

    -- ===== RDP Connection Parameters =====
    -- CHANGE THESE to your actual RDP server details
    INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value) VALUES
        (conn_id, 'hostname', '192.168.1.100'),
        (conn_id, 'port', '3389'),
        (conn_id, 'username', 'rdp_user'),
        (conn_id, 'password', 'rdp_password'),
        (conn_id, 'domain', ''),
        (conn_id, 'security', 'nla'),
        (conn_id, 'ignore-cert', 'true'),

        -- ===== DRIVE REDIRECTION (Required for file download) =====
        (conn_id, 'enable-drive', 'true'),
        (conn_id, 'drive-name', 'GuacamoleDrive'),
        (conn_id, 'drive-path', '/drive'),
        (conn_id, 'create-drive-path', 'true'),

        -- ===== PRINTING (Virtual PDF printer in remote session) =====
        (conn_id, 'enable-printing', 'true'),
        (conn_id, 'printer-name', 'Guacamole-Printer'),

        -- ===== Display =====
        (conn_id, 'color-depth', '32'),
        (conn_id, 'width', '1920'),
        (conn_id, 'height', '1080'),
        (conn_id, 'dpi', '96'),
        (conn_id, 'resize-method', 'display-update'),

        -- ===== Performance =====
        (conn_id, 'enable-wallpaper', 'true'),
        (conn_id, 'enable-font-smoothing', 'true'),
        (conn_id, 'enable-theming', 'true');

    -- Grant connection permission to admin
    INSERT INTO guacamole_connection_permission (entity_id, connection_id, permission)
    VALUES
        (admin_entity_id, conn_id, 'READ'),
        (admin_entity_id, conn_id, 'UPDATE'),
        (admin_entity_id, conn_id, 'DELETE'),
        (admin_entity_id, conn_id, 'ADMINISTER');
END $$;
